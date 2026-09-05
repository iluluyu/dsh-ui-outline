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
| `none` | `var(--dsw-alias-bg-layer-1)` opaque | none | 1px ring (`border-l2`) | `dsw-shadow-lv2` | official preview panel |
| `frost` (default) | `bg-layer-1` veil preset: 48/60/72% airy→dense (dark 44/60/68) | `blur(12–16px) saturate(1.5)` (dark `1.4`) | 1px ring (`border-l2`); dark drops the lv2 contact halo (hidden second outline) | `lv2` (dark: ring + soft drop) | transparent-to-milk glass per density |
| `liquid` | same veil system (52/65/74% light, 48/65/70% dark) plus a warm-white corner radial and a faint cool far-corner wash | `blur(10–14px) saturate(1.6)` (dark `1.5 brightness(.85) contrast(1.05)`) | 1px ring (same as frost; colored rim experiments rejected — see below) | `lv2` + corner radial light | directionally lit, faintly chromatic liquid glass |

Corners are G2 where `corner-shape` exists: `squircle` at 18.4px, measured to cross
the 45° diagonal where a 10px circle does (Chrome's squircle = superellipse(4):
circle@100 → 29.3px vs squircle@100 → 15.9px, factor 1.84). Area-based matching
is deliberately avoided — it reads visually smaller. Unsupported engines keep
the official 10px G1 radius via `@supports` fallback.

The outline is a 0-blur 1px-spread ring shadow, not a stroked border: a 1px
border rasterizes ~3.6× denser near the squircle's diagonal apex than on the
straight edges (measured), while the ring dilates the shape uniformly and peaks
at only the geometric 45° minimum (~1.4×).

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
| airy 清透 | 70% / 8px | 65% / 8px |
| standard 标准 | 50% / 12px | 50% / 12px |
| dense 浓郁 | 35% / 16px | 38% / 16px |

Airy is the readability floor for the secondary gray line (measured in
review); further transparency asks should move blur or text tone, not the
veil.

## 3. Activation & Discovery (as shipped)

- Settings card (Settings → Plugins → Plugin configuration), `material` field;
  the rail root carries `data-material` and CSS selects the card finish live.
  Each glass material additionally serves a `frostLevel` / `liquidLevel` field
  (airy | balanced | dense) only while that material is active; the rail root
  carries `data-frost-level` / `data-liquid-level` accordingly.
- No runtime UA gate, SVG host, injected filter, or body attribute exists.
  Browsers without `backdrop-filter` simply render the token-tinted surface.
- Defaults stay `frost`; `none` remains available for exact opaque official
  treatment.

## 4. Compatibility & Performance

- Liquid has no injected DOM or SVG/filter graph. The preview is a fixed-size
  CSS layer, so it cannot create document overflow or a second scrollbar.
- The only runtime work is one native `backdrop-filter` while the ≤300×106px
  preview is visible. There is no resize regeneration, animation loop, or
  material on the resting rail.
- The response line uses `label-secondary` and 12.5px/19px metrics rather than
  caption gray; the effect stays readable over both frost and liquid surfaces.
