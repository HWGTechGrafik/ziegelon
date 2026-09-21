"""
Erzeugt aus den gelieferten Ziegelon-Markenassets die Dateien, die die App
tatsaechlich braucht: freigestellte Logos und quadratische App-Icons.

Warum es dieses Skript gibt: die gelieferten PNGs sind vollstaendig deckend
(Alphakanal ueberall 255) auf fast weissem Grund (254,254,253) und das Symbol
ist mit 1024x964 nicht quadratisch. Auf dunklem Grund entstuende ein weisser
Kasten, und als Launcher-Icon waere das Bild verzerrt oder beschnitten.

Das Logo selbst wird dabei NICHT veraendert - keine Farben, keine Formen, keine
Proportionen. Es wird nur der Hintergrund entfernt und Rand ergaenzt.

Die Freistellung laeuft als Flutfuellung von den Bildecken aus. Nur der
zusammenhaengende Aussenbereich wird transparent; die weissen Moertelfugen und
die Tasten des Taschenrechners liegen im Inneren und bleiben erhalten. Ein
simples "alles Weisse entfernen" wuerde genau die durchloechern.

Aufruf:  python scripts/derive-brand-assets.py
Quelle:  src/assets/branding/          (unveraendert, Source of Truth)
Ziel:    src/assets/branding/derived/  und  public/icons/
"""

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets" / "branding"
DERIVED = SRC / "derived"
ICONS = ROOT / "public" / "icons"

# Markenfarben aus ziegelon_brand.json
BRAND_DARK = (0x19, 0x22, 0x2B)
BRAND_WHITE = (0xFF, 0xFF, 0xFF)

# Ab dieser Naehe zu Weiss gilt ein Pixel als Hintergrund. Grosszuegig genug
# fuer die Kantenglaettung der Vorlage, streng genug, um nicht ins Motiv zu
# laufen - wird unten gegen die Innenflaechen geprueft.
WHITE_TOLERANCE = 30


def cut_out_background(im: Image.Image) -> Image.Image:
    """Entfernt den zusammenhaengenden hellen Aussenbereich."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    def is_background(p) -> bool:
        return all(c >= 255 - WHITE_TOLERANCE for c in p[:3])

    outside = bytearray(w * h)
    queue = deque()
    for corner in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if is_background(px[corner]) and not outside[corner[1] * w + corner[0]]:
            outside[corner[1] * w + corner[0]] = 1
            queue.append(corner)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not outside[ny * w + nx]:
                if is_background(px[nx, ny]):
                    outside[ny * w + nx] = 1
                    queue.append((nx, ny))

    mask = Image.frombytes("L", (w, h), bytes(255 if b else 0 for b in outside))
    # Leichtes Weichzeichnen, damit die Kante nicht ausgefranst wirkt.
    alpha = mask.filter(ImageFilter.GaussianBlur(0.6)).point(lambda v: 255 - v)
    im.putalpha(alpha)
    return im


def square(im: Image.Image, padding: float = 0.0, background=None) -> Image.Image:
    """Zentriert das Bild auf einer quadratischen Flaeche, Seitenverhaeltnis bleibt."""
    content = max(im.size)
    canvas = int(round(content / (1 - 2 * padding))) if padding else content
    mode_bg = (*background, 255) if background else (0, 0, 0, 0)
    out = Image.new("RGBA", (canvas, canvas), mode_bg)

    scale = (canvas * (1 - 2 * padding)) / content
    target = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    resized = im.resize(target, Image.LANCZOS)
    out.alpha_composite(resized, ((canvas - target[0]) // 2, (canvas - target[1]) // 2))
    return out


def save(im: Image.Image, path: Path, size: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if size:
        im = im.resize((size, size), Image.LANCZOS)
    im.save(path)
    print(f"  {path.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}")


def main() -> None:
    logo = cut_out_background(Image.open(SRC / "Ziegelon_logo_original.png"))
    logo2x = cut_out_background(Image.open(SRC / "Ziegelon_logo_2x.png"))
    symbol = cut_out_background(Image.open(SRC / "Ziegelon_symbol_1024.png"))

    print("Freigestellte Logos:")
    save(logo, DERIVED / "Ziegelon_logo.png")
    save(logo2x, DERIVED / "Ziegelon_logo@2x.png")
    save(symbol, DERIVED / "Ziegelon_symbol.png")

    print("App-Icons (quadratisch):")
    # Normale Icons: transparent, kleiner Rand, damit das Motiv nicht klebt.
    plain = square(symbol, padding=0.06)
    save(plain, ICONS / "icon-192.png", 192)
    save(plain, ICONS / "icon-512.png", 512)
    save(plain, ICONS / "favicon-32.png", 32)

    # Maskable: Android beschneidet bis zu 20 % am Rand, deshalb viel Luft und
    # ein deckender Hintergrund.
    save(square(symbol, padding=0.22, background=BRAND_WHITE),
         ICONS / "icon-maskable-512.png", 512)

    # iOS zeigt keine Transparenz, sondern fuellt sie schwarz - deshalb deckend.
    save(square(symbol, padding=0.10, background=BRAND_WHITE),
         ICONS / "apple-touch-icon.png", 180)

    ico = square(symbol, padding=0.04)
    ico.save(ROOT / "public" / "favicon.ico",
             sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  public/favicon.ico  16/32/48")


if __name__ == "__main__":
    main()
