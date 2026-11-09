/**
 * Resolve a Chromium binary for the demo pipeline.
 *
 * Order: CHROME_PATH → the newest Playwright cache build → common system
 * installs. Keeps the scripts portable without pinning one machine's path.
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function playwrightCandidates() {
	const root = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), ".cache", "ms-playwright");
	if (!existsSync(root)) return [];
	return readdirSync(root)
		.filter((name) => name.startsWith("chromium-"))
		.sort((a, b) => {
			const na = Number(a.split("-")[1]) || 0;
			const nb = Number(b.split("-")[1]) || 0;
			return nb - na;
		})
		.map((name) => join(root, name, "chrome-linux64", "chrome"))
		.filter((p) => existsSync(p));
}

const candidates = [
	process.env.CHROME_PATH,
	...playwrightCandidates(),
	"/usr/bin/chromium",
	"/usr/bin/chromium-browser",
	"/usr/bin/google-chrome",
	"/usr/bin/google-chrome-stable",
].filter(Boolean);

export const CHROME = candidates.find((p) => existsSync(p));
if (!CHROME) {
	throw new Error("no Chromium found; set CHROME_PATH to a Chrome/Chromium binary");
}
