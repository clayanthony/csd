"""Create deterministic previews from the exact production assets used by V3."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
MAPS = [
    ("ACT 1 · HOME", "act-1-home-v3.png"),
    ("ACT 2 · LAND", "act-2-land-v3.png"),
    ("ACT 3 · TIME", "act-3-time-v3.png"),
    ("ACT 4 · COMMUNITY", "act-4-community-v3.png"),
    ("ACT 5 · MEANING", "act-5-meaning-v3.png"),
]

font_path = ASSETS / "fonts" / "balsamiq-sans-latin-700-normal.woff2"
font = ImageFont.truetype(font_path, 20)
small = ImageFont.truetype(font_path, 13)

# Five-act overview.
thumb_w, thumb_h = 460, 307
sheet = Image.new("RGB", (thumb_w * 2, thumb_h * 3), "#10251e")
draw = ImageDraw.Draw(sheet)
for index, (label, filename) in enumerate(MAPS):
    image = Image.open(ASSETS / filename).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
    x = (index % 2) * thumb_w
    y = (index // 2) * thumb_h
    sheet.paste(image, (x, y))
    draw.rectangle((x + 10, y + 10, x + 220, y + 43), fill=(10, 36, 27), outline=(247, 214, 104), width=2)
    draw.text((x + 20, y + 18), label, font=small, fill=(255, 244, 207))
sheet.save(ROOT / "preview-five-acts-v3.jpg", quality=92)

# Act 1 gameplay composite using the same sprite crop and world coordinates as the runtime.
camera = (245, 470)
frame = Image.open(ASSETS / "act-1-home-v3.png").convert("RGBA").crop((camera[0], camera[1], camera[0] + 768, camera[1] + 512))
blank_sign = Image.open(ASSETS / "blank-sign-v3.png").convert("RGBA").resize((178, 178), Image.Resampling.NEAREST)
bear_sheet = Image.open(ASSETS / "bear-sprites-v2.png").convert("RGBA")
hotspots = [(410, 640), (690, 585), (1020, 570), (1160, 720), (900, 850), (520, 850)]

for x, y in sorted(hotspots, key=lambda point: point[1]):
    frame.alpha_composite(blank_sign, (x - 89 - camera[0], y - 154 - camera[1]))

cell_w, cell_h = bear_sheet.width // 4, bear_sheet.height // 2
bear = bear_sheet.crop((2 * cell_w, 0, 3 * cell_w, cell_h)).resize((190, 190), Image.Resampling.NEAREST)
frame.alpha_composite(bear, (410 - 95 - camera[0], 736 - 155 - camera[1]))

draw = ImageDraw.Draw(frame, "RGBA")
draw.rounded_rectangle((18, 18, 750, 82), radius=5, fill=(10, 36, 27, 235), outline=(247, 214, 104, 255), width=3)
draw.text((34, 29), "ACT 1 · CHAPTER 1 · MISSION 1", font=small, fill=(247, 214, 104, 255))
draw.text((34, 49), "A Sign with No Words · find six word signs · 0/6", font=font, fill=(255, 244, 207, 255))
frame.convert("RGB").save(ROOT / "preview-gameplay-v3.jpg", quality=94)

print(ROOT / "preview-gameplay-v3.jpg")
print(ROOT / "preview-five-acts-v3.jpg")
