#!/usr/bin/env node
/**
 * Encode the captured UI stills/floops into the README asset set.
 *
 * Input:  video/.work/visuals (from tools/visuals.mjs)
 * Output: docs/img/*.webp, docs/img/*.avif, docs/img/bento.png|webp
 *
 * Animated AVIF (avifenc, per-frame durations) replaces the old 13 MB demo
 * video: the rail loop is ~50 KB, the search loop ~250 KB, both cropped to
 * the region that actually shows the feature.
 */
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { CHROME } from "./chrome.mjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const PLUGIN = resolve(VIDEO, "..");
const WORK = join(VIDEO, ".work", "visuals");
const IMG = join(PLUGIN, "docs", "img");
mkdirSync(IMG, { recursive: true });
const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

const SIZE = (file) => {
	const out = sh("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]).toString().trim();
	const [w, h] = out.split(",").map(Number);
	return { w, h };
};

/* ---------------------------------------------------------------- stills */
function webp(src, dst, quality = 84) {
	sh("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-c:v", "libwebp", "-quality", String(quality), "-compression_level", "6", dst]);
	const from = SIZE(src), to = SIZE(dst);
	console.log(`still ${dst.split("/").pop()}  ${from.w}x${from.h} -> ${to.w}x${to.h}  ${(readFileSync(dst).length / 1024).toFixed(0)} KB`);
}

/* ---------------------------------------------------------------- loops */
/* GIF, not AVIF: GitHub renders README images through Camo, and animated
   AVIF is not reliable there (it tends to show only the first frame).
   Six frames of UI at 2x still land at a few hundred KB — the old demo
   video was 13 MB. Frame holds are centiseconds. */
function animatedGif(specFile, dst, holds) {
	const spec = JSON.parse(readFileSync(specFile, "utf8"));
	const frames = spec.frames.map((f) => (typeof f === "string" ? f : f.file));
	const args = [];
	frames.forEach((file, i) => args.push("-delay", String(holds[i] ?? 10), file));
	args.push("-loop", "0", "-layers", "Optimize", dst);
	sh("magick", args);
	const { w, h } = SIZE(dst);
	console.log(`loop  ${dst.split("/").pop()}  ${w}x${h}  ${(readFileSync(dst).length / 1024).toFixed(0)} KB`);
}

/* ------------------------------------------------------------------ run */
const EN = process.argv.includes("--lang=en");
const suffix = (name) => EN ? name.replace(/(\.[^.]+)$/, "-en$1") : name;
const V = (name) => join(WORK, suffix(name));
const I = (name) => join(IMG, suffix(name));

/* Board parts: real 2x crops, kept at native size so the board composes at
   1:1. hero 420x281 CSS, search 880x280 CSS, materials 300x102 CSS each. */
webp(V("hero.png"), I("board-hero.webp"), 88);
webp(V("search.png"), I("board-search.webp"), 86);
for (const m of ["none", "frost", "liquid"]) webp(V(`material-${m}.png`), I(`board-material-${m}.webp`), 88);

/* The board is the README's opening visual: one 880px-wide 2x composited
   sheet (hero + materials + search). At 880 display it is 1:1 — no tile
   shrinks into unreadability the way the old 1560px board did. */
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 880, height: 635 }, deviceScaleFactor: 2 });
const tab = await ctx.newPage();
await tab.goto("file://" + join(PLUGIN, "docs", "preview", "board.html") + (EN ? "?lang=en" : ""), { waitUntil: "load" });
await tab.evaluate(() => document.fonts?.ready);
await tab.waitForTimeout(500);
const shot = V("board.png");
await tab.screenshot({ path: shot, fullPage: true });
await browser.close();
console.log(`board ${SIZE(shot).w}x${SIZE(shot).h}`);
webp(shot, I("board.webp"), 88);

/* Motion: two short loops. GIF, not AVIF: GitHub renders README images
   through Camo, and animated AVIF is not reliable there. ~390 KB total,
   replacing a 13 MB video. */
animatedGif(V("loop-rail.json"), I("loop-rail.gif"), [20, 10, 10, 10, 10, 80]);
animatedGif(V("loop-search.json"), I("loop-search.gif"), [30, 10, 10, 100, 40, 40]);

console.log("done ->", IMG);
