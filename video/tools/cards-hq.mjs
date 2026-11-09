#!/usr/bin/env node
/**
 * 1920x1080 card renderer: intro / material comparison / outro.
 *
 * The 1440x900 design is scaled 1.2 into a 1728x1080 stage centered in the
 * 1920x1080 frame, so every glyph is vector. Material stills are captured as
 * 2x element screenshots from the real app, then shown downscaled on the board.
 *
 * Cards are recorded from the PNG screencast (same as the hq takes) and
 * re-timed to 25fps.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import { CHROME } from "./chrome.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const WORK = join(VIDEO, ".work");
const HQ = join(WORK, "hq");
const TAKES = join(HQ, "takes");
const STILLS = join(HQ, "stills");
const STATE = JSON.parse(readFileSync(join(WORK, "demo.json"), "utf8"));
const BASE_URL = process.env.APP_URL;
if (!BASE_URL) { console.error('set APP_URL to the running dsh web token URL'); process.exit(2); }
const W = 1920;
const H = 1080;
const FPS = 25;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FONT = '"Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
const MONO = '"Noto Sans Mono CJK SC", "Noto Sans Mono", ui-monospace, SFMono-Regular, monospace';

const BASE_CSS = `
	* { box-sizing: border-box; }
	html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
	body {
		background:
			radial-gradient(1080px 720px at 82% 12%, rgba(77,107,254,.12), transparent 62%),
			radial-gradient(840px 600px at 12% 88%, rgba(168,85,247,.08), transparent 60%),
			#f4f5f7;
		font-family: ${FONT};
		color: #12141a;
		-webkit-font-smoothing: antialiased;
	}
	.stage {
		position: absolute; left: 96px; top: 0;
		width: 1440px; height: 900px;
		transform: scale(1.2); transform-origin: top left;
	}
	.eyebrow { font-size: 13px; letter-spacing: .24em; font-weight: 600; color: #4d6bfe; text-transform: uppercase; }
	.muted { color: #6a7078; }
	.card {
		background: rgba(255,255,255,.72);
		border: 1px solid rgba(255,255,255,.92);
		box-shadow: 0 1px 1px rgba(16,20,30,.04), 0 22px 60px rgba(16,20,30,.10);
		backdrop-filter: blur(14px) saturate(1.15);
		-webkit-backdrop-filter: blur(14px) saturate(1.15);
		border-radius: 20px;
	}
	.anim { opacity: 0; }
	body.play .fade-up { animation: fadeUp .8s cubic-bezier(.2,.7,.2,1) forwards; }
	body.play .fade-in { animation: fadeIn .7s ease forwards; }
	@keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
	@keyframes caret { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0; } }
`;

function page(title, css, body, script = "") {
	return `<!doctype html>
<html lang="zh">
<head><meta charset="utf-8"><title>${title}</title>
<style>${BASE_CSS}${css}</style></head>
<body class="">
<div class="stage">${body}</div>
<script>
	window.__play = () => { document.body.classList.add("play"); };
	${script}
</script>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* material stills                                                     */
/* ------------------------------------------------------------------ */
async function applyMaterial(label) {
	const browser = await chromium.launch({ executablePath: CHROME, headless: true });
	const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
	await context.addInitScript((sid) => localStorage.setItem("dsh.sessions.current", JSON.stringify({ sessionId: sid })), STATE.sessionId);
	const page = await context.newPage();
	await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
	await sleep(2800);
	await page.locator('button:has-text("插件")').first().click();
	await sleep(900);
	await page.locator('button:has-text("dsh-ui-outline")').first().click();
	await sleep(900);
	await page.getByRole("button", { name: label, exact: true }).click();
	await sleep(700);
	await context.close();
	await browser.close();
}

async function captureStill(name, label) {
	const file = join(STILLS, name + ".png");
	const browser = await chromium.launch({ executablePath: CHROME, headless: true });
	const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
	await context.addInitScript((sid) => localStorage.setItem("dsh.sessions.current", JSON.stringify({ sessionId: sid })), STATE.sessionId);
	const page = await context.newPage();
	await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
	await sleep(3000);
	const more = page.getByText("加载更早", { exact: true });
	if (await more.count()) { await more.first().click(); await sleep(1400); }
	await page.evaluate(() => document.querySelectorAll("#dsh-outline-root .ol-markBtn")[8].focus());
	await sleep(900);
	await page.locator(".ol-preview").screenshot({ path: file });
	await context.close();
	await browser.close();
	return file;
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */
function introHtml() {
	const ticks = Array.from({ length: 22 }, (_, i) => {
		const hot = i === 16;
		return `<i class="tick${hot ? " hot" : ""}" style="animation-delay:${(0.55 + i * 0.035).toFixed(2)}s"></i>`;
	}).join("");
	const css = `
		.hero { position: absolute; left: 120px; top: 232px; width: 760px; }
		.hero h1 { margin: 22px 0 18px; font-size: 78px; line-height: 1.02; letter-spacing: -.035em; font-weight: 700; }
		.hero .tag { font-size: 34px; line-height: 1.35; font-weight: 500; letter-spacing: -.01em; }
		.hero .feats { margin-top: 26px; font-size: 18px; letter-spacing: .02em; }
		.stage > .meta { position: absolute; left: 120px; bottom: 64px; font-size: 14px; letter-spacing: .04em; }
		.railBlock { position: absolute; right: 118px; top: 196px; width: 380px; height: 540px; }
		.rail { position: absolute; right: 0; top: 0; width: 44px; height: 100%; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; padding-top: 16px; }
		.tick { display: block; width: 24px; height: 2px; border-radius: 2px; background: #9aa0a8; opacity: 0; transform: scaleX(.25); transform-origin: right; animation: tick .5s ease forwards; }
		.tick.hot { background: #12141a; }
		@keyframes tick { to { opacity: .55; transform: scaleX(1); } }
		.orb { position: absolute; right: 52px; top: 120px; width: 300px; height: 220px; border-radius: 50%;
			background: radial-gradient(120px 90px at 30% 35%, rgba(77,107,254,.55), transparent 70%),
				radial-gradient(120px 90px at 72% 62%, rgba(236,72,153,.38), transparent 70%),
				radial-gradient(140px 110px at 55% 20%, rgba(250,204,21,.35), transparent 72%);
			filter: blur(26px); }
		.preview { position: absolute; right: 26px; top: 176px; width: 332px; padding: 16px 18px 15px; }
		.preview .q { font-size: 14px; line-height: 1.5; font-weight: 600; letter-spacing: -.005em; }
		.preview .a { margin-top: 8px; font-size: 12.5px; line-height: 1.6; color: #5b6169; }
		.preview .bar { position: absolute; left: 18px; right: 18px; bottom: 9px; height: 1px; background: rgba(16,20,30,.07); }
	`;
	const body = `
		<div class="hero">
			<div class="eyebrow anim fade-up" style="animation-delay:.15s">dsh plugin · web / desktop</div>
			<h1 class="anim fade-up" style="animation-delay:.28s">dsh-ui-outline</h1>
			<div class="tag anim fade-up" style="animation-delay:.45s">长对话，不必来回翻。</div>
			<div class="feats muted anim fade-up" style="animation-delay:.62s">轮次导航轨 · 悬停预览 · 滚轮步进 · ⌘F 对话搜索</div>
		</div>
		<div class="meta muted anim fade-in" style="animation-delay:1.05s">真实界面 · 一段 36 轮的技术讨论</div>
		<div class="railBlock">
			<div class="orb anim fade-in" style="animation-delay:.6s"></div>
			<div class="rail">${ticks}</div>
			<div class="preview card anim fade-up" style="animation-delay:1.15s">
				<div class="q">为什么要除以根号 d_k？不除会怎样？</div>
				<div class="a">点积的方差随 d_k 线性增长，softmax 会进入饱和区；除以 √d_k 把方差拉回 1 附近。</div>
				<div class="bar"></div>
			</div>
		</div>
	`;
	return page("dsh-ui-outline", css, body);
}

function materialsHtml(stills) {
	const rows = [
		{ key: "none", zh: "不透明", en: "none", note: "零模糊，官方纸面质感" },
		{ key: "frost", zh: "毛玻璃", en: "frost", note: "默认 · 80% 底色 / 6px 模糊" },
		{ key: "liquid", zh: "液态玻璃", en: "liquid", note: "更薄透，边缘折光" },
	];
	const css = `
		.title { position: absolute; left: 120px; top: 88px; }
		.title h2 { margin: 0 0 10px; font-size: 46px; letter-spacing: -.02em; }
		.title p { margin: 0; font-size: 18px; }
		.rows { position: absolute; left: 120px; top: 224px; width: 1200px; display: flex; flex-direction: column; gap: 20px; }
		.row { display: flex; align-items: center; gap: 34px; }
		.label { width: 200px; text-align: right; }
		.label .zh { font-size: 24px; font-weight: 650; letter-spacing: -.01em; }
		.label .en { margin-top: 2px; font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: #8a9099; }
		.shot { width: 500px; height: 170px; border-radius: 14px; overflow: hidden; border: 1px solid rgba(16,20,30,.08); box-shadow: 0 10px 28px rgba(16,20,30,.09); background: #fff; }
		.shot img { width: 500px; height: 170px; display: block; object-fit: contain; }
		.note { margin-left: 8px; font-size: 14px; color: #6a7078; }
		.foot { position: absolute; left: 120px; bottom: 58px; font-size: 15px; letter-spacing: .02em; }
	`;
	const body = `
		<div class="title">
			<h2 class="anim fade-up" style="animation-delay:.10s">同一条预览，三种材质</h2>
			<p class="muted anim fade-up" style="animation-delay:.28s">设置即时生效，预览卡与搜索浮层同步切换</p>
		</div>
		<div class="rows">
			${rows.map((r, i) => `
			<div class="row anim fade-up" style="animation-delay:${0.45 + i * 0.35}s">
				<div class="label"><div class="zh">${r.zh}</div><div class="en">${r.en}</div></div>
				<div class="shot"><img src="${stills[r.key]}" alt="${r.key}"></div>
				<div class="note">${r.note}</div>
			</div>`).join("")}
		</div>
		<div class="foot muted anim fade-in" style="animation-delay:1.65s">设置 → 插件 → dsh-ui-outline</div>
	`;
	return page("materials", css, body);
}

function outroHtml() {
	const css = `
		.wrap { position: absolute; left: 0; right: 0; top: 264px; text-align: center; }
		.wrap h2 { margin: 0 0 14px; font-size: 46px; letter-spacing: -.02em; }
		.wrap .sub { font-size: 19px; }
		.code { margin: 42px auto 0; display: inline-flex; align-items: center; gap: 16px; background: #14161c; color: #f7f8fa; border-radius: 16px; padding: 22px 30px; font-family: ${MONO}; font-size: 24px; letter-spacing: -.01em; box-shadow: 0 24px 60px rgba(16,20,30,.22); min-width: 760px; justify-content: flex-start; }
		.code .dollar { color: #7d8dff; }
		.code .cmd { white-space: pre; }
		.code .caret { display: inline-block; width: 2px; height: 26px; margin-left: 3px; background: #8f9dff; animation: caret 1s steps(1) infinite; }
		.note { margin-top: 28px; font-size: 17px; }
		.repo { margin-top: 12px; font-size: 14px; letter-spacing: .03em; color: #8a9099; }
		.rail { position: absolute; left: 50%; bottom: 72px; transform: translateX(-50%); display: flex; gap: 9px; }
		.rail i { display: block; width: 2px; height: 14px; border-radius: 2px; background: #c3c8cf; }
		.rail i:nth-child(14) { background: #4d6bfe; height: 20px; margin-top: -3px; }
	`;
	const cmd = "dsh plugin --profile web add dsh-ui-outline";
	const body = `
		<div class="wrap">
			<h2 class="anim fade-up" style="animation-delay:.10s">装上试试</h2>
			<div class="sub muted anim fade-up" style="animation-delay:.24s">重启 dsh web，刷新页面</div>
			<div class="code anim fade-in" style="animation-delay:.40s">
				<span class="dollar">$</span><span class="cmd" id="cmd"></span><span class="caret"></span>
			</div>
			<div class="note muted anim fade-in" style="animation-delay:2.55s">导航轨与 ⌘F 搜索，一处开启</div>
			<div class="repo anim fade-in" style="animation-delay:2.75s">github.com/iluluyu/dsh-ui-outline · MIT</div>
		</div>
		<div class="rail anim fade-in" style="animation-delay:.5s">${Array.from({ length: 29 }, () => "<i></i>").join("")}</div>
	`;
	const script = `
		window.addEventListener("load", () => {
			const t = ${JSON.stringify(cmd)};
			let i = 0;
			const el = document.getElementById("cmd");
			const id = setInterval(() => {
				el.textContent = t.slice(0, ++i);
				if (i >= t.length) clearInterval(id);
			}, 34);
		});
	`;
	return page("install", css, body, script);
}

/* ------------------------------------------------------------------ */
/* recorder                                                            */
/* ------------------------------------------------------------------ */
function encodeFrames(name, frames, endT) {
	const dir = join(HQ, "cards", name + "-frames");
	const list = ["ffconcat version 1.0"];
	for (let i = 0; i < frames.length; i++) {
		const cur = frames[i];
		const next = frames[i + 1];
		const dur = next ? Math.max(0.005, next.t - cur.t) : Math.max(0.25, endT - cur.t + 0.2);
		list.push(`file '${join(dir, "f" + String(cur.i).padStart(5, "0") + ".png")}'`);
		list.push(`duration ${dur.toFixed(4)}`);
	}
	list.push(`file '${join(dir, "f" + String(frames[frames.length - 1].i).padStart(5, "0") + ".png")}'`);
	const listFile = join(dir, "list.txt");
	writeFileSync(listFile, list.join("\n") + "\n");
	const out = join(HQ, "cards", name + ".mp4");
	const r = spawnSync("ffmpeg", [
		"-y", "-hide_banner", "-loglevel", "error",
		"-f", "concat", "-safe", "0", "-i", listFile,
		"-vf", "fps=" + FPS,
		"-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "4", "-pix_fmt", "yuv444p", "-r", String(FPS), out,
	], { encoding: "utf8" });
	if (r.status !== 0) throw new Error("card encode failed: " + r.stderr);
	return out;
}

async function recordCard(name, html, durationMs) {
	const cardsDir = join(HQ, "cards");
	const frameDir = join(cardsDir, name + "-frames");
	rmSync(frameDir, { recursive: true, force: true });
	mkdirSync(frameDir, { recursive: true });
	const file = join(cardsDir, name + ".html");
	writeFileSync(file, html);
	const browser = await chromium.launch({ executablePath: CHROME, headless: true });
	const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
	const page = await context.newPage();
	await page.goto("file://" + file, { waitUntil: "load" });
	await page.evaluate(() => document.fonts.ready);
	const cdp = await context.newCDPSession(page);
	const frames = [];
	let t0 = null;
	let stopping = false;
	cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
		if (stopping) return;
		if (t0 === null) t0 = Date.now();
		const idx = frames.length;
		writeFileSync(join(frameDir, "f" + String(idx).padStart(5, "0") + ".png"), Buffer.from(data, "base64"));
		frames.push({ i: idx, t: (Date.now() - t0) / 1000 });
		await cdp.send("Page.screencastFrameAck", { sessionId });
	});
	await cdp.send("Page.startScreencast", { format: "png", maxWidth: W, maxHeight: H, everyNthFrame: 1 });
	await sleep(300);
	if (t0 === null) t0 = Date.now();
	const playAt = (Date.now() - t0) / 1000;
	await page.evaluate(() => window.__play());
	await sleep(durationMs);
	stopping = true;
	await cdp.send("Page.stopScreencast");
	await sleep(300);
	const endT = (Date.now() - t0) / 1000;
	await context.close();
	await browser.close();
	const out = encodeFrames(name, frames, endT);
	return { name, video: out, playAt: Number(playAt.toFixed(2)), frames: frames.length };
}

/* ------------------------------------------------------------------ */
async function main() {
	mkdirSync(STILLS, { recursive: true });
	mkdirSync(join(HQ, "cards"), { recursive: true });
	const materials = [["none", "无材质"], ["frost", "毛玻璃"], ["liquid", "液态玻璃"]];
	const stills = {};
	for (const [key, label] of materials) {
		console.log("material", key);
		await applyMaterial(label);
		const png = await captureStill(key, label);
		stills[key] = "data:image/png;base64," + readFileSync(png).toString("base64");
	}
	const results = [];
	results.push(await recordCard("intro", introHtml(), 3400));
	results.push(await recordCard("materials", materialsHtml(stills), 4600));
	results.push(await recordCard("outro", outroHtml(), 4300));
	writeFileSync(join(HQ, "cards", "cards.json"), JSON.stringify(results, null, "\t") + "\n");
	console.log(results);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
