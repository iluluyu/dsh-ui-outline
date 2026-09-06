# Theme Plan: Liquid Glass / Frosted Glass Variants

> **SHIPPED** (0.0.2, as the `material` setting; veil presets + dispersion pending
> release). This plan's localStorage / WEB_SETTINGS_NAMESPACES constraint is
> historical — rc.7+ opens settings namespaces to third-party plugins, so the
> variants ship as one of three segmented options (`none | frost | liquid`) on
> the settings card, applied to the per-turn preview card only (the resting
> rail stays bare marks, matching the official TurnNavigator). **The liquid
> finish is pure CSS**: frost's token base, a veil preset (see below),
> and a directional corner light whose chromaticism lives in the
> background layers — a warm-white lit corner and a faint cool far-corner
> wash. Rim experiments are recorded below: an inset rim read as a double
> border, a tight `0 0 1px` contact halo rasterized as a hidden dark line
> in dark theme, and sub-pixel offset color fringes rasterized as detached
> colored line segments with a hairline gap — all three are gone; the rim
> stays a single neutral ring. The first SVG feDisplacementMap experiment leaked a 300×150 default-sized
> host into the page, so it was removed rather than patched. `frost` is the
> default. The original research note follows.

## 1. Background

- dsh themes switch via the official signal `body[data-ds-dark-theme]`
  (ThemePresenter, `packages/client/ui-theme`). The plugin already follows it.
- The host page carries the full `--dsw-alias-*` token set; the plugin resolves
  tokens live with fallbacks, so glass tints must also derive from tokens, not
  hard-coded colors.
- Community themes often introduce background wallpapers/gradents; an opaque
  panel visually "floats dead" on them. `backdrop-filter` glass keeps content
  legible while letting the artwork show through.
- Constraint (historical, pre-rc.7): third-party plugins could not use the
  settings RPC (`WEB_SETTINGS_NAMESPACES` whitelist in `packages/host/apiproxy`),
  so activation was planned via `localStorage`.

## 2. Variants

| Variant | Card background | Backdrop | Border | Shadow / light | Feel |
|---|---|---|---|---|---|
| `none` | `var(--dsw-alias-bg-layer-1)` opaque | none | 1px border (`border-l2`) | `dsw-shadow-lv2` | official preview panel |
| `frost` (default) | `bg-layer-1` veil preset: 48/60/72% airy→dense (dark 44/60/68) | `blur(12–16px) saturate(1.5)` (dark `1.4`) | 1px border (`border-l2`) | `lv2` | transparent-to-milk glass per density |
| `liquid` | same veil system (52/65/74% light, 48/65/70% dark) plus a warm-white corner radial and a faint cool far-corner wash | Chromium: SDF displacement lens (§2c) after a light blur, `saturate(1.5)`; others: `blur(2–8px) saturate(1.5)` fallback | 1px border (`border-l2`) | `lv2` + corner radial light | directionally lit, edge-refracting liquid glass |

Corners are G2 where `corner-shape` exists — written as `superellipse(4)`,
NOT the `squircle` keyword: in Chrome 152 the keyword parses
(`CSS.supports` → true) but computes to `superellipse(2)`, a plain circular
corner — the G2 upgrade silently never rendered until this was caught by
corner-arc fitting in review. The 18.4px radius is measured to cross the
45° diagonal where a 10px circle does (superellipse(4): circle@100 →
29.3px vs squircle@100 → 15.9px, factor 1.84). Area-based matching
is deliberately avoided — it reads visually smaller. Unsupported engines keep
the official 10px G1 radius via `@supports` fallback.

The outline is a real `1px` border (`var(--dsw-alias-border-l2)`), not a
ring shadow. The original implementation used a 0-blur 1px-spread ring
shadow (`box-shadow: 0 0 0 1px`) and that was the root cause of the
recurring "gap between the border and the glass" (reported three times):
the ring paints OUTSIDE the border box while the glass clips INSIDE it, so
any anti-aliased half pixel becomes a constructive seam. A real border is
painted in the border box itself, adjacent to the clipped glass by
construction — pixel-verified: page 18 → border 54 → glass 30 with no seam
band between them.

**Rim experiments, all rejected** (kept here so they are not retried):
1. *Inset rim* — an outer ring plus `inset 0 0 0 1px` white rim reads as two
   concentric borders (the original "double border" complaint).
2. *Dark contact halo* — the lv2 token's `0 0 1px` shadow hugging a light ring
   in dark theme rasterizes as a parallel dark line, a hidden second outline
   (confirmed by pixel luminance profiling: page 18 → dip 14 → ring 54).
3. *Offset chromatic fringes* — two ring shadows in warm red / cool blue
   displaced ±0.6px render at 1× as detached colored line segments beside the
   ring with a semi-transparent hairline gap between them; integrated at 3×
   zoom, artifacted at native resolution. Dispersion therefore moved into the
   background stack, which follows the squircle exactly and can never read as
   a second outline: the lit-corner radial is warm-white
   (`rgba(255,245,240,…)`), and the directional linear gradient carries a
   faint cool stop (`rgba(120,170,255,.06)`) at the far corner.
4. *Per-channel CA inside the displacement filter* — running three
   `feDisplacementMap`s at ×0.94/×1/×1.06 scale and recomposing channels
   additively produces true chromatic aberration, but any hard content edge
   inside the rim renders it as saturated yellow/pink line pairs, and lone
   G-channel rows read green — physically impossible for glass and
   indistinguishable from colored outlines. The shipped lens uses a single
   neutral displacement; the fold itself sells the glass.
5. *Soft cool/warm chroma inset washes* (LiquidLens-style `inset 1px 1px 6px
   rgba(120,170,255,.12)` + warm opposite) — individually subtle, but
   stacked over the refracted backdrop they amplified 8-bit color banding
   into visible contour steps (the "色彩断层" report). Removed; the chromatic
   character stays in the background gradients, which dither through the
   veil instead of banding on top of the lens.

The light enters from the corner facing the conversation text — top-left beside a
right rail, top-right beside a left rail (the preview mirrors with the rail),
implemented with `--ol-light-x` / `--ol-light-deg` corner variables; light and dark
rules use their respective host tokens so a light host does not get a black
“brand” tint and a dark host still receives a soft highlight.

## 2b. Glass parameters (transparency + blur)

Calibration anchor: Apple's iOS 26 `regular` material reverse-engineers to a
**~72% veil over blur ≈5.4px, saturate ≈1.8** — readable, but on request the
ladder leans translucent: the shipped presets top out at 2/3 veil and airy
sits near a third. The card exposes, per glass material (served only while
that material is selected — progressive disclosure):

- a four-chip row: 清透/Airy, 标准/Standard, 浓郁/Dense (each snaps BOTH the
  transparency and the blur) plus 自定义/Custom, which expands two sliders;
- 透明度/transparency (20–95%, step 5; the veil is 100 − t) and
  虚化半径/blur radius (0–24px, step 1) sliders — the custom path; a stored
  value pair matching no preset keeps the sliders expanded on reopen.

Slider writes are debounced (140ms trailing) into one settings write per
drag pause; preset clicks write immediately. One transparency serves both
themes (the dark veil token is darker, so equal percentages dim more in
dark — natural and intended). Background dimming is deliberately NOT a
third knob: in light theme the white veil is the wash, in dark the dark
veil is the dim — a brightness control would duplicate the veil's job.

| Preset | frost t / blur | liquid t / blur |
|---|---|---|
| airy 清透 | 70% / 8px | 70% / 2px |
| standard 标准 | 50% / 12px | 50% / 5px |
| dense 浓郁 | 35% / 16px | 35% / 8px |

Airy is the readability floor for the secondary gray line (measured in
review); further transparency asks should move blur or text tone, not the
veil. Liquid's blur ladder sits far below frost's (2/5/8px): liquid is a
lens, not heavy frost — the refraction below needs comparatively sharp
backdrop to bend.

## 2c. Edge refraction (the liquid lens)

Liquid alone runs the backdrop through a real displacement lens — an
independent re-implementation of the LiquidLens technique, now aligned to
its measured parameters:

| Parameter | Value | Source |
|---|---|---|
| rim profile | Snell: squircle height `f(u)=(1-(1-u)⁴)^¼` → slope → θ₁ → Snell (n=1.5) → `tan(θ₁-θ₂)`, 128 samples, normalized (peaks AT the edge, tapers inward) | LiquidLens `buildProfile` |
| bezel width | 22px | LiquidLens default / Panel `depth` |
| map | 600×212 canvas (2× supersampled), rounded-rect SDF, forward-difference normals, R/G = 128 ± 127·n·mag | tomagranate `dpr: 2` |
| displacement | single `feDisplacementMap`, scale 18 | LiquidLens `refraction: 18` |
| pre-blur | `std = clamp(blur/2, 0.5, 3)` — blur above ~4 erases the lens, so the slider's upper half stops adding frost while refraction is on | LiquidLens "keep LOW (0-4)" |
| saturation | 1.8 (also in the CSS fallback) | LiquidLens `saturation: 1.8` |
| rim light | directional 1px gradient glint ON the border (`::before`, `inset: -1px`, `corner-shape: inherit`, mask xor ring), bright at the lit corner, gone by mid-edge | LiquidLens `::before` ring |
| a11y gate | `prefers-reduced-transparency: reduce` skips the lens | LiquidLens |

A plain smoothstep magnitude was the first attempt — its flat top read as
a smeared band, not a lens; the Snell profile's edge-hugging peak is what
makes the fold read as glass. The rim-light ring initially sat at `inset: 0`
(padding box) and traced a concentric arc 1px inside the border arc —
visible as a split "double arc" at every corner in review; `inset: -1px`
puts the 1px frame exactly on the border line, where light belongs.

Delivery: a 0×0 absolutely-positioned SVG host (`#ol-fx-host`, aria-hidden,
body-level) holds the filter and is mounted only while `material: liquid`;
`backdrop-filter: url(#ol-liquid-fx)` is selected via a `data-refract` root
attribute gated at module load. Detection note: bare `CSS` is unreliable
inside the dsh loader's module scope (measured: `CSS.supports is not a
function` there while the page console has it) — the check goes through
`globalThis` with a defensive optional call, and requires Chromium brands
(`url()` backdrop filters are Chromium-only anyway). Non-Chromium engines
never mount the host and keep the plain `blur() saturate()` liquid from the
`@supports` fallback — the glass still works, minus the fold.

## 3. Activation & Discovery (as shipped)

- Settings card (Settings → Plugins → Plugin configuration), `material` field;
  the rail root carries `data-material` and CSS selects the card finish live.
  Each glass material additionally serves its `frostTransparency` /
  `frostBlur` / `liquidTransparency` / `liquidBlur` pair only while that
  material is active (four preset chips + custom sliders; see §2b).
- Refraction is capability-gated at module load (Chromium brands + backdrop
  filter support, via `globalThis` — see §2c); engines that fail the gate
  never see `data-refract` or the SVG host and fall back to plain
  `blur() saturate()` liquid.
- Defaults stay `frost`; `none` remains available for exact opaque official
  treatment.

## 4. Compatibility & Performance

- Liquid mounts exactly one extra element while active: the 0×0 SVG filter
  host (never focusable, aria-hidden, no paint area — it cannot create
  overflow or a scrollbar); the preview itself stays a fixed-size CSS layer.
- Runtime work while the ≤300×106px preview is visible: one native
  `backdrop-filter` chain (Chromium: blur + one displacement + saturate).
  Measured on this machine: 60–61 FPS through randomized hover sweeps, heap
  flat at ~38 MB. There is no resize regeneration, animation loop, or
  material on the resting rail; switching away from liquid removes the host.
- The response line uses `label-secondary` and 12.5px/19px metrics rather than
  caption gray; the effect stays readable over both frost and liquid surfaces.
