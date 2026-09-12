#!/usr/bin/env bash
# Taste ballot round 2 — user feedback round:
#   L) liquid·airy readability nudge (85/2 vs 85/3 vs 80/3), dark + light
#   F) frost ladder re-tune toward airier "standard" (user: too conservative):
#      F0 current 85/4·70/7·48/16  F1 90/3·80/6·55/18  F2 90/3·80/6·50/16
set -euo pipefail
cd "$(dirname "$0")/.."

shoot() { # shoot <dir> <query> <out> — preset overrides come via FP/LP env vars
	local dir=$1 query=$2 out=$3
	OL_OUT_DIR="$dir" FP="${FP-}" LP="${LP-}" node tools/harness.mjs >/dev/null
	agent-browser open "file://$dir/index.html$query" >/dev/null
	agent-browser screenshot "$out" --full >/dev/null
}

STD='[["airy",70,4],["standard",70,4],["misty",52,11]]' # placeholder, real ladders below

L0='[["airy",85,2],["standard",70,4],["misty",52,11]]'
L1='[["airy",85,3],["standard",70,4],["misty",52,11]]'
L2='[["airy",80,3],["standard",70,4],["misty",52,11]]'
F0='[["airy",85,4],["standard",70,7],["misty",48,16]]'
F1='[["airy",90,3],["standard",80,6],["misty",55,18]]'
F2='[["airy",90,3],["standard",80,6],["misty",50,16]]'

mkdir -p /tmp/ol-harness/{L0,L1,L2,F0,F1,F2}
for theme in light dark; do
	LP="$L0" FP="" shoot /tmp/ol-harness/L0 "?theme=$theme" "/tmp/ol-harness/b2-L0-$theme.png"
	LP="$L1" FP="" shoot /tmp/ol-harness/L1 "?theme=$theme" "/tmp/ol-harness/b2-L1-$theme.png"
	LP="$L2" FP="" shoot /tmp/ol-harness/L2 "?theme=$theme" "/tmp/ol-harness/b2-L2-$theme.png"
	LP="" FP="$F0" shoot /tmp/ol-harness/F0 "?theme=$theme" "/tmp/ol-harness/b2-F0-$theme.png"
	LP="" FP="$F1" shoot /tmp/ol-harness/F1 "?theme=$theme" "/tmp/ol-harness/b2-F1-$theme.png"
	LP="" FP="$F2" shoot /tmp/ol-harness/F2 "?theme=$theme" "/tmp/ol-harness/b2-F2-$theme.png"
done

python3 - <<'EOF'
from PIL import Image, ImageDraw

def crop(path, box, z=1):
	im = Image.open(path).convert("RGB")
	c = im.crop(box)
	if z != 1: c = c.resize((int(c.width*z), int(c.height*z)), Image.LANCZOS)
	return c

def compose(out, rows):
	# rows: list of (label, [images to paste left-to-right])
	gap, top = 14, 30
	W = max(sum(i.width for i in imgs) + gap*(len(imgs)+1) for _, imgs in rows) + 4
	H = sum(max(i.height for i in imgs) + top + gap for _, imgs in rows) + 10
	im = Image.new("RGB", (W, H), (16, 17, 20))
	d = ImageDraw.Draw(im)
	y = 10
	for lbl, imgs in rows:
		d.text((12, y), lbl, fill=(240, 240, 240))
		x = gap
		for img in imgs:
			im.paste(img, (x, y + top))
			x += img.width + gap
		y += max(i.height for i in imgs) + top + gap
	im.save(out)
	print("wrote", out, im.size)

# liquid row y=387, cards x=0/336/672/1008; airy = 1st cell
LY = (-6, 381, 330, 505)     # airy card with 6px context margins
LZ = (6, 445, 322, 505)         # airy card text zone (subtitle + fine text)
for theme in ["light", "dark"]:
	compose(f"/tmp/ol-harness/ballot2-L-{theme}.png", [
		("L0 current  t85 / b2",  [crop(f"/tmp/ol-harness/b2-L0-{theme}.png", LY), crop(f"/tmp/ol-harness/b2-L0-{theme}.png", LZ, 2)]),
		("L1 blur+1   t85 / b3",  [crop(f"/tmp/ol-harness/b2-L1-{theme}.png", LY), crop(f"/tmp/ol-harness/b2-L1-{theme}.png", LZ, 2)]),
		("L2 veil+5   t80 / b3",  [crop(f"/tmp/ol-harness/b2-L2-{theme}.png", LY), crop(f"/tmp/ol-harness/b2-L2-{theme}.png", LZ, 2)]),
	])

# frost row y=128 (DOM-verified), airy/std/misty = cells 1/2/3
FY = 122
def fcards(theme, tag):
	src = f"/tmp/ol-harness/b2-F{tag}-{theme}.png"
	return [crop(src, (0, FY, 330, FY+124)), crop(src, (330, FY, 660, FY+124)), crop(src, (660, FY, 990, FY+124))]
def mzoom(theme, tag):
	src = f"/tmp/ol-harness/b2-F{tag}-{theme}.png"
	return crop(src, (654, FY, 996, FY+130), 1.6)
for theme in ["light", "dark"]:
	rows = []
	for tag, lbl in [(0, "F0 current  airy 85/4 · std 70/7 · misty 48/16"),
	                 (1, "F1 airier    airy 90/3 · std 80/6 · misty 55/18"),
	                 (2, "F2 airier    airy 90/3 · std 80/6 · misty 50/16")]:
		rows.append((lbl, fcards(theme, tag) + [mzoom(theme, tag)]))
	compose(f"/tmp/ol-harness/ballot2-F-{theme}.png", rows)
EOF
