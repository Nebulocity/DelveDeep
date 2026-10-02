from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1] / "assets" / "enemies" / "xak-tsaroth"
CREATURES = [
    ("baaz-draconian", "Baaz draconian"),
    ("bozak-draconian", "Bozak draconian"),
    ("aghar-gully-dwarf", "Aghar gully dwarf"),
    ("spectral-minion", "Spectral minion"),
    ("huge-spider", "Huge spider"),
    ("ogre", "Ogre"),
    ("wraith", "Wraith"),
    ("troll", "Troll"),
    ("will-o-wisp", "Will-o-wisp"),
    ("poisonous-snake", "Poisonous snake"),
    ("khisanth-black-dragon", "Khisanth / Onyx"),
    ("catoblepas", "Catoblepas"),
    ("black-dragon-hatchling", "Black dragon hatchling"),
]


def main():
    font = ImageFont.load_default()
    cell = 154
    label = 172
    row = 165
    width = label + 5 * cell
    height = 48 + len(CREATURES) * row
    sheet = Image.new("RGB", (width, height), "#17202a")
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 12), "XAK TSAROTH | five PixelLab candidates per creature", fill="#f6e9c6", font=font)
    for n in range(5):
        draw.text((label + n * cell + 68, 30), str(n + 1), fill="#cad9e4", font=font)
    for r, (slug, name) in enumerate(CREATURES):
        top = 48 + r * row
        draw.text((12, top + 72), name, fill="#f6e9c6", font=font)
        for n in range(5):
            image_path = ROOT / slug / f"pose-{n + 1}.png"
            if not image_path.exists():
                raise FileNotFoundError(image_path)
            sprite = Image.open(image_path).convert("RGBA")
            if sprite.size != (128, 128):
                raise ValueError(f"Unexpected size for {image_path}: {sprite.size}")
            x = label + n * cell + 13
            y = top + 14
            draw.rectangle((x - 5, y - 5, x + 132, y + 132), fill="#35434e")
            sheet.paste(sprite, (x, y), sprite)
            draw.text((x + 58, top + 145), str(n + 1), fill="#aabdc8", font=font)
    sheet.save(ROOT / "preview.png")


if __name__ == "__main__":
    main()
