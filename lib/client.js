/**
 * dsh-ui-outline — browser half (zero-build: hand-maintained source AND
 * shipped artifact, in the window.__ModuleLoader__ handoff format).
 *
 * Registers one entry into the `shell.overlay` seat: a turn navigation rail
 * over the current conversation that follows the OFFICIAL dsh TurnNavigator
 * design (packages/client/ui-chat TurnNavigator) and extends it with the
 * options the GitHub issue asked for:
 *
 *   side     right | left   — which edge of the conversation column the rail
 *                            hugs (default right, official parity)
 *   material none | frost | liquid (default frost) — surface of the per-turn
 *                            preview card ONLY (the official hover tooltip:
 *                            prompt + response, two short lines each,
 *                            anchored beside the hovered mark); the resting
 *                            rail is bare marks in every mode, exactly like
 *                            the official rail (no pill, no background)
 *   layout   compact | loose — one shared, rippling mark language with a
 *                            forgiving hit strip; the choice is vertical
 *                            density, not a second visual system:
 *     compact the official rhythm: 20px lines at a fixed 10px pitch.
 *             Overflow scrolls inside the frame (never compressed), with a
 *             24px edge fade, capped at min(reading band−64px, 420px)
 *     loose   the same lines at a 30px pitch — an intentionally airy reading
 *             index, with 44×30px targets, the same internal scroll and
 *             24px fade, capped at min(reading band−64px, 70vh, 640px)
 *
 * While this rail is actually painted, the official TurnNavigator is hidden
 * (CSS by its aria-label — "Turn navigation"/"轮次导航", the only two locales
 * ui-chat ships) so the two never stack into a double navbar. Standing down
 * (off-chat, too few turns, or the user hid the narrow-column rail) lets the
 * official one return. A column under 900px is where the official rail hides
 * itself; staying up there is the point of this plugin (narrow defaults to
 * show). The edge switch and the settings row write the same field.
 *
 * Geometry comes from the live conversation scrollport instead of the window:
 * the rail hugs the conversation column edge (not the viewport edge — the
 * right edge moves when the details panel opens, the left when the sidebar
 * drags), and its vertical band is `--dsh-conversation-viewport-height −
 * --dsh-composer-height` — both published inline on the
 * [data-conversation-scroll] element by ui-conversation's ConversationRoot,
 * so a getComputedStyle read reproduces the official math without owning a
 * ResizeObserver pipeline of our own (a small one still tracks the column
 * rect through sidebar/details drag animations).
 *
 * Turn discovery stays DOM-based (the conversation flow's stable data
 * attributes) and the scroll path keeps its zero-cost profile: one container
 * rect + a binary search over cached content offsets per frame, cache
 * refilled only on content mutation, host swap or resize.
 *
 * Since 0.1.3 there is also a Spotlight-style conversation search: Cmd/Ctrl+F
 * opens a centered glass overlay (material follows the preview-card setting;
 * enter .18s / exit .12s spring, reduced-motion aware). Typing searches every
 * turn's full prompt + final response — index built in idle slices on first
 * open, snippet-prefix-validated per turn (streaming tail always re-read),
 * 4ms sliced newest-first scan behind a 60ms debounce and IME guard, first
 * 50 hits with token-highlighted context windows, ↑↓/↵/esc keyboard model,
 * Enter closes and lands on the turn with the rail's own landing flash. The
 * index survives close by five minutes and is disposed on conversation swap
 * or plugin teardown.
 *
 * Preferences ride the official plugin-settings path since 0.0.2 (the
 * deepdiving pattern, dsh 0.2.0): the Host half (lib/index.js) declares
 * the row's volatile Config schema, this half binds the shared configForms
 * controller and serves cards under the keyed plugins.bundle.config /
 * plugins.row.config slots — bilingual copy through the locale service.
 */
window.__ModuleLoader__.load({
	id: "dsh-ui-outline",
	factory: (require) => {
		const React = require("react");
		const h = React.createElement;
		const { Pill } = require("@deepseek-ai/dsh-client-ui-primitives");
		const { useCallback, useEffect, useLayoutEffect, useRef, useState, memo, useSyncExternalStore } = React;

		const NAV_ID = "dsh-outline-root";
		/* Live media query: WAAPI (el.animate) ignores the CSS
		   prefers-reduced-motion blocks, so the landing flash gates on this. */
		const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
		/* Compact matches the official rail: a fixed 10px pitch that scrolls
		   instead of compressing. Loose keeps the same marks at a 30px pitch.
		   The 44px strip is only the hit target; the painted line stays 20px. */
		const COMPACT_PITCH = 10; // official TURN_SPACING_PX
		const RAIL_INSET = 6; // official RAIL_INSET_PX
		const FADE_PX = 24; // official fade band
		const COMPACT_RAIL_MAX = 420;
		const LOOSE_PITCH = 30;
		const LOOSE_RAIL_MAX = 640;
		const RAIL_SAFE_MARGIN = 64;
		const EDGE_GAP = 12; // official gutter between rail and column edge
		const MARK_LINE_W = 20;
		const RAIL_HIT_W = 44;
		const REST_GROW = 0.3; // aligned ~6px idle line of the 20px mark
		const DRAG_START_DISTANCE = 5;
		/* Preview card height: two 20px prompt lines + two 19px response lines
		   + padding + border, kept exact in one place for the CSS var and the
		   JS clamps. */
		const PREVIEW_H = 106;
		/* Both layouts stand up from two turns — the official minimum. (The
		   desktop app's rail waits for four; matching it made a 2-3 turn
		   conversation look like the loose setting "did nothing".) */
		const MIN_TURNS = 2;
		
		/** Namespace defaults — mirror of the Host-half schema (lib/index.js);
		   both track the STANDARD preset of each material (the balance point,
		   iOS-regular-anchored — see the preset tables below). */
		const DEFAULTS = {
			side: "right", material: "frost", layout: "compact", narrow: "show",
			frostTransparency: 80, frostBlur: 6,
			liquidTransparency: 75, liquidBlur: 4,
		};
		/* Official TurnNavigator hides at @container (width<=900px). We stay. */
		const NARROW_MAX = 900;
		const SIDES = ["right", "left"];
		const MATERIALS = ["none", "frost", "liquid"];
		const LAYOUTS = ["compact", "loose"];
		/* Glass parameters: one transparency (%, higher = more see-through,
		   the veil is 100-t%) and one blur radius (px) per material. The card
		   serves a preset row plus the two sliders only while that material is
		   selected (KISS + progressive disclosure); presets are reference
		   points that snap BOTH values, dragging a slider is the custom path.
		   Background dimming is deliberately not a third knob: in light theme
		   the white veil IS the wash, in dark theme the dark veil IS the dim
		   — a separate brightness control would duplicate the veil's job. */
		const T_MIN = 20, T_MAX = 95, B_MIN = 0, B_MAX = 24;
		const clampNum = (x, min, max, dflt) => (
			typeof x === "number" && Number.isFinite(x)
				? Math.min(max, Math.max(min, x))
				: dflt
		);
		/* [id, transparency, blur] — two crossing axes, not one sliding
		   density dial: 清透/airy maximizes TRANSPARENCY (see-through glass,
		   gentle defocus), 朦胧/misty maximizes BLUR (fog that still glows —
		   the veil stays ≤45% so it can never collapse into the opaque
		   milk-wall the old t30 ladder ended at), 标准/standard is the balance
		   point. It originally anchored on Apple's iOS `regular` material
		   (~t72 / b5.4 / saturate 1.8 — reverse-engineered), which both review
		   rounds scored above every shipped preset; the live user then called
		   that anchor "too conservative" and the 0.0.4 taste round moved it
		   airier to 80/6 — background color temperature shows through while
		   text stays planted. Liquid uses the same see-through axis with no
		   veil floor: standard is the Apple-like 25% veil, airy is the extreme,
		   misty keeps the words readable. */
		const FROST_PRESETS = [["airy", 85, 3], ["standard", 80, 6], ["misty", 55, 18]];
		const LIQUID_T_MIN = 20, LIQUID_T_MAX = 95;
		const LIQUID_PRESETS = [["airy", 95, 2], ["standard", 75, 4], ["misty", 65, 12]];


		/* ===== search overlay (Cmd/Ctrl+F) budget knobs =====================
		   Spotlight-style conversation search over the current conversation:
		   numbers live here so the engine's slices stay self-documenting.
		   Index build = idle slices (≤2ms / ≤32Ki chars); scan = 4ms slices
		   between keystrokes; 60ms input debounce; results capped at 50 with
		   an honest "first 50" notice; index survives close by 5 minutes. */
		const SEARCH_MAX_RESULTS = 50;
		const SEARCH_DEBOUNCE_MS = 60;
		const SEARCH_SLICE_MS = 4;
		const SEARCH_EXTRACT_MS = 2;
		const SEARCH_EXTRACT_CHARS = 32768;
		const SEARCH_CTX_PAD = 30;
		const SEARCH_CTX_MAX = 120;
		const SEARCH_KEEPALIVE_MS = 300000;
		/* Revalidate reads dirty turns synchronously; past this many dirty
		   turns it degrades to the sliced idle rebuild instead (the whole
		   conversation is never re-read inside one task). */
		const SEARCH_REVALIDATE_SYNC_MAX = 8;

		/* Bilingual copy for the preferences card, selected off the locale
		 * service's active id. */
		const COPY = {
			zh: {
				title: "Outline",
				description: "轮次导航轨道。",
				sideLabel: "位置",
				sideRight: "右侧",
				sideLeft: "左侧",
				materialLabel: "材质",
				matNone: "无材质",
				matFrost: "毛玻璃",
				matLiquid: "液态玻璃",
				layoutLabel: "刻度分布",
				layoutCompact: "紧凑",
				layoutLoose: "宽松",
				narrowLabel: "窄列",
				narrowShow: "显示",
				narrowHide: "隐藏",
				frostGlassLabel: "毛玻璃",
				liquidGlassLabel: "液态玻璃",
				presetAiry: "清透",
				presetCustom: "自定义",
				presetStandard: "标准",
				presetMisty: "朦胧",
				transparencyLabel: "透明度",
				blurLabel: "虚化半径",
				unavailable: "设置服务不可用，暂时只读。",
			},
			en: {
				title: "Outline",
				description: "Turn navigation rail.",
				sideLabel: "Side",
				sideRight: "Right",
				sideLeft: "Left",
				materialLabel: "Material",
				matNone: "None",
				matFrost: "Frosted",
				matLiquid: "Liquid glass",
				layoutLabel: "Mark layout",
				layoutCompact: "Compact",
				layoutLoose: "Loose",
				narrowLabel: "Narrow column",
				narrowShow: "Show",
				narrowHide: "Hide",
				frostGlassLabel: "Frosted glass",
				liquidGlassLabel: "Liquid glass",
				presetAiry: "Airy",
				presetCustom: "Custom",
				presetStandard: "Standard",
				presetMisty: "Misty",
				transparencyLabel: "Transparency",
				blurLabel: "Blur radius",
				unavailable: "Settings service unavailable — read-only for now.",
			},
		};
		function copyFor(active) { return COPY[active === "en" ? "en" : "zh"]; }

		/* =====================================================================
		 * Cmd+F search overlay — UI layer (Worker B deliverable, spec §3).
		 *
		 * Paste-order contract into client.js module scope: COPY_SEARCH,
		 * SEARCH_CSS (append its joined text inside the CSS template literal),
		 * then the helpers/components below. Names assumed in scope, provided by
		 * the engine (Worker A) or the existing module: searchGet,
		 * searchSubscribe, searchCloseRequested, searchSubmit, searchRevalidate,
		 * searchLastQuery, jumpToKey, navBridge, prefsGet, prefsSubscribe,
		 * REDUCED_MOTION, h, React, useState/useEffect/useLayoutEffect/useRef,
		 * useSyncExternalStore. searchOpenRequested is owned by the integration
		 * (its document keydown interceptor), never by this component.
		 * ===================================================================== */

		/* ===== bilingual copy ==============================================
		   Same {zh,en} shape as COPY so the two dictionaries can be merged and
		   served through copyFor() if the integration prefers; searchCopy()
		   below keeps this file self-contained either way. */
		const COPY_SEARCH = {
			zh: {
				searchLabel: "搜索对话",
				searchPlaceholder: "搜索当前对话…",
				searchNoResults: "无匹配结果",
				/* [lead, tail]: the indexed counter is spliced as React children
				   between the halves (zh and en word orders differ, and the spec
				   rules out a template-replace helper). */
				searchIndexing: ["已索引 ", " 轮"],
				searchCapped: "仅显示前 50 条命中",
				searchFooter: "↑↓ 选择 · ↵ 跳转 · esc 关闭",
			},
			en: {
				searchLabel: "Search conversation",
				searchPlaceholder: "Search this conversation…",
				searchNoResults: "No matches",
				searchIndexing: ["", " turns indexed"],
				searchCapped: "Showing first 50 matches",
				searchFooter: "↑↓ select · ↵ jump · esc close",
			},
		};

		/* Language probe mirrors railLabel(): shell.overlay entries get no
		   locale-service handle, and the document's lang attribute is this
		   plugin's established fallback for exactly that case. */
		function searchCopy() {
			const lang = (document.documentElement.lang || "").startsWith("en") ? "en" : "zh";
			return COPY_SEARCH[lang];
		}

		/* ===== overlay CSS (kiro-opus final values, spec §B.3) =============
		   Joined plain string — no backticks and no ${ sequences anywhere in the
		   CSS text, so it can be spliced verbatim into client.js's CSS template
		   literal. Enter/exit keyframes must carry translateX(-50%) alongside
		   scale: the panel is centered by that transform. */
		const SEARCH_CSS = [
			"/* ===== Cmd+F search overlay ===================================== */",
			"",
			"/* Full-screen transparent plate below the panel: an outside",
			"   pointer-down closes the overlay without any page-level listener",
			"   juggling. shell.overlay is click-through, so input is restored",
			"   here explicitly (same reason the rail root does it). */",
			".ol-searchCatcher {",
			"\tposition: fixed;",
			"\tinset: 0;",
			"\tz-index: 9998;",
			"\tbackground: transparent;",
			"\tpointer-events: auto;",
			"}",
			"",
			".ol-searchOverlay {",
			"\tposition: fixed;",
			"\ttop: 23vh;",
			"\tleft: 50%;",
			"\ttransform: translateX(-50%);",
			"\twidth: min(640px, 90vw);",
			"\tmax-height: min(520px, 70vh);",
			"\tdisplay: flex;",
			"\tflex-direction: column;",
			"\tz-index: 9999;",
			"\tbox-sizing: border-box;",
			"\t/* Rounded + clipped so the scrolling list obeys the squircle; the",
			"\t   material rules below only swap the surface recipe. 26px in BOTH",
			"\t   states — exactly half the folded 52px bar, so the capsule ends",
			"\t   meet as continuous half-superellipses and the morph is a pure",
			"\t   height growth: the radius never changes, which is what makes it",
			"\t   read as one surface stretching (the preview card keeps its own",
			"\t   18.4px — family unity comes from the corner language, not from",
			"\t   sharing every number). */",
			"\tborder-radius: 26px;",
			"\tcorner-shape: superellipse(1.5);",
			"\toverflow: hidden;",
			"\tcolor: var(--dsw-alias-label-primary, #0f1115);",
			"\tfont-family: var(--dsw-font-family, \"quote-cjk-patch\", \"Inter\", system-ui,",
			"\t\t-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif);",
			"\tpointer-events: auto;",
			"\tanimation: ol-search-enter .18s cubic-bezier(.23, 1, .32, 1);",
			"}",
			"@keyframes ol-search-enter {",
			"\tfrom { opacity: 0; transform: translateX(-50%) scale(.92); }",
			"\tto { opacity: 1; transform: translateX(-50%) scale(1); }",
			"}",
			"/* Exit fade: same centering transform, scale down to .96; the state",
			"   flag also drops the panel out of hit-testing while it fades. */",
			".ol-searchOverlay[data-exiting] {",
			"\tanimation: ol-search-exit .12s cubic-bezier(.2, .8, .2, 1) forwards;",
			"\tpointer-events: none;",
			"}",
			"@keyframes ol-search-exit {",
			"\tfrom { opacity: 1; transform: translateX(-50%) scale(1); }",
			"\tto { opacity: 0; transform: translateX(-50%) scale(.96); }",
			"}",
			"/* ===== input row ================================================= */",
			"/* The row carries the mac magnifier glyph; the field itself gives up",
			"   its left padding to the icon margin so the text starts where mac",
			"   starts it (~41px in). */",
			".ol-searchFieldRow {",
			"\tflex: none;",
			"\tdisplay: flex;",
			"\talign-items: center;",
			"\tmin-width: 0;",
			"}",
			".ol-searchIcon {",
			"\tflex: none;",
			"\tmargin: 0 9px 0 15px;",
			"\tcolor: var(--dsw-alias-label-tertiary, #81858c);",
			"\tpointer-events: none;",
			"}",
			".ol-searchInput {",
			"\tflex: 1;",
			"\tmin-width: 0;",
			"\tdisplay: block;",
			"\theight: 52px;",
			"\tbox-sizing: border-box;",
			"\tmargin: 0;",
			"\tpadding: 0 16px 0 0;",
			"\tborder: 0;",
			"\tbackground: transparent;",
			"\tfont: var(--dsw-font-m-regular, 400 15px/52px inherit);",
			"\t/* The 52px leading is the row's vertical metric, not typography:",
			"\t   keep it even when the host font token supplies its own. */",
			"\tline-height: 52px;",
			"\tcolor: var(--dsw-alias-label-primary, #0f1115);",
			"\tcaret-color: var(--dsw-alias-brand-primary, #4d6bfe);",
			"}",
			".ol-searchInput::placeholder { color: var(--dsw-alias-label-tertiary, #81858c); }",
			"/* mac centers the placeholder but left-aligns typed text; the",
			"   empty field is the only time this applies (a blank query keeps",
			"   the panel collapsed). padding-right compensates the icon zone",
			"   so the centered string sits at the capsule's true midline. */",
			".ol-searchInput:placeholder-shown {",
			"\ttext-align: center;",
			"\tpadding-right: 26px;",
			"}",
			"/* Deliberately no focus ring (Spotlight omnibar idiom): the panel",
			"   is open and autofocused, the brand caret already signals input,",
			"   and an inset rectangle would fight both the superellipse clip and",
			"   the glass rim at the top corners. */",
			".ol-searchInput:focus {",
			"\toutline: none;",
			"}",
			"",
			"",
			"/* ===== reveal (thin bar -> card morph) =========================== */",
			"/* mac Spotlight idiom: an empty query shows the field row alone (the",
			"   panel IS a 52px capsule); the first keystroke grows the card under",
			"   it. grid-template-rows 0fr->1fr is the auto-height transition that",
			"   needs no JS measurement; the drop (the one grid child) requires",
			"   min-height:0 to squeeze to zero, and the reveal being a flex item",
			"   keeps the capped panel max-height feeding the scrolling list.",
			"   Expand rides the enter bezier, a touch slower than the panel enter",
			"   (.22s) so the growth reads as one gesture; collapse is quicker",
			"   (.16s) — down is always faster than up. Divider and footer live",
			"   INSIDE the drop so they fold away with it instead of popping. */",
			".ol-searchReveal {",
			"\tflex: 1 1 auto;",
			"\tmin-height: 0;",
			"\tdisplay: grid;",
			"\tgrid-template-rows: 0fr;",
			"\toverflow: hidden;",
			"\ttransition: grid-template-rows .16s cubic-bezier(.23, 1, .32, 1);",
			"}",
			".ol-searchReveal[data-expanded] {",
			"\tgrid-template-rows: 1fr;",
			"\ttransition-duration: .22s;",
			"}",
			".ol-searchDrop {",
			"\tmin-height: 0;",
			"\tdisplay: flex;",
			"\tflex-direction: column;",
			"\ttransition: opacity .15s ease-out;",
			"}",
			".ol-searchReveal:not([data-expanded]) .ol-searchDrop { opacity: 0; }",
			"",
			"/* ===== results body ============================================== */",
			".ol-searchBody {",
			"\tflex: 1;",
			"\tmin-height: 0;",
			"\tdisplay: flex;",
			"\tflex-direction: column;",
			"\tborder-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .1));",
			"}",
			".ol-searchScroll {",
			"\tflex: 1;",
			"\tmin-height: 0;",
			"\toverflow-y: auto;",
			"\toverscroll-behavior: contain;",
			"\tscrollbar-width: thin;",
			"\t/* Horizontal inset floats the rounded rows clear of the glass",
			"\t   wall so a hover/selected row reads as one pill, not a radius",
			"\t   clipped against the panel edge (the rail's preview keeps its",
			"\t   own geometry; this list is Spotlight-shaped). */",
			"\tpadding: 6px 8px;",
			"}",
			".ol-resultList { margin: 0; padding: 0; }",
			"",
			".ol-resultItem {",
			"\tdisplay: flex;",
			"\talign-items: center;",
			"\tgap: 10px;",
			"\tpadding: 0 10px 0 12px;",
			"\tmin-height: 48px;",
			"\tbox-sizing: border-box;",
			"\tborder-radius: 8px;",
			"\tcursor: pointer;",
			"}",
			".ol-resultItem:hover {",
			"\tbackground: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 6%, transparent);",
			"}",
			"/* Selection is the rounded tint pill alone (mac Spotlight idiom):",
			"   the old 3px left indicator bar read as an unrelated vertical",
			"   stroke fighting the pill radius, so it is gone — hover is the",
			"   same language at 6%, selected at 10% (later rule wins ties). The",
			"   10% tint loses the hover/selected race on a #232324 glass, so the",
			"   dark theme carries a stronger 18%. */",
			".ol-resultItem[data-selected] {",
			"\tbackground: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 10%, transparent);",
			"}",
			"body[data-ds-dark-theme] .ol-resultItem[data-selected] {",
			"\tbackground: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 18%, transparent);",
			"}",
			"",
			".ol-resultBadge {",
			"\tflex: none;",
			"\tpadding: 2px 7px;",
			"\tborder-radius: 6px;",
			"\tfont-size: 11.5px;",
			"\tline-height: 16px;",
			"\tfont-weight: 500;",
			"\tfont-variant-numeric: tabular-nums;",
			"\tbackground: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, .05));",
			"\tcolor: var(--dsw-alias-label-secondary, #61666b);",
			"}",
			"",
			"/* Two stacked one-line snippets per row; min-width:0 lets the flex",
			"   child actually ellipsize. */",
			".ol-resultTexts {",
			"\tflex: 1;",
			"\tmin-width: 0;",
			"\tdisplay: flex;",
			"\tflex-direction: column;",
			"\tgap: 2px;",
			"}",
			".ol-resultLine {",
			"\tmin-width: 0;",
			"\tfont-size: 13.5px;",
			"\tline-height: 20px;",
			"\twhite-space: nowrap;",
			"\toverflow: hidden;",
			"\ttext-overflow: ellipsis;",
			"}",
			".ol-resultPrompt { color: var(--dsw-alias-label-primary, #0f1115); }",
			".ol-resultResponse { color: var(--dsw-alias-label-secondary, #61666b); }",
			".ol-resultLine mark {",
			"\tbackground: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 24%, transparent);",
			"\t/* Primary, not inherit: response lines sit on secondary gray, and",
			"\t   a gray word on a blue tint barely reads — the hit is the point. */",
			"\tcolor: var(--dsw-alias-label-primary, #0f1115);",
			"\tborder-radius: 3px;",
			"\tpadding: 0 2px;",
			"\tfont-weight: 500;",
			"\t}",
			"body[data-ds-dark-theme] .ol-resultLine mark {",
			"\tbackground: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 32%, transparent);",
			"\tcolor: var(--dsw-alias-label-primary, #f9fafb);",
			"\t}",
			"",
			".ol-searchCapped {",
			"\tflex: none;",
			"\tpadding: 8px 16px;",
			"\tfont-size: 11.5px;",
			"\tline-height: 16px;",
			"\tcolor: var(--dsw-alias-label-tertiary, #81858c);",
			"}",
			".ol-searchEmpty {",
			"\tflex: 1;",
			"\tmin-height: 160px;",
			"\tbox-sizing: border-box;",
			"\t/* mac puts the no-results line in the upper third of the card:",
			"\t   a list whose rows are missing, not an empty bucket. */",
			"\tpadding: 72px 24px 56px;",
			"\tdisplay: flex;",
			"\tjustify-content: center;",
			"\tfont-size: 13.5px;",
			"\tline-height: 20px;",
			"\tcolor: var(--dsw-alias-label-tertiary, #81858c);",
			"}",
			".ol-searchFooter {",
			"\tflex: none;",
			"\t/* Mirrors the input/body divider so the panel reads head-list-foot;",
			"\t   without it, scrolled rows bleed straight into the hint line. */",
			"\tborder-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .1));",
			"\tpadding: 8px 16px;",
			"\tfont-size: 11.5px;",
			"\tline-height: 16px;",
			"\tfont-variant-numeric: tabular-nums;",
			"\tcolor: var(--dsw-alias-label-tertiary, #81858c);",
			"\tuser-select: none;",
			"\t}",
			"",
			"/* ===== materials =================================================",
			"   Same recipe family as the preview card: one backdrop-filter per",
			"   glass, inset rim instead of a border (cannot gap from the",
			"   superellipse clip), 'none' is the official opaque treatment. */",
			".ol-searchOverlay[data-material=\"none\"] {",
			"\t/* Inset ring, not a border: a real border grows the auto-height",
			"\t   panel to 54px and breaks the 26px capsule tangency with 2px",
			"\t   straight seams; the ring paints inside, so every material keeps",
			"\t   the same 52px folded height. */",
			"\tborder: 0;",
			"\tbackground: var(--dsw-alias-bg-layer-1, #ffffff);",
			"\tbox-shadow:",
			"\t\tinset 0 0 0 1px var(--dsw-alias-border-l2, rgba(0, 0, 0, .1)),",
			"\t\tvar(--dsw-shadow-lv2, 0 0 1px rgba(0, 0, 0, .2), 0 8px 24px rgba(0, 0, 0, .08));",
			"}",
			"/* Token-absent dark fallback: both glasses carry one; without this a",
			"   missing token would flash a white panel in a dark shell. */",
			"body[data-ds-dark-theme] .ol-searchOverlay[data-material=\"none\"] {",
			"\tbackground: var(--dsw-alias-bg-layer-1, #232324);",
			"}",
			".ol-searchOverlay[data-material=\"liquid\"] {",
			"\t--ol-glass-base: #fff;",
			"\t--ol-glass-edge: rgb(255 255 255 / .62);",
			"\tborder: 0;",
			"\tbox-shadow:",
			"\t\tinset 0 0 .5px .75px var(--ol-glass-edge),",
			"\t\t0 10px 28px rgb(0 0 0 / .12);",
			"\tbackground: color-mix(in srgb, var(--ol-glass-base) var(--ol-veil, 25%), transparent);",
			"\t/* Liquid's airy presets go down to 2px blur — right for the small",
			"\t   preview card, too thin here: 640px of glass straight over dense",
			"\t   transcript text needs a readability floor the veil alone cannot",
			"\t   provide. Values above the floor stay user-chosen. */",
			"\t-webkit-backdrop-filter: blur(max(10px, var(--ol-blur, 4px))) saturate(1.8);",
			"\tbackdrop-filter: blur(max(10px, var(--ol-blur, 4px))) saturate(1.8);",
			"}",
			"body[data-ds-dark-theme] .ol-searchOverlay[data-material=\"liquid\"] {",
			"\t--ol-glass-base: #232324;",
			"\t--ol-glass-edge: rgb(255 255 255 / .34);",
			"\tbox-shadow:",
			"\t\tinset 0 0 .5px .75px var(--ol-glass-edge),",
			"\t\t0 10px 28px rgb(0 0 0 / .36);",
			"}",
			".ol-searchOverlay[data-material=\"frost\"] {",
			"\t--ol-glass-base: #fff;",
			"\t--ol-glass-edge: rgb(255 255 255 / .62);",
			"\tborder: 0;",
			"\tbox-shadow:",
			"\t\tinset 0 0 .5px .75px var(--ol-glass-edge),",
			"\t\t0 10px 28px rgb(0 0 0 / .12);",
			"\tbackground: color-mix(in srgb, var(--ol-glass-base) calc(var(--ol-veil, 20%) + 16%), transparent);",
			"\t-webkit-backdrop-filter: blur(calc(var(--ol-blur, 6px) + 8px)) saturate(1.15);",
			"\tbackdrop-filter: blur(calc(var(--ol-blur, 6px) + 8px)) saturate(1.15);",
			"}",
			"body[data-ds-dark-theme] .ol-searchOverlay[data-material=\"frost\"] {",
			"\t--ol-glass-base: #232324;",
			"\t--ol-glass-edge: rgb(255 255 255 / .34);",
			"\tbox-shadow:",
			"\t\tinset 0 0 .5px .75px var(--ol-glass-edge),",
			"\t\t0 10px 28px rgb(0 0 0 / .36);",
			"}",
			"",
			"@media (prefers-reduced-motion: reduce) {",
			"\t.ol-searchOverlay, .ol-resultItem, .ol-searchReveal, .ol-searchDrop {",
			"\t\tanimation: none !important; transition: none !important;",
			"\t}",
			"}",
		].join("\n");

		const CSS = `
		/* ===== official-rail hiding ======================================
		   While our rail is up, the shipped TurnNavigator stands down, so the
		   two never stack into a double navbar. Matched on the aria-label the
		   official nav carries (ui-chat locale.ts ships exactly zh + en). */
		body[data-ol-active] nav[aria-label="Turn navigation"],
		body[data-ol-active] nav[aria-label="轮次导航"] { display: none !important; }

		/* ===== rail root ==================================================
		   Fixed inside the click-through shell.overlay layer: a deliberate,
		   44px transparent hit strip surrounds the 20px marks without becoming
		   a visible panel. Fixed positioning keeps it out of every
		   scroll/overflow context (no page overflow, no second scrollbar).
		   Left/right/top arrive as
		   inline styles from the measured conversation column. */
		#${NAV_ID} {
			position: fixed;
			z-index: 6;
			display: flex;
			align-items: stretch;
			/* shell.overlay can be click-through; restore input on this rail and
			   keep its 44px hit strip independent of the 20px visual line. */
			pointer-events: auto;
			user-select: none;
			--ol-mark-w: ${MARK_LINE_W}px;
			font-family: var(--dsw-font-family, "quote-cjk-patch", "Inter", system-ui,
				-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
			transition: opacity .15s cubic-bezier(.23, 1, .32, 1);
			animation: ol-enter .15s cubic-bezier(.23, 1, .32, 1);
		}
		@keyframes ol-enter { from { opacity: 0; } to { opacity: 1; } }
		/* Narrow-column switch. Sits in the rail's edge slot when the user has
		   hidden the rail; the collapse control hangs under a rail that is only
		   up because the column is under 900px. */
		.ol-narrowSwitch {
			position: fixed;
			z-index: 6;
			width: 28px;
			height: 28px;
			margin: 0;
			padding: 0;
			display: grid;
			place-items: center;
			border-radius: 999px;
			border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, .16));
			background: var(--dsw-alias-button-floating-fill, var(--dsw-alias-bg-layer-1, #232324));
			color: var(--dsw-alias-label-secondary, #c8c8c8);
			box-shadow: var(--dsw-elevation-panel, 0 8px 24px rgba(0, 0, 0, .28));
			cursor: pointer;
			pointer-events: auto;
		}
		.ol-narrowSwitch:hover { color: var(--dsw-alias-label-primary, #fff); }
		.ol-narrowSwitch:focus-visible {
			outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe);
			outline-offset: 2px;
		}
		#${NAV_ID} .ol-narrowHide {
			position: absolute;
			bottom: calc(100% + 6px);
			left: 50%;
			transform: translateX(-50%);
			width: 22px;
			height: 22px;
			margin: 0;
			padding: 0;
			display: grid;
			place-items: center;
			border-radius: 999px;
			border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, .16));
			background: var(--dsw-alias-button-floating-fill, var(--dsw-alias-bg-layer-1, #232324));
			color: var(--dsw-alias-label-tertiary, #8b9096);
			cursor: pointer;
			pointer-events: auto;
		}
		#${NAV_ID} .ol-narrowHide:hover { color: var(--dsw-alias-label-primary, #fff); }
		#${NAV_ID} .ol-narrowHide:focus-visible {
			outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe);
			outline-offset: 2px;
		}

		/* ===== shared mark language =====================================
		   The line and the interaction are identical in both layouts: idle
		   marks sit aligned at one short rest length and the current turn is
		   highlighted by color alone; under the pointer the target sweeps to
		   full length with a pronounced neighbor wave. Compact and loose
		   differ only in vertical density. The parent .ol-marks is the
		   generous hit strip; it snaps a nearby click to the closest physical
		   mark in JS, so users need not land on the two-pixel visual line. */
		#${NAV_ID} .ol-marks {
			position: relative;
			height: var(--ol-rail-h);
			width: 100%;
			flex: none;
			box-sizing: border-box;
			padding: ${RAIL_INSET}px 0;
			overflow-y: auto;
			scrollbar-width: none;
			overscroll-behavior: contain;
			cursor: pointer;
			pointer-events: auto;
			/* The strip owns its gestures: touch drags scrub instead of
			   scrolling the page (and pointercancel never preempts). */
			touch-action: none;
		}
		#${NAV_ID} .ol-marks::-webkit-scrollbar { display: none; }
		#${NAV_ID} .ol-markBtn {
			position: relative;
			display: flex;
			align-items: center;
			width: 100%;
			flex: none;
			padding: 0;
			border: 0;
			background: transparent;
			cursor: pointer;
			outline: none;
			pointer-events: none;
		}
		#${NAV_ID} .ol-line {
			width: var(--ol-mark-w);
			height: 2px;
			flex: none;
			border-radius: 2px;
			background-color: currentColor;
			/* Tertiary, not hairline-border, keeps the short resting marks
			   discoverable while the active/hover color states stay dominant. */
			color: var(--dsw-alias-label-tertiary, #81858c);
			opacity: .4;
			transition: transform .16s linear(0, .398 10%, .682 20%, .843 30%,
				.925 40%, .972 50%, 1.004 60%, 1.008 70%, 1.003 80%, 1),
				color .16s ease, opacity .16s ease;
		}
		/* The current turn keeps its rest length — hierarchy comes from
		   color, so idle marks stay perfectly aligned. */
		#${NAV_ID} .ol-markBtn[data-on="1"] .ol-line {
			color: var(--dsw-alias-label-primary, #0f1115);
			opacity: .6;
		}
		#${NAV_ID} .ol-markBtn[data-near="1"] .ol-line {
			color: var(--dsw-alias-label-primary, #0f1115);
			opacity: 1;
		}
		body[data-ds-dark-theme] #${NAV_ID} .ol-line {
			color: var(--dsw-alias-label-tertiary, #adb2b8);
		}
		body[data-ds-dark-theme] #${NAV_ID} .ol-markBtn[data-on="1"] .ol-line,
		body[data-ds-dark-theme] #${NAV_ID} .ol-markBtn[data-near="1"] .ol-line {
			color: var(--dsw-alias-label-primary, #f9fafb);
		}

		/* Pitch is the only difference between the two densities. */
		#${NAV_ID}[data-layout="compact"] .ol-markBtn { height: ${COMPACT_PITCH}px; }
		#${NAV_ID}[data-layout="loose"] .ol-markBtn { height: ${LOOSE_PITCH}px; }
		#${NAV_ID}[data-side="right"] .ol-markBtn { justify-content: flex-end; }
		#${NAV_ID}[data-side="left"] .ol-markBtn { justify-content: flex-start; }
		#${NAV_ID}[data-side="right"] .ol-line {
			transform: scaleX(var(--ol-grow, ${REST_GROW}));
			transform-origin: right;
		}
		#${NAV_ID}[data-side="left"] .ol-line {
			transform: scaleX(var(--ol-grow, ${REST_GROW}));
			transform-origin: left;
		}
		/* Official 24px fade, only once the frame is tall enough to keep a
		   readable middle. */
		#${NAV_ID}[data-clipped] .ol-marks {
			mask-image: linear-gradient(transparent 0, #000 ${FADE_PX}px, #000 calc(100% - ${FADE_PX}px), transparent 100%);
			-webkit-mask-image: linear-gradient(transparent 0, #000 ${FADE_PX}px, #000 calc(100% - ${FADE_PX}px), transparent 100%);
		}

		/* A scrub is deliberately instantaneous: animation would make the
		   selected turn lag behind the pointer. */
		#${NAV_ID}[data-scrubbing] .ol-line,
		#${NAV_ID}[data-scrubbing] .ol-markBtn { transition: none; }
		@media (prefers-reduced-motion: reduce) {
			#${NAV_ID}, #${NAV_ID} .ol-markBtn, #${NAV_ID} .ol-line,
			#${NAV_ID} .ol-previewWrap, #${NAV_ID} .ol-preview { transition: none; animation: none; }
		}


		/* ===== per-turn preview card =====================================
		   The official TurnNavigator preview, adapted: shown while a mark is
		   hovered / focused / scrubbed, anchored beside the rail (left of a
		   right rail, right of a left rail), vertically centered on that mark
		   and held clear of both rail ends. Prompt + response, two short
		   lines each. Material surface: 'none' is the official treatment
		   (bg-layer-1 + border-l2 + the token shadow). Both glasses share one
		   bright rim. Liquid is a thin lens; frost is fog with extra blur.
		   No reflection, no side-colored border, no hairline ring. The rail
		   itself stays bare marks in every mode. */
		/* 106px leaves two 20px prompt lines plus two 19px response lines
		   fully intact after padding/borders; 100px clipped the response's
		   descenders by four pixels. */
		#${NAV_ID} { --ol-preview-h: ${PREVIEW_H}px; }
		/* Vertical placement rides translateY on this wrapper so hover sweeps
		   stay on the compositor: animating the top property would relayout the card
		   (and the fixed rail subtree) every frame. */
		#${NAV_ID} .ol-previewWrap {
			position: absolute;
			top: 0; left: 0;
			width: 100%;
			pointer-events: none;
			transform: translateY(var(--ol-preview-top, 0px));
			transition: transform .14s cubic-bezier(.2, .8, .2, 1);
			will-change: transform;
		}
		#${NAV_ID} .ol-preview {
			position: absolute;
			width: min(300px, calc(100vw - 200px));
			max-height: var(--ol-preview-h);
			overflow: hidden;
			padding: 10px 12px;
			/* The 1px border is the opaque official card's outline only; the
			   glass materials zero it and rim themselves with an inset shadow
			   ring painted on the fill (see glass below). History: a transparent
			   border + outer ring-shadow gapped from the glass clip, so a real
			   border was reinstated — but a solid stroke on superellipse(1.5)
			   stair-steps at the corners under compositor subpixel offsets and
			   fractional DPR. An inset ring cannot gap by construction and
			   rasterizes coverage-antialiased. */
			border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .1));
			border-radius: 18.4px;
			corner-shape: superellipse(1.5);
			color: var(--dsw-alias-label-primary, #0f1115);
			background: var(--dsw-alias-bg-layer-1, #ffffff);
			pointer-events: none;
			box-sizing: border-box;
			animation: ol-preview-enter .12s ease-out;
		}
		/* The root is deliberately wider than the painted mark for hit slop;
		   anchor the card to the visual 20px line, not the invisible strip. */
		/* Opaque official card only. The token shadow's 0 0 1px hairline
		   must not stack on a glass border. */
		#${NAV_ID}[data-material="none"] .ol-preview {
			box-shadow: var(--dsw-shadow-lv2, 0 0 1px rgba(0, 0, 0, .2), 0 8px 24px rgba(0, 0, 0, .08));
		}
		#${NAV_ID}[data-side="right"] .ol-preview { right: calc(var(--ol-mark-w) + 10px); }
		#${NAV_ID}[data-side="left"] .ol-preview { left: calc(var(--ol-mark-w) + 10px); }
		@keyframes ol-preview-enter {
			from { opacity: 0; transform: translateX(4px); }
			to { opacity: 1; transform: translateX(0); }
		}
		#${NAV_ID}[data-side="left"] .ol-preview { animation-name: ol-preview-enter-left; }
		@keyframes ol-preview-enter-left {
			from { opacity: 0; transform: translateX(-4px); }
			to { opacity: 1; transform: translateX(0); }
		}
		.ol-prompt,
		.ol-response {
			display: -webkit-box;
			overflow: hidden;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
		}
		.ol-prompt {
			font: var(--dsw-font-xs-strong-13, 500 13px/20px inherit);
			color: var(--dsw-alias-label-primary, #0f1115);
			word-break: break-word;
		}
		.ol-response {
			margin-top: 4px;
			/* Response text is supporting, not disabled: use the readable
			   secondary token and one extra pixel of leading. Separate font
			   declarations preserve these metrics even if a host font token is
			   unavailable (an inherit fallback is invalid in that shorthand). */
			color: var(--dsw-alias-label-secondary, #61666b);
			font-size: 12.5px;
			font-weight: 400;
			line-height: 19px;
			word-break: break-word;
		}
		/* ===== glass =====================================================
		   Two materials, one backdrop-filter each, no extra nodes.
		   Liquid is a thin lens: bright rim, small blur, high saturation.
		   Frost is the same rim over fog: extra blur, muted saturation, a
		   milkier fill. The +8px is why a saved frost blur of 3px does not
		   look like liquid. No reflection gradient.
		   Shared rim: an inset ring (.75px spread + .5px blur, about the old
		   1px solid's ink) instead of a border. It rides the glass fill, so it
		   cannot gap from the edge the way the old outer ring-shadow did, and
		   its fractional spread rasterizes with per-pixel coverage, smoothing
		   the squircle corners where a 1px solid stroke stair-steps. Edge
		   alpha is unchanged - coverage, not more ink, is the antialiasing. */
		#${NAV_ID}[data-material="liquid"] .ol-preview {
			--ol-glass-base: #fff;
			--ol-glass-edge: rgb(255 255 255 / .62);
			border: 0;
			box-shadow:
				inset 0 0 .5px .75px var(--ol-glass-edge),
				0 10px 28px rgb(0 0 0 / .12);
			background: color-mix(in srgb, var(--ol-glass-base) var(--ol-veil, 25%), transparent);
			-webkit-backdrop-filter: blur(var(--ol-blur, 4px)) saturate(1.8);
			backdrop-filter: blur(var(--ol-blur, 4px)) saturate(1.8);
		}
		body[data-ds-dark-theme] #${NAV_ID}[data-material="liquid"] .ol-preview {
			--ol-glass-base: #232324;
			--ol-glass-edge: rgb(255 255 255 / .34);
			box-shadow:
				inset 0 0 .5px .75px var(--ol-glass-edge),
				0 10px 28px rgb(0 0 0 / .36);
		}
		#${NAV_ID}[data-material="frost"] .ol-preview {
			--ol-glass-base: #fff;
			--ol-glass-edge: rgb(255 255 255 / .62);
			border: 0;
			box-shadow:
				inset 0 0 .5px .75px var(--ol-glass-edge),
				0 10px 28px rgb(0 0 0 / .12);
			background: color-mix(in srgb, var(--ol-glass-base) calc(var(--ol-veil, 20%) + 16%), transparent);
			-webkit-backdrop-filter: blur(calc(var(--ol-blur, 6px) + 8px)) saturate(1.15);
			backdrop-filter: blur(calc(var(--ol-blur, 6px) + 8px)) saturate(1.15);
		}
		body[data-ds-dark-theme] #${NAV_ID}[data-material="frost"] .ol-preview {
			--ol-glass-base: #232324;
			--ol-glass-edge: rgb(255 255 255 / .34);
			box-shadow:
				inset 0 0 .5px .75px var(--ol-glass-edge),
				0 10px 28px rgb(0 0 0 / .36);
		}

				/* ===== settings card (deepdiving chrome replica) ================= */
		.ol-card {
			list-style: none;
			border: 1px solid var(--dsw-alias-border-l2);
			border-radius: 12px;
			background: var(--dsw-alias-bg-layer-3);
			transition: border-color .16s, background .16s;
		}
		.ol-card:hover { border-color: var(--dsw-alias-label-dimmed); }
		.ol-card.ol-card-open { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-label-dimmed); }
		.ol-head {
			width: 100%; appearance: none; border: 0; background: none;
			font: inherit; color: inherit; text-align: left; cursor: pointer;
			display: flex; align-items: center; gap: 12px;
			padding: 14px 16px; border-radius: 12px;
		}
		.ol-head:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
		.ol-headText { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
		.ol-name { font-size: 15px; font-weight: 600; line-height: 1.4; color: var(--dsw-alias-label-primary); }
		/* Supporting copy remains quiet, but it is not disabled UI: secondary
		   contrast survives a bright settings surface much better than tertiary. */
		.ol-desc { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary, #61666b); }
		.ol-chev { flex: none; color: var(--dsw-alias-label-secondary, #61666b); transition: transform .16s; }
		.ol-chev.ol-chevOpen { transform: rotate(180deg); }
		.ol-body { border-top: 1px solid var(--dsw-alias-border-l2); margin: 0 16px; padding-bottom: 8px; }
		.ol-field { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; }
		.ol-field + .ol-field { border-top: 1px solid var(--dsw-alias-border-l2); }
		.ol-label { font-size: 14px; font-weight: 600; line-height: 20px; color: var(--dsw-alias-label-primary); }
		.ol-hint { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary, #61666b); }
		.ol-scale { display: flex; gap: 8px; width: 100%; }
		/* Pill's default 12px muted labels are too faint in this dense card.
		   Increase both the target and the glyphs; active remains the primary
		   reading weight while inactive choices stay legible. */
		.ol-scale > button {
			flex: 1;
			justify-content: center;
			height: 32px;
			border-radius: 16px;
			font-size: 13px;
			line-height: 20px;
			font-weight: 500;
			color: var(--dsw-alias-label-secondary, #61666b);
		}
		.ol-scale > button[aria-pressed="true"] {
			font-weight: 600;
			color: var(--dsw-alias-label-primary, #0f1115);
		}
		/* Glass parameter sliders: the preset chips above snap both values;
		   these are the custom path. Native range + accent-color stays
		   theme-aware without a second widget system. */
		.ol-sliders { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
		.ol-sliderRow { display: flex; align-items: center; gap: 10px; }
		.ol-sliderName {
			flex: none; width: 6em;
			font-size: 13px; line-height: 20px;
			color: var(--dsw-alias-label-secondary, #61666b);
		}
		.ol-range {
			flex: 1; min-width: 0; margin: 0;
			accent-color: var(--dsw-alias-brand-primary, #4d6bfe);
			cursor: pointer;
		}
		.ol-sliderValue {
			flex: none; min-width: 3em; text-align: right;
			font-size: 13px; line-height: 20px;
			font-variant-numeric: tabular-nums;
			color: var(--dsw-alias-label-primary, #0f1115);
		}
		${SEARCH_CSS}
		`;

		/* =====================================================================
		 * Turn discovery + scroll tracking — unchanged in spirit from 0.0.1:
		 * DOM-attribute discovery, memoized scroller probe, content-offset
		 * cache refilled only on mutation/resize, binary-search scroll track.
		 * ===================================================================== */

		const scrollMemo = { host: null, el: null };

		function findScrollEl(host) {
			if (scrollMemo.el !== null && scrollMemo.el.isConnected
				&& scrollMemo.host === host) return scrollMemo.el;
			let el = null;
			if (/(auto|scroll)/.test(getComputedStyle(host).overflowY)
				|| host.scrollHeight > host.clientHeight + 20) el = host;
			if (el === null) el = host.querySelector('div[class*="_scrollBody"]');
			if (el === null) {
				for (const d of host.querySelectorAll("div")) {
					if (d.scrollHeight > d.clientHeight + 20
						&& /(auto|scroll)/.test(getComputedStyle(d).overflowY)) {
						el = d;
						break;
					}
				}
			}
			scrollMemo.host = host;
			scrollMemo.el = el;
			return el;
		}

		/** Preview budget per field — the card clamps two short lines, so
		   anything past this is invisible (official PREVIEW_LIMIT = 160). */
		const PREVIEW_LIMIT = 160;

		function snippet(el) {
			return (el.textContent || "")
				.replace(/\s+/g, " ")
				.replace(/^ +/, "")
				.slice(0, PREVIEW_LIMIT);
		}

		/** Prompt text without the message's action row (timestamp, copy
		 * buttons): the bubble text lives in a *_userStack module class —
		 * hashed prefix, stable suffix (the suffix-match idiom deepdiving
		 * uses for the running label). Falls back to the whole node. */
		function promptText(el) {
			const stack = el.querySelector('[class$="_userStack"]');
			return snippet(stack ?? el);
		}

		/** One turn for the rail: the user element (jump anchor + scroll
		   offset) plus the preview pair — its prompt and the LAST
		   assistant-step text of the same turn (official turnNavigationItem
		   semantics: findLast assistant text, empty string when none).
		   Walks the flow's [data-chat-flow-kind] nodes in document order so
		   a turn's response is whatever assistant text precedes the next
		   user element. Fidelity note: the official response reads only the
		   snapshot's finalized text blocks, while the DOM flattens a
		   rendered reasoning disclosure into the same step — a response may
		   open with its thinking text; no stable DOM seam separates them. */
		/* Turn-text cache: gen-validated per user element. A refresh re-reads
		   only fresh turns and the final (possibly streaming) turn; validated
		   history reuses its snippet pair, so streaming refreshes stop
		   rebuilding every historical string. The content observer bumps the
		   generation whenever a mutation lands outside the tail region
		   (edited prompts, re-rendered blocks) — over-invalidation is safe,
		   staleness is not. */
		let textGen = 0;
		const textCache = new WeakMap();

		function findParts() {
			const host = document.querySelector("[data-conversation-scroll]");
			if (host === null) return null;
			const scrollEl = findScrollEl(host);
			const turns = [];
			/* Steps are collected as elements and snippeted only from the tail;
			   live=false turns (validated cache hits) skip the read entirely. */
			const steps = [];
			let entry = null; // current turn's cache entry
			let live = false; // true → seal may read step text into the entry
			const seal = () => {
				if (entry !== null && live) {
					for (let i = steps.length - 1; i >= 0 && entry.response === ""; i -= 1) {
						const text = snippet(steps[i]);
						if (text !== "") entry.response = text;
					}
					/* The pushed turn holds a copy of the response string — sync it
					   back after the read (the pre-cache code wrote the turn object
					   directly; the cache entry is the new source of truth). */
					if (turns.length > 0) turns[turns.length - 1].response = entry.response;
				}
				steps.length = 0;
			};
			for (const el of host.querySelectorAll("[data-chat-flow-kind]")) {
				const kind = el.dataset.chatFlowKind;
				if (kind === "user") {
					seal();
					const hit = textCache.get(el);
					let next, nextLive;
					if (hit !== undefined && hit.gen === textGen) {
						next = hit;
						nextLive = false; // validated history: text + response reused
					} else {
						next = { gen: textGen, text: promptText(el), response: "" };
						textCache.set(el, next);
						nextLive = true;
					}
					/* Degenerate empty prompt (extraction failed): keep the previous
					   entry so following steps stay with that turn, as before. */
					if (next.text === "") continue;
					entry = next;
					live = nextLive;
					turns.push({ key: el.dataset.chatFlowKey ?? String(turns.length), el, text: entry.text, response: entry.response });
				} else if (kind === "assistant-step" && entry !== null) {
					steps.push(el);
				}
			}
			/* The final turn's response may still be streaming: always re-read
			   it and copy the fresh value back into the pushed turn object. */
			if (entry !== null && turns.length > 0) {
				entry.response = "";
				live = true;
				seal();
				turns[turns.length - 1].response = entry.response;
			}
			if (scrollEl === null || turns.length === 0) return null;
			return { host, scrollEl, turns, users: turns.map((t) => t.el) };
		}

		/* =====================================================================
		 * Geometry: the official rail's math, read off the live scrollport.
		 * ConversationRoot publishes --dsh-composer-height and
		 * --dsh-conversation-viewport-height inline on the
		 * [data-conversation-scroll] element; a getComputedStyle read picks
		 * them up (with the official first-paint fallbacks) plus the column
		 * rect the rail hugs.
		 * ===================================================================== */

		function measure() {
			const host = document.querySelector("[data-conversation-scroll]");
			if (host === null) return null;
			const rect = host.getBoundingClientRect();
			if (rect.width === 0) return null;
			const cs = getComputedStyle(host);
			const composerH = parseFloat(cs.getPropertyValue("--dsh-composer-height")) || 152;
			const vpH = parseFloat(cs.getPropertyValue("--dsh-conversation-viewport-height")) || rect.height;
			return {
				rect,
				composerH,
				band: Math.max(0, Math.min(vpH, rect.height) - composerH),
				colW: rect.width,
			};
		}

		/* =====================================================================
		 * Preferences external store: apply() owns the configForms controller;
		 * every scope change re-resolves the config into this store, which both the
		 * rail and the runtime side-effects subscribe to. Fallback = defaults
		 * until the scope reports ready.
		 * ===================================================================== */

		const prefs = {
			value: { ...DEFAULTS },
			listeners: new Set(),
			set(next) {
				prefs.value = next;
				for (const l of prefs.listeners) l();
			},
		};
		/* Stable unbound functions — React calls getSnapshot/subscribe as
		   bare references, so the store must not rely on `this`. */
		const prefsGet = () => prefs.value;
		const prefsSubscribe = (l) => {
			prefs.listeners.add(l);
			return () => { prefs.listeners.delete(l); };
		};

		function prefsFrom(snap) {
			if (snap !== undefined && snap.status === "ready"
				&& typeof snap.value === "object" && snap.value !== null) {
				const v = snap.value;
				return {
					side: SIDES.includes(v.side) ? v.side : DEFAULTS.side,
					material: MATERIALS.includes(v.material) ? v.material : DEFAULTS.material,
					layout: LAYOUTS.includes(v.layout) ? v.layout : DEFAULTS.layout,
					narrow: v.narrow === "hide" ? "hide" : "show",
					frostTransparency: clampNum(v.frostTransparency, T_MIN, T_MAX, DEFAULTS.frostTransparency),
					frostBlur: clampNum(v.frostBlur, B_MIN, B_MAX, DEFAULTS.frostBlur),
					liquidTransparency: clampNum(v.liquidTransparency, LIQUID_T_MIN, LIQUID_T_MAX, DEFAULTS.liquidTransparency),
					liquidBlur: clampNum(v.liquidBlur, B_MIN, B_MAX, DEFAULTS.liquidBlur),
				};
			}
			return { ...DEFAULTS };
		}

		/* =====================================================================
		 * Marks. One memoized row type serves both layouts: the differences
		 * live in CSS keyed off [data-layout], and the neighbor ripple passes
		 * through as a per-row growth value. Hover index drives the ripple;
		 * scrub reuses the same channel while dragging.
		 * ===================================================================== */

		function growthAt(distance) {
			/* One pronounced wave: the target sweeps to full length, then the
			   growth decays by distance — ±3 is already back at rest. */
			if (distance === 0) return 1;
			if (distance === 1) return 0.7;
			if (distance === 2) return 0.4;
			if (distance === 3) return 0.2;
			return REST_GROW;
		}

		function markGrowth(i, near) {
			/* Idle marks sit perfectly aligned at the rest length; the current
			   turn stands out by color alone, never by length. Pointer or
			   keyboard focus drives the distance-decay wave. */
			if (near < 0) return REST_GROW;
			return growthAt(Math.abs(i - near));
		}

		/** Preview card top (px within the rail root): centered on the mark's
		 *  live visual position, clamped inside the root — the official clamp,
		 *  numeric form. Pure DOM math, shared by hover placement and the
		 *  loose rail's internal-scroll re-placement. */
		function previewTopFor(root, btn) {
			const rootR = root.getBoundingClientRect();
			const btnR = btn.getBoundingClientRect();
			const center = btnR.top + btnR.height / 2 - rootR.top;
			return Math.max(0, Math.min(center - PREVIEW_H / 2, rootR.height - PREVIEW_H));
		}

		const Row = memo(function Row({ i, on, hot, near, text, onJump, grow }) {
			const style = { "--ol-grow": String(grow) };
			return h("button", {
				type: "button",
				className: "ol-markBtn",
				"data-on": on ? "1" : undefined,
				"data-near": hot ? "1" : undefined,
				"aria-current": on ? "true" : undefined,
				"aria-label": text.slice(0, 60) || `turn ${i + 1}`,
				style,
				/* Pointer input is intentionally handled once by the enlarged rail
				   strip. detail === 0 is the keyboard / assistive-technology path. */
				onClick: (e) => { if (e.detail === 0) onJump(i); },
				onFocus: () => near(i),
			}, h("span", { className: "ol-line" }));
		});

		/* =====================================================================
		 * The overlay entry.
		 * ===================================================================== */

		/** Device-pixel snap so a 1px rim is not sampled between pixels. */
		function snapPx(n) {
			const dpr = window.devicePixelRatio || 1;
			return Math.round(n * dpr) / dpr;
		}
		/* Flush with the column edge, not centered in the 44px hit strip.
		   A narrow column has ~20px of gutter before the text; a centered
		   22px chip covers the first characters. */
		function edgeBox(side, rect, top, size) {
			const edge = side === "right"
				? { right: `${snapPx(Math.max(0, window.innerWidth - rect.right) + EDGE_GAP)}px` }
				: { left: `${snapPx(rect.left + EDGE_GAP)}px` };
			return {
				...edge,
				top: `${snapPx(top)}px`,
				width: `${size}px`,
				height: `${size}px`,
				transform: "translateY(-50%)",
			};
		}
		function MarksGlyph() {
			return h("svg", {
				width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": "true",
			}, h("path", {
				d: "M2 3.5h10M2 7h7M2 10.5h10",
				fill: "none", stroke: "currentColor", "stroke-width": 1.4, "stroke-linecap": "round",
			}));
		}
		function ChevronGlyph({ side }) {
			const d = side === "left" ? "M9 3.5 5 7l4 3.5" : "M5 3.5 9 7l-4 3.5";
			return h("svg", {
				width: 12, height: 12, viewBox: "0 0 14 14", "aria-hidden": "true",
			}, h("path", {
				d, fill: "none", stroke: "currentColor",
				"stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round",
			}));
		}
		let outlineScope = null;
		function writeNarrow(mode) {
			const scope = outlineScope;
			const snap = scope && typeof scope.getSnapshot === "function" ? scope.getSnapshot() : null;
			if (snap && snap.status === "ready" && snap.writable !== false && typeof scope.set === "function") {
				void scope.set("narrow", mode);
				return;
			}
			prefs.set({ ...prefs.value, narrow: mode });
		}
		function railLabel(which) {
			const en = (document.documentElement.lang || "").startsWith("en");
			if (which === "show") return en ? "Show turn navigation" : "显示轮次导航";
			return en ? "Hide turn navigation" : "收起轮次导航";
		}


		/* =====================================================================
		 * Search bridge: OutlineNav publishes its live turn list here (the
		 * refresh path below keeps it current), and jumpToKey is the
		 * search-side twin of the rail's jump() — same smooth scroll, same
		 * quiet landing flash, addressed by turn key, never by stale index.
		 * ===================================================================== */
		const navBridge = { turns: [], host: null, version: 0 };

		function jumpToKey(key) {
			const t = navBridge.turns.find((x) => x.key === key);
			if (t === undefined || !t.el.isConnected) return;
			t.el.scrollIntoView({ behavior: "smooth", block: "start" });
			/* WAAPI is not covered by the CSS reduced-motion block — gate it
			   here exactly like the rail's jump(). */
			if (t.el.animate !== undefined && !REDUCED_MOTION.matches) {
				t.el.animate(
					[
						{ backgroundColor: "color-mix(in srgb, currentColor 14%, transparent)" },
						{ backgroundColor: "color-mix(in srgb, currentColor 14%, transparent)", offset: .35 },
						{ backgroundColor: "color-mix(in srgb, currentColor 5%, transparent)" },
					],
					{ duration: 1400, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
				);
			}
		}

		/* =====================================================================
		 * Conversation search (Cmd+F) — engine half: index build, sliced scan,
		 * context windows. The React half only touches the searchState store
		 * and the search* entry points; every DOM read lives here behind one
		 * bucketing walk. Splice: directly after the navBridge/jumpToKey
		 * integration block; the SEARCH_* constants live in the constants
		 * section (spec §1). navBridge is that integration global — the engine
		 * never imports, so the node harness can load this very source with
		 * injected host globals and no shipped test seams.
		 *
		 * Invalidation is snippet-prefix validation, not generations: every
		 * navBridge refresh re-reads each turn's PREVIEW_LIMIT snippet anyway,
		 * so sameSnippet(indexed full text, fresh snippet) detects edited
		 * prompts and regenerated responses for free. The tail turn streams by
		 * definition and is re-read on every revalidate regardless.
		 * ===================================================================== */

		/* External store, prefs pattern: stable unbound getters for
		   useSyncExternalStore. set() keeps the old value object when a patch
		   changes nothing — a fresh object per call would churn snapshot
		   identity and schedule empty renders. */
		const searchState = {
			value: { open: false, indexed: 0, total: 0, results: [], capped: false, pulse: 0 },
			listeners: new Set(),
			set(patch) {
				let changed = false;
				for (const k in patch) {
					if (!Object.is(searchState.value[k], patch[k])) { changed = true; break; }
				}
				if (changed) {
					searchState.value = { ...searchState.value, ...patch };
					for (const l of searchState.listeners) l();
				}
			},
		};
		const searchGet = () => searchState.value;
		const searchSubscribe = (l) => {
			searchState.listeners.add(l);
			return () => { searchState.listeners.delete(l); };
		};

		/* Timer discipline (file rule): every setTimeout/idle handle the engine
		   creates is registered here so disposeHard unwinds it all in one sweep —
		   a leaked debounce or an in-flight idle slice would otherwise outlive
		   the plugin and keep reading a torn-down DOM. */
		const searchTimers = { timeout: new Set(), idle: new Set() };
		function searchLater(fn, ms) {
			const id = setTimeout(() => { searchTimers.timeout.delete(id); fn(); }, ms);
			searchTimers.timeout.add(id);
			return id;
		}
		function searchIdle(fn) {
			/* requestIdleCallback keeps index building off the input path; the
			   16ms setTimeout fallback covers Safari and the node harness. */
			if (typeof requestIdleCallback !== "function") return searchLater(fn, 16);
			const id = requestIdleCallback(() => { searchTimers.idle.delete(id); fn(); }, { timeout: 100 });
			searchTimers.idle.add(id);
			return id;
		}
		function searchCancel(id) {
			if (searchTimers.timeout.delete(id)) clearTimeout(id);
			else if (searchTimers.idle.delete(id) && typeof cancelIdleCallback === "function") cancelIdleCallback(id);
		}

		/* Slice clock: performance.now in the browser; kept behind an
		   indirection so the node harness can step time and force
		   deterministic slice boundaries. */
		const searchNow = typeof performance !== "undefined" && typeof performance.now === "function"
			? () => performance.now()
			: () => Date.now();

		/* ===== Search: pure text logic (unit-tested straight from the harness) ==== */

		/* The same whitespace collapse snippet() applies before truncating —
		   the search side just never truncates. Idempotent, so storing
		   already-normalized full text keeps sameSnippet exact. */
		function normText(s) {
			return s.replace(/\s+/g, " ").replace(/^ +/, "");
		}

		/* Validation predicate: a rail snippet is normalize+slice(0,160) of the
		   turn's live text, so the indexed full text is stale exactly when its
		   normalized prefix no longer equals the fresh snippet. An empty
		   snippet matches anything (vacuous prefix) — safe because an empty
		   rail response can only come from a turn the engine also reads as
		   empty, and the tail turn bypasses validation entirely. */
		function sameSnippet(full, snippet) {
			return normText(full).slice(0, snippet.length) === snippet;
		}

		/* Query → lowercase AND-tokens. split(/\s+/) keeps CJK intact (a
		   Chinese phrase is one token, no per-character splitting), the Set
		   dedupes repeated words, and the empty filter keeps a blank query
		   from vacuously matching every turn. No Unicode normalization —
		   toLowerCase is what the rail-side matching already assumes. */
		function tokenizeQuery(q) {
			return [...new Set(q.toLowerCase().trim().split(/\s+/))].filter((t) => t !== "");
		}

		/* A turn matches when every token appears somewhere in it — each token
		   independently may hit the prompt OR the response (cross-field AND,
		   per-word OR), matching how a reader scans the preview pair. */
		function entryHits(entry, tokens) {
			return tokens.every((t) => entry.promptLower.indexOf(t) !== -1 || entry.responseLower.indexOf(t) !== -1);
		}

		/* Context window for one hit field: a ±pad window around the EARLIEST
		   token occurrence, clamped to cap characters (shrunk from the tail so
		   the first hit stays anchored), a hit mask built by indexOf-scanning
		   each token inside the window (overlaps merge for free in a boolean
		   mask), collapsed into segments. Segments concatenate back to the
		   exact window slice of the ORIGINAL text — matching used the
		   lowercase copy, rendering keeps the original case. Returns null when
		   no token occurs in this field (the other field carries the
		   highlight). */
		function buildSearchCtx(text, tokens, pad, cap) {
			const lower = text.toLowerCase();
			let start = -1;
			for (const t of tokens) {
				const i = lower.indexOf(t);
				if (i !== -1 && (start === -1 || i < start)) start = i;
			}
			if (start === -1) return null;
			let from = Math.max(0, start - pad);
			let to = Math.min(lower.length, start + pad);
			if (to - from > cap) to = from + cap;
			const win = lower.slice(from, to);
			const mask = new Array(to - from).fill(false);
			for (const t of tokens) {
				let i = win.indexOf(t);
				while (i !== -1) {
					for (let k = 0; k < t.length; k += 1) mask[i + k] = true;
					i = win.indexOf(t, i + t.length);
				}
			}
			const segments = [];
			for (let i = 0; i < mask.length;) {
				const hit = mask[i];
				let j = i + 1;
				while (j < mask.length && mask[j] === hit) j += 1;
				segments.push({ t: text.slice(from + i, from + j), hit });
				i = j;
			}
			return { segments, head: from > 0, tail: to < lower.length };
		}

		/* ===== Search: DOM extraction (one walk, independent of findParts) ==== */

		/* Full text, untruncated — the index must see past PREVIEW_LIMIT. A
		   TreeWalker over text nodes is the explicit spelling of "all text and
		   nothing else", kept separate from the rail's snippet cache. */
		function readAllText(el) {
			let out = "";
			const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
			for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) out += n.nodeValue;
			return out;
		}

		/* prompt = the *_userStack bubble text (the action row of timestamp
		   and copy buttons lives outside it; whole-node fallback mirrors
		   promptText()). response = the LAST non-empty assistant step, full
		   text — the findLast semantics the rail preview uses, minus the
		   truncation. */
		function extractTurn(el, steps) {
			const prompt = normText(readAllText(el.querySelector('[class$="_userStack"]') ?? el));
			let response = "";
			for (let i = steps.length - 1; i >= 0 && response === ""; i -= 1) {
				const text = normText(readAllText(steps[i]));
				if (text !== "") response = text;
			}
			return { prompt, response };
		}

		/* Steps per turn from ONE element pass over [data-chat-flow-kind].
		   Bucket boundaries are the rail's own user els, so degenerate
		   empty-prompt user elements (which findParts skips) are transparent:
		   steps after one land on the previous rail turn, exactly the
		   attribution the rail preview shows. Element refs only, zero text
		   reads — the budgeted cost is extraction, not bucketing. */
		function bucketSteps(turns, host) {
			const elToIdx = new Map(turns.map((t, i) => [t.el, i]));
			const steps = new Map(turns.map((t) => [t.el, []]));
			if (host === null || typeof host.querySelectorAll !== "function") return steps;
			let cur = -1;
			for (const el of host.querySelectorAll("[data-chat-flow-kind]")) {
				const kind = el.dataset.chatFlowKind;
				if (kind === "user") {
					const idx = elToIdx.get(el);
					if (idx !== undefined) cur = idx;
				} else if (kind === "assistant-step" && cur >= 0) {
					steps.get(turns[cur].el).push(el);
				}
			}
			return steps;
		}

		function makeEntry(turn, n, prompt, response) {
			return {
				key: turn.key, n, el: turn.el, prompt, response,
				promptLower: prompt.toLowerCase(), responseLower: response.toLowerCase(),
			};
		}

		/* ===== Search: index build (idle slices) ==== */

		const searchIndex = { entries: [], byEl: new Map(), building: false, done: false };
		const build = { phase: "idle", turns: [], host: null, stepsArr: [], k: 0, respIdx: -1, prompt: "", response: "" };

		function searchBuildStart() {
			/* Snapshot the rail's list: the build walks this turn set even if
			   navBridge refreshes mid-build — the finish pass re-aligns with
			   the live list (and revalidates) when the slices drain. */
			const turns = navBridge.turns;
			build.turns = turns.map((t, i) => ({ el: t.el, key: t.key ?? String(i) }));
			build.host = navBridge.host ?? document.querySelector("[data-conversation-scroll]");
			build.k = 0;
			build.respIdx = -1;
			build.prompt = "";
			build.response = "";
			build.phase = "walk";
			searchIndex.building = true;
			searchState.set({ total: build.turns.length, indexed: 0 });
			searchIdle(searchBuildSlice);
		}

		function searchBuildSlice() {
			if (build.phase === "idle" || build.phase === "done") return; // cleared (keepalive/dispose) between slices
			if (build.phase === "walk") {
				const buckets = bucketSteps(build.turns, build.host);
				build.stepsArr = build.turns.map((t) => buckets.get(t.el) ?? []);
				build.phase = "extract";
			}
			const t0 = searchNow();
			let chars = 0; // per-slice character budget (spec: ≤2ms / ≤32Ki per slice)
			while (build.phase === "extract") {
				const turn = build.turns[build.k];
				if (build.respIdx === -1) {
					build.prompt = normText(readAllText(turn.el.querySelector('[class$="_userStack"]') ?? turn.el));
					build.respIdx = (build.stepsArr[build.k] ?? []).length;
					chars += build.prompt.length;
				} else if (build.respIdx > 0) {
					/* Response searched from the tail; the first non-empty step
					   read stops the loop (findLast, not scan-all). */
					const text = normText(readAllText(build.stepsArr[build.k][build.respIdx - 1]));
					build.respIdx -= 1;
					chars += text.length;
					if (text !== "") { build.response = text; build.respIdx = 0; }
				} else {
					const entry = makeEntry(turn, build.k + 1, build.prompt, build.response);
					searchIndex.entries.push(entry);
					searchIndex.byEl.set(turn.el, entry);
					build.k += 1;
					build.respIdx = -1;
					build.prompt = "";
					build.response = "";
					if (build.k >= build.turns.length) searchBuildFinish();
				}
				if (build.phase !== "extract") break;
				if (chars >= SEARCH_EXTRACT_CHARS || searchNow() - t0 >= SEARCH_EXTRACT_MS) {
					searchIdle(searchBuildSlice);
					/* Indexed notifies per slice, not per turn: the value is the
					   same at turn granularity, minus one set() per turn. */
					searchState.set({ indexed: searchIndex.entries.length });
					return;
				}
			}
		}

		function searchBuildFinish() {
			build.phase = "done";
			searchIndex.building = false;
			searchIndex.done = true;
			searchState.set({ indexed: searchIndex.entries.length, total: build.turns.length });
			/* The turn list may have moved while we sliced (streaming tail, new
			   turns, edits): one align pass folds the live navBridge in — and,
			   with a standing query, re-runs the scan over the complete index.
			   This also serves revalidates requested mid-build. */
			searchRevalidate();
		}

		/* ===== Search: sliced scan (seq-gated, newest first, early stop) ==== */

		let searchSeq = 0;
		let scanState = null;
		let lastQuery = "";
		let submitTimer = null;
		let keepaliveTimer = null;

		function searchScanNow() {
			const tokens = tokenizeQuery(lastQuery);
			searchSeq += 1;
			if (tokens.length === 0) { searchState.set({ results: [], capped: false }); return; }
			const s = { seq: searchSeq, i: searchIndex.entries.length - 1, results: [], capped: false, tokens };
			scanState = s;
			searchScanSlice(s);
		}

		function searchScanSlice(s) {
			/* Seq gate: a newer submit/open/close/revalidate bumped the counter
			   or replaced the scan — drop this slice without touching results.
			   The identity check also retires slices of a scan object that was
			   replaced (not merely outdated) mid-flight. */
			if (s !== scanState || s.seq !== searchSeq) return;
			const t0 = searchNow();
			const entries = searchIndex.entries;
			while (s.i >= 0) {
				const e = entries[s.i]; // descending index → newest turn first
				s.i -= 1;
				if (entryHits(e, s.tokens)) {
					s.results.push({
						key: e.key,
						n: e.n,
						prompt: buildSearchCtx(e.prompt, s.tokens, SEARCH_CTX_PAD, SEARCH_CTX_MAX),
						response: buildSearchCtx(e.response, s.tokens, SEARCH_CTX_PAD, SEARCH_CTX_MAX),
					});
					/* Early stop at 50: no total counting past the cap. capped is
					   honest — set only when unscanned turns actually remain. */
					if (s.results.length >= SEARCH_MAX_RESULTS) { s.capped = s.i >= 0; break; }
				}
				if (searchNow() - t0 >= SEARCH_SLICE_MS) { searchLater(() => { searchScanSlice(s); }, 0); return; }
			}
			searchState.set({ results: s.results, capped: s.capped });
		}

		/* ===== Search: public entry points (component contract, spec A.1) ==== */

		function searchOpenRequested() {
			if (keepaliveTimer !== null) { searchCancel(keepaliveTimer); keepaliveTimer = null; }
			searchState.set({ open: true, pulse: searchState.value.pulse + 1 });
			/* A kept-alive index may predate a conversation swap, and the
			   overlay's version polling only sees bumps from here on — so a
			   finished index is revalidated on every open: a clean one costs one
			   prefix pass plus the tail read, a swapped one falls into the sliced
			   rebuild. Revalidate rescans a standing query itself. */
			if (searchIndex.done) {
				searchRevalidate();
				return;
			}
			if (!searchIndex.building) searchBuildStart();
			/* The input restores the remembered query (searchLastQuery), but
			   results were dropped on close — re-run the scan so the list
			   matches the restored text. Over a partial index if the build is
			   still slicing; the finish pass re-scans when it completes. */
			if (lastQuery !== "") searchScanNow();
		}

		function searchCloseRequested() {
			/* Results go (the panel is gone); the query stays engine-side for
			   the reopen restore, and the index lingers through the keepalive
			   window so a quick reopen is instant. Pending query work stops:
			   the seq bump retires in-flight slices, the debounce dies. */
			searchSeq += 1;
			scanState = null;
			if (submitTimer !== null) { searchCancel(submitTimer); submitTimer = null; }
			searchState.set({ open: false, results: [], capped: false });
			if (keepaliveTimer !== null) searchCancel(keepaliveTimer);
			keepaliveTimer = searchLater(searchKeepaliveExpire, SEARCH_KEEPALIVE_MS);
		}

		function searchKeepaliveExpire() {
			keepaliveTimer = null;
			/* Index only, never panel state: the query survives for the next
			   restore and open(false) stays as-is — the next open simply
			   rebuilds (searchOpenRequested starts a fresh build). */
			searchSeq += 1;
			scanState = null;
			build.phase = "idle";
			searchIndex.building = false;
			searchIndex.done = false;
			searchIndex.entries = [];
			searchIndex.byEl = new Map();
			searchState.set({ indexed: 0, total: 0 });
		}

		function searchDisposeHard() {
			for (const id of searchTimers.timeout) clearTimeout(id);
			searchTimers.timeout.clear();
			for (const id of searchTimers.idle) {
				if (typeof cancelIdleCallback === "function") cancelIdleCallback(id);
			}
			searchTimers.idle.clear();
			submitTimer = null;
			keepaliveTimer = null;
			searchSeq += 1;
			scanState = null;
			build.phase = "idle";
			searchIndex.entries = [];
			searchIndex.byEl = new Map();
			searchIndex.building = false;
			searchIndex.done = false;
			lastQuery = "";
			/* Direct value swap, no notify: teardown is unmounting the only
			   subscribers, and a final render burst would race the unmount. */
			searchState.value = { open: false, indexed: 0, total: 0, results: [], capped: false, pulse: 0 };
		}

		function searchSubmit(q) {
			lastQuery = q;
			if (submitTimer !== null) { searchCancel(submitTimer); submitTimer = null; }
			if (tokenizeQuery(q).length === 0) {
				/* Blank query clears synchronously — backspacing to empty must
				   never show stale hits — and the seq bump drops any in-flight
				   slices of the previous query. */
				searchSeq += 1;
				scanState = null;
				searchState.set({ results: [], capped: false });
				return;
			}
			/* In-flight slices of the previous query die at their next slice
			   boundary; the debounced scan re-reads lastQuery when it fires. */
			searchSeq += 1;
			submitTimer = searchLater(() => { submitTimer = null; searchScanNow(); }, SEARCH_DEBOUNCE_MS);
		}

		/* Re-read what changed: entries whose fresh rail snippet no longer
		   prefixes the indexed full text (edited prompt, regenerated response)
		   plus the tail turn (streaming by definition — validated or not); if
		   every entry validated, that tail read is the only DOM work. Turns
		   that appeared since the build are indexed here too. */
		function searchRevalidate() {
			/* During a build the finish pass re-aligns with the live list
			   anyway; before any build there is nothing to validate. */
			if (searchIndex.building || !searchIndex.done) return;
			const turns = navBridge.turns;
			const dirty = [];
			for (let i = 0; i < turns.length; i += 1) {
				const t = turns[i];
				const e = searchIndex.byEl.get(t.el);
				if (e === undefined || i === turns.length - 1
					|| !sameSnippet(e.prompt, t.text ?? "")
					|| !sameSnippet(e.response, t.response ?? "")) dirty.push(i);
			}
			/* Mass invalidation (a whole-page re-render flips every snippet): a
			   synchronous dirty sweep would read the entire conversation inside
			   one task and blow the frame budget — the exact jank this engine
			   exists to prevent. Fall back to the sliced idle builder, which
			   re-reads everything off the input path. */
			if (dirty.length > SEARCH_REVALIDATE_SYNC_MAX) {
				build.phase = "idle";
				searchIndex.building = false;
				searchIndex.done = false;
				searchIndex.entries = [];
				searchIndex.byEl = new Map();
				searchBuildStart();
				return;
			}
			if (dirty.length > 0) {
				const steps = bucketSteps(turns, navBridge.host ?? document.querySelector("[data-conversation-scroll]"));
				for (const i of dirty) {
					const t = turns[i];
					const full = extractTurn(t.el, steps.get(t.el) ?? []);
					searchIndex.byEl.set(t.el, makeEntry(t, i + 1, full.prompt, full.response));
				}
			}
			/* Re-align order/keys/n with the live list (turns may have been
			   appended or removed since the build); byEl is rebuilt so el
			   references of dropped turns are released. */
			const entries = turns.map((t, i) => {
				const e = searchIndex.byEl.get(t.el);
				e.key = t.key ?? String(i);
				e.n = i + 1;
				return e;
			});
			searchIndex.entries = entries;
			searchIndex.byEl = new Map(entries.map((e) => [e.el, e]));
			searchState.set({ indexed: entries.length, total: turns.length });
			if (lastQuery !== "") searchScanNow();
		}

		/* The panel reads this to seed its input on open (spec B.2). */
		const searchLastQuery = () => lastQuery;

		function OutlineNav() {
			const rootRef = useRef(null);
			const marksRef = useRef(null);
			const partsRef = useRef(null);
			const scrollElRef = useRef(null);
			const rafPending = useRef(0); // queued track() rAF handle, cancelable
			const topsRef = useRef([]);
			const rowsRef = useRef([]);
			const scrubbingRef = useRef(false);
			const draggedRef = useRef(false);
			const dragStartRef = useRef(null);
			const scrubIndexRef = useRef(-1);
			const moveRafRef = useRef(0);
			const movePtRef = useRef(null);
			const scrollRafRef = useRef(0);
			const [turns, setTurns] = useState([]); // [{ key, el, text, response }]
			const [active, setActive] = useState(0);
			const [near, setNear] = useState(-1); // hover/focus/scrub index
			const [previewTop, setPreviewTop] = useState(null); // px within the root
			const [geo, setGeo] = useState(null);
			const cfg = useSyncExternalStore(prefsSubscribe, prefsGet);
			const layout = cfg.layout, side = cfg.side;
			const showing = turns.length >= MIN_TURNS;
			const columnNarrow = geo !== null && geo.colW <= NARROW_MAX;
			/* show is the default: a narrow column still paints the rail. hide
			   stands it down and leaves the edge switch. Official hides only
			   while our rail is actually painted. */
			const railUp = showing && geo !== null && !(columnNarrow && cfg.narrow === "hide");

			const track = useCallback(() => {
				const parts = partsRef.current;
				if (parts === null || parts.users.length === 0) return;
				const scRect = parts.scrollEl.getBoundingClientRect();
				const probe = parts.scrollEl.scrollTop
					+ Math.min(scRect.height, window.innerHeight) * 0.35;
				const tops = topsRef.current;
				if (tops.length !== parts.users.length) return;
				let lo = 0, hi = tops.length - 1, idx = 0;
				while (lo <= hi) {
					const mid = (lo + hi) >> 1;
					if (tops[mid] <= probe) { idx = mid; lo = mid + 1; } else hi = mid - 1;
				}
				setActive(idx);
			}, []);


			useEffect(() => {
				const st = document.createElement("style");
				st.textContent = CSS;
				document.head.appendChild(st);

				let refreshTimer = null;
				const remeasure = () => {
					/* Measure outside the updater: updaters must stay pure —
					   StrictMode re-invokes them, which would double the DOM reads. */
					const next = measure();
					if (next === null) return;
					setGeo((cur) => (cur !== null && next.rect.width === cur.rect.width
						&& next.rect.height === cur.rect.height
						&& next.rect.x === cur.rect.x && next.rect.y === cur.rect.y
						&& next.composerH === cur.composerH && next.band === cur.band
						? cur : next));
				};
				/* Content offsets (user-turn tops in scroll coordinates) are the
				   binary-search index for scroll tracking; recomputed on content
				   mutation and on resize. */
				const remeasureTops = () => {
					const parts = partsRef.current;
					if (parts === null) { topsRef.current = []; return; }
					const sc = parts.scrollEl;
					const scTop = sc.getBoundingClientRect().top;
					const x0 = sc.scrollTop;
					topsRef.current = parts.users.map((el) => el.getBoundingClientRect().top - scTop + x0);
				};
				/* One rAF-gated scroll callback: coalesces bursts into a single
				   track() per frame. */
				const onScroll = () => {
					if (rafPending.current !== 0) return;
					rafPending.current = requestAnimationFrame(() => { rafPending.current = 0; track(); });
				};
				/* The scroll listener rides the live scroller; swap it when the
				   conversation remounts under a different host. */
				const attachScroll = () => {
					const el = partsRef.current?.scrollEl;
					if (el === undefined || el === scrollElRef.current) return;
					if (scrollElRef.current !== null) {
						scrollElRef.current.removeEventListener("scroll", onScroll);
					}
					el.addEventListener("scroll", onScroll, { passive: true });
					scrollElRef.current = el;
				};
				const refresh = () => {
					const parts = findParts();
					partsRef.current = parts;
					observeHost(parts === null ? null : parts.host);
					if (parts === null) {
						setTurns((cur) => cur.length === 0 ? cur : []);
						navBridge.turns = [];
						navBridge.host = null;
						navBridge.version += 1;
						return;
					}
					remeasure();
					const prev = new Map(rowsRef.current.map((r) => [r.key, r]));
					const next = parts.turns.map((t) => {
						const old = prev.get(t.key);
						return old !== undefined && old.el === t.el
							&& old.text === t.text && old.response === t.response
							? old
							: t;
					});
					const same = next.length === rowsRef.current.length
						&& next.every((r, i) => rowsRef.current[i] === r);
					if (!same) {
						rowsRef.current = next;
						setTurns(next);
					}
					navBridge.turns = next;
					navBridge.host = parts.host;
					navBridge.version += 1;
					remeasureTops();
					track();
					attachScroll();
				};
				const schedule = () => {
					if (refreshTimer !== null) return;
					refreshTimer = setTimeout(() => { refreshTimer = null; refresh(); }, 300);
				};

				const onResize = () => {
					remeasureTops();
					remeasure();
					if (rafPending.current !== 0) return;
					rafPending.current = requestAnimationFrame(() => { rafPending.current = 0; track(); });
				};

				// Column-rect follower: sidebar drag, details-panel toggle and
				// window resize all animate the conversation column — a
				// ResizeObserver on the scroll host keeps the rail glued to
				// the edge through the whole animation (rAF-gated setState). It
				// is re-observed by observeHost, so a remounted host keeps its
				// glue instead of stranding this observer on a detached node.
				let geoRaf = 0;
				const ro = new ResizeObserver(() => {
					if (geoRaf !== 0) return;
					geoRaf = requestAnimationFrame(() => { geoRaf = 0; remeasure(); });
				});
				/* Conversation-scoped observation: the content observer rides the
				   live conversation host's subtree (turn discovery), while a
				   body-level guard observer wakes us only when that host is gone
				   (first mount, session-switch remount) — unrelated app DOM churn
				   (tooltips, other plugins) no longer schedules a full refresh.
				   The content wrapper also validates the turn-text cache: streaming
				   writes land after the last user element, so any mutation outside
				   that tail region (an edited prompt, a re-rendered block) bumps
				   the cache generation. */
				let observedHost = null;
				const onContentMutate = (records) => {
					const users = partsRef.current === null ? undefined : partsRef.current.users;
					const lastUser = users === undefined || users.length === 0 ? null : users[users.length - 1];
					if (lastUser === null) {
						textGen += 1;
					} else {
						const follows = (n) => !!(lastUser.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING);
						for (const r of records) {
							const moved = r.addedNodes.length + r.removedNodes.length > 0
								? [...r.addedNodes, ...r.removedNodes]
								: [r.target];
							if (!moved.every(follows)) { textGen += 1; break; }
						}
					}
					schedule();
				};
				const mo = new MutationObserver(onContentMutate);
				const guard = new MutationObserver(() => {
					if (observedHost === null || !observedHost.isConnected) schedule();
				});
				guard.observe(document.body, { childList: true, subtree: true });
				const observeHost = (host) => {
					if (host === observedHost) return;
					mo.disconnect();
					ro.disconnect();
					observedHost = host;
					if (host === null) return;
					mo.observe(host, { childList: true, subtree: true });
					ro.observe(host);
				};
				const interval = setInterval(() => {
					const parts = partsRef.current;
					if (parts === null || !document.contains(parts.scrollEl)) refresh();
					attachScroll();
				}, 2000);
				window.addEventListener("resize", onResize);
				refresh();

				return () => {
					mo.disconnect();
					guard.disconnect();
					clearInterval(interval);
					if (refreshTimer !== null) clearTimeout(refreshTimer);
					if (rafPending.current !== 0) cancelAnimationFrame(rafPending.current);
					if (geoRaf !== 0) cancelAnimationFrame(geoRaf);
					ro.disconnect();
					window.removeEventListener("resize", onResize);
					if (scrollElRef.current !== null) {
						scrollElRef.current.removeEventListener("scroll", onScroll);
					}
					st.remove();
				};
			}, [track]);

			/* While our rail is painted, the official one hides; when ours
			   stands down (off-chat / too few turns / narrow hidden), it returns. */
			useEffect(() => {
				if (railUp) document.body.setAttribute("data-ol-active", "");
				else document.body.removeAttribute("data-ol-active");
				return () => { document.body.removeAttribute("data-ol-active"); };
			}, [railUp]);

			/* Cancel a queued coalesced move or preview placement on unmount. */
			useEffect(() => () => {
				if (moveRafRef.current !== 0) cancelAnimationFrame(moveRafRef.current);
				if (scrollRafRef.current !== 0) cancelAnimationFrame(scrollRafRef.current);
			}, []);


			/* The hovered mark drives the preview: this effect measures the
			   mark's live (visual) position — so a scrolled loose rail follows
			   too — centers the card on it and holds it inside the rail box:
			   the official clamp, in numeric form. Sits above the render's
			   early return: hooks must run unconditionally. */
			useLayoutEffect(() => {
				const root = rootRef.current;
				const marks = marksRef.current;
				const clear = () => { setPreviewTop((cur) => cur === null ? cur : null); };
				if (root === null || marks === null || near < 0) { clear(); return; }
				const btn = marks.children[near];
				if (btn === undefined) { clear(); return; }
				setPreviewTop(previewTopFor(root, btn));
			}, [near, layout, turns, geo]);

			const hovered = near >= 0 && near < turns.length ? turns[near] : undefined;

			const jump = useCallback((i, behavior) => {
				const parts = partsRef.current;
				if (parts === null) return;
				const el = parts.users[i];
				if (el === undefined) return;
				if (behavior === "instant" && topsRef.current[i] !== undefined) {
					parts.scrollEl.scrollTop = Math.max(0, topsRef.current[i] - 24);
				} else {
					el.scrollIntoView({ behavior: behavior ?? "smooth", block: "start" });
				}
				/* A quiet landing flash confirms a click/keyboard jump in both
				   densities. Scrubbing skips it so a fast drag never leaves a trail
				   of long-lived animations on every crossed turn. WAAPI is not
				   covered by the CSS reduced-motion block — gate it here too. */
				if (behavior !== "instant" && el.animate !== undefined
					&& !REDUCED_MOTION.matches) {
					el.animate(
						[
							{ backgroundColor: "color-mix(in srgb, currentColor 14%, transparent)" },
							{ backgroundColor: "color-mix(in srgb, currentColor 14%, transparent)", offset: .35 },
							{ backgroundColor: "color-mix(in srgb, currentColor 5%, transparent)" },
						],
						{ duration: 1400, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
					);
				}
			}, []);

			/* Pointer input belongs to the whole 44px hit strip in both modes.
			   Instead of turning its Y coordinate into a percentage, snap to the
			   closest *rendered* mark center. That remains correct when compact
			   compresses or loose internally scrolls, and gives a near miss a
			   predictable home. A drag begins only after five pixels, so natural
			   hand jitter still behaves as a normal click. */
			const rowAt = (rail, clientY) => {
				if (rail === null) return -1;
				const railR = rail.getBoundingClientRect();
				if (railR.height <= 0) return -1;
				const n = rail.children.length; // the marks column renders rows only
				if (n === 0) return -1;
				/* Marks are the strip's only children at a fixed pitch under a
				   6px padding cap (no border, border-box, padding scrolls away
				   with the content): one rect read plus arithmetic replaces the
				   per-button rect scan, so a scrub across a thousand-turn rail
				   costs one layout read per frame, not one per turn.
				   Nearest-center with the loop's tie-to-lower-index semantics,
				   clamped to the visible window (the loop skipped rows outside
				   the viewport, and a captured pointer above/below must hold the
				   nearest visible row, not freeze the scrub). */
				const pitch = layout === "loose" ? LOOSE_PITCH : COMPACT_PITCH;
				const st = rail.scrollTop;
				const iMin = Math.max(0, Math.ceil((st - RAIL_INSET - pitch) / pitch));
				const iMax = Math.min(n - 1, Math.floor((railR.height - RAIL_INSET + st) / pitch));
				if (iMin > iMax) return -1;
				const y = clientY - railR.top + st - RAIL_INSET; // 0 at content origin
				let idx = Math.round((y - pitch / 2) / pitch);
				if (idx > 0 && y === idx * pitch) idx -= 1; // exact tie → lower index
				return idx < iMin ? iMin : idx > iMax ? iMax : idx;
			};
			const finishScrub = (rail, pointerId) => {
				scrubbingRef.current = false;
				rootRef.current?.removeAttribute("data-scrubbing");
				rail?.releasePointerCapture?.(pointerId);
				dragStartRef.current = null;
			};
			const onMarksPointerDown = (e) => {
				if (e.button !== 0 || turns.length === 0) return;
				const rail = marksRef.current;
				const idx = rowAt(rail, e.clientY);
				if (idx < 0) return;
				draggedRef.current = false;
				dragStartRef.current = { x: e.clientX, y: e.clientY };
				scrubIndexRef.current = idx;
				setNear(idx);
				scrubbingRef.current = true;
				rail?.setPointerCapture?.(e.pointerId);
				rootRef.current?.setAttribute("data-scrubbing", "");
			};
			/* Pointer moves are coalesced to one job per animation frame.
			   Reading mark rects per pointer EVENT would force a synchronous
			   layout after every scrub jump (which writes scrollTop); reading
			   once per frame, right before that frame's write, keeps scrub
			   O(1 layout) regardless of pointing-device frequency. */
			const applyPointerMove = () => {
				moveRafRef.current = 0;
				const pt = movePtRef.current;
				if (pt === null) return;
				movePtRef.current = null;
				const rail = marksRef.current;
				if (rail === null || turns.length === 0) return;
				const idx = rowAt(rail, pt.y);
				if (idx >= 0 && idx !== near) setNear(idx);
				if (!scrubbingRef.current || idx < 0) return;
				const start = dragStartRef.current;
				if (start === null) return;
				if (!draggedRef.current) {
					if (Math.hypot(pt.x - start.x, pt.y - start.y) < DRAG_START_DISTANCE) return;
					draggedRef.current = true;
					scrubIndexRef.current = idx;
					jump(idx, "instant");
					return;
				}
				if (idx !== scrubIndexRef.current) {
					scrubIndexRef.current = idx;
					jump(idx, "instant");
				}
			};
			const onMarksPointerMove = (e) => {
				movePtRef.current = { x: e.clientX, y: e.clientY };
				if (moveRafRef.current === 0) {
					moveRafRef.current = requestAnimationFrame(applyPointerMove);
				}
			};
			const onMarksPointerUp = (e) => {
				const rail = marksRef.current;
				if (!scrubbingRef.current) return;
				const idx = rowAt(rail, e.clientY);
				const dragged = draggedRef.current;
				const lastScrub = scrubIndexRef.current;
				finishScrub(rail, e.pointerId);
				if (idx < 0) return;
				if (dragged) {
					if (idx !== lastScrub) jump(idx, "instant");
					return;
				}
				jump(idx);
			};
			const onMarksPointerCancel = (e) => {
				if (!scrubbingRef.current) return;
				finishScrub(marksRef.current, e.pointerId);
				draggedRef.current = false;
				scrubIndexRef.current = -1;
			};

			if (!showing || geo === null) return null;
			if (columnNarrow && cfg.narrow === "hide") {
				return h("button", {
					type: "button",
					className: "ol-narrowSwitch",
					"aria-label": railLabel("show"),
					title: railLabel("show"),
					style: edgeBox(side, geo.rect, geo.rect.top - 14, 16),
					onClick: () => writeNarrow("show"),
				}, h(MarksGlyph));
			}

			/* Rail geometry: hug the conversation column (so the desktop titlebar
			   and side panels do not shift it) and center on the reading band.
			   Both densities use a fixed pitch and scroll inside the frame — the
			   official rail never compresses marks to fit. */
			const pitch = layout === "loose" ? LOOSE_PITCH : COMPACT_PITCH;
			const natural = turns.length * pitch + 2 * RAIL_INSET;
			const readingCap = Math.max(0, geo.band - RAIL_SAFE_MARGIN);
			const railH = layout === "loose"
				? Math.min(natural, readingCap, window.innerHeight * 0.7, LOOSE_RAIL_MAX)
				: Math.min(natural, readingCap, COMPACT_RAIL_MAX);
			const clipped = natural > railH + 0.5 && railH >= FADE_PX * 2;
			const { rect } = geo;
			const pos = side === "right"
				? { right: `${snapPx(Math.max(0, window.innerWidth - rect.right) + EDGE_GAP)}px` }
				: { left: `${snapPx(rect.left + EDGE_GAP)}px` };
			const railTop = snapPx(rect.top + geo.band / 2 - railH / 2);

			const rail = h("div", {
				id: NAV_ID,
				ref: rootRef,
				"data-side": side,
				"data-layout": layout,
				"data-material": cfg.material,
				"data-clipped": clipped || undefined,
				"data-narrow": columnNarrow ? "" : undefined,
				style: {
					...pos,
					top: `${railTop}px`,
					width: `${RAIL_HIT_W}px`,
					"--ol-rail-h": `${Math.round(railH)}px`,
				/* Glass veil for the ACTIVE material only; the CSS consumes these
				   under the matching [data-material] rules. */
				...(cfg.material === "none" ? {} : {
					"--ol-veil": `${100 - (cfg.material === "liquid" ? cfg.liquidTransparency : cfg.frostTransparency)}%`,
					"--ol-blur": `${cfg.material === "liquid" ? cfg.liquidBlur : cfg.frostBlur}px`,
				}),
				},
			},
				h("div", {
					className: "ol-marks",
					ref: marksRef,
					role: "navigation",
					"aria-label": "Turn outline",
					onPointerDown: onMarksPointerDown,
					onPointerMove: onMarksPointerMove,
					onPointerUp: onMarksPointerUp,
					onPointerCancel: onMarksPointerCancel,
					onPointerLeave: () => {
						movePtRef.current = null; // a queued move must not resurrect hover
						if (!scrubbingRef.current) setNear(-1);
					},
					onBlur: (e) => {
						if (!e.currentTarget.contains(e.relatedTarget)) setNear(-1);
					},
					onScroll: () => {
						// An internally scrolled loose rail moves the hovered mark,
						// so re-run the preview placement read — coalesced to one
						// job per frame like the pointer path.
						if (near < 0 || scrollRafRef.current !== 0) return;
						scrollRafRef.current = requestAnimationFrame(() => {
							scrollRafRef.current = 0;
							const root = rootRef.current;
							const marks = marksRef.current;
							if (root === null || marks === null || near < 0) return;
							const btn = marks.children[near];
							if (btn === undefined) return;
							setPreviewTop(previewTopFor(root, btn));
						});
					},
				},
					turns.map((t, i) => h(Row, {
						key: t.key,
						i,
						on: i === active,
						hot: i === near,
						near: setNear,
						text: t.text,
						onJump: jump,
						grow: markGrowth(i, near),
					})),
				),
				hovered !== undefined && previewTop !== null
					? h("div", {
						className: "ol-previewWrap",
						style: { "--ol-preview-top": `${Math.round(previewTop)}px` },
					},
						h("div", { className: "ol-preview", role: "tooltip" },
							h("div", { className: "ol-prompt" },
								hovered.text !== "" ? hovered.text : "\u2026"),
							hovered.response !== ""
								? h("div", { className: "ol-response" }, hovered.response)
								: null,
						),
					)
					: null,
			);
			if (!columnNarrow) return rail;
			/* Collapse control sits in the column header, not under the rail,
			   so it does not cover the first line of a narrow transcript. */
			return [
				rail,
				h("button", {
					type: "button",
					className: "ol-narrowSwitch",
					"aria-label": railLabel("hide"),
					title: railLabel("hide"),
					style: edgeBox(side, rect, rect.top - 14, 16),
					onClick: () => writeNarrow("hide"),
				}, h(ChevronGlyph, { side })),
			];
		}


		/* =====================================================================
		 * Search panel body. Remounts per open session (key from OutlineSearch)
		 * so its useState can seed the input from the engine's remembered query
		 * — no render-phase setState, and select() on the mount commit always
		 * sees the restored text (no effect-ordering hazard).
		 * ===================================================================== */

		/* The field-row magnifier (mac Spotlight carries exactly one decorative
		   glyph): 1.5px outline circle + handle, tertiary color, 16px. */
		function SearchGlyph() {
			return h("svg", {
				className: "ol-searchIcon",
				width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": "true",
			},
				h("circle", {
					cx: 6.75, cy: 6.75, r: 4.75,
					fill: "none", stroke: "currentColor", "stroke-width": 1.5,
				}),
				h("path", {
					d: "M10.4 10.4L14 14",
					fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round",
				}),
			);
		}

		/* Context segments -> children with explicit head/tail ellipses. The CSS
		   ellipsis stays as the pure-overflow guard; the explicit markers carry
		   the engine's truncation semantics even on a short, non-overflowing
		   window. Spread as separate children (never an array child), so the
		   mark elements need no keys. */
		function snippetChildren(ctx) {
			const kids = [];
			if (ctx.head) kids.push("\u2026");
			for (const seg of ctx.segments) {
				kids.push(seg.hit ? h("mark", null, seg.t) : seg.t);
			}
			if (ctx.tail) kids.push("\u2026");
			return kids;
		}

		/* One result row. Not focusable by design: the keyboard model is the
		   combobox pattern — input owns focus, options speak through
		   aria-activedescendant. */
		function ResultRow({ r, i, selected, selRowRef, onHover, onJump }) {
			return h("div", {
				className: "ol-resultItem",
				role: "option",
				id: "ol-search-opt-" + i,
				"aria-selected": selected ? "true" : "false",
				"data-selected": selected || undefined,
				ref: selected ? selRowRef : undefined,
				onPointerEnter: () => onHover(i),
				onClick: () => onJump(r.key),
			},
				h("span", { className: "ol-resultBadge" }, "#" + r.n),
				h("div", { className: "ol-resultTexts" },
					r.prompt !== null
						? h("div", { className: "ol-resultLine ol-resultPrompt" }, ...snippetChildren(r.prompt))
						: null,
					r.response !== null
						? h("div", { className: "ol-resultLine ol-resultResponse" }, ...snippetChildren(r.response))
						: null,
				),
			);
		}

		function SearchPanel({ view, copy }) {
			const [query, setQuery] = useState(() => searchLastQuery());
			const [sel, setSel] = useState(0);
			const composingRef = useRef(false);
			const inputRef = useRef(null);
			const selRowRef = useRef(null);
			const results = view.results;
			/* Clamp in render: the reset-to-0 effect below lands after this
			   commit, and a shrunken list must not address a stale index. */
			const selIdx = results.length === 0 ? -1 : Math.min(sel, results.length - 1);

			/* Open mount and every repeat invocation (pulse bump): focus +
			   select-all, so typing over a repeated Cmd+F replaces the previous
			   query instead of appending to it. */
			useEffect(() => {
				const el = inputRef.current;
				if (el === null) return;
				el.focus();
				el.select();
			}, [view.pulse]);

			/* Fresh result set -> selection restarts at the top (newest turn).
			   The engine keeps array identity stable across unrelated patches,
			   so this only fires on real result changes. */
			useEffect(() => { setSel(0); }, [results]);

			/* Keyboard selection stays visible without scrolling the page under
			   the fixed overlay: block:"nearest" is a no-op while the row is
			   already inside the list's scrollport. */
			useLayoutEffect(() => {
				if (selRowRef.current !== null) selRowRef.current.scrollIntoView({ block: "nearest" });
			}, [selIdx, results]);

			/* Close first, then jump: the overlay fades out while the turn
			   scrolls into view under it, and the catcher is already gone by
			   then, so it cannot eat the landing. */
			const jump = (key) => {
				searchCloseRequested();
				jumpToKey(key);
			};

			const onInputKey = (e) => {
				/* IME first: during composition every key belongs to the IME —
				   arrows walk its candidate list and Enter commits the string,
				   so none of them may navigate, jump, or close here. */
				if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
				const n = results.length;
				if (e.key === "ArrowDown" && n > 0) {
					e.preventDefault();
					setSel((selIdx + 1) % n);
				} else if (e.key === "ArrowUp" && n > 0) {
					e.preventDefault();
					setSel((selIdx - 1 + n) % n);
				} else if (e.key === "Enter") {
					if (selIdx >= 0) jump(results[selIdx].key);
				} else if (e.key === "Escape") {
					searchCloseRequested();
				}
			};

			const list = results.length > 0
				? h("div", { className: "ol-searchScroll" },
					h("div", {
						role: "listbox",
						id: "ol-search-list",
						className: "ol-resultList",
						"aria-label": copy.searchLabel,
					},
						results.map((r, i) => h(ResultRow, {
							key: r.key,
							r,
							i,
							selected: i === selIdx,
							selRowRef,
							onHover: setSel,
							onJump: jump,
						})),
					),
					view.capped
						? h("div", { className: "ol-searchCapped" }, copy.searchCapped)
						: null,
				)
				: h("div", { className: "ol-searchEmpty" }, copy.searchNoResults);

			/* Thin-bar morph: an empty query keeps the panel a 52px capsule (the
			   reveal sits at 0fr; the 26px radius is shared by both states, so
			   growth never touches the corners); the first keystroke grows it
			   into the card — mac expands on input, not on
			   first result. A reopen with a remembered query mounts expanded
			   straight away: the attribute is present at first render, so the
			   transition never fires (CSS transitions skip initial resolution). */
			const expanded = query.trim() !== "";
			return h(React.Fragment, null,
				h("div", { key: "fieldRow", className: "ol-searchFieldRow" },
					h(SearchGlyph),
					h("input", {
						ref: inputRef,
						className: "ol-searchInput",
						type: "text",
						value: query,
						placeholder: copy.searchPlaceholder,
						/* Combobox wiring completes the listbox contract: options live
						   below this field and are not focusable themselves. */
						role: "combobox",
						"aria-expanded": results.length > 0 ? "true" : "false",
						"aria-controls": results.length > 0 ? "ol-search-list" : undefined,
						"aria-autocomplete": "list",
						"aria-activedescendant": selIdx >= 0 ? "ol-search-opt-" + selIdx : undefined,
						"aria-label": copy.searchLabel,
						spellCheck: false,
						autoComplete: "off",
						onChange: (e) => {
							const v = e.currentTarget.value;
							setQuery(v);
							/* IME guard: mid-composition keystrokes must update the
							   field but never search; compositionend flushes the
							   committed string immediately. */
							if (!composingRef.current) searchSubmit(v);
						},
						onCompositionStart: () => { composingRef.current = true; },
						onCompositionEnd: (e) => {
							composingRef.current = false;
							searchSubmit(e.currentTarget.value);
						},
						onKeyDown: onInputKey,
						}),
				),
				h("div", {
					key: "reveal",
					className: "ol-searchReveal",
					"data-expanded": expanded || undefined,
				},
					h("div", { className: "ol-searchDrop" },
						h("div", { className: "ol-searchBody" }, list),
						/* Indexing status rides as a footer prefix instead of a row under
						   the field: a dedicated row would unmount on completion and jump
						   the whole panel mid-typing, while the footer's geometry is
						   constant. tabular-nums keeps the counter from wiggling. */
						h("div", { className: "ol-searchFooter" },
							view.total > view.indexed
								? [copy.searchIndexing[0], view.indexed, "/", view.total, copy.searchIndexing[1], " · ", copy.searchFooter]
								: copy.searchFooter,
							),
					),
				),
			);
		}

		/* =====================================================================
		 * The overlay entry: store consumption, exit animation, document-level
		 * listeners. The panel subtree is keyed per open session (see
		 * SearchPanel) and receives a frozen snapshot during the exit fade.
		 * ===================================================================== */
		function OutlineSearch() {
			const s = useSyncExternalStore(searchSubscribe, searchGet);
			const cfg = useSyncExternalStore(prefsSubscribe, prefsGet);
			const [exiting, setExiting] = useState(false);
			const [session, setSession] = useState(0);
			const exitTimerRef = useRef(0); // pending 120ms exit-fade timeout, cancelable
			/* Last open-frame snapshot: the engine clears results the moment
			   close is requested, but the fade must paint the real content, not
			   a flash of the empty state. Written only while open, so the
			   closing commit (already cleared) cannot overwrite it. */
			const lastOpenRef = useRef(null);

			useEffect(() => { if (s.open) lastOpenRef.current = s; });

			/* Open/close transitions. Open: cancel any pending fade and remount
			   the panel (session key). Close: play the 120ms exit fade to match
			   the CSS exit animation — immediately skipped under reduced motion,
			   which the CSS media block already disarms. Layout effect on
			   purpose: the closing commit must not paint — exiting=true has to
			   land before the browser renders, or the panel unmounts for one
			   frame and remounts to fade (a visible flash). */
			useLayoutEffect(() => {
				if (s.open) {
					if (exitTimerRef.current !== 0) {
						clearTimeout(exitTimerRef.current);
						exitTimerRef.current = 0;
					}
					setExiting(false);
					setSession((n) => n + 1);
					return;
				}
				if (lastOpenRef.current === null) return; // never opened: nothing painted
				if (REDUCED_MOTION.matches) { lastOpenRef.current = null; return; }
				setExiting(true);
				exitTimerRef.current = setTimeout(() => {
					exitTimerRef.current = 0;
					setExiting(false);
					lastOpenRef.current = null;
				}, 120);
			}, [s.open]);

			/* Timer discipline: one cleanup point for the exit handle. */
			useEffect(() => () => {
				if (exitTimerRef.current !== 0) clearTimeout(exitTimerRef.current);
			}, []);

			/* Document-level Escape: covers focus lost into the page. Capture,
			   so a page widget that swallows keydown cannot trap the overlay;
			   the input's own handler closes too — the request is idempotent.
			   The composition guards match the input's own handler: an IME
			   Escape cancels the candidate string, never the overlay. */
			useEffect(() => {
				if (!s.open) return;
				const onKey = (e) => {
					if (e.key === "Escape" && !e.isComposing && e.keyCode !== 229) searchCloseRequested();
				};
				document.addEventListener("keydown", onKey, true);
				return () => document.removeEventListener("keydown", onKey, true);
			}, [s.open]);

			/* Background scroll lock while open (Spotlight behavior): wheel
			   events over anything but the results list are cancelled, so the
			   page behind cannot scroll away mid-search. The list itself keeps
			   native scrolling — its overscroll-behavior:contain stops the
			   chain at its own edge. Non-passive on purpose; React's synthetic
			   onWheel is passive at the root and cannot preventDefault. */
			useEffect(() => {
				if (!s.open) return;
				const inScroll = (n) => {
				for (; n !== null && n !== document.body; n = n.parentNode) {
					if (n.classList !== undefined && n.classList.contains("ol-searchScroll")) return true;
				}
					return false;
				};
				const onWheel = (e) => { if (!e.defaultPrevented && !inScroll(e.target)) e.preventDefault(); };
				document.addEventListener("wheel", onWheel, { passive: false, capture: true });
				return () => document.removeEventListener("wheel", onWheel, { capture: true });
			}, [s.open]);

			/* navBridge is a plain module object with no listener surface (the
			   integration keeps it dependency-free), so diff its version counter
			   on a slow tick while open — the 300ms cadence doubles as the
			   revalidate throttle. Host swaps dispose/rebuild inside the engine;
			   this side only revalidates. */
			useEffect(() => {
				if (!s.open) return;
				let seen = navBridge.version;
				const timer = setInterval(() => {
					if (navBridge.version === seen) return;
					seen = navBridge.version;
					searchRevalidate();
				}, 300);
				return () => clearInterval(timer);
			}, [s.open]);

			if (!s.open && !exiting) return null;
			const view = exiting && lastOpenRef.current !== null ? lastOpenRef.current : s;
			const copy = searchCopy();
			return [
				/* Click-catcher stands down during the fade so the page is
				   interactive for those 120ms. Closes on click, not pointerdown:
				   unmounting mid-gesture would let the release land on the page
				   under it — an accidental click-through. */
				!exiting && h("div", {
					key: "catcher",
					className: "ol-searchCatcher",
					onClick: () => searchCloseRequested(),
				}),
				h("div", {
					key: "panel",
					className: "ol-searchOverlay",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": copy.searchLabel,
					"data-material": cfg.material,
					"data-exiting": exiting || undefined,
					style: {
						/* Glass veil for the ACTIVE material only; the CSS consumes
						   these under the matching [data-material] rules — the same
						   recipe the rail root injects. */
						...(cfg.material === "none" ? {} : {
							"--ol-veil": `${100 - (cfg.material === "liquid" ? cfg.liquidTransparency : cfg.frostTransparency)}%`,
							"--ol-blur": `${cfg.material === "liquid" ? cfg.liquidBlur : cfg.frostBlur}px`,
						}),
					},
				},
					h(SearchPanel, { key: session, view, copy }),
				),
			];
		}

		/* Chevron replica (14px outline chevron, the shipped Icon idiom). */
		function Chevron({ open }) {
			return h("svg", {
				className: "ol-chev" + (open ? " ol-chevOpen" : ""),
				width: 14, height: 14, viewBox: "0 0 14 14", fill: "none",
				"aria-hidden": true,
			},
				h("path", {
					d: "M3.5 5.25L7 8.75L10.5 5.25",
					stroke: "currentColor", "stroke-width": 1.2,
					"stroke-linecap": "round", "stroke-linejoin": "round",
				}),
			);
		}

		/** A labeled range control. Local state keeps the thumb at pointer
		 * speed; the prefs snapshot re-syncs it only on external changes
		 * (preset clicks), where the synced value equals the last local one. */
		function Slider({ label, value, min, max, step, unit, disabled, onChange }) {
			const [local, setLocal] = useState(value);
			useEffect(() => { setLocal(value); }, [value]);
			return h("div", { className: "ol-sliderRow" },
				h("span", { className: "ol-sliderName" }, label),
				h("input", {
				type: "range", className: "ol-range",
				min: String(min), max: String(max), step: String(step),
				value: String(local), disabled,
				"aria-label": label,
				onInput: (e) => {
					const v = Number(e.target.value);
					setLocal(v);
					onChange(v);
				},
				}),
				h("span", { className: "ol-sliderValue" }, `${local}${unit}`),
			);
		}

		/** One glass material's parameter field: three named presets plus a
		 * fourth “custom” chip. A preset snaps BOTH values and keeps the row
		 * collapsed; “custom” expands the two sliders (the sliders also
		 * self-expand when the stored values match no preset, so a custom
		 * value is always visible/editable). Served only while its material
		 * is the active choice. */
		function GlassParams({ copy, labelKey, p, presets, keys, writable, setPair, setDebounced, tMin = T_MIN, tMax = T_MAX, tStep = 5 }) {
			const t = (k) => copy[k];
			const [tKey, bKey] = keys;
			const match = presets.find(([, tv, bv]) => p[tKey] === tv && p[bKey] === bv);
			/* intent holds the click until both fields land together. Without it
			   the first of two writes matches no preset and the custom row flashes. */
			const [intent, setIntent] = useState(null);
			useEffect(() => {
				if (intent !== null && intent !== "custom" && match !== undefined && match[0] === intent) setIntent(null);
			}, [intent, match]);
			const showSliders = intent === "custom" || (intent === null && match === undefined);
			const activeId = intent !== null && intent !== "custom" ? intent : (match === undefined ? null : match[0]);
			return h("div", { className: "ol-field" },
				h("span", { className: "ol-label" }, t(labelKey)),
				h("div", { className: "ol-scale", role: "group" },
					presets.map(([id, tv, bv]) =>
						h(Pill, {
							key: id,
							active: activeId === id,
							onClick: () => {
								setIntent(id);
								if (writable) setPair(tKey, tv, bKey, bv);
							},
							"aria-pressed": String(activeId === id),
						}, t("preset" + id[0].toUpperCase() + id.slice(1)))),
					h(Pill, {
					active: showSliders,
					onClick: () => { setIntent("custom"); },
					"aria-pressed": String(showSliders),
				}, t("presetCustom")),
				),
				showSliders ? h("div", { className: "ol-sliders" },
					h(Slider, {
						label: t("transparencyLabel"), value: p[tKey],
						min: tMin, max: tMax, step: tStep, unit: "%", disabled: !writable,
						onChange: (v) => setDebounced(tKey, v),
					}),
					h(Slider, {
						label: t("blurLabel"), value: p[bKey],
						min: B_MIN, max: B_MAX, step: 1, unit: "px", disabled: !writable,
						onChange: (v) => setDebounced(bKey, v),
					}),
				) : null,
			);
		}

		/** One segmented field: official Pill chips filling the row. */
		function Scale({ value, options, onChange }) {
			return h("div", { className: "ol-scale", role: "group" },
				options.map(([id, label]) =>
					h(Pill, {
						key: id, active: id === value,
						onClick: () => { onChange(id); },
						"aria-pressed": String(id === value),
					}, label)),
			);
		}

		/** The preferences card: fold-out chrome + three segmented fields.
		 * Preference state is the configForms snapshot; writes are
		 * revision-fenced scope.set calls (the deepdiving controller shape). */
		function OutlineCard({ copy, scope, defaultOpen = false }) {
			const t = (key) => copy[key];
			const [cardOpen, setCardOpen] = useState(defaultOpen);
			/* Stable store references: a fresh arrow per render would tear down
			   and resubscribe on every keystroke and fold toggle. */
			const subscribe = useCallback((listener) => scope.subscribe(listener), [scope]);
			const getSnapshot = useCallback(() => scope.getSnapshot(), [scope]);
			const snap = useSyncExternalStore(subscribe, getSnapshot);
			const writable = snap.status === "ready" && snap.writable !== false;
			const p = prefsFrom(snap);
			const set = (k) => (v) => { if (writable) void scope.set(k, v); };
			/* Slider drags fire per input tick; coalesce them into one trailing
			   settings write per pause so a scrub is one RPC, not forty. */
			const debTimers = useRef({}); // key -> { timer, v }
			const writableRef = useRef(writable);
			writableRef.current = writable;
			useEffect(() => () => {
				/* Navigating away mid-drag: flush the trailing value instead of
			   silently dropping the last ≤140ms of the scrub. */
				for (const k in debTimers.current) {
					const pending = debTimers.current[k];
					clearTimeout(pending.timer);
					if (writableRef.current) void scope.set(k, pending.v);
				}
			}, []);
			const setNow = (k, v) => { if (writable) void scope.set(k, v); };
			/* One revision for both knobs. Two scope.set calls leave a frame
			   that matches no preset. */
			const setPair = (a, av, b, bv) => {
				if (!writable) return;
				if (typeof scope.mutate === "function") {
					void scope.mutate([
						{ op: "set", path: [a], value: av },
						{ op: "set", path: [b], value: bv },
					]);
					return;
				}
				void scope.set(a, av);
				void scope.set(b, bv);
			};
			const setDebounced = (k, v) => {
				const cur = debTimers.current[k];
				if (cur !== undefined) clearTimeout(cur.timer);
				debTimers.current[k] = { timer: setTimeout(() => { delete debTimers.current[k]; setNow(k, v); }, 140), v };
			};
			return h("li", { className: "ol-card" + (cardOpen ? " ol-card-open" : "") },
				h("button", {
					type: "button", className: "ol-head", "aria-expanded": cardOpen,
					onClick: () => { setCardOpen(!cardOpen); },
				},
					h("span", { className: "ol-headText" },
						h("span", { className: "ol-name" }, t("title")),
						h("span", { className: "ol-desc" }, t("description")),
					),
					h(Chevron, { open: cardOpen }),
				),
				cardOpen ? h("div", { className: "ol-body" },
					h("div", { className: "ol-field" },
						h("span", { className: "ol-label" }, t("sideLabel")),
						h(Scale, {
							value: p.side,
							options: [["right", t("sideRight")], ["left", t("sideLeft")]],
							onChange: set("side"),
						}),
					),
					h("div", { className: "ol-field" },
						h("span", { className: "ol-label" }, t("materialLabel")),
						h(Scale, {
							value: p.material,
							options: [["none", t("matNone")], ["frost", t("matFrost")], ["liquid", t("matLiquid")]],
							onChange: set("material"),
						}),
					),
					/* Progressive disclosure: the parameter field exists per glass
					   material and is served only while that material is the active
					   choice — the card stays three fields tall for every material. */
					p.material === "frost" ? h(GlassParams, {
						copy, labelKey: "frostGlassLabel", p,
						presets: FROST_PRESETS, keys: ["frostTransparency", "frostBlur"],
						writable, setPair, setDebounced,
					}) : null,
					p.material === "liquid" ? h(GlassParams, {
						copy, labelKey: "liquidGlassLabel", p,
						presets: LIQUID_PRESETS, keys: ["liquidTransparency", "liquidBlur"],
						tMin: LIQUID_T_MIN, tMax: LIQUID_T_MAX, tStep: 1,
						writable, setPair, setDebounced,
					}) : null,
					h("div", { className: "ol-field" },
						h("span", { className: "ol-label" }, t("layoutLabel")),
						h(Scale, {
							value: p.layout,
							options: [["compact", t("layoutCompact")], ["loose", t("layoutLoose")]],
							onChange: set("layout"),
						}),
					),
					h("div", { className: "ol-field" },
						h("span", { className: "ol-label" }, t("narrowLabel")),
						h(Scale, {
							value: p.narrow,
							options: [["show", t("narrowShow")], ["hide", t("narrowHide")]],
							onChange: set("narrow"),
						}),
					),
					snap.status === "unavailable" ? h("p", { className: "ol-hint" }, t("unavailable")) : null,
				) : null,
			);
		}

		/** Services required: the slot registry, the locale service for
		 * bilingual card copy, and the settings domain's shared form transport
		 * (dsh 0.2.0: configForms replaces the 0.1.x settingsScope binder;
		 * same controller face and snapshot shape). */
		const inject = ["slots", "locale", "configForms"];

		function apply(ctx) {
			const scope = ctx.configForms.get("outline");
			/* (Re)activation may have missed conversation mutations while this
			   plugin was inactive (no observer ran to bump the generation), so
			   the turn-text cache starts invalid on every apply. */
			textGen += 1;

			/* Runtime projection: every scope change re-resolves the config
			 * into the prefs store the rail reads. Stable snapshot identity:
			 * a revision that resolves to the same values keeps the old
			 * object, so useSyncExternalStore subscribers skip a pointless
			 * re-render. */
			const samePrefs = (a, b) => {
				for (const k in DEFAULTS) { if (a[k] !== b[k]) return false; }
				return true;
			};
			const project = () => {
				const next = prefsFrom(scope.getSnapshot());
				if (samePrefs(prefs.value, next)) return;
				prefs.set(next);
			};
			ctx.effect(() => {
				const off = scope.subscribe(project);
				project();
				outlineScope = scope;
				return () => { off(); outlineScope = null; prefs.set({ ...DEFAULTS }); };
			}, "outline: settings projection");

			ctx.effect(() => ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register({ name: "shell.overlay", id: "outline", order: 20 }, OutlineNav)),
			"outline: rail registration");


			ctx.effect(() => ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register({ name: "shell.overlay", id: "outline-search", order: 21 }, OutlineSearch)),
			"outline: search overlay registration");

			/* Cmd/Ctrl+F interception: capture phase so the browser's native
			   find-in-page never opens over a conversation, gated on the
			   conversation host so non-chat pages keep the native behavior.
			   e.code (physical key) keeps the binding stable across layouts;
			   either modifier flavor opens it (mac ⌘F / win-linux Ctrl+F). */
			ctx.effect(() => {
				const onKey = (e) => {
					if (e.code !== "KeyF" || e.altKey || e.shiftKey
						|| !(e.metaKey || e.ctrlKey)) return;
					if (document.querySelector("[data-conversation-scroll]") === null) return;
					e.preventDefault();
					searchOpenRequested();
				};
				document.addEventListener("keydown", onKey, { capture: true });
				return () => {
					document.removeEventListener("keydown", onKey, { capture: true });
					searchDisposeHard();
				};
			}, "outline: search hotkey");

			/* The card, with a tiny external-store bridge so it re-renders on
			 * locale flips (same shape as deepdiving's). */
			ctx.effect(() => {
				const locale = ctx.get("locale");
				let copy = copyFor(locale === undefined ? "zh" : locale.getSnapshot().active);
				let disposer = null;
				if (locale !== undefined) {
					disposer = locale.subscribe(() => { copy = copyFor(locale.getSnapshot().active); notify(); });
				}
				const listeners = new Set();
				const subscribe = (l) => { listeners.add(l); return () => { listeners.delete(l); }; };
				const notify = () => { for (const l of listeners) l(); };
				const getCopy = () => copy;
				function LocaleBridge({ subscribe: sub, getCopy: gc, scope: sc, defaultOpen = false }) {
					const c = useSyncExternalStore(sub, gc);
					return h(OutlineCard, { copy: c, scope: sc, defaultOpen });
				}
				const renderConfig = (props, defaultOpen = false) => {
					if (props && props.view === "summary") {
						return copy.description;
					}
					return h(LocaleBridge, { subscribe, getCopy, scope, defaultOpen });
				};

				/* 1. Bundle-level configuration: rendered on the bundle's page in Plugins panel */
				const unregisterBundle = ctx.slots.inject("plugins.bundle.config", () =>
					ctx.slots.register({ name: "plugins.bundle.config", key: "dsh-ui-outline" }, (props) => renderConfig(props, true)));

				/* 2. Row-level configuration: row gains a Configure control */
				const unregisterRow = ctx.slots.inject("plugins.row.config", () =>
					ctx.slots.register({ name: "plugins.row.config", key: "dsh-ui-outline#outline" }, (props) => renderConfig(props, true)));

				return () => {
					if (disposer !== null) disposer();
					unregisterBundle();
					unregisterRow();
				};
			}, "outline: settings card");
		}

		return { inject, apply };
	},
});
