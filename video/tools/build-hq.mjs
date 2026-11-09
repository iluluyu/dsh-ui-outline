#!/usr/bin/env node
/**
 * 1920x1080 AV1 assembly from the hq screencast takes + cards.
 *
 * Segment sources are near-lossless x264 masters; every cut is re-rendered
 * with its caption into a lossless FFV1 intermediate, concatenated, then
 * encoded once with SVT-AV1. Only one lossy generation touches the final.
 *
 * Output: video/outline-demo-av1.mp4 | .gif | -poster.png
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const HQ = join(VIDEO, ".work", "hq");
const TAKES = join(HQ, "takes");
const CARDS = join(HQ, "cards");
const CAPS = join(HQ, "captions");
const BUILD = join(HQ, "build");
const W = 1920;
const H = 1080;
const FPS = 25;
const OUT = join(VIDEO, "outline-demo-av1.mp4");

function run(args, label) {
	const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
	if (r.status !== 0) throw new Error("ffmpeg failed: " + label);
}
function duration(file) {
	const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" });
	return Number(r.stdout.trim());
}

const take = (name) => JSON.parse(readFileSync(join(TAKES, name + ".json"), "utf8"));
const takes = Object.fromEntries(["rail", "hover", "search", "narrow-wide", "narrow"].map((n) => [n, take(n)]));
const cards = Object.fromEntries(JSON.parse(readFileSync(join(CARDS, "cards.json"), "utf8")).map((c) => [c.name, c]));
const at = (name, key, off = 0) => takes[name].events[key] + off;

const segments = [
	{ id: "intro", card: "intro", from: cards.intro.playAt, to: cards.intro.playAt + 3.5 },
	{ id: "rail-wide", take: "rail", from: 0.10, to: at("rail", "plugins", -0.15), cap: "c01" },
	{ id: "rail-side", take: "rail", from: at("rail", "card", 0.55), to: at("rail", "side-click", 1.5), cap: "c02", redact: true },
	{ id: "rail-density", take: "rail", from: at("rail", "side-click", 1.5), to: at("rail", "back", -0.2), cap: "c03", redact: true },
	{ id: "rail-loose", take: "rail", from: at("rail", "back", 0.4), to: at("rail", "rail-scroll-down", 0.9) },

	{ id: "hover-preview", take: "hover", from: at("hover", "hover-1", -0.5), to: at("hover", "wheel-1", -0.2), cap: "c04" },
	{ id: "wheel", take: "hover", from: at("hover", "wheel-1", -0.2), to: at("hover", "commit-wheel", -0.05), cap: "c05" },
	{ id: "click-jump", take: "hover", from: at("hover", "commit-wheel", -0.15), to: at("hover", "hover-far", -0.2), cap: "c06" },
	{ id: "click-far", take: "hover", from: at("hover", "hover-far", -0.3), to: at("hover", "commit-far", 1.8), cap: "c07" },

	{ id: "spotlight", take: "search", from: at("search", "spotlight", -0.3), to: at("search", "arrow-2", -0.1), cap: "c08" },
	{ id: "search-jump", take: "search", from: at("search", "arrow-2", -0.1), to: at("search", "landed", 0.5), cap: "c10" },
	{ id: "and-filter", take: "search", from: at("search", "reopen", -0.2), to: at("search", "close", 0.3), cap: "c11" },

	{ id: "materials", card: "materials", from: cards.materials.playAt, to: cards.materials.playAt + 4.6 },

	{ id: "narrow-wide", take: "narrow-wide", from: at("narrow-wide", "hover", -0.9), to: at("narrow-wide", "hover", 1.2), cap: "c13" },
	{ id: "narrow", take: "narrow", from: at("narrow", "hover", -0.6), to: at("narrow", "jump", 1.8), cap: "c14", narrow: true },

	{ id: "outro", card: "outro", from: cards.outro.playAt, to: cards.outro.playAt + 4.3 },
];

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });

const rendered = [];
for (let i = 0; i < segments.length; i++) {
	const s = segments[i];
	const src = s.card ? cards[s.card].video : takes[s.take].video;
	if (!existsSync(src)) throw new Error("missing " + src);
	const masterDur = duration(src);
	const from = Math.max(0, s.from);
	const to = Math.min(masterDur - 0.05, s.to);
	const dur = Number((to - from).toFixed(3));
	if (!(dur > 0.1)) throw new Error(`bad segment ${s.id}: ${from}..${to} of ${masterDur}`);
	const file = join(BUILD, String(i).padStart(2, "0") + "-" + s.id + ".mkv");
	const vf = ["fps=" + FPS];
	if (s.narrow) {
		vf.push("pad=" + W + ":" + H + ":510:0:color=0xEEF1F5");
		vf.push("drawbox=x=510:y=0:w=900:h=" + H + ":color=0xDFE3EA@0.85:t=1");
	}
	const args = ["-ss", String(from), "-i", src];
	if (s.cap) {
		const cap = join(CAPS, s.cap + ".png");
		args.push("-loop", "1", "-i", cap);
		const fadeOut = Math.max(0, dur - 0.22);
		args.push(
			"-filter_complex",
			`[0:v]${vf.join(",")}[base];` +
			`[1:v]format=rgba,fade=t=in:st=0:d=0.22:alpha=1,fade=t=out:st=${fadeOut.toFixed(2)}:d=0.22:alpha=1[cap];` +
			`[base][cap]overlay=0:902:format=auto${s.redact ? ",drawbox=x=1190:y=965:w=570:h=120:color=white:t=fill" : ""},format=yuv420p[v]`,
			"-map", "[v]",
		);
	} else {
		args.push("-vf", vf.join(",") + ",format=yuv420p");
	}
	args.push(
		"-t", String(dur), "-r", String(FPS), "-fps_mode", "cfr",
		"-an", "-c:v", "ffv1", "-level", "3", "-g", "1", "-slicecrc", "1",
		"-pix_fmt", "yuv420p", file,
	);
	run(args, s.id);
	const real = duration(file);
	rendered.push({ ...s, file, dur: real, offset: 0, from, to });
	console.log(`[${String(i + 1).padStart(2, "0")}/${segments.length}] ${s.id.padEnd(15)} ${real.toFixed(2)}s`);
}

let acc = 0;
for (const s of rendered) { s.offset = acc; acc += s.dur; }
const total = acc;

const list = join(BUILD, "list.txt");
writeFileSync(list, rendered.map((s) => `file '${s.file.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
const joined = join(BUILD, "joined.mkv");
run(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined], "concat");

const fadeOut = Math.max(0, total - 0.6);
run([
	"-i", joined,
	"-vf", `fade=t=in:st=0:d=0.45:color=0xF4F5F7,fade=t=out:st=${fadeOut.toFixed(2)}:d=0.6:color=0xF4F5F7,format=yuv420p`,
	"-an", "-c:v", "libsvtav1", "-preset", "6", "-crf", "28",
	"-svtav1-params", "tune=0",
	"-pix_fmt", "yuv420p", "-r", String(FPS), "-fps_mode", "cfr",
	"-movflags", "+faststart", OUT,
], "av1");

/* gif + poster from the finished AV1 */
const spotlight = rendered.find((s) => s.id === "spotlight");
const jump = rendered.find((s) => s.id === "search-jump");
const gifStart = spotlight.offset + 0.1;
const gifDur = jump.offset + jump.dur - 0.2 - gifStart;
const gif = join(VIDEO, "outline-demo.gif");
run([
	"-ss", gifStart.toFixed(2), "-t", gifDur.toFixed(2), "-i", OUT,
	"-vf", "fps=15,scale=1000:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
	"-loop", "0", gif,
], "gif");

/* clean poster from the lossless search master (no caption) */
const posterAt = takes.search.events.spotlight + 1.6;
const poster = join(VIDEO, "outline-demo-poster.png");
run(["-ss", posterAt.toFixed(2), "-i", takes.search.video, "-frames:v", "1", poster], "poster");

writeFileSync(join(BUILD, "timeline.json"), JSON.stringify({
	total,
	segments: rendered.map(({ file, ...rest }) => rest),
}, null, "\t") + "\n");
console.log("");
console.log("total:", total.toFixed(2) + "s");
console.log("av1:", OUT);
console.log("gif:", gif);
console.log("poster:", poster);
