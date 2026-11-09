#!/usr/bin/env node
/**
 * Render the three designed interstitials (intro / material comparison /
 * outro) as 1440x900 videos, using the same Playwright + Chromium stack as
 * the live takes. Everything is plain HTML/CSS/JS on a file:// page, so the
 * cards are editable without touching the app.
 *
 * The material stills are cropped out of the recorded hover takes, so the
 * comparison board shows the real preview card for each material.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import { CHROME } from "./chrome.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const WORK = join(VIDEO, ".work");
const CARDS = join(WORK, "cards");
const TAKES = join(WORK, "takes");

const FONT = '"Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
const MONO = '"Noto Sans Mono CJK SC", "Noto Sans Mono", ui-monospace, SFMono-Regular, monospace';

/* ------------------------------------------------------------------ */
/* material stills                                                     */
/* ------------------------------------------------------------------ */
function extractStills() {
	const out = {};
	for (const [key, file] of [["none", "mat-none"], ["frost", "mat-frost"], ["liquid", "mat-liquid"]]) {
		const src = join(TAKES, file + ".webm");
		if (!existsSync(src)) throw new Error("missing take " + src);
		const png = join(CARDS, "card-" + key + ".png");
		const r = spawnSync("ffmpeg", [
			"-hide_banner", "-loglevel", "error", "-y",
			"-ss", "8.9", "-i", src, "-frames:v", "1",
			"-vf", "crop=340:130:318:300", png,
		], { stdio: "inherit" });
		if (r.status !== 0) throw new Error("ffmpeg crop failed for " + key);
		out[key] = "data:image/png;base64," + readFileSync(png).toString("base64");
	}
	return out;
}

/* ------------------------------------------------------------------ */
/* shared card chrome                                                  */
/* ------------------------------------------------------------------ */
const BASE_CSS = `
	* { box-sizing: border-box; }
	html, body { margin: 0; width: 1440px; height: 900px; overflow: hidden; }
	body {
		background:
			radial-gradient(900px 600px at 82% 12%, rgba(77,107,254,.12), transparent 62%),
			radial-gradient(700px 500px at 12% 88%, rgba(168,85,247,.08), transparent 60%),
			#f4f5f7;
		font-family: ${FONT};
		color: #12141a;
		-webkit-font-smoothing: antialiased;
	}
	.stage { position: relative; width: 1440px; height: 900px; padding: 0 120px; }
	.eyebrow {
		font-size: 13px; letter-spacing: .24em; font-weight: 600;
		color: #4d6bfe; text-transform: uppercase;
	}
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
/* intro                                                               */
/* ------------------------------------------------------------------ */
function introHtml() {
	const ticks = Array.from({ length: 22 }, (_, i) => {
		const hot = i === 16;
		return `<i class="tick${hot ? " hot" : ""}" style="animation-delay:${(0.55 + i * 0.035).toFixed(2)}s"></i>`;
	}).join("");
	const css = `
		.hero { position: absolute; left: 120px; top: 232px; width: 760px; }
		.hero h1 {
			margin: 22px 0 18px; font-size: 78px; line-height: 1.02; letter-spacing: -.035em;
			font-weight: 700;
		}
		.hero .tag { font-size: 34px; line-height: 1.35; font-weight: 500; letter-spacing: -.01em; }
		.hero .feats { margin-top: 26px; font-size: 18px; letter-spacing: .02em; }
		.stage > .meta { position: absolute; left: 120px; bottom: 64px; font-size: 14px; letter-spacing: .04em; }
		.railBlock { position: absolute; right: 118px; top: 196px; width: 380px; height: 540px; }
		.rail {
			position: absolute; right: 0; top: 0; width: 44px; height: 100%;
			display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
			padding-top: 16px;
		}
		.tick {
			display: block; width: 24px; height: 2px; border-radius: 2px;
			background: #9aa0a8; opacity: 0; transform: scaleX(.25); transform-origin: right;
			animation: tick .5s ease forwards;
		}
		.tick.hot { background: #12141a; }
		@keyframes tick { to { opacity: .55; transform: scaleX(1); } }
		.orb {
			position: absolute; right: 52px; top: 120px; width: 300px; height: 220px;
			border-radius: 50%;
			background:
				radial-gradient(120px 90px at 30% 35%, rgba(77,107,254,.55), transparent 70%),
				radial-gradient(120px 90px at 72% 62%, rgba(236,72,153,.38), transparent 70%),
				radial-gradient(140px 110px at 55% 20%, rgba(250,204,21,.35), transparent 72%);
			filter: blur(26px);
		}
		.preview {
			position: absolute; right: 26px; top: 176px; width: 332px; padding: 16px 18px 15px;
		}
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

/* ------------------------------------------------------------------ */
/* materials                                                           */
/* ------------------------------------------------------------------ */
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
		.shot {
			width: 476px; height: 182px; border-radius: 14px; overflow: hidden;
			border: 1px solid rgba(16,20,30,.08);
			box-shadow: 0 10px 28px rgba(16,20,30,.09);
			background: #fff;
		}
		.shot img { width: 476px; height: 182px; display: block; }
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

/* ------------------------------------------------------------------ */
/* outro                                                               */
/* ------------------------------------------------------------------ */
function outroHtml() {
	const css = `
		.wrap { position: absolute; left: 0; right: 0; top: 264px; text-align: center; }
		.wrap h2 { margin: 0 0 14px; font-size: 46px; letter-spacing: -.02em; }
		.wrap .sub { font-size: 19px; }
		.code {
			margin: 42px auto 0; display: inline-flex; align-items: center; gap: 16px;
			background: #14161c; color: #f7f8fa; border-radius: 16px;
			padding: 22px 30px; font-family: ${MONO}; font-size: 24px; letter-spacing: -.01em;
			box-shadow: 0 24px 60px rgba(16,20,30,.22);
			min-width: 760px; justify-content: flex-start;
		}
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
async function recordCard(name, html, durationMs) {
	const file = join(CARDS, name + ".html");
	writeFileSync(file, html);
	const dir = join(CARDS, name + "-video");
	mkdirSync(dir, { recursive: true });
	const browser = await chromium.launch({ executablePath: CHROME, headless: true });
	const started = Date.now();
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 1,
		recordVideo: { dir, size: { width: 1440, height: 900 } },
	});
	const page = await context.newPage();
	await page.goto("file://" + file, { waitUntil: "load" });
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(400);
	const playAt = (Date.now() - started) / 1000;
	await page.evaluate(() => window.__play());
	await page.waitForTimeout(durationMs);
	await context.close();
	const video = await page.video().path();
	await browser.close();
	const out = join(CARDS, name + ".webm");
	const raw = readdirSync(dir).find((f) => f.endsWith(".webm"));
	renameSync(raw ? join(dir, raw) : video, out);
	return { name, video: out, playAt: Number(playAt.toFixed(2)) };
}

async function main() {
	mkdirSync(CARDS, { recursive: true });
	const stills = extractStills();
	const results = [];
	results.push(await recordCard("intro", introHtml(), 3400));
	results.push(await recordCard("materials", materialsHtml(stills), 4600));
	results.push(await recordCard("outro", outroHtml(), 4300));
	writeFileSync(join(CARDS, "cards.json"), JSON.stringify(results, null, "\t") + "\n");
	console.log(results);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
