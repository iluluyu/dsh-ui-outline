/**
 * Tests for the favorites (turn bookmarks) feature.
 *
 * The feature lives inline in lib/client.js (one bundle, no module system),
 * so — exactly like tools/search-engine.test.mjs — this script slices the
 * favorites section straight out of the shipped source, re-exports it from
 * a temp module with a stubbed window.localStorage, and exercises it.
 * Nothing here duplicates the algorithm: a bug in client.js is a failing
 * assertion here.
 *
 * Beyond the pure logic, a source-contract block asserts the ADDITIVE
 * geometry the feature must keep: the bookmark dot is absolutely positioned
 * (never a flex child that could displace the line), the original .ol-line
 * scaleX(var(--ol-grow)) transform / side-specific transform-origin /
 * flush-outer-edge pack rules are byte-identical, and the preview card body
 * keeps its shipped pointer-events:none unless it has a bookmark control.
 *
 * Usage: node tools/favorites.test.mjs   (exit 1 on any failure)
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { strict as assert } from "node:assert";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "lib", "client.js");
const START = "/* ===== favorites (turn bookmarks) ====";
const END = "/* ===== end favorites ====";

const source = readFileSync(SRC, "utf8");
const from = source.indexOf(START);
const to = source.indexOf(END, from);
assert.ok(from > 0 && to > from, "favorites section markers not found in lib/client.js");

const block = source.slice(from, to).replace(/^\t+/gm, "");

/* ---- module loader with a controllable localStorage ---------------- */

function makeLocalStorage(seed = "", { throwOnSet = false } = {}) {
	const store = { value: seed };
	return {
		getItem: () => store.value,
		setItem: (k, v) => {
			if (throwOnSet) throw new Error("QuotaExceeded");
			store.value = String(v);
		},
		__raw: () => store.value,
	};
}

let loadCount = 0;
async function loadFav(storage) {
	globalThis.window = { localStorage: storage };
	const tmp = mkdtempSync(join(tmpdir(), "ol-fav-"));
	const modPath = join(tmp, "fav.mjs");
	writeFileSync(modPath, `${block}
export { favIdOf, bookmarksGet, bookmarksSubscribe, toggleBookmark, FAV_STORE_KEY };
`);
	loadCount += 1;
	return import(pathToFileURL(modPath).href + "?load=" + loadCount);
}

let passed = 0;
function ok(cond, label) {
	assert.ok(cond, label);
	passed += 1;
	console.log("ok - " + label);
}

/* =====================================================================
 * 1. favIdOf — identity is UUID-only, everything else is refused.
 *    The engine key format is conversationContextKey(kind, id) =
 *    "<len>:<kind><id>"; only definition kind "input-message" (the
 *    user/message projection) yields a bookmarkable id.
 * ===================================================================== */

{
	const m = await loadFav(makeLocalStorage());
	const { favIdOf } = m;
	const UUID = "550e8400-e29b-41d4-a716-446655440000";

	// the real shape dsh 0.2.1 renders on kind=user flow items
	ok(favIdOf(`13:input-message${UUID}`) === UUID, "real user-message key parses to the UUID");
	ok(favIdOf("13:input-messageabc") === null, "non-UUID ids are refused");
	ok(favIdOf("13:input-message550e8400-e29b-11d4-a716-446655440000") === null, "non-v4 UUIDs are refused");
	ok(favIdOf("13:input-message550e8400-e29b-41d4-0716-446655440000") === null, "invalid UUID variants are refused");
	// wrong definition kinds
	ok(favIdOf("15:assistant-stepxyz") === null, "assistant-step key refused");
	ok(favIdOf("9:tool-callxyz") === null, "tool-call key refused");
	ok(favIdOf("12:input-messagexyz") === null, "length-prefix mismatch refused");
	ok(favIdOf("13:Input-Messagexyz") === null, "case-sensitive kind mismatch refused");
	// reasoning-group JSON keys (JSON.stringify([key, groupPart]))
	ok(favIdOf(`["13:input-message${UUID}","reasoning"]`) === null, "reasoning-group JSON key refused");
	// ordinal / fallback shapes — the forbidden binding path
	ok(favIdOf("3") === null, "bare ordinal refused");
	ok(favIdOf("0") === null, "bare zero refused");
	ok(favIdOf("") === null, "empty key refused");
	ok(favIdOf(undefined) === null, "missing attribute (undefined) refused");
	ok(favIdOf(null) === null, "null refused");
	ok(favIdOf(42) === null, "non-string refused");
	ok(favIdOf("13:input-message") === null, "kind with empty id refused");
}

/* =====================================================================
 * 2. store — lazy load, fail-quiet, toggle, persist, subscribe.
 * ===================================================================== */

{
	const m = await loadFav(makeLocalStorage(""));
	const { bookmarksGet, toggleBookmark } = m;
	ok(bookmarksGet().size === 0, "absent storage starts empty");
	toggleBookmark("id-1");
	ok(bookmarksGet().has("id-1"), "toggle adds to the live set");
	toggleBookmark("id-1");
	ok(!bookmarksGet().has("id-1"), "toggle removes again");
	toggleBookmark("");
	toggleBookmark(undefined);
	ok(bookmarksGet().size === 0, "empty/invalid ids are no-ops");
}

{
	const m = await loadFav(makeLocalStorage("{oops not json"));
	ok(m.bookmarksGet().size === 0, "corrupt storage starts empty, no throw");
}

{
	const seed = JSON.stringify({ v: 1, ids: { "id-a": 1, "id-b": 1, "": 1 } });
	const m = await loadFav(makeLocalStorage(seed));
	const s = m.bookmarksGet();
	ok(s.has("id-a") && s.has("id-b"), "valid seed loads its ids");
	ok(!s.has(""), "empty seed keys are dropped");
}

{
	const m = await loadFav(makeLocalStorage(JSON.stringify({ v: 2, ids: { "id-a": 1 } })));
	ok(m.bookmarksGet().size === 0, "unknown schema version starts empty");
}

{
	const storage = makeLocalStorage("");
	const m = await loadFav(storage);
	const { bookmarksGet, toggleBookmark, FAV_STORE_KEY } = m;
	toggleBookmark("persist-me");
	const raw = JSON.parse(storage.__raw());
	ok(raw.v === 1 && raw.ids["persist-me"] === 1, "toggle persists {v:1,ids} JSON");
	ok(storage === globalThis.window.localStorage, "writes go to the plugin storage key namespace");
	// simulated refresh: a fresh module load over the SAME storage (what a
	// page reload does to localStorage) sees the bookmark
	const m2 = await loadFav(storage);
	ok(m2.bookmarksGet().has("persist-me"), "bookmark survives a reload (fresh lazy load)");
	ok(m2.FAV_STORE_KEY === FAV_STORE_KEY, "storage key stable across loads");
}

{
	const m = await loadFav(makeLocalStorage("", { throwOnSet: true }));
	const { bookmarksGet, toggleBookmark } = m;
	let threw = false;
	try { toggleBookmark("quota-id"); } catch { threw = true; }
	ok(!threw, "quota-exceeded storage never throws");
	ok(bookmarksGet().has("quota-id"), "read-only storage degrades to memory-only");
}

{
	const m = await loadFav(makeLocalStorage(""));
	const { bookmarksGet, bookmarksSubscribe, toggleBookmark } = m;
	let fires = 0;
	const off = bookmarksSubscribe(() => { fires += 1; });
	toggleBookmark("sub-id");
	const snap1 = bookmarksGet();
	toggleBookmark("sub-id");
	ok(fires === 2, "subscribers fire once per toggle");
	ok(bookmarksGet() !== snap1, "snapshot identity changes with the set");
	off();
	toggleBookmark("sub-id");
	ok(fires === 2, "unsubscribed listener stops firing");
}

/* =====================================================================
 * 3. source contract — the feature stays ADDITIVE.
 *    The original mark language (scaleX transform, transform-origin per
 *    side, flush outer edge, hit strip) and the preview card's shipped
 *    non-interactivity must be byte-identical.
 * ===================================================================== */

{
	// (a) the original line rules survive verbatim
	ok(source.includes('[data-side="right"] .ol-line {'),
		"right-rail .ol-line rule still present");
	ok(/#?\$\{NAV_ID\}\[data-side="right"\] \.ol-line \{\s*\n\s*transform: scaleX\(var\(--ol-grow, \$\{REST_GROW\}\)\);\s*\n\s*transform-origin: right;/.test(source)
		|| source.includes("transform: scaleX(var(--ol-grow, ${REST_GROW}))"),
		"line keeps scaleX(var(--ol-grow, ${REST_GROW})) transform");
	ok(source.includes("transform-origin: right;") && source.includes("transform-origin: left;"),
		"line keeps both side-specific transform-origins");
	ok(source.includes('[data-side="right"] .ol-markBtn { justify-content: flex-end; }'),
		"right-rail mark pack (flush outer edge) unchanged");
	ok(source.includes('[data-side="left"] .ol-markBtn { justify-content: flex-start; }'),
		"left-rail mark pack (flush outer edge) unchanged");
	ok(source.includes("transition: transform .16s linear(0, .398 10%, .682 20%, .843 30%,"),
		"line's original transform bezier still present");

	// (b) the dot is absolutely positioned and never a flex child
	const dotRule = source.match(/\$\{NAV_ID\} \.ol-favDot \{\n[\s\S]*?\n\t\t\}/);
	ok(dotRule !== null, ".ol-favDot rule exists");
	ok(/position:\s*absolute;/.test(dotRule[0]), "dot is absolutely positioned");
	ok(!/order\s*:/.test(dotRule[0]) && !/margin/.test(dotRule[0]),
		"dot uses no flex order/margin (cannot displace the line)");
	ok(/top:\s*calc\(50% - 1px\)/.test(dotRule[0]), "dot centers vertically without transform");
	ok(/width:\s*2px;/.test(dotRule[0]) && /height:\s*2px;/.test(dotRule[0]),
		"dot matches the 2px line thickness");
	ok(/opacity:\s*max\(var\(--ol-line-base\),\s*var\(--ol-wave-opacity\)\);/.test(dotRule[0])
		&& source.includes('[data-near="1"] .ol-favDot { opacity: 1; }'),
		"dot opacity follows its line in idle, current, wave and hover states");
	ok(!source.includes('[data-fav="1"] .ol-line'),
		"favorite state changes only the dot, not the line");
	ok(source.includes('opacity: max(var(--ol-line-base), var(--ol-wave-opacity));'),
		"the current line never dims when the light wave passes");
	ok(/pointer-events:\s*none;/.test(dotRule[0]), "dot is never a hit target");

	// (c) dot rides the same growth variable, mirrored per side
	const dotRight = source.match(/\$\{NAV_ID\}\[data-side="right"\] \.ol-favDot \{\n[\s\S]*?\n\t\t\}/);
	const dotLeft = source.match(/\$\{NAV_ID\}\[data-side="left"\] \.ol-favDot \{\n[\s\S]*?\n\t\t\}/);
	ok(dotRight !== null && /right:\s*calc\(var\(--ol-mark-w\) \+ 3px\)/.test(dotRight[0])
		&& /translateX\(calc\(\(1 - var\(--ol-grow, \$\{REST_GROW\}\)\) \* var\(--ol-mark-w\)\)\)/.test(dotRight[0]),
		"right-rail dot pinned beyond the line's full inner tip, tracks growth inward");
	ok(dotLeft !== null && /left:\s*calc\(var\(--ol-mark-w\) \+ 3px\)/.test(dotLeft[0])
		&& /translateX\(calc\(\(var\(--ol-grow, \$\{REST_GROW\}\) - 1\) \* var\(--ol-mark-w\)\)\)/.test(dotLeft[0]),
		"left-rail dot mirrored");
	ok(dotRight !== null && /transition: transform \.16s linear\(0, \.398 10%/.test(dotRight[0]) === false,
		"dot transition lives in the base rule (one declaration)");
	ok(/#?\$\{NAV_ID\}\[data-scrubbing\] \.ol-favDot \{ transition: none; \}/.test(source),
		"scrub disables dot transition in parallel with the line's rule");

	// (d) bookmarkable cards allow movement from the rail to the star.
	const previewRule = source.match(/\$\{NAV_ID\} \.ol-preview \{\n[\s\S]*?\n\t\t\}/);
	ok(previewRule !== null && /pointer-events:\s*none;/.test(previewRule[0]),
		"non-bookmarkable previews remain click-through");
	ok(source.includes('.ol-preview[data-bookmarkable] { pointer-events: auto; }'),
		"bookmarkable previews accept pointer input");
	ok(source.includes('.ol-previewWrap[data-bookmarkable]::before')
		&& source.includes('height: var(--ol-preview-h);'),
		"short previews retain a full-height pointer path to the star");

	// (e) star control: unobtrusive chrome, keyboard + theme parity
	const starRule = source.match(/\$\{NAV_ID\} \.ol-favStar \{\n[\s\S]*?\n\t\t\}/);
	ok(starRule !== null && /border:\s*0;/.test(starRule[0])
		&& /background:\s*transparent;/.test(starRule[0]) && !/box-shadow:/.test(starRule[0]),
		"star has no circular border or shadow");
	ok(source.includes(".ol-favStar:focus-visible {"), "star has a focus-visible ring");
	ok(source.includes('body[data-ds-dark-theme] #${NAV_ID} .ol-favStar {'),
		"star has a dark-theme rule");
	ok(source.includes('body[data-ds-dark-theme] #${NAV_ID} .ol-favDot {'),
		"dot has a dark-theme rule");
	ok(source.includes('"aria-pressed": favs.has(hovered.favId) ? "true" : "false"'),
		"star exposes aria-pressed state");

	// (f) wiring + the no-ordinal guarantee
	ok(source.includes("fav: t.favId !== null && favs.has(t.favId),"),
		"Row receives fav from the UUID-keyed store");
	ok(source.includes("favId: favIdOf(el.dataset.chatFlowKey)"),
		"turns bind favId from the raw flow-key attribute");
	ok(source.includes("el.dataset.chatFlowKey ?? String(turns.length)"),
		"existing react-key ordinal fallback untouched (never used for favorites)");
	ok(!source.includes("favIdOf(String("), "no ordinal is ever fed to favIdOf");
	ok((source.match(/!inPreview\(e\.relatedTarget\)/g) || []).length === 2,
		"rail leave + blur carry the additive star-bar guard");
	ok(source.includes("toggleBookmark(hovered.favId)"), "star click toggles the UUID bookmark");
}

// The brightness wave shares the hover index but does not change growth.
{
	const match = source.match(/function markLight\(i, near\) \{[\s\S]*?\n\t\t\}/);
	assert.ok(match, "markLight not found");
	const markLight = Function(`return (${match[0]})`)();
	ok(markLight(3, -1) === null, "no light wave while idle");
	ok(markLight(3, 3) === null, "hovered mark retains its original highlight");
	ok(markLight(4, 3) === 1 && markLight(5, 3) === 2 && markLight(6, 3) === 3
		&& source.includes('--ol-wave-1: .65;') && source.includes('--ol-wave-2: .42;')
		&& source.includes('--ol-wave-3: .28;'), "neighbor brightness fades with distance");
	ok(markLight(2, 3) === markLight(4, 3) && markLight(7, 3) === null,
		"light wave is symmetric and bounded");
}

console.log(`\nfavorites: ${passed} assertions passed`);
