import AppKit
import AVFoundation
import Foundation

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
  fputs("Usage: create-motion-video.swift <frames-directory> <output-mp4>\n", stderr)
  exit(64)
}

let framesDirectory = URL(fileURLWithPath: arguments[1])
let outputURL = URL(fileURLWithPath: arguments[2])
let width = 1280
let height = 720
let frameRate: Int32 = 24
let files = try FileManager.default.contentsOfDirectory(at: framesDirectory, includingPropertiesForKeys: nil)
  .filter { $0.pathExtension.lowercased() == "png" }
  .sorted { $0.lastPathComponent < $1.lastPathComponent }

guard !files.isEmpty else { throw NSError(domain: "MotionVideo", code: 1, userInfo: [NSLocalizedDescriptionKey: "No PNG frames found."]) }
try? FileManager.default.removeItem(at: outputURL)

let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: width,
  AVVideoHeightKey: height,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 7_000_000]
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
  kCVPixelBufferWidthKey as String: width,
  kCVPixelBufferHeightKey as String: height
])
guard writer.canAdd(input) else { throw NSError(domain: "MotionVideo", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot add video input."]) }
writer.add(input)
guard writer.startWriting() else { throw writer.error ?? NSError(domain: "MotionVideo", code: 3) }
writer.startSession(atSourceTime: .zero)

for (index, file) in files.enumerated() {
  while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
  guard let image = NSImage(contentsOf: file), let data = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: data), let cgImage = bitmap.cgImage else {
    throw NSError(domain: "MotionVideo", code: 4, userInfo: [NSLocalizedDescriptionKey: "Cannot read frame \(file.lastPathComponent)."])
  }
  var pixelBuffer: CVPixelBuffer?
  CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32ARGB, nil, &pixelBuffer)
  guard let buffer = pixelBuffer else { throw NSError(domain: "MotionVideo", code: 5) }
  CVPixelBufferLockBaseAddress(buffer, [])
  if let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue) {
    context.interpolationQuality = .high
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
  }
  CVPixelBufferUnlockBaseAddress(buffer, [])
  let presentation = CMTime(value: CMTimeValue(index), timescale: frameRate)
  guard adaptor.append(buffer, withPresentationTime: presentation) else { throw writer.error ?? NSError(domain: "MotionVideo", code: 6) }
}

input.markAsFinished()
let finished = DispatchSemaphore(value: 0)
writer.finishWriting { finished.signal() }
finished.wait()
guard writer.status == .completed else { throw writer.error ?? NSError(domain: "MotionVideo", code: 7) }
print(outputURL.path)
