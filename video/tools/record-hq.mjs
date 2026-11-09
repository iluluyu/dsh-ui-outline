#!/usr/bin/env node
/**
 * High-quality take recorder: native 1920x1080 frames pulled from Chrome's
 * PNG screencast (not Playwright's VP8 video), then re-timed to 25fps.
 *
 * The screencast only pushes frames when the page repaints, so static holds
 * cost nothing; the frame timestamps are expanded into a VFR concat list and
 * `fps=25` fills the holds. That gives lossless UI text at native 1080p and
 * ~23fps during motion without a screenshot pull loop.
 *
 * Usage: node tools/record-hq.mjs [--take=rail,hover] [--url=...]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import { CHROME } from "./chrome.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const WORK = join(VIDEO, ".work");
const HQ = join(WORK, "hq");
const TAKES = join(HQ, "takes");
const STATE = JSON.parse(readFileSync(join(WORK, "demo.json"), "utf8"));
const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => {
	const m = a.match(/^--([^=]+)(?:=(.*))?$/);
	return m ? [m[1], m[2] ?? true] : [a, true];
}));
const WANT = ARGS.take ? String(ARGS.take).split(",") : null;
const PORT = Number(ARGS.port ?? STATE.port ?? 7418);
const SKIP_SERVER = Boolean(ARGS["skip-server"]) || Boolean(ARGS.url);
const W = 1920;
const H = 1080;
const FPS = 25;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* server                                                              */
/* ------------------------------------------------------------------ */
let serverProc = null;
let baseUrl = ARGS.url ? String(ARGS.url) : null;

async function waitForUrl(url, timeoutMs = 45000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url, { redirect: "manual" });
			if (res.status >= 200 && res.status < 500) return true;
		} catch { /* not up */ }
		await sleep(400);
	}
	return false;
}

async function ensureServer() {
	if (baseUrl) return;
	const probe = `http://127.0.0.1:${PORT}/`;
	if (await waitForUrl(probe, 1200)) throw new Error(`port ${PORT} is busy; stop it or pass --url`);
	const log = [];
	serverProc = spawn("dsh", ["web", "--no-open", "--port", String(PORT)], {
		cwd: WORK,
		env: { ...process.env, DSH_HOME: STATE.home },
		detached: true,
		stdio: ["ignore", "pipe", "pipe"],
	});
	serverProc.stdout.on("data", (d) => {
		const s = d.toString();
		log.push(s);
		const m = s.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/);
		if (m && !baseUrl) baseUrl = m[0];
	});
	serverProc.stderr.on("data", (d) => log.push(d.toString()));
	const deadline = Date.now() + 60000;
	while (!baseUrl && Date.now() < deadline) await sleep(300);
	writeFileSync(join(WORK, "server.log"), log.join(""));
	if (!baseUrl || !(await waitForUrl(baseUrl))) throw new Error("dsh web did not start; see .work/server.log");
}

function stopServer() {
	if (!serverProc) return;
	try { process.kill(-serverProc.pid, "SIGTERM"); } catch { /* gone */ }
	serverProc = null;
}

/* ------------------------------------------------------------------ */
/* browser helpers                                                     */
/* ------------------------------------------------------------------ */
const CURSOR_OVERLAY = () => {
	const mount = () => {
		const style = document.createElement("style");
		style.textContent = `
			#olx-demo-cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px;
				z-index: 2147483647; pointer-events: none; will-change: transform; }
			#olx-demo-cursor svg { display: block; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
			.olx-demo-ping { position: fixed; left: 0; top: 0; width: 34px; height: 34px;
				z-index: 2147483646; pointer-events: none; border-radius: 50%;
				border: 2px solid rgba(77,107,254,.85); box-shadow: 0 0 0 6px rgba(77,107,254,.12);
				transform: translate(-50%,-50%) scale(.25); opacity: 1;
				animation: olx-demo-ping .5s cubic-bezier(.2,.7,.2,1) forwards; }
			@keyframes olx-demo-ping { to { transform: translate(-50%,-50%) scale(1.15); opacity: 0; } }
		`;
		document.head.appendChild(style);
		const el = document.createElement("div");
		el.id = "olx-demo-cursor";
		el.innerHTML = `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><path d="M3.2 2.4 L18.2 9.6 L11.6 11.6 L9.2 18.4 Z" fill="#ffffff" stroke="#111318" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
		document.documentElement.appendChild(el);
		const move = (x, y) => { el.style.transform = `translate3d(${x - 3}px, ${y - 2}px, 0)`; };
		window.addEventListener("pointermove", (e) => move(e.clientX, e.clientY), { passive: true });
		window.addEventListener("pointerdown", (e) => {
			const ping = document.createElement("div");
			ping.className = "olx-demo-ping";
			ping.style.left = e.clientX + "px";
			ping.style.top = e.clientY + "px";
			document.documentElement.appendChild(ping);
			setTimeout(() => ping.remove(), 650);
		}, true);
	};
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
	else mount();
};

function initScript(sessionId) {
	return {
		content: `(() => {
			try { localStorage.setItem("dsh.sessions.current", JSON.stringify({ sessionId: ${JSON.stringify(sessionId)} })); } catch (e) {}
			(${CURSOR_OVERLAY.toString()})();
		})();`,
	};
}

async function markPoints(page) {
	return page.evaluate(() => [...document.querySelectorAll("#dsh-outline-root .ol-markBtn")].map((b) => {
		const r = b.getBoundingClientRect();
		return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.getAttribute("aria-label") || "" };
	}));
}

async function hoverMark(page, index, pause = 700) {
	const marks = await markPoints(page);
	const m = marks[Math.max(0, Math.min(index, marks.length - 1))];
	await page.mouse.move(m.x, m.y, { steps: 10 });
	await sleep(pause);
	return m;
}

async function openApp(page, at, viewport = { width: W, height: H }) {
	await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
	at("goto");
	await sleep(2800);
	at("ready");
	await page.waitForFunction(() => document.querySelector("#dsh-outline-root") !== null, null, { timeout: 20000 });
	const more = page.getByText("加载更早", { exact: true });
	if (await more.count()) {
		await more.first().click();
		await sleep(1500);
	}
	await page.waitForFunction(() => document.querySelectorAll("#dsh-outline-root .ol-markBtn").length >= 36, null, { timeout: 20000 });
	await sleep(600);
	at("preloaded");
}

async function goPlugins(page) {
	await page.locator('button:has-text("插件")').first().click();
	await sleep(900);
	await page.locator('button:has-text("dsh-ui-outline")').first().click();
	await sleep(900);
}

async function goChat(page) {
	await page.getByRole("treeitem").filter({ hasText: STATE.title }).first().click();
	await sleep(1400);
}

/* ------------------------------------------------------------------ */
/* prefs                                                               */
/* ------------------------------------------------------------------ */
async function applyPrefs(prefs) {
	const browser = await chromium.launch({ executablePath: CHROME, headless: true });
	const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
	await context.addInitScript(initScript(STATE.sessionId));
	const page = await context.newPage();
	await openApp(page, () => {});
	await goPlugins(page);
	if (prefs.side) await page.getByRole("button", { name: prefs.side, exact: true }).click();
	if (prefs.layout) await page.getByRole("button", { name: prefs.layout, exact: true }).click();
	if (prefs.material) await page.getByRole("button", { name: prefs.material, exact: true }).click();
	if (prefs.narrow) await page.getByRole("button", { name: prefs.narrow, exact: true }).click();
	await sleep(700);
	await context.close();
	await browser.close();
}

/* ------------------------------------------------------------------ */
/* takes                                                               */
/* ------------------------------------------------------------------ */
const TAKES_SPEC = {
	rail: {
		prefs: { side: "右侧", layout: "紧凑", material: "毛玻璃", narrow: "显示" },
		async run(page, at, wait) {
			await page.locator("[data-conversation-scroll]").hover();
			for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -1600); await wait(90); }
			at("scroll-up");
			await wait(700);
			for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 900); await wait(90); }
			at("scroll-down");
			await wait(500);
			await page.locator('button:has-text("插件")').first().click();
			at("plugins");
			await wait(900);
			await page.locator('button:has-text("dsh-ui-outline")').first().click();
			at("card");
			await wait(1100);
			await page.getByRole("button", { name: "左侧", exact: true }).click();
			at("side-click");
			await wait(1500);
			await page.getByRole("button", { name: "宽松", exact: true }).click();
			at("layout-click");
			await wait(1500);
			await goChat(page);
			at("back");
			await wait(600);
			await page.locator("[data-conversation-scroll]").hover();
			for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -1600); await wait(90); }
			at("rail-scroll-up");
			await wait(600);
			for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 1200); await wait(90); }
			at("rail-scroll-down");
			await wait(900);
		},
	},
	hover: {
		prefs: { side: "左侧", layout: "宽松", material: "毛玻璃", narrow: "显示" },
		async run(page, at, wait) {
			await page.locator("[data-conversation-scroll]").hover();
			for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -1400); await wait(80); }
			await wait(400);
			at("scroll");
			await hoverMark(page, 4, 550); at("hover-1");
			await hoverMark(page, 7, 550); at("hover-2");
			await hoverMark(page, 10, 650); at("hover-3");
			const rest = await hoverMark(page, 13, 900); at("hover-rest");
			await page.mouse.wheel(0, 100); await wait(900); at("wheel-1");
			await page.mouse.wheel(0, 100); await wait(450); at("wheel-2");
			await page.mouse.wheel(0, 100); await wait(650); at("wheel-3");
			await page.mouse.wheel(0, -100); await wait(450); at("wheel-back");
			await page.mouse.wheel(0, 100); await wait(900); at("wheel-4");
			await page.mouse.click(rest.x, rest.y); at("commit-wheel");
			await page.waitForTimeout(2200);
			await hoverMark(page, 19, 800); at("hover-far");
			const ms = await markPoints(page);
			await page.mouse.click(ms[19].x, ms[19].y);
			at("commit-far");
			await page.waitForTimeout(2000);
		},
	},
	search: {
		prefs: { side: "左侧", layout: "宽松", material: "毛玻璃", narrow: "显示" },
		async run(page, at, wait) {
			await page.locator("[data-conversation-scroll]").hover();
			for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -1200); await wait(80); }
			await wait(300);
			await page.keyboard.press("Control+f");
			await wait(750); at("spotlight");
			await page.locator(".ol-searchInput").click();
			await page.keyboard.type("注意力", { delay: 220 });
			await wait(900); at("typed");
			await page.keyboard.press("ArrowDown");
			at("arrow-1");
			await wait(450);
			await page.keyboard.press("ArrowDown");
			at("arrow-2");
			await wait(650);
			await page.keyboard.press("Enter");
			at("enter");
			await page.waitForTimeout(2500);
			at("landed");
			await page.keyboard.press("Control+f");
			await wait(900); at("reopen");
			await page.keyboard.press("End");
			await page.keyboard.type(" 显存", { delay: 180 });
			await wait(1100); at("typed-and");
			await page.keyboard.press("Escape");
			await wait(650); at("close");
		},
	},
	"narrow-wide": {
		prefs: { side: "左侧", layout: "宽松", material: "毛玻璃", narrow: "显示" },
		async run(page, at, wait) {
			await page.locator("[data-conversation-scroll]").hover();
			for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -1200); await wait(80); }
			await wait(300);
			await hoverMark(page, 7, 1600); at("hover");
		},
	},
	"narrow": {
		prefs: { side: "左侧", layout: "宽松", material: "毛玻璃", narrow: "显示" },
		viewport: { width: 900, height: 1080 },
		async run(page, at, wait) {
			await page.locator("[data-conversation-scroll]").hover();
			for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -1200); await wait(80); }
			await wait(300);
			await hoverMark(page, 11, 900); at("hover");
			const ms = await markPoints(page);
			await page.mouse.click(ms[11].x, ms[11].y);
			at("jump");
			await page.waitForTimeout(1800);
		},
	},
	"mat-none": { prefs: { side: "左侧", layout: "宽松", material: "无材质", narrow: "显示" }, materialClip: true },
	"mat-frost": { prefs: { side: "左侧", layout: "宽松", material: "毛玻璃", narrow: "显示" }, materialClip: true },
	"mat-liquid": { prefs: { side: "左侧", layout: "宽松", material: "液态玻璃", narrow: "显示" }, materialClip: true },
};

async function materialClip(page, at) {
	await page.locator("[data-conversation-scroll]").hover();
	for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -1200); await sleep(80); }
	await sleep(400);
	await hoverMark(page, 8, 2600);
	at("hover");
}

/* ------------------------------------------------------------------ */
/* recording                                                           */
/* ------------------------------------------------------------------ */
function encodeFrames(name, frames, viewport, endT) {
	const dir = join(TAKES, name + "-frames");
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
	const out = join(TAKES, name + ".mp4");
	const args = [
		"-y", "-hide_banner", "-loglevel", "error",
		"-f", "concat", "-safe", "0", "-i", listFile,
		"-vf", "fps=" + FPS,
		"-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "4",
		"-pix_fmt", "yuv444p", "-r", String(FPS), out,
	];
	const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
	if (r.status !== 0) throw new Error("encode failed for " + name + "\n" + r.stderr);
	return out;
}

async function recordTake(name, spec) {
	if (spec.prefs) {
		console.log(`[${name}] prefs`, JSON.stringify(spec.prefs));
		await applyPrefs(spec.prefs);
	}
	const viewport = spec.viewport ?? { width: W, height: H };
	const frameDir = join(TAKES, name + "-frames");
	rmSync(frameDir, { recursive: true, force: true });
	mkdirSync(frameDir, { recursive: true });

	const browser = await chromium.launch({ executablePath: CHROME, headless: true });
	const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
	await context.addInitScript(initScript(STATE.sessionId));
	const page = await context.newPage();
	const events = {};
	let t0 = null;
	const at = (k) => { events[k] = Number((((Date.now() - (t0 ?? Date.now())) / 1000)).toFixed(2)); };

	await openApp(page, at, viewport);
	const cdp = await context.newCDPSession(page);
	const frames = [];
	let stopping = false;
	cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
		if (stopping) return;
		if (t0 === null) { t0 = Date.now(); events.start = 0; }
		const idx = frames.length;
		writeFileSync(join(frameDir, "f" + String(idx).padStart(5, "0") + ".png"), Buffer.from(data, "base64"));
		frames.push({ i: idx, t: (Date.now() - t0) / 1000 });
		await cdp.send("Page.screencastFrameAck", { sessionId });
	});
	await cdp.send("Page.startScreencast", {
		format: "png", maxWidth: viewport.width, maxHeight: viewport.height, everyNthFrame: 1,
	});
	await sleep(250);
	if (spec.materialClip) await materialClip(page, at);
	else await spec.run(page, at, sleep);
	await sleep(400);
	stopping = true;
	await cdp.send("Page.stopScreencast");
	await sleep(300);
	await context.close();
	await browser.close();
	if (frames.length < 2) throw new Error("no frames captured for " + name);
	const endT = t0 === null ? 0 : (Date.now() - t0) / 1000;
	const out = encodeFrames(name, frames, viewport, endT);
	writeFileSync(join(TAKES, name + ".json"), JSON.stringify({ name, viewport, video: out, frames: frames.length, events }, null, "\t") + "\n");
	console.log(`[${name}] ${frames.length} frames -> ${out}`, JSON.stringify(events));
	return { name, out, events };
}

async function main() {
	mkdirSync(TAKES, { recursive: true });
	mkdirSync(HQ, { recursive: true });
	await ensureServer();
	writeFileSync(join(HQ, "server-url.txt"), baseUrl + "\n");
	console.log("app:", baseUrl.replace(/token=[^&]+/, "token=***"));
	console.log("server URL: .work/hq/server-url.txt");
	const names = Object.keys(TAKES_SPEC).filter((n) => !WANT || WANT.includes(n));
	for (const name of names) await recordTake(name, TAKES_SPEC[name]);
}

main()
	.catch((e) => { console.error(e); process.exitCode = 1; })
	.finally(() => { if (!ARGS["keep-server"]) stopServer(); });
