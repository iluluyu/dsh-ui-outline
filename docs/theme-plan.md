# Theme Plan: Liquid Glass / Frosted Glass Variants

> **SHIPPED** (0.0.2, as the `material` setting). This plan's localStorage /
> WEB_SETTINGS_NAMESPACES constraint is historical — rc.7+ opens settings
> namespaces to third-party plugins, so the variants ship as one of three
> segmented options (`none | frost | liquid`) on the settings card, applied
> to the per-turn preview card only (the resting rail stays bare marks,
> matching the official TurnNavigator). **The liquid finish is pure CSS**:
> frost's token base and border, an 11px blurred/dimmed backdrop, a radial
> highlight from the prompt text-start, and contained inset rims. The first
> SVG feDisplacementMap experiment leaked a 300×150 default-sized host into
> the page, so it was removed rather than patched. `frost` is the default.
> The original research note follows.

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
| `frost` (default) | `bg-layer-1` @ 45% alpha (35% dark) | `blur(6px) saturate(1.35)` | 1px ring (`border-l2`) | `lv2` | transparent milk glass, page reads through |
| `liquid` | `bg-layer-1` @ 42% alpha (32% dark) plus a corner radial | `blur(5px) saturate(1.3) brightness(.9) contrast(1.02)` (dark: `.8` / `1.05`) | 1px ring + uniform inner rim | `lv2` + corner radial light | dimmed, directionally lit liquid glass |

Corners are G2 where `corner-shape` exists: `squircle` at 18.4px, measured to cross
the 45° diagonal where a 10px circle does (Chrome's squircle = superellipse(4):
circle@100 → 29.3px vs squircle@100 → 15.9px, factor 1.84). Area-based matching
is deliberately avoided — it reads visually smaller. Unsupported engines keep
the official 10px G1 radius via `@supports` fallback.

The outline is a 0-blur 1px-spread ring shadow, not a stroked border: a 1px
border rasterizes ~3.6× denser near the squircle's diagonal apex than on the
straight edges (measured), while the ring dilates the shape uniformly and peaks
at only the geometric 45° minimum (~1.4×). Liquid's inner highlight is likewise
a uniform inner ring — hard 1px inset lines clip unevenly where the corner cuts
them.

The light enters from the corner facing the conversation text — top-left beside a
right rail, top-right beside a left rail (the preview mirrors with the rail),
implemented with `--ol-light-x` / `--ol-light-deg` corner variables and a uniform
inner rim; light and dark rules use their respective host tokens so a light host
does not get a black “brand” tint and a dark host still receives a soft highlight.

## 3. Activation & Discovery (as shipped)

- Settings card (Settings → Plugins → Plugin configuration), `material` field;
  the rail root carries `data-material` and CSS selects the card finish live.
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
