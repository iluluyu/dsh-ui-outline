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
 *     compact 20px lines at a 14px pitch — every mark rests aligned at a
 *             short ~6px line, the current turn is highlighted by color,
 *             and hover/focus sweeps the target to full length through a
 *             pronounced neighbor wave
 *     loose   the same lines at a 30px pitch — an intentionally airy reading
 *             index, with 44×30px targets, internal scroll + a 2.5rem edge
 *             fade when it reaches min(reading band−64px, 70vh, 640px)
 *
 * While this rail is showing, the official TurnNavigator is hidden (CSS by
 * its aria-label — "Turn navigation"/"轮次导航", the only two locales ui-chat
 * ships) so the two never stack into a double navbar; when this rail stands
 * down (off-chat, too few turns) the official one returns.
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
 * Preferences ride the official plugin-settings path since 0.0.2 (the
 * deepdiving pattern): the Host half registers the `outline` namespace, this
 * half binds a settingsScope and serves a card under the keyed
 * settings.plugin.item slot — bilingual copy through the locale service.
 */
window.__ModuleLoader__.load({
	id: "dsh-ui-outline",
	factory: (require) => {
		const React = require("react");
		const h = React.createElement;
		const { Pill } = require("@deepseek-ai/dsh-client-ui-primitives");
		const { useCallback, useEffect, useLayoutEffect, useRef, useState, memo, useSyncExternalStore } = React;

		const NAV_ID = "dsh-outline-root";
		/* The compact rail preserves the official visual rhythm, but its 14px
		   pitch and a 44px-wide transparent hit strip make individual turns
		   comfortably selectable. Loose keeps the same marks and ripple, then
		   gives each turn a deliberate 30px vertical slot. */
		const COMPACT_PITCH = 14;
		const RAIL_INSET = 6;
		const COMPACT_RAIL_MAX = 420;
		const LOOSE_PITCH = 30;
		const LOOSE_RAIL_MAX = 640;
		const RAIL_SAFE_MARGIN = 64;
		const EDGE_GAP = 12; // official gutter between rail and column edge
		const LOOSE_EDGE_FADE_MIN = 96;
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
		
		/** Namespace defaults — mirror of the Host-half schema (lib/index.js). */
		const DEFAULTS = { side: "right", material: "frost", layout: "compact" };
		const SIDES = ["right", "left"];
		const MATERIALS = ["none", "frost", "liquid"];
		const LAYOUTS = ["compact", "loose"];

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
				unavailable: "Settings service unavailable — read-only for now.",
			},
		};
		function copyFor(active) { return COPY[active === "en" ? "en" : "zh"]; }

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
		/* Column narrower than the official 900px container query → stand down
		   (the official rail hides itself there too, so behavior matches). */
		#${NAV_ID}[data-hidden] { display: none; }

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
			cursor: pointer;
			pointer-events: auto;
			/* The strip owns its gestures: touch drags scrub instead of
			   scrolling the page (and pointercancel never preempts). */
			touch-action: none;
		}
		#${NAV_ID} .ol-markBtn {
			padding: 0;
			border: 0;
			background: transparent;
			cursor: pointer;
			outline: none;
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

		/* Compact: official-style dense distribution. The buttons remain
		   keyboard targets, while pointer input belongs to the full hit strip
		   so overlap between forgiving 24px hit boxes cannot choose a wrong
		   DOM button. */
		#${NAV_ID}[data-layout="compact"] .ol-markBtn {
			position: absolute;
			left: 0; right: 0;
			height: 24px;
			pointer-events: none;
			transform: translateY(-50%);
			transition: top 220ms cubic-bezier(.2, .8, .2, 1);
			animation: ol-enter .15s ease-out;
		}
		#${NAV_ID}[data-layout="compact"] .ol-line {
			position: absolute;
			top: 50%; right: 0;
			transform: translateY(-50%) scaleX(var(--ol-grow, ${REST_GROW}));
			transform-origin: right;
		}
		#${NAV_ID}[data-layout="compact"][data-side="left"] .ol-line {
			right: auto;
			left: 0;
			transform-origin: left;
		}

		/* Loose: the same mark language, but one comfortable 30px row per
		   turn. That makes the setting mean exactly what it says: more vertical
		   breathing room and larger per-turn targets, rather than another kind
		   of horizontal mark. */
		#${NAV_ID}[data-layout="loose"] .ol-marks {
			padding: ${RAIL_INSET}px 0;
			overflow-y: auto;
			scrollbar-width: none;
			overscroll-behavior: contain;
		}
		#${NAV_ID}[data-layout="loose"] .ol-markBtn {
			position: relative;
			display: flex;
			align-items: center;
			width: 100%;
			height: ${LOOSE_PITCH}px;
			flex: none;
			pointer-events: auto;
		}
		#${NAV_ID}[data-layout="loose"][data-side="right"] .ol-markBtn {
			justify-content: flex-end;
		}
		#${NAV_ID}[data-layout="loose"][data-side="right"] .ol-line {
			transform: scaleX(var(--ol-grow, ${REST_GROW}));
			transform-origin: right;
		}
		#${NAV_ID}[data-layout="loose"][data-side="left"] .ol-markBtn {
			justify-content: flex-start;
		}
		#${NAV_ID}[data-layout="loose"][data-side="left"] .ol-line {
			transform: scaleX(var(--ol-grow, ${REST_GROW}));
			transform-origin: left;
		}
		/* Edge fade only while loose rows really scroll; a short rail keeps
		   every mark fully readable. */
		#${NAV_ID}[data-layout="loose"][data-clipped] .ol-marks {
			mask-image: linear-gradient(transparent 0, #000 2.5rem, #000 calc(100% - 2.5rem), transparent 100%);
			-webkit-mask-image: linear-gradient(transparent 0, #000 2.5rem, #000 calc(100% - 2.5rem), transparent 100%);
		}
		#${NAV_ID}[data-layout="loose"] .ol-marks::-webkit-scrollbar { display: none; }

		/* A scrub is deliberately instantaneous: animation would make the
		   selected turn lag behind the pointer. */
		#${NAV_ID}[data-scrubbing] .ol-line,
		#${NAV_ID}[data-scrubbing] .ol-markBtn { transition: none; }
		@media (prefers-reduced-motion: reduce) {
			#${NAV_ID}, #${NAV_ID} .ol-markBtn, #${NAV_ID} .ol-line,
			#${NAV_ID} .ol-preview { transition: none; animation: none; }
		}


		/* ===== per-turn preview card =====================================
		   The official TurnNavigator preview, adapted: shown while a mark is
		   hovered / focused / scrubbed, anchored beside the rail (left of a
		   right rail, right of a left rail), vertically centered on that mark
		   and held clear of both rail ends. Prompt + response, two short
		   lines each. Material surface: 'none' is the official treatment
		   (bg-layer-1 + border-l2 + shadow-lv2); frost layers a translucent
		   token tint over a backdrop blur; liquid keeps frost's token base,
		   presses the backdrop slightly and lights from the conversation-side
		   corner with a soft radial sheen and a uniform inner rim — pure CSS,
		   same in every browser, no injected elements. The outline itself is a
		   0-blur ring shadow so its width stays even around G2 corners. The
		   rail itself stays bare marks in every mode. */
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
			/* The outline is a 0-blur 1px-spread ring, not a stroked border: on
		   G2 squircle corners a stroked 1px border rasterizes denser near the
		   diagonal apex (measured 3.6× straight-edge ink) while a ring shadow
		   dilates the shape uniformly. The transparent border keeps box
		   geometry identical to the official 1px-border layout. */
			border: 1px solid transparent;
			border-radius: 10px;
			/* G1 fallback is the official preview radius (10px, verbatim).
			   Where corner-shape exists, upgrade to a G2 squircle whose radius is
			   diagonal-matched to the G1 arc: a superellipse(4) crosses the 45°
			   diagonal at r·(1−2^−¼) vs a circle's r·(1−2^−½), so parity needs
			   ≈1.84× the radius (measured in-browser: circle@100→29.3px,
			   squircle@100→15.9px). Area-matching instead would shrink the
			   perceived roundness. */
			color: var(--dsw-alias-label-primary, #0f1115);
			background: var(--dsw-alias-bg-layer-1, #ffffff);
			box-shadow: 0 0 0 1px var(--dsw-alias-border-l2, rgba(0, 0, 0, .1)),
				var(--dsw-shadow-lv2, 0 0 1px rgba(0, 0, 0, .2), 0 8px 24px rgba(0, 0, 0, .08));
			pointer-events: none;
			box-sizing: border-box;
			animation: ol-preview-enter .12s ease-out;
		}
		/* The root is deliberately wider than the painted mark for hit slop;
		   anchor the card to the visual 20px line, not the invisible strip. */
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
		@supports (corner-shape: squircle) {
			#${NAV_ID} .ol-preview {
				corner-shape: squircle;
				border-radius: 18.4px;
			}
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
		/* frost: a lighter tint over a gentler blur — the page behind reads
		   through instead of being erased, while ~45% tint + blur keeps the
		   card's own text comfortably readable. */
		#${NAV_ID}[data-material="frost"] .ol-preview {
			background: color-mix(in srgb, var(--dsw-alias-bg-layer-1, #ffffff) 45%, transparent);
			-webkit-backdrop-filter: blur(6px) saturate(1.35);
			backdrop-filter: blur(6px) saturate(1.35);
		}
		body[data-ds-dark-theme] #${NAV_ID}[data-material="frost"] .ol-preview {
			background: color-mix(in srgb, var(--dsw-alias-bg-layer-1, #232324) 35%, transparent);
		}
		/* liquid: frost's base with a dimmed backdrop and a directional sheen.
		   The light enters from the corner facing the conversation text —
		   top-left beside a right rail, top-right beside a left rail (the
		   preview mirrors with the rail) — and stays soft. Pure CSS: no
		   SVG/filter host can affect page layout. */
		#${NAV_ID} { --ol-light-x: 26px; --ol-light-deg: 132deg; }
		#${NAV_ID}[data-side="left"] { --ol-light-x: calc(100% - 26px); --ol-light-deg: 228deg; }
		#${NAV_ID}[data-material="liquid"] .ol-preview {
			background:
				radial-gradient(140px 90px at var(--ol-light-x) 16px,
					rgba(255, 255, 255, .34) 0%,
					rgba(255, 255, 255, .12) 40%,
					transparent 72%),
				/* A neutral, background-aware plane — host brand tokens are often
				   black here, so tinting with them is what made liquid grey. */
				linear-gradient(var(--ol-light-deg),
					rgba(255, 255, 255, .13) 0%,
					transparent 56%),
				color-mix(in srgb, var(--dsw-alias-bg-layer-1, #ffffff) 42%, transparent);
			-webkit-backdrop-filter: blur(5px) saturate(1.3) brightness(.9) contrast(1.02);
			backdrop-filter: blur(5px) saturate(1.3) brightness(.9) contrast(1.02);
			/* Start from frost's ring treatment; the outline itself is the base
		   outer ring — only the uniform inner rim is added below, since hard
		   1px inset LINES clip unevenly at squircle corners. */
		}
		/* One uniform inner ring follows the corner continuously; the corner's
		   directional emphasis lives entirely in the background radial. */
		#${NAV_ID}[data-material="liquid"] .ol-preview {
			box-shadow: 0 0 0 1px var(--dsw-alias-border-l2, rgba(0, 0, 0, .1)),
				var(--dsw-shadow-lv2, 0 0 1px rgba(0, 0, 0, .2), 0 8px 24px rgba(0, 0, 0, .08)),
				inset 0 0 0 1px rgba(255, 255, 255, .22);
		}
		body[data-ds-dark-theme] #${NAV_ID}[data-material="liquid"] .ol-preview {
			background:
				radial-gradient(140px 90px at var(--ol-light-x) 16px,
					rgba(255, 255, 255, .13) 0%,
					rgba(255, 255, 255, .05) 40%,
					transparent 72%),
				linear-gradient(var(--ol-light-deg),
					color-mix(in srgb, var(--dsw-alias-label-primary, #f9fafb) 9%, transparent) 0%,
					transparent 56%),
				color-mix(in srgb, var(--dsw-alias-bg-layer-1, #232324) 32%, transparent);
			-webkit-backdrop-filter: blur(5px) saturate(1.28) brightness(.8) contrast(1.05);
			backdrop-filter: blur(5px) saturate(1.28) brightness(.8) contrast(1.05);
		}
		body[data-ds-dark-theme] #${NAV_ID}[data-material="liquid"] .ol-preview {
			box-shadow: 0 0 0 1px var(--dsw-alias-border-l2, rgba(255, 255, 255, .14)),
				0 0 1px rgba(0, 0, 0, .6), 0 8px 24px rgba(0, 0, 0, .32),
				inset 0 0 0 1px rgba(255, 255, 255, .13);
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
		 * uses for *_turnStatus). Falls back to the whole node. */
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
		function findParts() {
			const host = document.querySelector("[data-conversation-scroll]");
			if (host === null) return null;
			const scrollEl = findScrollEl(host);
			const turns = [];
			/* Steps are collected as elements and snippeted only from the tail:
			   during streaming this refreshes every ~300ms, and reading
			   textContent of every historical step would rebuild the whole
			   conversation's strings each time. Usually exactly one read. */
			const steps = [];
			const seal = () => {
				if (turns.length === 0) return;
				const turn = turns[turns.length - 1];
				for (let i = steps.length - 1; i >= 0 && turn.response === ""; i -= 1) {
					const text = snippet(steps[i]);
					if (text !== "") turn.response = text;
				}
				steps.length = 0;
			};
			for (const el of host.querySelectorAll("[data-chat-flow-kind]")) {
				const kind = el.dataset.chatFlowKind;
				if (kind === "user") {
					seal();
					const text = promptText(el);
					if (text === "") continue;
					turns.push({ key: el.dataset.chatFlowKey ?? String(turns.length), el, text, response: "" });
				} else if (kind === "assistant-step" && turns.length > 0) {
					steps.push(el);
				}
			}
			seal();
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
		 * Preferences external store: apply() owns the settingsScope; every
		 * scope change re-resolves the config into this store, which both the
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

		const Row = memo(function Row({ i, on, hot, near, text, onJump, grow, top }) {
			const style = {
				"--ol-grow": String(grow),
				...(top === undefined ? {} : { top }),
			};
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

		function OutlineNav() {
			const rootRef = useRef(null);
			const marksRef = useRef(null);
			const partsRef = useRef(null);
			const scrollElRef = useRef(null);
			const rafPending = useRef(false);
			const topsRef = useRef([]);
			const rowsRef = useRef([]);
			const scrubbingRef = useRef(false);
			const draggedRef = useRef(false);
			const dragStartRef = useRef(null);
			const scrubIndexRef = useRef(-1);
			const moveRafRef = useRef(0);
			const movePtRef = useRef(null);
			const [turns, setTurns] = useState([]); // [{ key, el, text, response }]
			const [active, setActive] = useState(0);
			const [near, setNear] = useState(-1); // hover/focus/scrub index
			const [previewTop, setPreviewTop] = useState(null); // px within the root
			const [geo, setGeo] = useState(null);
			const cfg = useSyncExternalStore(prefsSubscribe, prefsGet);
			const layout = cfg.layout, side = cfg.side;
			const showing = turns.length >= MIN_TURNS;

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
					setGeo((cur) => {
						const next = measure();
						if (next === null) return cur;
						if (cur !== null && next.rect.width === cur.rect.width
							&& next.rect.height === cur.rect.height
							&& next.rect.x === cur.rect.x && next.rect.y === cur.rect.y
							&& next.composerH === cur.composerH && next.band === cur.band) return cur;
						return next;
					});
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
					if (rafPending.current) return;
					rafPending.current = true;
					requestAnimationFrame(() => { rafPending.current = false; track(); });
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
					if (parts === null) {
						setTurns((cur) => cur.length === 0 ? cur : []);
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
					if (rafPending.current) return;
					rafPending.current = true;
					requestAnimationFrame(() => { rafPending.current = false; track(); });
				};

				const mo = new MutationObserver(schedule);
				mo.observe(document.body, { childList: true, subtree: true });
				const interval = setInterval(() => {
					const parts = partsRef.current;
					if (parts === null || !document.contains(parts.scrollEl)) refresh();
					attachScroll();
				}, 2000);
				// Column-rect follower: sidebar drag, details-panel toggle and
				// window resize all animate the conversation column — a
				// ResizeObserver on the scroll host keeps the rail glued to
				// the edge through the whole animation (rAF-gated setState).
				let geoRaf = 0;
				const ro = new ResizeObserver(() => {
					if (geoRaf !== 0) return;
					geoRaf = requestAnimationFrame(() => { geoRaf = 0; remeasure(); });
				});
				const host = document.querySelector("[data-conversation-scroll]");
				if (host !== null) ro.observe(host);
				window.addEventListener("resize", onResize);
				refresh();

				return () => {
					mo.disconnect();
					clearInterval(interval);
					if (refreshTimer !== null) clearTimeout(refreshTimer);
					if (geoRaf !== 0) cancelAnimationFrame(geoRaf);
					ro.disconnect();
					window.removeEventListener("resize", onResize);
					if (scrollElRef.current !== null) {
						scrollElRef.current.removeEventListener("scroll", onScroll);
					}
					st.remove();
				};
			}, [track]);

			/* While our rail stands up, the official one hides; when ours
			   stands down (off-chat / too few turns), the official returns. */
			useEffect(() => {
				if (showing) document.body.setAttribute("data-ol-active", "");
				else document.body.removeAttribute("data-ol-active");
				return () => { document.body.removeAttribute("data-ol-active"); };
			}, [showing]);

			/* Cancel a queued coalesced move on unmount. */
			useEffect(() => () => {
				if (moveRafRef.current !== 0) cancelAnimationFrame(moveRafRef.current);
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
				   of long-lived animations on every crossed turn. */
				if (behavior !== "instant" && el.animate !== undefined) {
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
				let best = -1, bestDistance = Infinity;
				const buttons = rail.children; // the marks column renders rows only
				for (let i = 0; i < buttons.length; i += 1) {
					const r = buttons[i].getBoundingClientRect();
					/* Exclude loose rows hidden above/below its scroll viewport. */
					if (r.bottom < railR.top || r.top > railR.bottom) continue;
					const distance = Math.abs(clientY - (r.top + r.height / 2));
					if (distance < bestDistance) { best = i; bestDistance = distance; }
				}
				return best;
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

			/* Rail geometry: hug the conversation column edge (12px inset) and
			   center on the reading band. Both densities stay *inside* that band:
			   otherwise a tall loose rail could extend behind the composer and make
			   edge turns unreachable. Compact keeps its proportional compression;
			   loose has one real 30px row per turn plus six-pixel end breathing. */
			const natural = layout === "loose"
				? turns.length * LOOSE_PITCH + 2 * RAIL_INSET
				: (turns.length - 1) * COMPACT_PITCH + 2 * RAIL_INSET;
			const readingCap = Math.max(0, geo.band - RAIL_SAFE_MARGIN);
			const railH = layout === "loose"
				? Math.min(natural, readingCap, window.innerHeight * 0.7, LOOSE_RAIL_MAX)
				: Math.min(natural, readingCap, COMPACT_RAIL_MAX);
			const clipped = layout === "loose" && natural > railH && railH >= LOOSE_EDGE_FADE_MIN;
			const { rect } = geo;
			const pos = side === "right"
				? { right: Math.max(0, window.innerWidth - rect.right) + EDGE_GAP }
				: { left: rect.left + EDGE_GAP };
			const railTop = rect.top + geo.band / 2;

			/* Compact positions use the official proportional-compression shape,
			   with a modestly roomier 14px natural pitch for pointer tolerance. */
			const compactPos = (i) => {
				const ratio = turns.length <= 1 ? 0 : i / (turns.length - 1);
				const usable = Math.max(0, railH - 2 * RAIL_INSET);
				return `${RAIL_INSET + Math.round(Math.min(i * COMPACT_PITCH, ratio * usable))}px`;
			};

			return h("div", {
				id: NAV_ID,
				ref: rootRef,
				"data-side": side,
				"data-layout": layout,
				"data-material": cfg.material,
				"data-clipped": clipped || undefined,
				"data-hidden": geo.colW < 900 ? "" : undefined,
				style: {
					...pos,
					top: `${Math.round(railTop)}px`,
					width: `${RAIL_HIT_W}px`,
					"--ol-rail-h": `${Math.round(railH)}px`,
					transform: "translateY(-50%)",
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
						// so re-run the preview placement read.
						const root = rootRef.current;
						const marks = marksRef.current;
						if (root === null || marks === null || near < 0) return;
						const btn = marks.children[near];
						if (btn === undefined) return;
						setPreviewTop(previewTopFor(root, btn));
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
						top: layout === "compact" ? compactPos(i) : undefined,
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
		 * Preference state is the settingsScope snapshot; writes are
		 * revision-fenced scope.set calls (the deepdiving controller shape). */
		function OutlineCard({ copy, scope }) {
			const t = (key) => copy[key];
			const [cardOpen, setCardOpen] = useState(false);
			const snap = useSyncExternalStore(
				(listener) => scope.subscribe(listener),
				() => scope.getSnapshot(),
			);
			const writable = snap.status === "ready" && snap.writable !== false;
			const p = prefsFrom(snap);
			const set = (k) => (v) => { if (writable) void scope.set(k, v); };
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
					h("div", { className: "ol-field" },
						h("span", { className: "ol-label" }, t("layoutLabel")),
						h(Scale, {
							value: p.layout,
							options: [["compact", t("layoutCompact")], ["loose", t("layoutLoose")]],
							onChange: set("layout"),
						}),
					),
					snap.status === "unavailable" ? h("p", { className: "ol-hint" }, t("unavailable")) : null,
				) : null,
			);
		}

		/** Services required: the slot registry, the locale service for
		 * bilingual card copy, and the settings transport trio. */
		const inject = ["slots", "locale", "connection", "remote", "settingsScope"];

		function apply(ctx) {
			const scope = ctx.settingsScope.bind({ namespace: "outline" });

			/* Runtime projection: every scope change re-resolves the config
			 * into the prefs store the rail reads. No legacy migration —
			 * 0.0.1 carried no configuration. */
			const project = () => { prefs.set(prefsFrom(scope.getSnapshot())); };
			ctx.effect(() => {
				const off = scope.subscribe(project);
				project();
				return () => { off(); prefs.set({ ...DEFAULTS }); };
			}, "outline: settings projection");

			ctx.effect(() => ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register({ name: "shell.overlay", id: "outline", order: 20 }, OutlineNav)),
			"outline: rail registration");

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
				const card = () => h(LocaleBridge, { subscribe, getCopy, scope });
				function LocaleBridge({ subscribe: sub, getCopy: gc, scope: sc }) {
					const c = useSyncExternalStore(sub, gc);
					return h(OutlineCard, { copy: c, scope: sc });
				}
				const unregister = ctx.slots.inject("settings.plugin.item", () =>
					ctx.slots.register({ name: "settings.plugin.item", key: "outline" }, card));
				return () => { if (disposer !== null) disposer(); unregister(); };
			}, "outline: settings card");
		}

		return { inject, apply };
	},
});
