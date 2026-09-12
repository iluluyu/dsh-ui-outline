#!/usr/bin/env bash
# Taste ballot builder: renders several optics/finish configurations of the
# liquid glass card and composes labelled comparison images for model review.
#
#   tools/ballot.sh          → /tmp/ol-harness/ballot-{light,dark}-optics.png
#                             + ballot-{light,dark}-finish.png
#
# Ballot 1 (optics strength, three lens tunings over the same card):
#   A gemini-optics  RIM=14 SCALE=10
#   B mid-optics     RIM=16 SCALE=18
#   C glm-optics     RIM=22 SCALE=26
# Ballot 2 (finish at B optics):
#   D sheen=neutral (cool tight sheen + strict Fresnel rim light)
#   E dither=off
set -euo pipefail
cd "$(dirname "$0")/.."

shoot() { # shoot <dir> <query> <out>
	local dir=$1 query=$2 out=$3
	OL_OUT_DIR="$dir" node tools/harness.mjs >/dev/null
	agent-browser open "file://$dir/index.html$query" >/dev/null
	agent-browser screenshot "$out" --full >/dev/null
}

mkdir -p /tmp/ol-harness/vA /tmp/ol-harness/vB /tmp/ol-harness/vC /tmp/ol-harness/vD /tmp/ol-harness/vE
B="/tmp/ol-harness/vB/index.html"

for theme in light dark; do
	FX_RIM=14 FX_SCALE=10 shoot /tmp/ol-harness/vA "?theme=$theme" "/tmp/ol-harness/ballot-$theme-A.png"
	FX_RIM=16 FX_SCALE=18 shoot /tmp/ol-harness/vB "?theme=$theme" "/tmp/ol-harness/ballot-$theme-B.png"
	FX_RIM=22 FX_SCALE=26 shoot /tmp/ol-harness/vC "?theme=$theme" "/tmp/ol-harness/ballot-$theme-C.png"
	shoot /tmp/ol-harness/vB "?theme=$theme&sheen=neutral" "/tmp/ol-harness/ballot-$theme-D.png"
	shoot /tmp/ol-harness/vB "?theme=$theme&dither=off" "/tmp/ol-harness/ballot-$theme-E.png"
done

python3 - <<'EOF'
from PIL import Image, ImageDraw

def card(shots, key):
	"""crop the liquid standard card (row2 col2) + its top-left corner zoom"""
	img = Image.open(f"/tmp/ol-harness/ballot-{shots}-{key}.png").convert("RGB")
	card_img = img.crop((336, 387, 636, 499))            # full card 300x112
	zoom = img.crop((330, 381, 450, 501))                # left edge + corner 120x120
	z3 = zoom.resize((360, 360), Image.LANCZOS)          # 3x
	return card_img, z3

def ballot(theme, keys, labels, out):
	rows = []
	for k in keys:
		c, z = card(theme, k)
		rows.append((c, z))
	cw, ch = 300, 112
	zs = 360
	gap = 18
	W = cw + zs + 90
	H = (len(rows)) * (max(ch, zs) + 46) + 20
	im = Image.new("RGB", (W, H), (16, 17, 20))
	d = ImageDraw.Draw(im)
	y = 20
	for (c, z), lbl in zip(rows, labels):
		d.text((10, y), lbl, fill=(240, 240, 240))
		im.paste(c, (10, y + 22))
		im.paste(z, (10 + cw + 60, y + 22))
		y += max(ch, zs) + 46
	im.save(out)
	print("wrote", out)

ballot("light", ["A", "B", "C"],
	["A: RIM=14 SCALE=10 (gemini optics)", "B: RIM=16 SCALE=18 (mid optics)", "C: RIM=22 SCALE=26 (glm optics)"],
	"/tmp/ol-harness/ballot-light-optics.png")
ballot("dark", ["A", "B", "C"],
	["A: RIM=14 SCALE=10 (gemini optics)", "B: RIM=16 SCALE=18 (mid optics)", "C: RIM=22 SCALE=26 (glm optics)"],
	"/tmp/ol-harness/ballot-dark-optics.png")
ballot("light", ["B", "D", "E"],
	["B: current warm sheen + rim light + dither", "D: neutral tight sheen + strict Fresnel rim", "E: dither OFF (B sheen)"],
	"/tmp/ol-harness/ballot-light-finish.png")
ballot("dark", ["B", "D", "E"],
	["B: current warm sheen + rim light + dither", "D: neutral tight sheen + strict Fresnel rim", "E: dither OFF (B sheen)"],
	"/tmp/ol-harness/ballot-dark-finish.png")
EOF
