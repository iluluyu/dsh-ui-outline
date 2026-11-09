#!/usr/bin/env node
/**
 * README visual capture: real UI stills + short motion takes.
 *
 * The demo profile in video/.work holds an isolated 36-turn conversation, so
 * nothing here touches a real session. Captures are 2x device pixels and
 * cropped to the region that carries the feature.
 *
 * Two rules learned the hard way:
 *   1. the card is anchored to the hovered tick, so a lot of scroll offsets
 *      park it on whitespace between turns. Candidate positions are scored
 *      by the actual ink under the card (paint the backdrop with the card
 *      hidden, read the pixel mean) instead of DOM rects, which count
 *      clipped and off-screen text;
 *   2. crops are aligned to the rail's tick grid and kept clear of the
 *      column divider, otherwise a half tick / 1px line glues to the edge.
 *
 * Usage: node tools/visuals.mjs [--take=stills|loops]
 * Output: .work/visuals/*.png — build-readme-visuals.mjs encodes them.
 */
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, writeFileSync, copyFileSync, renameSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHROME } from "./chrome.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const WORK = join(VIDEO, ".work");
const OUT = join(WORK, "visuals");
mkdirSync(OUT, { recursive: true });

const STATE = JSON.parse(readFileSync(join(WORK, "demo.json"), "utf8"));
const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => {
	const m = a.match(/^--([^=]+)(?:=(.*))?$/);
	return m ? [m[1], m[2] ?? true] : [a, true];
}));
const EN = ARGS.lang === "en";
const out = (name) => join(OUT, EN ? name.replace(/(\.png|\.json)$/, "-en$1").replace(/(loop-(?:rail|search))-(\d+)-en/, "$1-en-$2") : name);
const localized = (name) => EN ? ({ "左侧": "Left", "宽松": "Loose", "毛玻璃": "Frosted", "显示": "Show", "无材质": "None", "液态玻璃": "Liquid glass", "标准": "Standard", "清透": "Airy" }[name] || name) : name;
const BASE_URL = ARGS.url ? String(ARGS.url) : readFileSync(join(WORK, "server2.log"), "utf8").match(/http:\/\/127\.0\.0\.1:\d+\/\?token=\S+/)?.[0];
if (!BASE_URL) { console.error("no demo server URL; run dsh web in video/.work first"); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CURSOR = () => {
	const mount = () => {
		const style = document.createElement("style");
		style.textContent = `#olx-cursor{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;will-change:transform;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}`;
		document.head.appendChild(style);
		const el = document.createElement("div");
		el.id = "olx-cursor";
		el.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3.2 2.4 L18.2 9.6 L11.6 11.6 L9.2 18.4 Z" fill="#fff" stroke="#111318" stroke-width="1.3" stroke-linejoin="round"/></svg>';
		document.documentElement.appendChild(el);
		window.addEventListener("pointermove", (e) => {
			el.style.transform = `translate3d(${e.clientX - 3}px, ${e.clientY - 2}px, 0)`;
		}, { passive: true });
	};
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
	else mount();
};

const box = (sel) => page.evaluate((s) => {
	const el = document.querySelector(s);
	if (!el) return null;
	const r = el.getBoundingClientRect();
	return { x: r.x, y: r.y, w: r.width, h: r.height };
}, sel);

const setTranscript = (on) => page.evaluate((v) => {
	const e = document.querySelector("[data-conversation-scroll]");
	if (e) e.style.visibility = v ? "" : "hidden";
}, on);

/* Hide the preview card's own copy: the material itself is the subject,
   text on top of it hides the very thing the shot is about. */
const setPreviewText = (on) => page.evaluate((v) => {
	document.querySelectorAll("#dsh-outline-root .ol-prompt, #dsh-outline-root .ol-response").forEach((e) => {
		e.style.visibility = v ? "" : "hidden";
	});
}, on);

/* Floating app chrome (a fade-in scroll-to-bottom pill, toasts) lands in the
   card's bounding box and shows through its rounded corners, so every tile
   carried a stray glyph at the bottom-right. Hide anything overlay-ish that
   intersects the shot region, then restore. */
const hideOverlays = (rect) => page.evaluate((r) => {
	const hits = [];
	for (const el of document.querySelectorAll("body *")) {
		if (el.closest("#dsh-outline-root") || el.closest("#olx-material-capture")) continue;
		if (el.id && el.id.startsWith("olx-")) continue;
		if (el.querySelector("[data-conversation-scroll]")) continue;
		const cs = getComputedStyle(el);
		if (cs.position !== "fixed" && cs.position !== "absolute") continue;
		if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
		const b = el.getBoundingClientRect();
		if (b.width * b.height > r.w * r.h * 0.5) continue;
		if (b.right < r.x || b.left > r.x + r.w || b.bottom < r.y || b.top > r.y + r.h) continue;
		el.style.visibility = "hidden";
		el.dataset.olxHidden = "1";
		hits.push(el);
	}
	return hits.length;
}, rect);

const restoreOverlays = () => page.evaluate(() => {
	for (const el of document.querySelectorAll("[data-olx-hidden]")) {
		el.style.visibility = "";
		delete el.dataset.olxHidden;
	}
});


/* The card is opaque only inside its rounded shape, so conversation text at
   the four corners shows through the notches of the bounding box (a stray
   glyph at the bottom-right of every tile). Mask the tile to the real radius
   and flatten it onto the page's white. */
const maskCorners = (file, w, h, radiusCss) => {
	const W = Math.round(w * 2), H = Math.round(h * 2), r = Math.round(radiusCss * 2);
	const mask = file.replace(/\.png$/, "-mask.png");
	const alpha = file.replace(/\.png$/, "-alpha.png");
	const out = file.replace(/\.png$/, "-masked.png");
	execFileSync("magick", ["-size", `${W}x${H}`, "xc:none", "-fill", "white",
		"-draw", `roundrectangle 0,0 ${W - 1},${H - 1} ${r},${r}`, mask]);
	execFileSync("magick", [mask, "-alpha", "extract", alpha]);
	execFileSync("magick", [file, alpha, "-alpha", "off", "-compose", "CopyOpacity", "-composite",
		/* `-flatten` blanks the result under IM7 here; drop the alpha instead */
		"-background", "white", "-alpha", "remove", "-alpha", "off", out]);
	for (const f of [mask, alpha]) rmSync(f, { force: true });
	renameSync(out, file);
};

const setCursorVisible = (on) => page.evaluate((v) => {
	const el = document.getElementById("olx-cursor");
	if (el) el.style.display = v ? "" : "none";
}, on);

const marks = () => page.evaluate(() => [...document.querySelectorAll("#dsh-outline-root .ol-markBtn")].map((b) => {
	const r = b.getBoundingClientRect();
	return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}));

/* How much real content sits behind a rectangle: text-line rects from the
   conversation plus the prompt bubbles (their fill is what makes a glass
   card read as glass, even when the line is short). */
const coverage = (rect) => page.evaluate((r) => {
	let area = 0;
	const inter = (b) => {
		const w = Math.min(b.right, r.x + r.w) - Math.max(b.left, r.x);
		const h = Math.min(b.bottom, r.y + r.h) - Math.max(b.top, r.y);
		return w > 0 && h > 0 ? w * h : 0;
	};
	const host = document.querySelector("[data-conversation-scroll]");
	if (!host) return 0;
	const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		if (!n.nodeValue || !n.nodeValue.trim()) continue;
		range.selectNodeContents(n);
		for (const b of range.getClientRects()) area += inter(b);
	}
	for (const el of host.querySelectorAll('[class$="_userStack"]')) {
		area += 1.4 * inter(el.getBoundingClientRect());
	}
	return area / (r.w * r.h);
}, rect);

const scrollTopOf = () => page.evaluate(() => document.querySelector("[data-conversation-scroll]")?.scrollTop ?? 0);
const setScroll = async (top) => {
	await page.evaluate((t) => { const e = document.querySelector("[data-conversation-scroll]"); if (e) e.scrollTop = t; }, top);
	await sleep(350);
};

/* The transcript is a virtualized list that owns its scroll state: assigning
   scrollTop is silently undone (set 0 on a page sitting at 2629 stays at
   2629), so every "scroll offset" the capture used was really one fixed
   position. Wheel events are the only thing that actually moves it. Drive the
   transcript to an absolute offset and return where it really landed. */
const gotoScroll = async (target) => {
	await page.locator("[data-conversation-scroll]").hover();
	let top = await scrollTopOf();
	for (let i = 0; i < 40; i++) {
		const d = target - top;
		if (Math.abs(d) <= 24) break;
		await page.mouse.wheel(0, Math.max(-600, Math.min(600, d)));
		await sleep(90);
		top = await scrollTopOf();
	}
	await sleep(300);
	return scrollTopOf();
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript({
	content: `(() => { try { localStorage.setItem("dsh.sessions.current", JSON.stringify({ sessionId: ${JSON.stringify(STATE.sessionId)} })); } catch (e) {} (${CURSOR.toString()})(); })();`,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message)));

async function openChat() {
	await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
	await sleep(3000);
	const more = page.getByText(EN ? "Load earlier" : "加载更早", { exact: true });
	if (await more.count()) { await more.first().click(); await sleep(1500); }
	await page.waitForFunction(() => document.querySelectorAll("#dsh-outline-root .ol-markBtn").length >= 36, null, { timeout: 20000 });
	await sleep(600);
}

async function goPlugins() {
	await page.locator(EN ? 'button:has-text("Plugins")' : 'button:has-text("插件")').first().click();
	await sleep(850);
	await page.locator('button:has-text("dsh-ui-outline")').first().click();
	await sleep(950);
}

async function goChat() {
	await page.getByRole("treeitem").filter({ hasText: STATE.title }).first().click();
	await sleep(1500);
}

/* side right + compact: the preview card hangs over the transcript */
async function setPrefs({ side = "左侧", layout = "宽松", material = "毛玻璃", narrow = "显示" } = {}) {
	await goPlugins();
	for (const name of [side, layout, material, narrow]) {
		const b = page.getByRole("button", { name: localized(name), exact: true });
		if (await b.count()) await b.first().click();
		await sleep(320);
	}
	await goChat();
}

async function setMaterial(label, preset) {
	await goPlugins();
	const b = page.getByRole("button", { name: localized(label), exact: true });
	if (await b.count()) await b.first().click();
	await sleep(450);
	/* Presets are the product's own reference points — the illustration must
	   show a real preset, not hand-picked CSS variable values. */
	if (preset) {
		const p = page.getByRole("button", { name: localized(preset), exact: true });
		if (await p.count()) { await p.first().click(); await sleep(450); }
		else console.log("preset not found:", localized(preset));
	}
	await goChat();
}

async function scrollTop() {
	await page.locator("[data-conversation-scroll]").hover();
	for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -1600); await sleep(80); }
	await sleep(600);
}

/* Pick the mark whose preview card sits over the most real content. */
async function bestMark() {
	const ms = await marks();
	let best = null;
	for (const i of [4, 6, 8, 10, 12, 14, 16, 18]) {
		await page.mouse.move(ms[i].x, ms[i].y, { steps: 4 });
		await sleep(420);
		const card = await box(".ol-preview");
		if (!card) continue;
		const score = await coverage(card);
		if (!best || score > best.score) best = { i, card, score };
	}
	await page.mouse.move(ms[best.i].x, ms[best.i].y, { steps: 4 });
	await sleep(700);
	console.log("best mark", best.i, "coverage", best.score.toFixed(2));
	return { index: best.i, card: await box(".ol-preview"), marks: ms };
}

/* Coverage for several rectangles in one pass. */
const coverageAll = (rects) => page.evaluate((list) => {
	const host = document.querySelector("[data-conversation-scroll]");
	if (!host) return list.map(() => 0);
	const nodes = [];
	const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		if (!n.nodeValue || !n.nodeValue.trim()) continue;
		range.selectNodeContents(n);
		for (const b of range.getClientRects()) nodes.push(b);
	}
	const bubbles = [...host.querySelectorAll('[class$="_userStack"]')].map((e) => e.getBoundingClientRect());
	return list.map((r) => {
		let area = 0;
		const inter = (b, k) => {
			const w = Math.min(b.right, r.x + r.w) - Math.max(b.left, r.x);
			const h = Math.min(b.bottom, r.y + r.h) - Math.max(b.top, r.y);
			return w > 0 && h > 0 ? k * w * h : 0;
		};
		for (const b of nodes) area += inter(b, 1);
		for (const b of bubbles) area += inter(b, 1.6);
		return area / (r.w * r.h);
	});
}, rects);

/* Pixel truth for the backdrop: hide the subject, photograph the area it
   will occupy, and return the mean luminance (1 = blank paper, lower = ink).
   DOM rects lie here — clipped and off-screen text still reports a rect. */
const meanOf = async (rect, hideSel) => {
	if (hideSel) await page.evaluate((sel) => { const e = document.querySelector(sel); if (e) e.style.visibility = "hidden"; }, hideSel);
	const file = join(OUT, "_mean.png");
	await page.screenshot({ path: file, clip: { x: rect.x, y: rect.y, width: rect.w ?? rect.width, height: rect.h ?? rect.height } });
	if (hideSel) await page.evaluate((sel) => { const e = document.querySelector(sel); if (e) e.style.visibility = ""; }, hideSel);
	const mean = execFileSync("magick", [file, "-colorspace", "gray", "-format", "%[fx:mean]", "info:"]).toString();
	return +(+mean).toFixed(4);
};

const inkMean = (rect) => meanOf(rect, ".ol-previewWrap");

/* Colour-only backdrop: text goes transparent, the bubble fills stay, so the
   glass reads as glass over a colour field instead of over glyphs. */
const hideTranscriptText = () => page.evaluate(() => {
	document.querySelectorAll("[data-conversation-scroll] *").forEach((e) => { e.style.color = "transparent"; });
	document.querySelectorAll("[data-conversation-scroll]").forEach((e) => { e.style.setProperty("-webkit-text-fill-color", "transparent"); });
});

const rgbMean = async (rect, hideSel) => {
	if (hideSel) await page.evaluate((sel) => { const e = document.querySelector(sel); if (e) e.style.visibility = "hidden"; }, hideSel);
	const file = join(OUT, "_rgb.png");
	await page.screenshot({ path: file, clip: { x: rect.x, y: rect.y, width: rect.w ?? rect.width, height: rect.h ?? rect.height } });
	if (hideSel) await page.evaluate((sel) => { const e = document.querySelector(sel); if (e) e.style.visibility = ""; }, hideSel);
	const out = execFileSync("magick", [file, "-format", "%[fx:mean.r] %[fx:mean.g] %[fx:mean.b]", "info:"]).toString().trim().split(/\s+/).map(Number);
	return out;
};

/* Card geometry for a mark, from the measured card + rail offsets. */
const cardRects = (ms, geo) => ms.map((m) => {
	/* a two-line prompt + two-line answer card is 106 tall; geo.cardH is
	   whatever the measuring mark happened to render, so clamp up. */
	const h = Math.max(geo.cardH, 106);
	return {
		x: geo.cardX,
		y: Math.max(geo.railTop, Math.min(geo.railBottom - h, m.y - h / 2)),
		w: geo.cardW,
		h,
	};
});

async function measureGeo() {
	const ms = await marks();
	await page.mouse.move(ms[5].x, ms[5].y, { steps: 4 });
	await sleep(500);
	const card = await box(".ol-preview");
	const rail = await box("#dsh-outline-root");
	return { ms, geo: { cardX: card.x, cardW: card.w, cardH: card.h, railTop: rail.y, railBottom: rail.y + rail.h, railX: rail.x } };
}

/* Hero: the card on blank paper — the rail and the card are the subject,
   the transcript behind it would only add noise. */
async function blankCard(geoInfo) {
	const base = await scrollTopOf();
	return { mark: 18, scroll: base, mean: 1 };
}

/* Score every candidate against the same viewport photograph at each scroll
   offset. Crops are local ImageMagick operations, not browser screenshots. */
/* Pick the mark + scroll whose preview-card area sits over the most TEXTURE
   (gray standard deviation, not mean: a white page dominates the mean and
   hides two perfectly good text lines). The rail is hidden during the scan,
   each scroll offset costs one screenshot, and every candidate card rect is
   scored by a local crop. */
async function materialCard(geoInfo) {
	const { ms, geo } = geoInfo;
	const base = await scrollTopOf();
	/* Score the band a card is GUARANTEED to cover (real cards run 82–150px
	   tall and cardRects' 106px guess overshoots) AND score it through the
	   glass: crop, blur by the radius the material really applies, then rank
	   by how much haze is left. Ranking raw ink picked spots whose two thin
	   lines dissolved into nothing once blurred (frost tile read as white). */
	const bandRect = (m) => {
		const h = heights[m] || 80;
		return { x: geo.cardX, y: m.y - h / 2, w: geo.cardW, h };
	};
	let best = { mark: 10, scroll: base, score: -1, wash: 0, cover: 0, std: 0 };
	/* ranked candidates, kept so a pick whose turn is not rendered (the
	   transcript virtualizes, so the card only exists while its turn is in
	   view) can fall through to the next best window */
	const ranked = [];
	const allMarks = Array.from({ length: 21 }, (_, i) => i + 4);
	/* Measure each card's real height once: cards run 82–150px, and only a tall
	   one (a longer answer) fills the tile instead of leaving two blurred lines
	   floating in white. */
	const heights = {};
	for (const m of allMarks) {
		await page.mouse.move(ms[m].x, ms[m].y, { steps: 3 });
		await sleep(380);
		const b = await box(".ol-preview");
		heights[m] = b ? Math.round(b.h) : 0;
	}
	const tall = allMarks.filter((m) => heights[m] >= 110);
	const candidates = tall.length >= 3 ? tall : allMarks;
	const shot = join(OUT, '_scan.png');
	/* frost airy: blur 11 CSS px -> magick sigma 11 (see the still capture) */
	const SCAN_SIGMA = 11;
	/* Probe the conversation's FULL scroll range, not just the first 1200px:
	   both transcripts are several thousand px tall, and the dense spot is
	   usually mid-conversation. Step widens so the probe count stays ~30. */
	const maxScroll = await page.evaluate(() => {
		const e = document.querySelector('[data-conversation-scroll]');
		return e ? Math.round(e.scrollHeight - e.clientHeight) : 0;
	});
	const range = Math.max(0, maxScroll - base);
	const stepArg = Number(ARGS.step || 0);
	const step = stepArg || (range <= 1400 ? 40 : Math.max(140, Math.round(range / 55 / 20) * 20));
	await setCursorVisible(false);
	await page.evaluate(() => { document.querySelector('#dsh-outline-root').style.visibility = 'hidden'; });
	/* The coarse pass steps ~140px, wider than a line of text, so it can only
	   promise the right neighbourhood. Score that neighbourhood again at line
	   scale (10px) before committing. */
	let curTop = base;
	const scoreAt = (shotFile) => {
		const args = [shotFile, '-colorspace', 'gray'];
		for (const mark of candidates) {
			const r = bandRect(ms[mark]);
			const crop = `${Math.round(r.w * 2)}x${Math.round(r.h * 2)}+${Math.round(r.x * 2)}+${Math.round(r.y * 2)}`;
			args.push('(', '-clone', '0', '-crop', crop, '+repage', '-blur', `0x${SCAN_SIGMA}`,
				'-format', '%[fx:mean] %[fx:standard_deviation] ', '-write', 'info:',
				/* rows = share of the card's HEIGHT that carries haze. Area coverage
				   saturates as soon as the blur spreads one line across the card, so it
				   happily picked windows with a white band above and below; collapsing
				   each row to its mean and counting the rows still below white measures
				   exactly the blank bands a reader sees in the tile. */
				'-resize', '1x!', '-threshold', '98%', '-negate', '-format', '%[fx:mean]\n', '-write', 'info:', '+delete', ')');
		}
		args.push('null:');
		const values = execFileSync('magick', args).toString().trim().split(/\s+/).map(Number);
		for (let i = 0; i < candidates.length; i++) {
			const mean = values[i * 3], std = values[i * 3 + 1], rows = values[i * 3 + 2];
			const wash = 1 - mean;
			/* filled top-to-bottom first (no gratuitous blank area), then haze,
			   then texture (a flat grey slab is not material either) */
			const score = rows * 10 + wash * 4 + std * 3;
			ranked.push({ mark: candidates[i], scroll: curTop, score, wash, rows, std });
			if (score > best.score) {
				best = { mark: candidates[i], scroll: curTop, score, wash, rows, std };
				copyFileSync(shotFile, out('_scan-best.png'));
			}
		}
	};
	/* wheel travel is the expensive part, so the coarse pass steps 200px (most
	   of a line block) and the refine pass above covers the rest */
	const coarseStep = Math.max(200, Math.round(range / 40 / 20) * 20);
	for (let off = 0; off <= range; off += coarseStep) {
		curTop = await gotoScroll(base + off);
		await page.screenshot({ path: shot });
		scoreAt(shot);
	}
	/* Refine the best few NEIGHBOURHOODS at line scale: the coarse pass steps
	   ~140px, wider than a line, and the best window is only as good as its
	   alignment with the text rows. */
	const coarse = [...ranked].sort((a, b) => b.score - a.score);
	const hubs = [];
	for (const c of coarse) {
		if (hubs.every((h) => Math.abs(h - c.scroll) > coarseStep * 1.5)) hubs.push(c.scroll);
		if (hubs.length === 3) break;
	}
	for (const hub of hubs) {
		for (let t = Math.max(0, hub - coarseStep / 2); t <= Math.min(range, hub + coarseStep / 2); t += 12) {
			curTop = await gotoScroll(t);
			await page.screenshot({ path: shot });
			scoreAt(shot);
		}
	}
	await page.evaluate(() => { document.querySelector('#dsh-outline-root').style.visibility = ''; });
	await setCursorVisible(true);
	/* verify the card actually renders at the winner; otherwise fall through
	   the ranking (a virtualized transcript only mounts the turns in view) */
	ranked.sort((a, b) => b.score - a.score);
	let chosen = null;
	for (const cand of ranked.slice(0, 20)) {
		await gotoScroll(cand.scroll);
		await page.mouse.move(ms[cand.mark].x, ms[cand.mark].y, { steps: 3 });
		await sleep(650);
		if (await box(".ol-preview")) { chosen = cand; break; }
	}
	if (chosen) best = chosen;
	else console.warn("none of the top-20 windows rendered a preview card");
	await gotoScroll(best.scroll);
	console.log("material card", best.mark, "scroll", best.scroll, "rows", best.rows.toFixed(3), "wash", best.wash.toFixed(3), "std", best.std.toFixed(3), "range", range, "step", step);
	if (best.wash < 0.05) console.warn("blurred backdrop is nearly white (wash < 0.05); inspect _scan-best");
	return best;
}

/* ---------------------------------------------------------------- stills */
async function stills() {
	await openChat();
	await setPrefs();
	await scrollTop();
	const info = await measureGeo();
	const { ms } = info;

	// hero tile: rail + card on the app's own blank background (transcript
	// hidden for the shot — text behind the glass is what made it messy)
	await page.mouse.move(ms[18].x, ms[18].y, { steps: 5 });
	await sleep(700);
	await setTranscript(false);
	await sleep(200);
	const card = await box(".ol-preview");
	const rail = await box("#dsh-outline-root");
	await page.screenshot({
		path: out("hero.png"),
		clip: { x: rail.x, y: card.y - (281 - card.h) / 2, width: 420, height: 281 },
	});
	await setTranscript(true);
	writeFileSync(out("hero.json"), JSON.stringify({ card, rail }));

	const matPick = await materialCard(info);
	/* Presets come from the product's own table: frost reads best at AIRY
	   (its standard veil washed the tile out to plain white), liquid at
	   STANDARD — airy left it so clear it no longer read as a material */
	for (const [name, label, preset] of [["none", "无材质", null], ["frost", "毛玻璃", "清透"], ["liquid", "液态玻璃", "标准"]]) {
		await setMaterial(label, preset);
		await gotoScroll(matPick.scroll);
		await page.mouse.move(ms[matPick.mark].x, ms[matPick.mark].y, { steps: 4 });
		await sleep(800);
		await setCursorVisible(false);
		await setPreviewText(false);
		const c = await box(".ol-preview");
		if (!c) continue;
		if (name === "none") {
			await hideOverlays(c);
			await page.screenshot({ path: out(`material-${name}.png`), clip: { x: c.x, y: c.y, width: c.w, height: c.h } });
			await restoreOverlays();
			maskCorners(out(`material-${name}.png`), c.w, c.h, 18.4);
			continue;
		}
		/* Chromium clips the pseudo-element's backdrop input at the card's
		   overflow boundary, even though the filter is oversized. For this
		   illustration, photograph extra backdrop, pre-blur it, and clip the
		   result to the card. This is a capture-only approximation of the
		   intended glass; it does not alter the plugin's runtime CSS. */
		const glass = await page.evaluate(() => {
			const card = document.querySelector('.ol-preview');
			const root = document.querySelector('#dsh-outline-root');
			const bf = getComputedStyle(card, '::before').backdropFilter;
			return {
				blur: parseFloat((bf.match(/blur\(([\d.]+)px\)/) || [])[1] || getComputedStyle(root).getPropertyValue('--ol-blur')),
				sat: parseFloat((bf.match(/saturate\(([^)]+)\)/) || [])[1] || "1"),
				fill: getComputedStyle(card, '::before').backgroundColor,
				shadow: getComputedStyle(card).boxShadow,
			};
		});
		const pad = 32;
		const bg = join(OUT, '_material-backdrop.png');
		const blurred = join(OUT, '_material-blurred.png');
		await page.evaluate(() => { document.querySelector('#dsh-outline-root').style.visibility = 'hidden'; });
		await page.screenshot({ path: bg, clip: { x: c.x - pad, y: c.y - pad, width: c.w + 2 * pad, height: c.h + 2 * pad } });
		/* CSS blur(r) is a Gaussian with standard deviation r/2 in CSS px, so on
		   a 2x capture the matching magick sigma is exactly r (not 2r — using 2r
		   smeared the backdrop into blank white, which read as "no glass at
		   all"). saturate() maps to -modulate's saturation channel. */
		const sigma = glass.blur;
		execFileSync('magick', [bg, '-blur', `0x${sigma}`, '-modulate', `100,${Math.round(glass.sat * 100)}`, blurred]);
		const data = readFileSync(blurred).toString('base64');
		await page.evaluate(({ c, pad, glass, data }) => {
			const el = document.createElement('div');
			el.id = 'olx-material-capture';
			Object.assign(el.style, { position: 'fixed', left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px`, borderRadius: '18.4px', overflow: 'hidden', zIndex: '2147483646', boxShadow: glass.shadow, backgroundImage: `url(data:image/png;base64,${data})`, backgroundSize: `${c.w + 2 * pad}px ${c.h + 2 * pad}px`, backgroundPosition: `-${pad}px -${pad}px` });
			const veil = document.createElement('div');
			Object.assign(veil.style, { position: 'absolute', inset: '0', background: glass.fill, boxShadow: glass.shadow, borderRadius: 'inherit' });
			el.appendChild(veil);
			document.body.appendChild(el);
		}, { c, pad, glass, data });
		const tile = out(`material-${name}.png`);
		await hideOverlays(c);
		await page.screenshot({ path: tile, clip: { x: c.x, y: c.y, width: c.w, height: c.h } });
		await restoreOverlays();
		maskCorners(tile, c.w, c.h, 18.4);
		const rows = execFileSync('magick', [tile, '-colorspace', 'gray', '-resize', '1x!', '-threshold', '98%', '-negate', '-format', '%[fx:mean]', 'info:']).toString();
		console.log(`tile ${name} ${Math.round(c.w)}x${Math.round(c.h)} rows ${(+rows).toFixed(3)} scroll ${Math.round(await scrollTopOf())}`);
		await page.evaluate(() => { document.querySelector('#olx-material-capture').remove(); document.querySelector('#dsh-outline-root').style.visibility = ''; });
	}
	await setPreviewText(true);
	await setMaterial("毛玻璃", "清透");
	await setScroll(matPick.scroll);

	// The search overlay is 640px wide and would overlap the sidebar at
	// 1100; widen the window for it so the card floats clear of the chrome.
	await page.setViewportSize({ width: 1440, height: 900 });
	await sleep(900);

	// search: type first so the overlay is expanded, then slide the
	// transcript behind it and keep the densest position
	await page.keyboard.press("Control+f");
	await sleep(700);
	await page.locator(".ol-searchInput").click();
	if (EN) await page.locator(".ol-searchInput").evaluate((el) => el.setAttribute("placeholder", "Search this conversation…"));
	await page.keyboard.type("PagedAttention", { delay: 90 });
	await sleep(1600);
	const ov = await box(".ol-searchOverlay");
	const sbase = await scrollTopOf();
	const pad = 28;
	const clip = { x: ov.x - pad, y: ov.y - pad, width: ov.w + pad * 2, height: ov.h + pad * 2 };
	const bestScroll = { top: sbase, mean: 1 };
	await setScroll(bestScroll.top);
	console.log("search scroll", bestScroll.top, "mean", bestScroll.mean.toFixed(3));
	await setCursorVisible(false);
	await setTranscript(false);
	await sleep(250);
	await page.screenshot({ path: out("search.png"), clip });
	await setTranscript(true);
	writeFileSync(out("search-box.json"), JSON.stringify(ov));
	await page.keyboard.press("Escape");
	await sleep(400);
}

/* ----------------------------------------------------------------- loops */
async function loopRail() {
	await openChat();
	await setPrefs();
	await scrollTop();
	const info = await measureGeo();
	const pick = await materialCard(info);
	const { ms } = info;
	const i0 = Math.max(1, Math.min(pick.mark - 3, ms.length - 7));

	// fixed window, aligned to the 30px tick grid; starts at the card, never
	// at the column divider
	const card = info.geo;
	const clip = {
		x: card.railX,
		y: ms[i0].y - 110,
		width: Math.ceil(card.cardX + card.cardW + 20 - card.railX),
		height: 340,
	};
	/* nudge the top edge into a text gap: a sliced line at the very top was
	   the "small black dot" readers kept spotting */
	let topY = clip.y, topMean = -1;
	for (let d = -24; d <= 24; d += 2) {
		const m = await meanOf({ x: clip.x, y: clip.y + d, w: clip.width, h: 8 });
		if (m > topMean) { topMean = m; topY = clip.y + d; }
	}
	clip.y = topY;
	for (let n = 0; n < 6; n++) {
		const i = i0 + n;
		await page.mouse.move(ms[i].x, ms[i].y, { steps: 5 });
		await sleep(430);
		await page.screenshot({ path: out(`loop-rail-${String(n).padStart(2, "0")}.png`), clip });
	}
	writeFileSync(out("loop-rail.json"), JSON.stringify({
		frames: [0, 1, 2, 3, 4, 5].map((n) => out(`loop-rail-${String(n).padStart(2, "0")}.png`)),
		hold: [2, 1, 1, 1, 1, 8],
	}));
}

async function loopSearch() {
	await openChat();
	await setPrefs();
	await scrollTop();
	await page.setViewportSize({ width: 1440, height: 900 });
	await sleep(900);
	await page.keyboard.press("Control+f");
	await sleep(700);
	await page.locator(".ol-searchInput").click();
	if (EN) await page.locator(".ol-searchInput").evaluate((el) => el.setAttribute("placeholder", "Search this conversation…"));
	await page.keyboard.type("PagedAttention", { delay: 70 });
	await sleep(1400);
	const ov = await box(".ol-searchOverlay");
	const band = 28;
	const base = await scrollTopOf();
	const probe = { x: ov.x - band, y: ov.y - band, w: ov.w + band * 2, h: ov.h + band * 2 };
	const best = { top: base, mean: 1 };
	await setScroll(best.top);
	console.log("loop search scroll", best.top, "mean", best.mean.toFixed(3));

	await setCursorVisible(false);
	// The search still already uses a quiet backdrop; do the same for every
	// loop frame. Otherwise blurred transcript glyphs look like a watermark.
	await setTranscript(false);
	await page.locator(".ol-searchInput").fill("");
	await sleep(500);

	const clip = { x: ov.x - band, y: ov.y - band, width: ov.w + band * 2, height: ov.h + band * 2 };
	const frames = [];
	const snap = async (hold = 1) => {
		const file = out(`loop-search-${String(frames.length).padStart(2, "0")}.png`);
		await page.screenshot({ path: file, clip });
		frames.push({ file, hold });
	};
	await snap(3);
	for (const ch of ["P", "a", "g", "e", "d", "A", "t", "t", "e", "n", "t", "i", "o", "n"]) {
		await page.keyboard.type(ch, { delay: 40 });
		await sleep(260);
		await snap(1);
	}
	await sleep(1500);
	await snap(8);
	await page.keyboard.press("ArrowDown");
	await sleep(500);
	await snap(4);
	await page.keyboard.press("ArrowDown");
	await sleep(500);
	await snap(4);
	writeFileSync(out("loop-search.json"), JSON.stringify({ frames }));
}

if (ARGS.take === "stills" || !ARGS.take) await stills();
if (ARGS.take === "loops" || !ARGS.take) { await loopRail(); await loopSearch(); }
console.log("captured to", OUT, "errors:", errors.length ? errors : "none");
await browser.close();
