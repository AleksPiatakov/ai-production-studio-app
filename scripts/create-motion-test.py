from pathlib import Path
import sys
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "public/assets/generated-images/luma-shot-01-draft-v1.png"
frames_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else root / ".runtime/motion-frames"
frames_dir.mkdir(parents=True, exist_ok=True)

width, height = 1280, 720
frame_count = 96
with Image.open(source) as original:
    original = original.convert("RGB")
    aspect = width / height
    for index in range(frame_count):
        progress = index / (frame_count - 1)
        zoom = 1 + (0.09 * progress)
        crop_width = int(original.width / zoom)
        crop_height = int(crop_width / aspect)
        if crop_height > original.height:
            crop_height = int(original.height / zoom)
            crop_width = int(crop_height * aspect)
        center_x = original.width * (0.50 + (0.025 * progress))
        center_y = original.height * (0.50 - (0.012 * progress))
        left = max(0, min(original.width - crop_width, int(center_x - crop_width / 2)))
        top = max(0, min(original.height - crop_height, int(center_y - crop_height / 2)))
        frame = original.crop((left, top, left + crop_width, top + crop_height)).resize((width, height), Image.Resampling.LANCZOS)
        frame.save(frames_dir / f"frame-{index:03d}.png")

print(frames_dir)
