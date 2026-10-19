from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "assets" / "images"
SIZE = 1024
IVORY = (245, 243, 234, 255)
INK = (32, 35, 31, 255)
LIME = (199, 243, 107, 255)

def draw_mark(image, color=INK, pulse=LIME):
    d = ImageDraw.Draw(image)
    cx, cy = SIZE // 2, SIZE // 2
    # Open circular timer ring, intentionally inset for adaptive icon masks.
    d.arc((180, 180, 844, 844), start=43, end=317, fill=color, width=58)
    # Distinct pulse path through the timer center.
    pts = [(235, 525), (365, 525), (430, 405), (495, 630), (572, 465), (640, 525), (790, 525)]
    d.line(pts, fill=pulse, width=56, joint="curve")
    r = 28
    for x, y in (pts[0], pts[-1]):
        d.ellipse((x-r, y-r, x+r, y+r), fill=pulse)

base = Image.new("RGBA", (SIZE, SIZE), IVORY)
draw_mark(base)
base.convert("RGB").save(OUT / "icon.png", quality=95)
base.convert("RGB").save(OUT / "favicon.png", quality=95)
# Splash is the same mark on transparent pixels so the configured splash background remains clean.
splash = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw_mark(splash)
splash.save(OUT / "splash-icon.png")
# Android adaptive foreground has no baked-in rounded mask; background is supplied separately.
foreground = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw_mark(foreground)
foreground.save(OUT / "android-icon-foreground.png")
Image.new("RGB", (SIZE, SIZE), LIME[:3]).save(OUT / "android-icon-background.png")
mono = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw_mark(mono, color=(255,255,255,255), pulse=(255,255,255,255))
mono.save(OUT / "android-icon-monochrome.png")
