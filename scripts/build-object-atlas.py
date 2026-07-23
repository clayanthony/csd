#!/usr/bin/env python3
"""Build the 300-object runtime atlas from 25 ordered 4x3 sprite sheets.

Usage:
    python build-object-atlas.py OUTPUT.png SHEET_01.png ... SHEET_25.png

The source sheets use #ff00ff as a removable production background.  Each
resulting sprite occupies a transparent 64x64 atlas cell, ordered exactly as
the workbook rows (left-to-right, top-to-bottom, sheet 1 through sheet 25).
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


CELL_SIZE = 64
ATLAS_COLUMNS = 20
EXPECTED_SHEETS = 25
SPRITES_PER_SHEET = 12
EXPECTED_SPRITES = EXPECTED_SHEETS * SPRITES_PER_SHEET


def remove_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    cleaned = []
    for red, green, blue, _alpha in rgba.getdata():
        chroma = red >= 210 and blue >= 210 and green <= 135 and abs(red - blue) <= 55
        cleaned.append((red, green, blue, 0 if chroma else 255))
    rgba.putdata(cleaned)
    return rgba


def extract_sprite(sheet: Image.Image, column: int, row: int) -> Image.Image:
    left = round(column * sheet.width / 4)
    top = round(row * sheet.height / 3)
    right = round((column + 1) * sheet.width / 4)
    bottom = round((row + 1) * sheet.height / 3)
    cell = remove_magenta(sheet.crop((left, top, right, bottom)))
    alpha_box = cell.getchannel("A").getbbox()
    if alpha_box is None:
        raise ValueError(f"Empty sprite cell at row {row + 1}, column {column + 1}")

    sprite = cell.crop(alpha_box)
    max_extent = CELL_SIZE - 6
    scale = min(max_extent / sprite.width, max_extent / sprite.height)
    width = max(1, round(sprite.width * scale))
    height = max(1, round(sprite.height * scale))
    return sprite.resize((width, height), Image.Resampling.NEAREST)


def main() -> int:
    if len(sys.argv) != EXPECTED_SHEETS + 2:
        print(
            f"Expected an output path and {EXPECTED_SHEETS} ordered source sheets; "
            f"received {max(0, len(sys.argv) - 2)} sheets.",
            file=sys.stderr,
        )
        return 2

    output = Path(sys.argv[1])
    sheet_paths = [Path(value) for value in sys.argv[2:]]
    atlas_rows = (EXPECTED_SPRITES + ATLAS_COLUMNS - 1) // ATLAS_COLUMNS
    atlas = Image.new("RGBA", (ATLAS_COLUMNS * CELL_SIZE, atlas_rows * CELL_SIZE), (0, 0, 0, 0))

    sprite_index = 0
    for sheet_number, sheet_path in enumerate(sheet_paths, start=1):
        with Image.open(sheet_path) as source:
            sheet = source.convert("RGBA")
        for row in range(3):
            for column in range(4):
                sprite = extract_sprite(sheet, column, row)
                atlas_column = sprite_index % ATLAS_COLUMNS
                atlas_row = sprite_index // ATLAS_COLUMNS
                x = atlas_column * CELL_SIZE + (CELL_SIZE - sprite.width) // 2
                y = atlas_row * CELL_SIZE + CELL_SIZE - sprite.height - 2
                atlas.alpha_composite(sprite, (x, y))
                sprite_index += 1
        print(f"sheet {sheet_number:02d}: {sheet_path.name}")

    if sprite_index != EXPECTED_SPRITES:
        raise RuntimeError(f"Built {sprite_index} sprites instead of {EXPECTED_SPRITES}")

    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, optimize=True)
    print(f"wrote {sprite_index} sprites to {output} ({atlas.width}x{atlas.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
