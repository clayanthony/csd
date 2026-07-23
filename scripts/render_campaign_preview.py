"""Render deterministic previews from the exact 300-object production assets."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
campaign_source = (ROOT / "js" / "campaign-300.js").read_text(encoding="utf-8")
campaign = json.loads(campaign_source.split("=", 1)[1].strip().removesuffix(";"))
atlas = Image.open(ASSETS / "object-sprites-300.png").convert("RGBA")
bear_sheet = Image.open(ASSETS / "bear-sprites-v2.png").convert("RGBA")

font_path = ASSETS / "fonts" / "balsamiq-sans-latin-700-normal.woff2"
font = ImageFont.truetype(font_path, 20)
small = ImageFont.truetype(font_path, 13)


def words_for_stage(stage_number: int) -> list[dict]:
    return sorted(
        (word for word in campaign["words"] if word["stage"] == stage_number),
        key=lambda word: word["slot"],
    )


def atlas_sprite(word: dict) -> Image.Image:
    index = word["sprite"]
    x = (index % 20) * 64
    y = (index // 20) * 64
    size = round(word["displaySize"])
    return atlas.crop((x, y, x + 64, y + 64)).resize((size, size), Image.Resampling.NEAREST)


def draw_board(draw: ImageDraw.ImageDraw, word: dict) -> None:
    x = round(word["board"]["x"])
    y = round(word["board"]["y"])
    draw.ellipse((x - 24, y + 2, x + 24, y + 16), fill=(12, 23, 17, 72))
    draw.rectangle((x - 15, y - 7, x - 10, y + 15), fill=(98, 66, 37, 255))
    draw.rectangle((x + 10, y - 7, x + 15, y + 15), fill=(98, 66, 37, 255))
    draw.rectangle((x - 24, y - 35, x + 24, y - 5), fill=(57, 39, 25, 255))
    draw.rectangle((x - 21, y - 32, x + 21, y - 8), fill=(183, 123, 54, 255))
    draw.ellipse((x - 6, y - 26, x + 6, y - 14), fill=(79, 96, 57, 255))


def stage_composite(stage_number: int) -> Image.Image:
    stage = campaign["stages"][stage_number - 1]
    world = campaign["worlds"][stage["world"] - 1]
    world_image = Image.open(ROOT / world["map"]).convert("RGBA")
    draw = ImageDraw.Draw(world_image, "RGBA")
    for word in words_for_stage(stage_number):
        draw_board(draw, word)
    for word in sorted(words_for_stage(stage_number), key=lambda item: item["object"]["y"]):
        sprite = atlas_sprite(word)
        x = round(word["object"]["x"] - sprite.width / 2)
        y = round(word["object"]["y"] - sprite.height)
        world_image.alpha_composite(sprite, (x, y))
    return world_image


# Five-world overview, with one representative six-object arena per world.
representative_stages = [1, 11, 21, 31, 41]
thumb_w, thumb_h = 460, 307
sheet = Image.new("RGB", (thumb_w * 2, thumb_h * 3), "#10251e")
sheet_draw = ImageDraw.Draw(sheet)
for index, stage_number in enumerate(representative_stages):
    world = campaign["worlds"][index]
    stage = campaign["stages"][stage_number - 1]
    image = stage_composite(stage_number).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
    x = (index % 2) * thumb_w
    y = (index // 2) * thumb_h
    sheet.paste(image, (x, y))
    sheet_draw.rectangle((x + 10, y + 10, x + 325, y + 55), fill=(10, 36, 27), outline=(247, 214, 104), width=2)
    sheet_draw.text((x + 20, y + 16), f"WORLD {world['number']} · {world['title'].upper()}", font=small, fill=(247, 214, 104))
    sheet_draw.text((x + 20, y + 34), f"Arena {stage_number} · {stage['title']}", font=small, fill=(255, 244, 207))
sheet.save(ROOT / "preview-five-acts-v3.jpg", quality=92)


# Arena 1 gameplay composite using the same atlas cells, map coordinates, and bear crop as runtime.
stage_number = 1
stage = campaign["stages"][stage_number - 1]
world_image = stage_composite(stage_number)
player_x, player_y = stage["spawn"]["x"], stage["spawn"]["y"]
camera_x = max(0, min(1536 - 768, player_x - 384))
camera_y = max(0, min(1024 - 512, player_y - 256))

cell_w, cell_h = bear_sheet.width // 4, bear_sheet.height // 2
bear = bear_sheet.crop((2 * cell_w, 0, 3 * cell_w, cell_h)).resize((190, 190), Image.Resampling.NEAREST)
world_image.alpha_composite(bear, (round(player_x - 95), round(player_y - 155)))
frame = world_image.crop((camera_x, camera_y, camera_x + 768, camera_y + 512))

frame_draw = ImageDraw.Draw(frame, "RGBA")
frame_draw.rounded_rectangle((18, 18, 750, 82), radius=5, fill=(10, 36, 27, 235), outline=(247, 214, 104, 255), width=3)
frame_draw.text((34, 29), "WORLD 1 · HOMEFIRE · ARENA 1", font=small, fill=(247, 214, 104, 255))
frame_draw.text((34, 49), "Bedroom Warmth · find six illustrated objects · 0/6", font=font, fill=(255, 244, 207, 255))
frame.convert("RGB").save(ROOT / "preview-gameplay-v3.jpg", quality=94)

print(ROOT / "preview-gameplay-v3.jpg")
print(ROOT / "preview-five-acts-v3.jpg")
