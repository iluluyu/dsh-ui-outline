#!/usr/bin/env python3
"""Objective pixel stats for the outline glass harness screenshots.

Pure PIL (no numpy): for each preset card crop (interior, rim excluded),
luminance mean/std, channel means and a saturation proxy; plus pairwise
mean-abs-diff between the three preset cards of a material row (how visually
distinct the preset ladder really is).

Run: python3 tools/stats.py <light.png> <dark.png>
"""
import sys
import json
from PIL import Image

CARDS = [
    ("frost.airy", 0, 120), ("frost.standard", 336, 120), ("frost.dense", 672, 120),
    ("frost.max", 1008, 120),
    ("liquid.airy", 0, 371), ("liquid.standard", 336, 371), ("liquid.dense", 672, 371),
    ("liquid.max", 1008, 371),
    ("none", 0, 621), ("frost.ios", 336, 621),
]
INSET = 12  # skip border + rim-light band


def region(img, x, y):
    return list(img.crop((x + INSET, y + INSET, x + 300 - INSET, y + 112 - INSET)).getdata())


def stats(px):
    n = len(px)
    ls = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in px]
    mean = sum(ls) / n
    std = (sum((v - mean) ** 2 for v in ls) / n) ** 0.5
    rs = sum(p[0] for p in px) / n
    gs = sum(p[1] for p in px) / n
    bs = sum(p[2] for p in px) / n
    sat = sum((max(p) - min(p)) / (max(p) + 1e-9) for p in px) / n
    return {
        "lum_mean": round(mean, 1), "lum_std": round(std, 1),
        "rgb": [round(rs, 1), round(gs, 1), round(bs, 1)],
        "sat": round(sat, 3),
    }


def diff(pa, pb):
    n = len(pa)
    return round(sum(abs(pa[i][c] - pb[i][c]) for i in range(n) for c in range(3)) / (n * 3), 2)


def main():
    out = {}
    for path, theme in ((sys.argv[1], "light"), (sys.argv[2], "dark")):
        img = Image.open(path).convert("RGB")
        regions, rows = {}, {}
        for name, x, y in CARDS:
            regions[name] = region(img, x, y)
            rows[name] = stats(regions[name])
        pairs = {}
        for mat in ("frost", "liquid"):
            for a, b in (("airy", "standard"), ("standard", "dense"), ("airy", "dense")):
                pairs[f"{mat}:{a}-{b}"] = diff(regions[f"{mat}.{a}"], regions[f"{mat}.{b}"])
        out[theme] = {"cards": rows, "ladder_diff": pairs}
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
