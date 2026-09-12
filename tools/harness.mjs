/**
 * Visual test harness generator for dsh-ui-outline's glass materials.
 *
 * Extracts the LIVE CSS template string and the liquid-refraction FX code
 * block straight out of lib/client.js (so the harness can never drift from
 * the shipped plugin), then wraps them in a standalone page:
 *
 *   - a rich mock conversation backdrop (fine text + code block + colorful
 *     bands) painted behind everything,
 *   - a comparison grid of .ol-preview cards — frost × liquid × presets
 *     plus reference cells (official `none`, an iOS-regular anchor),
 *   - ?theme=dark flips body[data-ds-dark-theme] + the token set, because
 *     the extracted CSS keys dark rules off the body attribute.
 *
 * Per-card liquid refraction: the shipped design mounts ONE SVG filter host
 * synced to the blur slider; the grid needs several blur values at once, so
 * we clone fxHostMarkup() per distinct blur with unique filter ids and pin
 * each card's backdrop-filter inline (inline beats the extracted url rule).
 *
 * Usage: node tools/harness.mjs   → writes /tmp/ol-harness/index.html
 * Open:  file:///tmp/ol-harness/index.html[?theme=dark]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "lib", "client.js");
const OUT_DIR = process.env.OL_OUT_DIR ?? "/tmp/ol-harness";
const OUT = join(OUT_DIR, "index.html");

const src = readFileSync(SRC, "utf8");

/* --- 1. the CSS template ------------------------------------------- */
const cssMatch = src.match(/const CSS = `([\s\S]*?)`;/);
if (!cssMatch) throw new Error("CSS template not found");
const SUBST = {
	"${NAV_ID}": "dsh-outline-root",
	"${MARK_LINE_W}": "20px",
	"${REST_GROW}": "0.3",
	"${LOOSE_PITCH}": "30px",
	"${RAIL_INSET}": "6px",
	"${PREVIEW_H}": "106px",
};
let css = cssMatch[1];
for (const [k, v] of Object.entries(SUBST)) css = css.split(k).join(v);
/* the grid hosts several material roots in one page: turn the id selector
   into a class so each cell can be its own root. */
css = css.split("#dsh-outline-root").join(".ol-root");
const unresolved = css.match(/\$\{[^}]+\}/);
if (unresolved) throw new Error("unresolved interpolation in CSS: " + unresolved[0]);

/* --- 2. the FX (liquid refraction) code block ---------------------- */
const fxStart = src.indexOf("/* ===== liquid refraction");
const overlayIdx = src.indexOf("* The overlay entry.");
if (fxStart < 0 || overlayIdx < 0) throw new Error("FX block markers not found");
const fxEnd = src.lastIndexOf("/* =", overlayIdx);
let fxCode = src.slice(fxStart, fxEnd);
/* Variant knobs (taste ballot): patch the extracted constants so each build
   renders ONE optics configuration baked into the initial DOM. */
if (process.env.FX_RIM) {
	if (!/const FX_RIM = [\d.]+;/.test(fxCode)) throw new Error("FX_RIM patch point not found");
	fxCode = fxCode.replace(/const FX_RIM = [\d.]+;/, `const FX_RIM = ${process.env.FX_RIM};`);
}
if (process.env.FX_SCALE) {
	if (!/const FX_SCALE = [\d.]+;/.test(fxCode)) throw new Error("FX_SCALE patch point not found");
	fxCode = fxCode.replace(/const FX_SCALE = [\d.]+;/, `const FX_SCALE = ${process.env.FX_SCALE};`);
}

/* --- 3. live presets (single source of truth = client.js) ---------- */
const frostPresets = eval(src.match(/const FROST_PRESETS = (\[\[.*?\]\]);/)[1]);
const liquidPresets = eval(src.match(/const LIQUID_PRESETS = (\[\[.*?\]\]);/)[1]);
/* Taste-ballot knobs: full preset-ladder overrides as JSON arrays of
   [id, transparency, blur] — FP (frost) / LP (liquid). Keep transparency
   on the 5-step slider lattice so preset chips still recognize values. */
if (process.env.FP) frostPresets.splice(0, frostPresets.length, ...JSON.parse(process.env.FP));
if (process.env.LP) liquidPresets.splice(0, liquidPresets.length, ...JSON.parse(process.env.LP));

/* reference anchors shown alongside the presets (t, blur): the iOS 26
   `regular` material reverse-engineers to ~72% veil-equivalent over ~5.4px
   blur — a public calibration point for taste review. */
const REFS = [
	{ id: "none", label: "none · 官方不透明基线" },
	{ id: "ios", label: "frost · iOS regular 参考 t72/b5.4", material: "frost", t: 72, b: 5.4 },
];

const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>outline glass harness</title>
<style>
	:root {
		--dsw-alias-bg-layer-1: #ffffff;
		--dsw-alias-bg-layer-2: #f7f7f8;
		--dsw-alias-bg-layer-3: #f2f3f5;
		--dsw-alias-label-primary: #0f1115;
		--dsw-alias-label-secondary: #61666b;
		--dsw-alias-label-tertiary: #81858c;
		--dsw-alias-border-l2: rgba(0, 0, 0, .1);
		--dsw-alias-brand-primary: #4d6bfe;
		--dsw-shadow-lv2: 0 0 1px rgba(0, 0, 0, .2), 0 8px 24px rgba(0, 0, 0, .08);
		--page-bg: #f4f5f6;
		color-scheme: light;
	}
	body[data-ds-dark-theme] {
		--dsw-alias-bg-layer-1: #232324;
		--dsw-alias-bg-layer-2: #2a2a2c;
		--dsw-alias-bg-layer-3: #303033;
		--dsw-alias-label-primary: #f9fafb;
		--dsw-alias-label-secondary: #adb2b8;
		--dsw-alias-label-tertiary: #8f939a;
		--dsw-alias-border-l2: rgba(255, 255, 255, .12);
		--dsw-shadow-lv2: 0 0 1px rgba(0, 0, 0, .4), 0 8px 24px rgba(0, 0, 0, .32);
		--page-bg: #1b1b1d;
		color-scheme: dark;
	}
	* { box-sizing: border-box; }
	html, body { margin: 0; padding: 0; }
	body { background: var(--page-bg); font-family: system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }

	/* ===== the backdrop: one identical high-frequency strip behind every
	       comparison row, so frost / liquid / presets sample the SAME material
	       (controlled variable) and the rim fold always has content to bend. */
	#page { position: relative; z-index: 0; }
	.row { position: relative; }
	.strip {
		position: absolute; left: -40px; right: -40px; top: -6px; bottom: -6px;
		z-index: 0; overflow: hidden; border-radius: 12px;
		background: var(--page-bg);
	}
	.strip .rainbow {
		position: absolute; left: 0; right: 0; top: 46px; height: 64px;
		background: linear-gradient(90deg,
				#e11d48 0%, #f97316 18%, #facc15 36%, #22c55e 54%, #0ea5e9 72%, #6366f1 88%, #a855f7 100%);
		opacity: .9;
	}
	.strip .hairlines {
		position: absolute; left: 0; right: 0; top: 118px; height: 1px;
		background: repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px);
		color: var(--dsw-alias-label-tertiary); opacity: .8;
	}
	.strip .finetext {
		position: absolute; left: 10px; right: 10px; top: 124px;
		font-size: 11px; line-height: 1.5; color: var(--dsw-alias-label-secondary);
	}
	.strip .finecode {
		position: absolute; left: 10px; right: 10px; top: 0; height: 44px; overflow: hidden;
		font: 11px/1.5 ui-monospace, Consolas, monospace; white-space: pre;
	}
	body:not([data-ds-dark-theme]) .strip .finecode { color: #6b7280; }
	body[data-ds-dark-theme] .strip .finecode { color: #9aa0a6; }

	/* ===== the grid =============================================== */
	#grid { position: relative; z-index: 1; width: 1352px; margin: 0 auto; padding: 20px 0 60px; }
	.rowHead { display: flex; align-items: center; gap: 10px; margin: 34px 0 12px; position: relative; z-index: 1; }
	.rowTitle {
		padding: 4px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
		background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
		border: 1px solid var(--dsw-alias-border-l2); box-shadow: var(--dsw-shadow-lv2);
	}
	.rowNote { font-size: 12px; color: #fff; background: rgba(0,0,0,.55); padding: 2px 10px; border-radius: 6px; }
	body:not([data-ds-dark-theme]) .rowNote { color: #fff; }
	.row { display: flex; gap: 16px; }
	.cellWrap { width: 320px; position: relative; z-index: 1; }
	.cellLabel {
		display: inline-block; margin-bottom: 8px; padding: 2px 10px; border-radius: 6px;
		font: 600 12px/1.7 ui-monospace, monospace;
		background: rgba(0, 0, 0, .62); color: #fff;
	}
	.cell.ol-root {
		position: relative; z-index: auto; display: block;
		width: 320px; height: 150px;
	}
	/* ===== taste-ballot override: neutral tight sheen + strict Fresnel rim
	   (the gemini proposal) — applied only under body.olx-neutral. */
	body.olx-neutral .ol-root[data-material="liquid"] .ol-preview {
		background:
			radial-gradient(100px 50px at var(--ol-light-x) 14px,
				rgba(255, 255, 255, .16) 0%,
				rgba(255, 255, 255, .04) 45%,
				transparent 70%),
			linear-gradient(var(--ol-light-deg),
				rgba(255, 255, 255, .10) 0%,
				transparent 50%,
				rgba(120, 170, 255, .04) 100%),
			color-mix(in srgb, var(--dsw-alias-bg-layer-1, #ffffff) var(--ol-veil, 50%), transparent);
	}
	body.olx-neutral .ol-root[data-material="liquid"] .ol-preview::before {
		background: linear-gradient(var(--ol-light-deg),
			rgba(255, 255, 255, .30) 0%,
			rgba(255, 255, 255, .06) 22%,
			transparent 45%);
	}
	body[data-ds-dark-theme].olx-neutral .ol-root[data-material="liquid"] .ol-preview {
		background:
			radial-gradient(100px 50px at var(--ol-light-x) 14px,
				rgba(255, 255, 255, .08) 0%,
				rgba(255, 255, 255, .02) 45%,
				transparent 70%),
			linear-gradient(var(--ol-light-deg),
				color-mix(in srgb, var(--dsw-alias-label-primary, #f9fafb) 8%, transparent) 0%,
				transparent 50%,
				rgba(120, 170, 255, .04) 100%),
			color-mix(in srgb, var(--dsw-alias-bg-layer-1, #232324) var(--ol-veil, 50%), transparent);
	}
	body[data-ds-dark-theme].olx-neutral .ol-root[data-material="liquid"] .ol-preview::before {
		background: linear-gradient(var(--ol-light-deg),
			rgba(255, 255, 255, .16) 0%,
			rgba(255, 255, 255, .03) 22%,
			transparent 45%);
	}
</style>
<style>
${css}
</style>
</head>
<body>

	<div id="grid"></div>
	<div id="fxhosts"></div>

<script>
${fxCode}
</script>
<script>
	const PRESETS = ${JSON.stringify({ frost: frostPresets, liquid: liquidPresets })};
	const REFS = ${JSON.stringify(REFS)};
	const NAMES = { airy: "清透", standard: "标准", misty: "朦胧" };
	const theme = new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light";
	if (theme === "dark") document.body.setAttribute("data-ds-dark-theme", "");
	if (new URLSearchParams(location.search).get("sheen") === "neutral") document.body.classList.add("olx-neutral");

	const PROMPT = "帮我把这份季度数据整理成带同比的增长摘要，重点标出异常波动";
	const RESPONSE = "已完成：Q3 营收同比 +12.4%，8 月异常回落 −3.2% 已标注；毛利 +3.1pt，复购 +8.7%，明细见表格。";

	const fxMade = new Set();
	const DISPOVR = new URLSearchParams(location.search).get("disp");
	const DITHER = new URLSearchParams(location.search).get("dither") !== "off";
	function fxIdFor(blurPx) {
		const key = String(Math.round(blurPx * 10));
		if (fxMade.has(key)) return "ol-fx-" + key;
		fxMade.add(key);
		let markup = fxHostMarkup(blurPx)
			.replace('id="ol-fx-host"', 'id="ol-fx-host-' + key + '"')
			.replace('id="ol-liquid-fx"', 'id="ol-fx-' + key + '"');
		/* A/B override baked into the INITIAL markup — mutating a live
		   feDisplacementMap scale does not reliably re-render a CSS-referenced
		   backdrop filter, so comparisons must come from fresh loads. */
		if (DISPOVR !== null) markup = markup.replace(/scale="[0-9]+"/, 'scale="' + DISPOVR + '"');
		if (!DITHER) markup = markup.replace('k3="0.02" k4="-0.005"', 'k3="0" k4="0"');
		document.getElementById("fxhosts").insertAdjacentHTML("beforeend", markup);
		return "ol-fx-" + key;
	}

	function makeCard(material, t, b, label) {
		const wrap = document.createElement("div");
		wrap.className = "cellWrap";
		const tag = document.createElement("span");
		tag.className = "cellLabel";
		tag.textContent = label;
		const cell = document.createElement("div");
		cell.className = "cell ol-root";
		cell.dataset.material = material;
		cell.style.setProperty("--ol-veil", (100 - t) + "%");
		cell.style.setProperty("--ol-blur", b + "px");
		const card = document.createElement("div");
		card.className = "ol-preview";
		card.setAttribute("role", "tooltip");
		if (material === "liquid" && CAN_REFRACT) {
			cell.setAttribute("data-refract", "1");
			const val = "url(#" + fxIdFor(b) + ")";
			const full = theme === "dark" ? val + " contrast(1.03)" : val;
			card.style.setProperty("-webkit-backdrop-filter", full);
			card.style.setProperty("backdrop-filter", full);
		}
		const p = document.createElement("div");
		p.className = "ol-prompt";
		p.textContent = PROMPT;
		const r = document.createElement("div");
		r.className = "ol-response";
		r.textContent = RESPONSE;
		card.appendChild(p); card.appendChild(r);
		cell.appendChild(card);
		wrap.appendChild(tag); wrap.appendChild(cell);
		return wrap;
	}

	const grid = document.getElementById("grid");
	const STRIP = '<div class="strip">' +
		'<div class="finecode">const summarize = (rows) =&gt; rows.map((r) =&gt; ({ "month": r[0], "yoy": pct(r[2], r[1]) })).filter((r) =&gt; Math.abs(r.yoy) &gt; 0.03); // 同比对齐口径剔除错位影响</div>' +
		'<div class="rainbow"></div>' +
		'<div class="hairlines"></div>' +
		'<div class="finetext">附注：同比按自然月对齐，剔除错位影响；8 月回落来自华东仓临时停发（−3.2pt），还原则回到趋势线附近。The quick brown fox jumps over the lazy dog. 敏捷的棕色狐狸跳过了懒狗。0123456789 ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ</div>' +
		'</div>';
	function row(title, note, cells) {
		const head = document.createElement("div");
		head.className = "rowHead";
		const t = document.createElement("span");
		t.className = "rowTitle"; t.textContent = title;
		head.appendChild(t);
		if (note) { const n = document.createElement("span"); n.className = "rowNote"; n.textContent = note; head.appendChild(n); }
		grid.appendChild(head);
		const rowEl = document.createElement("div");
		rowEl.className = "row";
		rowEl.insertAdjacentHTML("afterbegin", STRIP);
		for (const c of cells) rowEl.appendChild(c);
		grid.appendChild(rowEl);
	}

	for (const mat of ["frost", "liquid"]) {
		const zh = mat === "frost" ? "毛玻璃" : "液态玻璃";
		const cells = PRESETS[mat].map(([id, t, b]) =>
			makeCard(mat, t, b, mat + " · " + (NAMES[id] ?? id) + " " + id + " · t" + t + " / b" + b));
		if (mat === "frost") cells.push(makeCard("frost", 50, 24, "frost · 磨砂极值 t50 / b24"));
		else cells.push(makeCard("liquid", 95, 0, "liquid · 清透极值 t95 / b0"));
		row(zh + " " + mat + " — 三档预设 + 极值参考", "每行背后为同一条高频素材带", cells);
	}
	row("参考基线", "官方处理 / iOS 校准点", REFS.map((ref) => {
		if (ref.id === "none") return makeCard("none", 100, 0, ref.label);
		return makeCard(ref.material, ref.t, ref.b, ref.label);
	}));
</script>
</body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html);
console.log("wrote", OUT, "— frost:", JSON.stringify(frostPresets), "liquid:", JSON.stringify(liquidPresets));
