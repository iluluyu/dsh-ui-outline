# Theme Plan: Liquid Glass / Frosted Glass Variants

> **SHIPPED** (0.0.2, as the `material` setting; veil presets + dispersion pending
> release). This plan's localStorage / WEB_SETTINGS_NAMESPACES constraint is
> historical — rc.7+ opens settings namespaces to third-party plugins, so the
> variants ship as one of three segmented options (`none | frost | liquid`) on
> the settings card, applied to the per-turn preview card only (the resting
> rail stays bare marks, matching the official TurnNavigator). **The liquid
> finish is pure CSS**: frost's token base, a veil preset (see below), a
> radial highlight from the prompt text-start, and sub-pixel chromatic rim
> fringes — warm on the lit corner's edges, cool on the far corner — no inner
> rim (an outer ring + inset rim read as a double border), and no tight
> `0 0 1px` contact halo in dark (it rasterized as a hidden second outline).
> The first SVG feDisplacementMap experiment leaked a 300×150 default-sized
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
| `liquid` | same veil system (52/65/74% light, 48/65/70% dark) plus a corner radial | `blur(10–14px) saturate(1.6)` (dark `1.5 brightness(.85) contrast(1.05)`) | 1px ring + sub-pixel warm/cool chromatic fringes (`±0.6px` offset, alpha .15/.17) | `lv2` + corner radial light | directionally lit, faintly dispersive liquid glass |

Corners are G2 where `corner-shape` exists: `squircle` at 18.4px, measured to cross
the 45° diagonal where a 10px circle does (Chrome's squircle = superellipse(4):
circle@100 → 29.3px vs squircle@100 → 15.9px, factor 1.84). Area-based matching
is deliberately avoided — it reads visually smaller. Unsupported engines keep
the official 10px G1 radius via `@supports` fallback.

The outline is a 0-blur 1px-spread ring shadow, not a stroked border: a 1px
border rasterizes ~3.6× denser near the squircle's diagonal apex than on the
straight edges (measured), while the ring dilates the shape uniformly and peaks
at only the geometric 45° minimum (~1.4×). Liquid's dispersion rides the same
ring: two extra ring shadows in warm red / cool blue, displaced ±0.6px toward
and away from the lit corner, painted *under* the neutral ring — only the
sub-pixel sliver poking past it shows, so the color reads as the ring's own
edge and never as a second outline. An earlier inset-rim variant was removed:
two concentric lines (outer ring + inner rim) read as a double border, and in
dark theme the lv2 token's `0 0 1px` contact halo added a hidden dark line
outside the light ring — both are gone.

The light enters from the corner facing the conversation text — top-left beside a
right rail, top-right beside a left rail (the preview mirrors with the rail),
implemented with `--ol-light-x` / `--ol-light-deg` corner variables (and
`--ol-dis-warm` / `--ol-dis-cool` for the mirrored fringes); light and dark
rules use their respective host tokens so a light host does not get a black
“brand” tint and a dark host still receives a soft highlight.

## 2b. Veil presets (density settings)

Calibration anchor: Apple's iOS 26 `regular` material reverse-engineers to a
**~72% veil over blur ≈5.4px, saturate ≈1.8** — readability comes from the
tint veil, not a heavy blur; community web reproductions sit at tint
0.06–0.40 with blur 20–40px and only the top of that range reads legible over
code blocks. The card exposes one three-step preset per glass material
(`airy | balanced | dense`, default balanced); the field is served only while
its material is selected (progressive disclosure). Each step is one
veil+blur pair consumed through `--ol-veil` / `--ol-blur` custom properties:

| Preset | frost veil (light/dark) | frost blur | liquid veil (light/dark) | liquid blur |
|---|---|---|---|---|
| airy | 48% / 44% | 12px | 52% / 48% | 10px |
| balanced | 60% / 60% | 14px | 65% / 65% | 12px |
| dense | 72% / 68% | 16px | 74% / 70% | 14px |

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
