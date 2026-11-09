#!/usr/bin/env node
/**
 * Record the dsh-ui-outline demo takes.
 *
 * A take = one Playwright context with 1440x900 video. Each take starts from
 * a deterministic outline config (written through the real settings UI, not
 * by editing files), pins the seeded session through localStorage so the app
 * never creates an empty session first, and injects a cursor overlay so the
 * hover/click choreography is legible in the final video.
 *
 * Usage:
 *   node video/tools/record.mjs                 # all takes
 *   node video/tools/record.mjs --take=hover    # one take
 *   node video/tools/record.mjs --url=<token URL> --skip-server
 *
 * Output: video/.work/takes/<name>.webm + <name>.json (event times, seconds
 * from context creation, used by build-video.mjs to place captions).
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { CHROME } from "./chrome.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const WORK = join(VIDEO, ".work");
const TAKES = join(WORK, "takes");
const STATE = JSON.parse(readFileSync(join(WORK, "demo.json"), "utf8"));
const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => {
	const m = a.match(/^--([^=]+)(?:=(.*))?$/);
	return m ? [m[1], m[2] ?? true] : [a, true];
}));
const WANT = ARGS.take ? String(ARGS.take).split(",") : null;
const PORT = Number(ARGS.port ?? STATE.port ?? 7418);
const SKIP_SERVER = Boolean(ARGS["skip-server"]) || Boolean(ARGS.url);



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
		} catch { /* not up yet */ }
		await new Promise((r) => setTimeout(r, 400));
	}
	return false;
}

async function ensureServer() {
	if (baseUrl) return;
	const probe = `http://127.0.0.1:${PORT}/`;
	if (await waitForUrl(probe, 1200)) {
		throw new Error(`port ${PORT} already serves a dsh instance without a known token; stop it or pass --url`);
	}
	const logPath = join(WORK, "server.log");
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
	while (!baseUrl && Date.now() < deadline) await new Promise((r) => setTimeout(r, 300));
	writeFileSync(logPath, log.join(""));
	if (!baseUrl) throw new Error("dsh web did not print a token URL; see " + logPath);
	if (!(await waitForUrl(baseUrl))) throw new Error("dsh web did not answer at " + baseUrl);
}

function stopServer() {
	if (!serverProc) return;
	try { process.kill(-serverProc.pid, "SIGTERM"); } catch { /* gone */ }
	serverProc = null;
}

/* ------------------------------------------------------------------ */
/* page helpers                                                        */
/* ------------------------------------------------------------------ */
const CURSOR_OVERLAY = () => {
	const mount = () => {
		const style = document.createElement("style");
		style.textContent = `
			#olx-demo-cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px;
				z-index: 2147483647; pointer-events: none; will-change: transform;
				transition: opacity .15s ease; }
			#olx-demo-cursor svg { display: block; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
			.olx-demo-ping { position: fixed; left: 0; top: 0; width: 34px; height: 34px;
				z-index: 2147483646; pointer-events: none; border-radius: 50%;
				border: 2px solid rgba(77,107,254,.85); box-shadow: 0 0 0 6px rgba(77,107,254,.12);
				transform: translate(-50%,-50%) scale(.25); opacity: 1;
				animation: olx-demo-ping .5s cubic-bezier(.2,.7,.2,1) forwards; }
			@keyframes olx-demo-ping {
				to { transform: translate(-50%,-50%) scale(1.15); opacity: 0; }
			}
			@media (prefers-reduced-motion: reduce) { .olx-demo-ping { animation-duration: .01s; } }
		`;
		document.head.appendChild(style);
		const el = document.createElement("div");
		el.id = "olx-demo-cursor";
		el.innerHTML = `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
			<path d="M3.2 2.4 L18.2 9.6 L11.6 11.6 L9.2 18.4 Z"
				fill="#ffffff" stroke="#111318" stroke-width="1.3" stroke-linejoin="round"/>
		</svg>`;
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
	await page.waitForTimeout(pause);
	return m;
}

async function preloadConversation(page) {
	await page.waitForFunction(() => document.querySelector("#dsh-outline-root") !== null, null, { timeout: 20000 });
	const more = page.getByText("加载更早", { exact: true });
	if (await more.count()) {
		await more.first().click();
		await page.waitForTimeout(1500);
	}
	await page.waitForFunction(() => document.querySelectorAll("#dsh-outline-root .ol-markBtn").length >= 36, null, { timeout: 20000 });
	await page.waitForTimeout(600);
}

async function openApp(page, at) {
	await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
	at("goto");
	await page.waitForTimeout(2800);
	at("ready");
	await preloadConversation(page);
	at("preloaded");
}

async function goPlugins(page) {
	await page.locator('button:has-text("插件")').first().click();
	await page.waitForTimeout(900);
	await page.locator('button:has-text("dsh-ui-outline")').first().click();
	await page.waitForTimeout(900);
}

async function goChat(page) {
	await page.getByRole("treeitem").filter({ hasText: STATE.title }).first().click();
	await page.waitForTimeout(1400);
}

/* ------------------------------------------------------------------ */
/* takes                                                               */
/* ------------------------------------------------------------------ */
async function applyPrefs(prefs) {
	const browser = await chromium.launch({ executablePath: CHROME, headless: true });
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
	await context.addInitScript(initScript(STATE.sessionId));
	const page = await context.newPage();
	await openApp(page, () => {});
	await goPlugins(page);
	if (prefs.side) await page.getByRole("button", { name: prefs.side, exact: true }).click();
	if (prefs.layout) await page.getByRole("button", { name: prefs.layout, exact: true }).click();
	if (prefs.material) await page.getByRole("button", { name: prefs.material, exact: true }).click();
	if (prefs.narrow) await page.getByRole("button", { name: prefs.narrow, exact: true }).click();
	await page.waitForTimeout(700);
	await context.close();
	await browser.close();
}

const TAKES_SPEC = {
	"rail": {
		prefs: { side: "右侧", layout: "紧凑", material: "毛玻璃" },
		async run(page, at, wait) {
			// open on the latest turns, then travel the history so the rail tracks it
			await page.locator("[data-conversation-scroll]").hover();
			for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -1600); await wait(90); }
			at("scroll-up");
			await wait(700);
			for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 900); await wait(90); }
			at("scroll-down");
			await wait(500);
			// live settings: dock left + loose density
			await goPlugins(page);
			at("settings-open");
			await wait(1100);
			await page.getByRole("button", { name: "左侧", exact: true }).click();
			at("side-left");
			await wait(1500);
			await page.getByRole("button", { name: "宽松", exact: true }).click();
			at("layout-loose");
			await wait(1500);
			await goChat(page);
			at("back-to-chat");
			await wait(500);
			await page.locator("[data-conversation-scroll]").hover();
			for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -1600); await wait(90); }
			at("rail-scroll-up");
			await wait(600);
			for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 1200); await wait(90); }
			at("rail-scroll-down");
			await wait(900);
		},
	},
	"hover": {
		prefs: { side: "左侧", layout: "宽松", material: "毛玻璃" },
		async run(page, at, wait) {
			await page.locator("[data-conversation-scroll]").hover();
			for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -1400); await wait(80); }
			await wait(400);
			await hoverMark(page, 4, 550); at("hover-1");
			await hoverMark(page, 7, 550); at("hover-2");
			await hoverMark(page, 10, 650); at("hover-3");
			const rest = await hoverMark(page, 13, 900); at("hover-rest");
			// wheel-step: cursor walks ahead while the conversation stays put
			await page.mouse.wheel(0, 100); await wait(450); at("wheel-1");
			await page.mouse.wheel(0, 100); await wait(450); at("wheel-2");
			await page.mouse.wheel(0, 100); await wait(650); at("wheel-3");
			await page.mouse.wheel(0, -100); await wait(450); at("wheel-back");
			await page.mouse.wheel(0, 100); await wait(900); at("wheel-4");
			// a click after wheel-stepping commits the shown selection
			await page.mouse.click(rest.x, rest.y); at("commit-wheel");
			await page.waitForTimeout(2200);
			// then a plain hover + click on a far mark
			await hoverMark(page, 19, 800); at("hover-far");
			await page.mouse.click((await markPoints(page))[19].x, (await markPoints(page))[19].y);
			at("commit-far");
			await page.waitForTimeout(2000);
		},
	},
	"search": {
		prefs: { side: "左侧", layout: "宽松", material: "毛玻璃" },
		async run(page, at, wait) {
			await page.locator("[data-conversation-scroll]").hover();
			for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -1200); await wait(80); }
			await wait(300);
			await page.keyboard.press("Control+f");
			await wait(750); at("spotlight-open");
			await page.locator(".ol-searchInput").click();
			await page.keyboard.type("注意力", { delay: 220 });
			await wait(900); at("typed-attention");
			await page.keyboard.press("ArrowDown");
			await wait(450);
			await page.keyboard.press("ArrowDown");
			at("arrow-select");
			await wait(650);
			await page.keyboard.press("Enter");
			at("enter");
			await page.waitForTimeout(2500);
			at("landed");
			await page.keyboard.press("Control+f");
			await wait(900); at("reopen");
			await page.keyboard.press("End");
			await page.keyboard.type(" 显存", { delay: 180 });
			await wait(1100); at("and-filter");
			await page.keyboard.press("Escape");
			await wait(650); at("close");
		},
	},
	"narrow": {
		prefs: { side: "左侧", layout: "宽松", material: "毛玻璃", narrow: "显示" },
		async run(page, at, wait) {
			await page.locator("[data-conversation-scroll]").hover();
			for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -1200); await wait(80); }
			await wait(300);
			await hoverMark(page, 7, 800); at("hover-wide");
			await page.setViewportSize({ width: 900, height: 900 });
			await wait(1200); at("narrow");
			await hoverMark(page, 11, 900); at("hover-narrow");
			await page.mouse.click((await markPoints(page))[11].x, (await markPoints(page))[11].y);
			at("jump-narrow");
			await page.waitForTimeout(1400);
		},
	},
	"mat-none": { prefs: { side: "左侧", layout: "宽松", material: "无材质" }, materialClip: true },
	"mat-frost": { prefs: { side: "左侧", layout: "宽松", material: "毛玻璃" }, materialClip: true },
	"mat-liquid": { prefs: { side: "左侧", layout: "宽松", material: "液态玻璃" }, materialClip: true },
};

async function materialClip(page, at) {
	await page.locator("[data-conversation-scroll]").hover();
	for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -1200); await new Promise((r) => setTimeout(r, 80)); }
	await page.waitForTimeout(400);
	await hoverMark(page, 8, 2600);
	at("hover-material");
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function recordTake(name, spec) {
	if (spec.prefs) {
		console.log(`[${name}] apply prefs`, JSON.stringify(spec.prefs));
		await applyPrefs(spec.prefs);
	}
	const takeDir = join(TAKES, name + "-video");
	rmSync(takeDir, { recursive: true, force: true });
	mkdirSync(takeDir, { recursive: true });
	const browser = await chromium.launch({ executablePath: CHROME, headless: true });
	const started = Date.now();
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 1,
		recordVideo: { dir: takeDir, size: { width: 1440, height: 900 } },
	});
	await context.addInitScript(initScript(STATE.sessionId));
	const page = await context.newPage();
	const events = {};
	const at = (label) => { events[label] = Number(((Date.now() - started) / 1000).toFixed(2)); };
	const wait = sleep;
	await openApp(page, at);
	if (spec.materialClip) await materialClip(page, at);
	else await spec.run(page, at, wait);
	await page.waitForTimeout(400);
	await context.close();
	const video = await page.video().path();
	await browser.close();
	const out = join(TAKES, name + ".webm");
	const raw = readdirSync(takeDir).find((f) => f.endsWith(".webm"));
	const { renameSync } = await import("node:fs");
	renameSync(raw ? join(takeDir, raw) : video, out);
	writeFileSync(join(TAKES, name + ".json"), JSON.stringify({ name, video: out, events }, null, "\t") + "\n");
	console.log(`[${name}] -> ${out}`, JSON.stringify(events));
	return { name, video: out, events };
}

async function main() {
	mkdirSync(TAKES, { recursive: true });
	await ensureServer();
	console.log("app:", baseUrl.replace(/token=[^&]+/, "token=***"));
	const names = Object.keys(TAKES_SPEC).filter((n) => !WANT || WANT.includes(n));
	for (const name of names) await recordTake(name, TAKES_SPEC[name]);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => {
		if (!ARGS["keep-server"]) stopServer();
	});
