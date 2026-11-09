#!/usr/bin/env node
/**
 * Build a throwaway DeepSeek Harness home for the demo video.
 *
 * The recording must never touch the real `~/.dsh` state, and the fake
 * conversation must render exactly like a real one. So this script:
 *
 *   1. rewrites an isolated `$DSH_HOME` with a one-bundle web profile,
 *      a linked dsh-ui-outline, zh locale and the plugin's default config;
 *   2. writes a real v4 session log (header frame + one zstd frame per
 *      append batch) whose 36 turns come from demo/transcript.mjs;
 *   3. registers the demo workspace so the app opens straight into it;
 *   4. pins the "current session" hint in a file the recorder reads, so the
 *      browser never has to create an empty session first.
 *
 * Usage: node video/tools/seed-demo.mjs [--port 7418]
 */
import { mkdirSync, rmSync, writeFileSync, symlinkSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { zstdCompressSync } from "node:zlib";
const LANG = process.argv.includes("--lang=en") ? "en" : "zh";
const { TITLE, TURNS } = await import(LANG === "en" ? "../demo/transcript.en.mjs" : "../demo/transcript.mjs");

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = resolve(HERE, "..");
const PLUGIN = resolve(VIDEO, "..");
const WORK = join(VIDEO, ".work");
const HOME = join(WORK, "dsh-home");
const NOTES = join(WORK, "notes");
const OUTLINE_CONFIG = {
	side: "right",
	material: "frost",
	layout: "compact",
	narrow: "show",
	frostTransparency: 80,
	frostBlur: 6,
	liquidTransparency: 75,
	liquidBlur: 4,
};

const portArg = process.argv.indexOf("--port");
const PORT = portArg > -1 ? Number(process.argv[portArg + 1]) : 7418;

/* ------------------------------------------------------------------ */
/* 1. isolated home + profile                                          */
/* ------------------------------------------------------------------ */
rmSync(HOME, { recursive: true, force: true });
rmSync(NOTES, { recursive: true, force: true });
mkdirSync(join(HOME, "profiles", "web", "node_modules"), { recursive: true });
mkdirSync(NOTES, { recursive: true });

writeFileSync(join(HOME, "profiles", "web", "package.json"), JSON.stringify({
	name: "dsh-profile-web-demo",
	private: true,
	dsh: {
		profile: {
			bundles: [
				"@deepseek-ai/dsh-base",
				"@deepseek-ai/dsh-web-app",
				"dsh-ui-outline",
			],
		},
	},
	dependencies: {
		"dsh-ui-outline": "link:" + PLUGIN,
	},
}, null, "\t") + "\n");

writeFileSync(join(HOME, "profiles", "web", "cordis.yml"), "[]\n");

/* The web settings UI writes this same layer; seeding it here means every
   take starts in the same zh / right / compact / frost state, with the
   preview notice already dismissed. */
writeFileSync(join(HOME, "profiles", "web", "cordis.patch.yml"), [
	"- id: ui-settings-general",
	'  name: "@deepseek-ai/dsh-client-ui-settings-general"',
	"  config:",
	"    welcomeNoticeVersion: 2026-09-28.1",
	"- id: locale",
	'  name: "@deepseek-ai/dsh-client-locale"',
	"  config:",
	`    preference: ${LANG}`,
	"- id: ui-theme",
	'  name: "@deepseek-ai/dsh-client-ui-theme"',
	"  config:",
	"    preference: light",
	"- id: outline",
	"  name: dsh-ui-outline",
	"  config:",
	...Object.entries(OUTLINE_CONFIG).map(([k, v]) => `    ${k}: ${v}`),
	"",
].join("\n"));

symlinkSync(PLUGIN, join(HOME, "profiles", "web", "node_modules", "dsh-ui-outline"), "dir");

/* ------------------------------------------------------------------ */
/* 2. session log                                                      */
/* ------------------------------------------------------------------ */
const sessionId = "session-" + randomUUID();
const workspaceId = randomUUID();
const projectDir = join(HOME, "sessions", "--" + NOTES.replace(/^\/+/, "").replace(/[\/\\]+/g, "-") + "--");
const sessionDir = join(projectDir, sessionId);
mkdirSync(sessionDir, { recursive: true });

const startedAt = Date.now() - 2 * 60 * 60 * 1000;
const header = {
	type: "session",
	version: 4,
	id: sessionId,
	createdAt: startedAt,
	cwd: NOTES,
	isSeeded: false,
	delegationDepth: 0,
	agentPreset: "standard",
};
const rows = [
	{ type: "permission/preset", seq: 0, time: startedAt, data: { preset: "workspace-write" } },
	{ type: "sandbox/mode", seq: 1, time: startedAt + 1, data: { mode: "workspace-write" } },
	{ type: "approval/policy", seq: 2, time: startedAt + 1, data: { policy: "ask" } },
];
let seq = 3;
let clock = startedAt + 5000;
let firstUserSeq = null;
TURNS.forEach((turn, index) => {
	const n = index + 1;
	const think = 3200 + (index % 7) * 1600;
	rows.push({ type: "turn/start", seq: seq++, time: (clock += 1200), data: { turn: n } });
	rows.push({ type: "step/start", seq: seq++, time: (clock += 200), data: { turn: n, step: 1 } });
	const userSeq = seq++;
	if (firstUserSeq === null) firstUserSeq = userSeq;
	rows.push({
		type: "user/message",
		seq: userSeq,
		time: (clock += 400),
		surfaceOp: "append",
		data: {
			content: [{ type: "text", text: turn.prompt }],
			source: { kind: "user", rpcId: randomUUID(), clientTimeZone: "Asia/Shanghai" },
			role: "user",
			id: randomUUID(),
		},
	});
	rows.push({
		type: "assistant/message",
		seq: seq++,
		time: (clock += think),
		surfaceOp: "append",
		data: {
			turn: n,
			step: 1,
			message: {
				role: "assistant",
				content: [{ type: "text", text: turn.answer }],
				source: { kind: "model", provider: "deepseek-official", model: "deepseek-v4-flash" },
				id: randomUUID(),
			},
			usage: {
				inputTokens: 1200 + index * 60,
				outputTokens: 60 + turn.answer.length,
				totalTokens: 1260 + index * 60 + turn.answer.length,
			},
			stream: [],
		},
	});
	rows.push({ type: "step/end", seq: seq++, time: (clock += 120), data: { turn: n, step: 1 } });
	rows.push({ type: "turn/end", seq: seq++, time: (clock += 120), data: { turn: n, reason: { kind: "completed" } } });
});
rows.push({
	type: "session/title",
	seq: seq++,
	time: (clock += 500),
	data: { title: TITLE, messageSeqs: [firstUserSeq], source: { kind: "fallback" } },
});

/* One zstd frame for the header, then one frame per append batch — the
   same physical shape the backend publishes. A single frame containing
   header + events is rejected as a corrupt header frame. */
const frames = [zstdCompressSync(Buffer.from(JSON.stringify(header) + "\n"))];
for (let i = 0; i < rows.length; i += 4) {
	frames.push(zstdCompressSync(Buffer.from(rows.slice(i, i + 4).map((r) => JSON.stringify(r)).join("\n") + "\n")));
}
writeFileSync(join(sessionDir, "session.v4.jsonl.zstd"), Buffer.concat(frames));

/* ------------------------------------------------------------------ */
/* 3. workspace registry                                               */
/* ------------------------------------------------------------------ */
const iso = new Date().toISOString();
mkdirSync(join(HOME, "storages"), { recursive: true });
writeFileSync(join(HOME, "storages", "workspace.json"), JSON.stringify({
	unit: { name: "workspace", version: 2 },
	global: { initialized: true, workspaceIds: [workspaceId], archivedSessionIds: [], pinnedSessionIds: [] },
	tables: {
		workspaces: {
			[workspaceId]: {
				path: NOTES,
				title: "notes",
				sessionIds: [sessionId],
				createdAt: iso,
				updatedAt: iso,
			},
		},
	},
}) + "\n");

/* ------------------------------------------------------------------ */
/* 4. recorder hints                                                   */
/* ------------------------------------------------------------------ */
const stateFile = join(WORK, "demo.json");
writeFileSync(stateFile, JSON.stringify({ home: HOME, notes: NOTES, sessionId, workspaceId, title: TITLE, port: PORT }, null, "\t") + "\n");

if (existsSync(join(WORK, "projcache"))) rmSync(join(WORK, "projcache"), { recursive: true, force: true });
console.log("seeded", TURNS.length, "turns ->", sessionId);
console.log("home:", HOME);
console.log("state:", stateFile);
