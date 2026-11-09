#!/usr/bin/env node
/**
 * Assemble the recorded takes + designed cards into the final demo.
 *
 * Every segment is normalized to 1440x900 / 25fps / yuv420p first, captions
 * are burned in per segment (rounded pill PNGs with alpha fades), then the
 * segments are concatenated and encoded once. The GIF is a short window cut
 * out of the finished timeline, not a second edit.
 *
 * Usage: node video/tools/build-video.mjs
 * Output: video/outline-demo-h264-1440p.mp4
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const WORK = join(VIDEO, ".work");
const TAKES = join(WORK, "takes");
const CARDS = join(WORK, "cards");
const CAPS = join(WORK, "captions");
const BUILD = join(WORK, "build");
const OUT = VIDEO;

const W = 1440;
const H = 900;
const FPS = 25;

function run(args, label) {
	const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
	if (r.status !== 0) throw new Error("ffmpeg failed: " + label);
}

function duration(file) {
	const r = spawnSync("ffprobe", [
		"-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file,
	], { encoding: "utf8" });
	return Number(r.stdout.trim());
}

/* ------------------------------------------------------------------ */
/* timeline                                                            */
/* ------------------------------------------------------------------ */
const cards = JSON.parse(readFileSync(join(CARDS, "cards.json"), "utf8"));
const cardIn = Object.fromEntries(cards.map((c) => [c.name, c.playAt + 0.02]));

const segments = [
	{ id: "intro", kind: "card", src: "intro", in: cardIn.intro, out: cardIn.intro + 3.9 },
	{ id: "rail-wide", kind: "take", src: "rail", in: 5.35, out: 7.15, cap: "c01" },
	{ id: "rail-side", kind: "take", src: "rail", in: 8.95, out: 11.55, cap: "c02" },
	{ id: "rail-density", kind: "take", src: "rail", in: 11.55, out: 14.6, cap: "c03" },
	{ id: "rail-loose", kind: "take", src: "rail", in: 15.0, out: 17.8 },

	{ id: "hover-preview", kind: "take", src: "hover", in: 6.15, out: 10.15, cap: "c04" },
	{ id: "wheel", kind: "take", src: "hover", in: 9.55, out: 12.3, cap: "c05" },
	{ id: "click-jump", kind: "take", src: "hover", in: 12.05, out: 14.7, cap: "c06" },
	{ id: "click-far", kind: "take", src: "hover", in: 15.1, out: 17.45, cap: "c07" },

	{ id: "spotlight", kind: "take", src: "search", in: 6.15, out: 9.2, cap: "c08" },
	{ id: "search-jump", kind: "take", src: "search", in: 9.2, out: 12.6, cap: "c10" },
	{ id: "and-filter", kind: "take", src: "search", in: 12.6, out: 15.3, cap: "c11" },

	{ id: "materials", kind: "card", src: "materials", in: cardIn.materials, out: 5.36 },

	{ id: "narrow-wide", kind: "take", src: "narrow", in: 6.15, out: 7.9, cap: "c13" },
	{ id: "narrow", kind: "take", src: "narrow", in: 8.4, out: 10.95, narrow: true, cap: "c14" },

	{ id: "outro", kind: "card", src: "outro", in: cardIn.outro, out: 5.1 },
];

/* the wheel caption should start when the second hover ends, not at 9.55;
   trim its head so the two captions do not overlap on screen. */
segments.find((s) => s.id === "hover-preview").out = 9.55;
segments.find((s) => s.id === "wheel").in = 9.55;

/* ------------------------------------------------------------------ */
/* normalize segments                                                  */
/* ------------------------------------------------------------------ */
rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });
mkdirSync(OUT, { recursive: true });

const rendered = [];
for (let i = 0; i < segments.length; i++) {
	const s = segments[i];
	const src = s.kind === "card" ? join(CARDS, s.src + ".webm") : join(TAKES, s.src + ".webm");
	if (!existsSync(src)) throw new Error("missing source " + src);
	const dur = Number((s.out - s.in).toFixed(3));
	const file = join(BUILD, String(i).padStart(2, "0") + "-" + s.id + ".mp4");
	const filters = [];
	let vf = `fps=${FPS}`;
	if (s.narrow) {
		vf += ",crop=900:900:0:0,pad=1440:900:270:0:color=0xEEF1F5,drawbox=x=270:y=0:w=900:h=900:color=0xDFE3EA@0.85:t=1";
	}
	vf += ",scale=1440:900,setsar=1";
	const args = ["-ss", String(s.in), "-i", src];

	if (s.cap) {
		const cap = join(CAPS, s.cap + ".png");
		args.push("-loop", "1", "-i", cap);
		const fadeOut = Math.max(0, dur - 0.22);
		filters.push(`[0:v]${vf}[base]`);
		filters.push(`[1:v]format=rgba,fade=t=in:st=0:d=0.22:alpha=1,fade=t=out:st=${fadeOut.toFixed(2)}:d=0.22:alpha=1[cap]`);
		filters.push(`[base][cap]overlay=0:752:format=auto,format=yuv420p[v]`);
	} else {
		filters.push(`[0:v]${vf},format=yuv420p[v]`);
	}
	args.push(
		"-filter_complex", filters.join(";"),
		"-map", "[v]", "-t", String(dur), "-r", String(FPS), "-fps_mode", "cfr",
		"-an", "-c:v", "libx264", "-preset", "fast", "-crf", "10",
		"-pix_fmt", "yuv420p", file,
	);
	run(args, s.id);
	const real = duration(file);
	rendered.push({ ...s, file, dur: real, offset: 0 });
	console.log(`[${String(i + 1).padStart(2, "0")}/${segments.length}] ${s.id.padEnd(16)} ${real.toFixed(2)}s`);
}

/* offsets */
let acc = 0;
for (const s of rendered) { s.offset = acc; acc += s.dur; }
const total = acc;

/* concat */
const list = join(BUILD, "list.txt");
writeFileSync(list, rendered.map((s) => `file '${s.file.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
const joined = join(BUILD, "joined.mp4");
run(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", joined], "concat");

/* final pass: fade in/out + encode */
const finalFile = join(OUT, "outline-demo-h264-1440p.mp4");
const fadeOut = Math.max(0, total - 0.6);
run([
	"-i", joined,
	"-vf", `unsharp=5:5:0.4:5:5:0,fade=t=in:st=0:d=0.45:color=0xF4F5F7,fade=t=out:st=${fadeOut.toFixed(2)}:d=0.6:color=0xF4F5F7`,
	"-an", "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-x264-params", "aq-mode=3",
	"-pix_fmt", "yuv420p", "-r", String(FPS), "-fps_mode", "cfr",
	"-movflags", "+faststart", finalFile,
], "final");

/* The legacy path only refreshes the H.264 fallback; the AV1 build owns
   outline-demo.gif / outline-demo-poster.png. */

writeFileSync(join(BUILD, "timeline.json"), JSON.stringify({
	total,
	segments: rendered.map(({ file, ...rest }) => rest),
}, null, "\t") + "\n");

console.log("");
console.log("total:", total.toFixed(2) + "s");
console.log("mp4:", finalFile);
