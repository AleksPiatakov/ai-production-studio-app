from pathlib import Path
import math
import sys
from PIL import Image, ImageDraw, ImageFilter

root = Path(__file__).resolve().parents[1]
source = root / "public/assets/generated-images/luma-shot-03-lit-lantern-draft-v1.png"
frames_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else root / ".runtime/lantern-motion-frames"
frames_dir.mkdir(parents=True, exist_ok=True)

width, height = 1280, 720
frame_count = 96

with Image.open(source) as original:
    original = original.convert("RGB")
    aspect = width / height
    for index in range(frame_count):
        progress = index / (frame_count - 1)
        # A slow pull-back reveals a little more of the landscape.
        zoom = 1.075 - (0.075 * progress)
        crop_width = int(original.width / zoom)
        crop_height = int(crop_width / aspect)
        if crop_height > original.height:
            crop_height = int(original.height / zoom)
            crop_width = int(crop_height * aspect)
        center_x = original.width * (0.54 - (0.012 * progress))
        center_y = original.height * (0.54 - (0.008 * progress))
        left = max(0, min(original.width - crop_width, int(center_x - crop_width / 2)))
        top = max(0, min(original.height - crop_height, int(center_y - crop_height / 2)))
        frame = original.crop((left, top, left + crop_width, top + crop_height)).resize(
            (width, height), Image.Resampling.LANCZOS
        ).convert("RGBA")

        # A subtle, deliberately limited 2.5D light pulse around the lantern.
        # It is an overlay, not simulated 3D character animation.
        pulse = (math.sin(progress * math.pi * 3 - 0.55) + 1) / 2
        glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(glow)
        lantern_x, lantern_y = int(width * 0.76), int(height * 0.66)
        radius = int(108 + pulse * 32)
        alpha = int(24 + pulse * 34)
        draw.ellipse(
            (lantern_x - radius, lantern_y - radius, lantern_x + radius, lantern_y + radius),
            fill=(255, 178, 67, alpha),
        )
        glow = glow.filter(ImageFilter.GaussianBlur(radius=42))
        frame = Image.alpha_composite(frame, glow).convert("RGB")
        frame.save(frames_dir / f"frame-{index:03d}.png", quality=95)

print(frames_dir)
