#!/usr/bin/env node
/**
 * Render caption pills as transparent 1440x130 PNGs.
 * One PNG per caption, overlaid by build-video.mjs at y=762.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { CHROME } from "./chrome.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const OUT = join(VIDEO, ".work", "captions");

export const CAPTIONS = [
	{ id: "c01", text: "轨道贴住会话列边缘" },
	{ id: "c02", text: "停靠左缘或右缘，一键切换" },
	{ id: "c03", text: "紧凑与宽松，两种刻度密度" },
	{ id: "c04", text: "悬停刻度，提问与回答即刻预览" },
	{ id: "c05", text: "滚轮逐轮步进，会话主体原地不动" },
	{ id: "c06", text: "轻点直达，落点闪光" },
	{ id: "c07", text: "再远的轮次，一次点击" },
	{ id: "c08", text: "⌘F / Ctrl+F，命中词块高亮" },
	{ id: "c09", text: "命中词块高亮，纯键盘驱动" },
	{ id: "c10", text: "↑ ↓ 选择，↵ 直达原轮" },
	{ id: "c11", text: "空格分词 AND，结果即时收窄" },
	{ id: "c12", text: "Esc 收起，不打断阅读" },
	{ id: "c13", text: "列再窄，导航也不退场" },
	{ id: "c14", text: "900px 窄列，轨道依然贴边" },
];

function html(text) {
	return `<!doctype html>
<html lang="zh">
<head><meta charset="utf-8">
<style>
	html, body { margin: 0; width: 1440px; height: 130px; background: transparent; overflow: hidden; }
	body { display: flex; align-items: center; justify-content: center;
		font-family: "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
		-webkit-font-smoothing: antialiased; }
	.pill {
		display: inline-flex; align-items: center; gap: 12px;
		padding: 12px 26px 13px; border-radius: 999px;
		background: rgba(18, 20, 26, .86);
		border: 1px solid rgba(255,255,255,.13);
		box-shadow: 0 12px 34px rgba(16, 20, 30, .22), inset 0 1px 0 rgba(255,255,255,.06);
		color: #f7f8fa; font-size: 25px; font-weight: 500; letter-spacing: .015em;
		white-space: nowrap;
	}
	.dot { width: 7px; height: 7px; border-radius: 50%; background: #7d8dff;
		box-shadow: 0 0 0 4px rgba(125,141,255,.18); }
</style></head>
<body><div class="pill"><span class="dot"></span><span>${text}</span></div></body>
</html>`;
}

async function main() {
	mkdirSync(OUT, { recursive: true });
	const browser = await chromium.launch({ executablePath: CHROME, headless: true });
	const context = await browser.newContext({ viewport: { width: 1440, height: 130 }, deviceScaleFactor: 1 });
	const page = await context.newPage();
	for (const c of CAPTIONS) {
		writeFileSync(join(OUT, c.id + ".html"), html(c.text));
		await page.goto("file://" + join(OUT, c.id + ".html"), { waitUntil: "load" });
		await page.evaluate(() => document.fonts.ready);
		await page.waitForTimeout(60);
		await page.screenshot({ path: join(OUT, c.id + ".png"), omitBackground: true });
	}
	await browser.close();
	console.log("captions:", CAPTIONS.length, "->", OUT);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
