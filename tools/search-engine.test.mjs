/**
 * Regression tests for the conversation-search engine.
 *
 * The engine lives inline in lib/client.js (one bundle, no module system),
 * so this script extracts the three pure sections straight out of the
 * shipped source — core / match / snippet — re-exports them from a temp
 * module and exercises them. Nothing here duplicates the algorithm: a bug
 * in client.js is a failing assertion here.
 *
 * Usage: node tools/search-engine.test.mjs   (exit 1 on any failure)
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { strict as assert } from "node:assert";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "lib", "client.js");
const START = "/* ===== core.js ===== */";
const END = "/* ===== Search: index build (idle slices) ==== */";

const source = readFileSync(SRC, "utf8");
const from = source.indexOf(START);
const to = source.indexOf(END, from);
assert.ok(from > 0 && to > from, "engine section markers not found in lib/client.js");

const block = source.slice(from, to).replace(/^\t+/gm, "");

/* Two helpers live outside the engine section but define its staleness rule;
   pull them in by name so the revalidate contract is testable too. */
function functionSource(name) {
	const at = source.indexOf(`function ${name}(`);
	assert.ok(at > 0, `${name} not found in lib/client.js`);
	const end = source.indexOf("\n\t\t}\n", at);
	assert.ok(end > at, `end of ${name} not found`);
	return source.slice(at, end + 4).replace(/^\t+/gm, "");
}
const tmp = mkdtempSync(join(tmpdir(), "ol-search-"));
const modPath = join(tmp, "engine.mjs");
writeFileSync(modPath, `${block}
${functionSource("normText")}
${functionSource("sameSnippet")}
${functionSource("fieldSnippet")}
${functionSource("displaySearchText")}
export {
	normalizeSearchText, parseQuery, planSatisfiable,
	spansIn, matchFields, pickSnippetField, buildSnippet,
	normText, sameSnippet, fieldSnippet, displaySearchText,
};
`);

const {
	normalizeSearchText, parseQuery, planSatisfiable,
	spansIn, matchFields, pickSnippetField, buildSnippet,
	normText, sameSnippet, fieldSnippet, displaySearchText,
} = await import(pathToFileURL(modPath).href);

/* ---- helpers ------------------------------------------------------- */

const norm = normalizeSearchText;
const field = (role, text) => ({ role, text, norm: text });
const entry = (prompt, steps = []) => ({
	key: "k", n: 1,
	fields: [field("prompt", norm(prompt)), ...steps.map((s) => field("step", norm(s)))],
});
const hits = (prompt, steps, q) => matchFields(entry(prompt, steps).fields, parseQuery(q));
const plain = (snip) => (snip === null ? null : snip.segments.map((s) => s.t).join(""));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/* ---- normalization ------------------------------------------------- */

test("NFKC + full-width folding on both sides", () => {
	assert.equal(norm("ＡＢＣ　１２３"), "abc 123");
	assert.equal(hits("ｐｒｅｖｉｅｗ height", [], "PREVIEW"), true);
	assert.equal(hits("preview height", [], "ＰＲＥＶＩＥＷ"), true);
});

test("zero-width characters never break a match", () => {
	assert.equal(hits("预览卡高度", [], "预\u200B览卡高度"), true);
	assert.equal(norm("a\u200Bb\uFEFFc"), "abc");
});

test("idempotent and locale-independent casing", () => {
	for (const s of ["ＡＢＣ", "  mü  ", "预览 卡", "İstanbul"]) {
		assert.equal(norm(norm(s)), norm(s));
	}
	assert.equal(norm("I"), "i");
});

/* ---- query grammar ------------------------------------------------- */

test("phrase vs bare vs exclusion", () => {
	assert.deepEqual(parseQuery('"a b" -c').positives.map((c) => c.kind), ["phrase"]);
	assert.equal(hits("x a b y", [], '"a b"'), true);
	assert.equal(hits("x a y b", [], '"a b"'), false);
	assert.equal(hits("alpha beta", [], "alpha -beta"), false);
	assert.equal(hits("alpha gamma", [], "alpha -beta"), true);
	assert.equal(hits("alpha gamma", [], "-beta"), true);
	assert.equal(planSatisfiable(parseQuery("foo -foo")), false);
});

test("an unterminated quote consumes the rest instead of throwing", () => {
	assert.deepEqual(parseQuery('"unclosed tail').positives.map((c) => c.text), ["unclosed tail"]);
});

/* ---- CJK adjacency ------------------------------------------------- */

test("a CJK query tolerates up to two inserted characters (L+2 span)", () => {
	// L = 5 code points → a match window of at most 7 is accepted.
	assert.equal(hits("预览卡高度被裁掉一截", [], "预览卡高度"), true);   // 0 inserted
	assert.equal(hits("预览卡的高度被裁掉", [], "预览卡高度"), true);     // 1 inserted
	assert.equal(hits("预览卡的两高度被裁掉", [], "预览卡高度"), true);   // 2 inserted (boundary)
	assert.equal(hits("预览卡的两个高度被裁掉", [], "预览卡高度"), false); // 3 inserted → rejected
	assert.equal(hits("览卡预览高度", [], "预览卡高度"), false);         // reordered grams
});

test("repeated grams need distinct positions", () => {
	assert.equal(hits("哈哈哈哈", [], "哈哈哈"), true);
	assert.equal(hits("哈哈", [], "哈哈哈"), false);
});

/* ---- field semantics ----------------------------------------------- */

test("positives may land in different fields; a phrase may not", () => {
	const e = ["紧凑模式里预览卡高度被裁掉", "PREVIEW_H 106px 刚好吃满"];
	assert.equal(hits(e[0], [e[1]], "预览 106"), true);
	assert.equal(hits("预览卡", ["高度"], '"预览卡高度"'), false);
	assert.equal(hits("预览卡高度", [], '"预览卡高度"'), true);
});

test("search reaches every assistant step, not just the final one", () => {
	const steps = ["Error: Cannot find module 'x'", "看起来是依赖没装，跑一下 npm i"];
	assert.equal(hits("帮我看看 npm run build", steps, "cannot find module"), true);
	assert.equal(hits("帮我看看 npm run build", steps, "依赖没装"), true);
});

test("an exclusion in any field rejects the turn", () => {
	assert.equal(hits("alpha", ["beta"], "alpha -beta"), false);
});

test("snippet field prefers the latest matching step", () => {
	const e = entry("prompt 预览", ["step one 预览", "step two 别的"]);
	assert.equal(pickSnippetField(e.fields, parseQuery("预览")), 1);
	assert.equal(pickSnippetField(e.fields, parseQuery("-别的")), 2); // exclusions only → latest step
	assert.equal(pickSnippetField(e.fields, parseQuery("-预览")), 2);
	// a prompt-only match falls back to the prompt
	const p = entry("prompt 预览", ["step one 别的"]);
	assert.equal(pickSnippetField(p.fields, parseQuery("预览")), 0);
});

/* ---- revalidate contract ------------------------------------------- */

test("sameSnippet compares the index form against the rail snippet", () => {
	/* The index keeps normalizeSearchText(text); the rail hands over
	   normText(text).slice(0,160) — case and width preserved. Comparing them
	   without folding the snippet side marks every capitalised turn dirty
	   forever, which used to turn revalidate into an endless rebuild loop. */
	const raw = "Fix the Ｂug in compact mode — 106px";
	assert.equal(sameSnippet(normalizeSearchText(raw), normText(raw).slice(0, 160)), true);
	assert.equal(sameSnippet(normalizeSearchText(raw), "unrelated text"), false);
	assert.equal(sameSnippet("", ""), true);
	/* A long field validates on its 160-char prefix, not the whole text. */
	const long = normalizeSearchText("Lorem ipsum ".repeat(40) + "TAIL");
	assert.equal(sameSnippet(long, normText("Lorem ipsum ".repeat(40)).slice(0, 160)), true);
});

/* ---- snippets ------------------------------------------------------ */

test("snippet picks the densest cluster, not the first hit", () => {
	const text = "预览" + "。".repeat(80) + "预览卡高度 预览卡宽度 预览卡圆角";
	const spans = spansIn(norm(text), parseQuery("预览"));
	assert.ok(spans.length >= 4);
	const snip = buildSnippet(norm(text), spans, { pad: 30, cap: 120, clauseCount: 1 });
	const out = plain(snip);
	assert.ok(out.includes("预览卡宽度"), "expected the dense cluster, got: " + out);
	assert.ok(out.length <= 120);
	assert.equal(out, norm(text).slice(norm(text).indexOf(out), norm(text).indexOf(out) + out.length));
});

test("segments concatenate back to the exact window slice", () => {
	const text = norm("alpha 预览 beta 预览 gamma");
	const snip = buildSnippet(text, spansIn(text, parseQuery("预览")), { pad: 10, cap: 120 });
	const joined = plain(snip);
	assert.ok(text.includes(joined));
	assert.equal(snip.segments.filter((s) => s.hit).length, 2);
});

test("no positive spans → plain preview with correct flags", () => {
	const text = norm("short text");
	const snip = buildSnippet(text, [], { pad: 30, cap: 120 });
	assert.equal(plain(snip), "short text");
	assert.equal(snip.head, false);
	assert.equal(snip.tail, false);
});

test("display text folds exactly like the search text, minus case", () => {
	/* Anything the display form folds differently (or not at all) shows up as
	   spans landing on the wrong character, so the two must agree character
	   for character. Case folding is the only intended difference. */
	const samples = [
		"Fix the Ｂug — 106px", "预览卡的高度​被裁掉", "✅ done⏳ next",
		"Istanbul İstanbul", "  spaced   out  ", "ﬁle ㍿ ½",
	];
	for (const raw of samples) {
		const disp = displaySearchText(raw);
		assert.equal(disp.toLowerCase(), normalizeSearchText(raw));
		assert.equal(displaySearchText(disp), disp);
	}
});

test("rows render the transcript's own text, not the folded search form", () => {
	const mk = (text) => ({ role: "prompt", text: displaySearchText(text), norm: displaySearchText(text).toLowerCase() });
	const opts = { pad: 20, cap: 120, clauseCount: 1 };
	/* Case folding keeps the length → offsets transfer, the row shows "Bug". */
	const a = mk("Fix the Bug now");
	const aSnip = fieldSnippet(a, spansIn(a.norm, parseQuery("bug")), opts);
	assert.ok(plain(aSnip).includes("Bug"), plain(aSnip));
	assert.equal(aSnip.segments.filter((seg) => seg.hit).length, 1);
	/* NFKC applies to the display form too, so a ligature highlights as well. */
	const b = mk("ﬁle here");
	assert.equal(b.text, "file here");
	assert.equal(fieldSnippet(b, spansIn(b.norm, parseQuery("file")), opts).segments.filter((seg) => seg.hit).length, 1);
	/* Turkish İ folds to two code points → offsets cannot transfer, so the row
	   degrades to a plain preview instead of highlighting the wrong chars. */
	const c = mk("İstanbul here");
	assert.notEqual(c.norm.length, c.text.length);
	assert.equal(fieldSnippet(c, spansIn(c.norm, parseQuery("here")), opts).segments.filter((seg) => seg.hit).length, 0);
});

/* ---- runner -------------------------------------------------------- */

let failed = 0;
for (const { name, fn } of tests) {
	try {
		fn();
		console.log("ok   " + name);
	} catch (err) {
		failed += 1;
		console.error("FAIL " + name);
		console.error("     " + String(err && err.message ? err.message : err).split("\n").join("\n     "));
	}
}
console.log(`\n${tests.length - failed}/${tests.length} search-engine tests passed`);
process.exitCode = failed ? 1 : 0;
