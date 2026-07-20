"""Render a deterministic asset-composite preview of the in-game starting area."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
VIEW = (768, 512)
CAMERA = (376, 420)

background = Image.open(ASSETS / "parkland-hub-v2.png").convert("RGBA")
frame = background.crop((CAMERA[0], CAMERA[1], CAMERA[0] + VIEW[0], CAMERA[1] + VIEW[1]))
signs = Image.open(ASSETS / "word-signs-v2.png").convert("RGBA")
bear = Image.open(ASSETS / "bear-sprites-v2.png").convert("RGBA")

hotspots = [
    ("maskwa", 762, 575, 0),
    ("mîtos", 600, 238, 1),
    ("mînis", 946, 338, 4),
    ("kinosêw", 1090, 445, 5),
    ("nîpiy", 322, 714, 3),
    ("asiniy", 662, 870, 2),
]


def paste_sign(x: int, y: int, index: int) -> None:
    cell_w, cell_h = signs.width // 3, signs.height // 2
    left = (index % 3) * cell_w
    top = (index // 3) * cell_h
    sprite = signs.crop((left, top, left + cell_w, top + cell_h)).resize((178, 178), Image.Resampling.NEAREST)
    frame.alpha_composite(sprite, (x - 89 - CAMERA[0], y - 154 - CAMERA[1]))


for _, x, y, index in sorted(hotspots, key=lambda item: item[2]):
    if y < 674:
        paste_sign(x, y, index)

cell_w, cell_h = bear.width // 4, bear.height // 2
bear_sprite = bear.crop((2 * cell_w, 0, 3 * cell_w, cell_h)).resize((190, 190), Image.Resampling.NEAREST)
frame.alpha_composite(bear_sprite, (760 - 95 - CAMERA[0], 674 - 155 - CAMERA[1]))

for _, x, y, index in sorted(hotspots, key=lambda item: item[2]):
    if y >= 674:
        paste_sign(x, y, index)

draw = ImageDraw.Draw(frame, "RGBA")
draw.rounded_rectangle((18, 18, 750, 82), radius=5, fill=(10, 36, 27, 235), outline=(247, 214, 104, 255), width=3)
font = ImageFont.truetype("DejaVuSans-Bold.ttf", 20)
small = ImageFont.truetype("DejaVuSans-Bold.ttf", 13)
draw.text((34, 30), "TRAILHEAD DEMO", font=small, fill=(247, 214, 104, 255))
draw.text((34, 48), "Find the six picture signs · 0 found", font=font, fill=(255, 244, 207, 255))
draw.rounded_rectangle((622, 32, 730, 70), radius=3, fill=(255, 244, 207, 255), outline=(18, 36, 29, 255), width=3)
draw.text((639, 43), "WORDS 0/6", font=small, fill=(18, 36, 29, 255))

output = ROOT / "preview-gameplay-v2.png"
frame.convert("RGB").save(output, quality=95)
print(output)
