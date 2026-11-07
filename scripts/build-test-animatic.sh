#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/public/assets/test-animatic"
STORYBOARD="$ROOT_DIR/public/assets/storyboards/vohnyk-dlia-druha-storyboard-draft-v1.png"
WORK_DIR="$SOURCE_DIR/work"
OUTPUT="$SOURCE_DIR/vohnyk-dlia-druha-test-animatic-v1.mp4"

mkdir -p "$WORK_DIR"

if ! command -v ffmpeg >/dev/null || ! ffmpeg -version >/dev/null 2>&1; then
  echo "FFmpeg is unavailable or cannot run on this Mac. Use the DaVinci Resolve project for the test edit, then export the preview there." >&2
  exit 1
fi

say -v Lesya -r 155 -o "$WORK_DIR/voice-1.aiff" "Вечірня стежка стихла. Лума помітила, що звичне тепле світло зникло."
say -v Lesya -r 155 -o "$WORK_DIR/voice-2.aiff" "Твій ліхтарик згас. Ти не злякався?"
say -v Lesya -r 155 -o "$WORK_DIR/voice-3.aiff" "Іноді найкраща допомога — спершу уважно послухати."

for voice in "$WORK_DIR"/voice-*.aiff; do
  if ! afinfo "$voice" 2>/dev/null | grep -Eq 'estimated duration: [1-9]'; then
    echo "Local voice generation produced an empty file: $voice. Do not assemble this animatic until a working TTS or recorded voice is supplied." >&2
    exit 1
  fi
done

ffmpeg -y -loop 1 -t 5 -i "$SOURCE_DIR/luma-prelude-draft-v1.png" -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0007,1.08)':d=125:s=1280x720:fps=25" -an -c:v libx264 -pix_fmt yuv420p "$WORK_DIR/shot-1.mp4"
ffmpeg -y -loop 1 -t 5 -i "$STORYBOARD" -vf "crop=1672:313:0:0,scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0006,1.06)':d=125:s=1280x720:fps=25" -an -c:v libx264 -pix_fmt yuv420p "$WORK_DIR/shot-2.mp4"
ffmpeg -y -loop 1 -t 5 -i "$STORYBOARD" -vf "crop=1672:313:0:314,scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0005,1.05)':d=125:s=1280x720:fps=25" -an -c:v libx264 -pix_fmt yuv420p "$WORK_DIR/shot-3.mp4"
ffmpeg -y -loop 1 -t 5 -i "$STORYBOARD" -vf "crop=1672:313:0:628,scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0005,1.05)':d=125:s=1280x720:fps=25" -an -c:v libx264 -pix_fmt yuv420p "$WORK_DIR/shot-4.mp4"

printf "file '%s'\nfile '%s'\nfile '%s'\nfile '%s'\n" "$WORK_DIR/shot-1.mp4" "$WORK_DIR/shot-2.mp4" "$WORK_DIR/shot-3.mp4" "$WORK_DIR/shot-4.mp4" > "$WORK_DIR/shots.txt"
ffmpeg -y -f concat -safe 0 -i "$WORK_DIR/shots.txt" -c copy "$WORK_DIR/video.mp4"
ffmpeg -y -i "$WORK_DIR/voice-1.aiff" -i "$WORK_DIR/voice-2.aiff" -i "$WORK_DIR/voice-3.aiff" -filter_complex "[0:a]adelay=0|0[a0];[1:a]adelay=5000|5000[a1];[2:a]adelay=10500|10500[a2];[a0][a1][a2]amix=inputs=3:duration=longest,atrim=duration=20[a]" -map "[a]" -c:a aac "$WORK_DIR/audio.m4a"
ffmpeg -y -i "$WORK_DIR/video.mp4" -i "$WORK_DIR/audio.m4a" -vf "subtitles=$ROOT_DIR/assets/test-animatic/subtitles-uk.srt" -map 0:v -map 1:a -t 20 -c:v libx264 -c:a aac -movflags +faststart "$OUTPUT"

cp "$OUTPUT" "$ROOT_DIR/assets/test-animatic/vohnyk-dlia-druha-test-animatic-v1.mp4"
echo "Created $OUTPUT"
