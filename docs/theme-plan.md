# Theme Plan: Liquid Glass / Frosted Glass Variants

> **SHIPPED** (0.0.2 as the `material` setting; the 0.0.3 round — folded-
> inside SDF fix, crossing-axes preset ladder, neutral Fresnel finish — is
> in-tree pending release). This plan's localStorage /
> WEB_SETTINGS_NAMESPACES constraint is historical — rc.7+ opens settings
> namespaces to third-party plugins, so the variants ship as one of three
> segmented options (`none | frost | liquid`) on the settings card, applied
> to the per-turn preview card only (the resting rail stays bare marks,
> matching the official TurnNavigator). The liquid finish is CSS plus one
> 0×0 SVG filter: frost's token base, a neutral cool-white corner sheen
> with a faint cool far-corner wash, and — on Chromium — a real SDF
> displacement lens at the rim (§2c). Rim experiments are recorded below:
> an inset rim read as a double border, a tight `0 0 1px` contact halo
> rasterized as a hidden dark line in dark theme, and sub-pixel offset
> color fringes rasterized as detached colored line segments with a
> hairline gap — all three are gone; the rim stays a single neutral ring
> plus the Fresnel glint. The first SVG feDisplacementMap experiment
> leaked a 300×150 default-sized host into the page, so it was removed
> rather than patched. `frost` is the default. The original research note
> follows.

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
| `frost` (default) | `bg-layer-1` veil, preset ladder t85/t70/t48 (veil = 100−t) | `blur(0–24px) saturate(1.5)` (dark `1.4`) | 1px border (`border-l2`) | `lv2` | airy → balanced → deep-fog glass |
| `liquid` | same veil ladder + a neutral cool-white corner sheen and a faint cool far-corner wash | Chromium: SDF displacement lens (§2c) after a light blur, `saturate(1.6)`; others: `blur(0–24px) saturate(1.6)` fallback | 1px border (`border-l2`) | `lv2` + corner sheen + strict Fresnel rim glint | clear, edge-refracting liquid glass |

Corners are plain `border-radius: 18.4px` circles — the radius the card has
effectively rendered as all along. The whole corner-shape (G2) direction was
explored and abandoned, with three measured findings so it is not retried:

1. The `squircle` keyword parses (`CSS.supports` → true) but silently
   computes to `superellipse(2)` in Chrome 152 — a plain circle — so the
   original "G2 upgrade" never actually rendered.
2. The explicit `superellipse(4)` DOES render, but at 18.4px it hugs the
   corner box so tightly it reads as a ~10px circle ("corners shrank"), and
   scaling the radius up (34px, apex-parity with an 18.4 circle) collapses
   the *perceived* radius to ~6px: a superellipse(4) runs nearly flush with
   the corner box's straight edges and only turns over near the diagonal —
   apex parity at one point does not carry the perceived roundness.
3. Chrome 152's *default* `corner-shape` computes to `superellipse(1.5)`,
   which pulls every undeclared radius inward — this is the look the card
   always had (18.4px + n=1.5 ≈ perceived ~10px), i.e. "the user's corner".
   Overriding to a true `round` at 18.4px would render visibly larger than
   anything the user has seen, so nothing is declared: the default plus
   18.4px reproduces the familiar look byte-for-byte.

The fold map's SDF is circular at the same 18.4px (`FX_R = 18.4`), keeping
the refraction band concentric with the rendered edge within ~1px at the
diagonals.

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
6. *Warm lit-corner radial* (`rgba(255,245,240,.30)`, 140×90) — carried over
   from the original plan, rejected in the 0.0.3 taste review: over the
   white veil it read as tea-stain yellowing, and against dsh's cool dark
   palette it clashed ("半透明黄斑"). The sheen is now neutral cool-white,
   smaller (100×50) and fainter (.16 light / .08 dark).
7. *High-peak rim light with a far-corner re-brighten* (white .50 → .10 →
   .06 bounce) — washed the near border white over light borders and read
   as a neon filament over dark veils. Replaced by a strict one-way Fresnel
   falloff: peak .30 (light) / .16 (dark), .06/.03 at 22%, fully transparent
   by 45% of the way around — no back-corner bounce.

The light enters from the corner facing the conversation text — top-left beside a
right rail, top-right beside a left rail (the preview mirrors with the rail),
implemented with `--ol-light-x` / `--ol-light-deg` corner variables; light and dark
rules use their respective host tokens so a light host does not get a black
“brand” tint and a dark host still receives a soft highlight.

## 2b. Glass parameters (transparency + blur)

The ladder runs on **two crossing axes, not one sliding density dial**:

- 清透/airy maximizes the TRANSPARENCY axis — see-through glass with a
  gentle defocus;
- 朦胧/misty maximizes the BLUR axis — real fog whose colors still glow
  through (the veil is capped ≤45% so it can never collapse into the opaque
  milk-wall the old t30 step ended at);
- 标准/standard is the balance point. It anchored on Apple's iOS 26
  `regular` material (reverse-engineered ≈ t72 / blur 5.4 / saturate 1.8)
  through 0.0.3 — both review rounds scored that anchor above every shipped
  preset — until the live user called it "too conservative" and the 0.0.4
  taste ballot moved it airier to 80/6: the background's color temperature
  shows through while text stays planted (the iOS anchor remains on the
  reference row of the visual harness as a calibration point).

Calibration history: the 0.0.2 ladder (70/4 · 50/12 · 30/16) slid ONE axis
— transparency and blur moved together, and pixel measurement showed the
frost steps nearly indistinguishable in light theme (adjacent-preset mean
pixel diff ≈ 20/15) while 朦胧 at veil 70% measured within ~5 luminance
points of the opaque `none` card — a milk wall, not glass. The crossing
ladder measures 28–44 per adjacent step and keeps every step legibly glass.
The 0.0.4 user-feedback round re-tuned frost toward beauty (standard
70/7 → 80/6, misty 48/16 → 55/18 — the 18px blur dissolves the color
bands into pure color-temperature glow; review tied 50/16 vs 55/18 and
the Fresnel-strict 55/18 won on silkiness), lifted liquid·airy's blur
floor 2 → 3 and its veil 15 → 20% for subtitle readability, and nudged
frost·airy's defocus 4 → 3. Rounds 5–6 then closed the liquid·airy
readability tail (75/4 — veil is the knob) and re-spaced liquid's
standard to 65/6 after a patrol flagged airy/standard reading as one
step when they differed by veil alone.

The card exposes, per glass material (served only while that material is
selected — progressive disclosure):

- a four-chip row: 清透/Airy, 标准/Standard, 朦胧/Misty (each snaps BOTH the
  transparency and the blur; names only — percentages were shown on the
  chips for a round and removed as cognitive load) plus 自定义/Custom,
  which expands two sliders;
- 透明度/transparency (20–95%, step 5; the veil is 100 − t) and
  虚化半径/blur radius (0–24px, step 1) sliders — the custom path; a stored
  value pair matching no preset keeps the sliders expanded on reopen.

Slider writes are debounced (140ms trailing) into one settings write per
drag pause; preset clicks write immediately. One transparency serves both
themes (the dark veil token is darker, so equal percentages dim more in
dark — natural and intended). Background dimming is deliberately NOT a
third knob: in light theme the white veil is the wash, in dark the dark
veil is the dim — a brightness control would duplicate the veil's job
(and 0.0.3 removed the stray dark-liquid `brightness(.85)` on exactly
this principle: it dimmed the freshly fixed edge lens for no benefit).

| Preset | frost t / blur | liquid t / blur |
|---|---|---|
| airy 清透 | 85% / 3px | 75% / 4px |
| standard 标准 | 80% / 6px | 65% / 6px |
| misty 朦胧 | 55% / 18px | 50% / 10px |

Liquid's airy floor took two user rounds to walk 85/2 → 80/3 → 75/4,
and the measurable lesson is that the readable knob is the VEIL, not
blur — the subtitle's interference is low-frequency color bands, which
blur barely touches (the round-5 A/B: +1 blur was imperceptible, +5 veil
was the structural fix). Standard then dropped to 65/6 (round-6 final):
at 70/4 it differed from 75/4 airy by veil alone and the two chips read
as one — the ladder needs both axes moving, the same lesson frost taught.
Misty sits on the slider lattice (50/10) with a veil clearer than frost's
misty — a dark veil with no frost grain to break it read as a flat gray
slab (round-3 A/B), while t50 still lets the fog glow through. The preset
id `dense` was renamed `misty` alongside — the label had already moved,
"dense/rich" read as a premium recommendation when it is the most veiled
step. Namespace defaults track the STANDARD preset of each material
(80/6, 65/6).

## 2c. Edge refraction (the liquid lens)

Liquid alone runs the backdrop through a real displacement lens — an
independent re-implementation of the LiquidLens technique, now aligned to
its measured parameters:

| Parameter | Value | Source |
|---|---|---|
| rim profile | Snell: squircle height `f(u)=(1-(1-u)⁴)^¼` → slope → θ₁ → Snell (n=1.5) → `tan(θ₁-θ₂)`, 128 samples, normalized (peaks AT the edge, tapers inward); from t=0.45 to 1 the value is multiplied by a quintic smootherstep tail window (f(1)=0, f'(1)=0, monotone) — see below | LiquidLens `buildProfile` + tail window |
| bezel width | 16px | taste ballot (see below) |
| map | 600×212 canvas (2× supersampled), rounded-rect SDF, forward-difference normals, R/G = 128 ± 127·n·mag | tomagranate `dpr: 2` |
| displacement | single `feDisplacementMap`, scale 18 | LiquidLens `refraction: 18`; ballot-confirmed |
| pre-blur | `std = clamp(blur/2, 0.5, 3)` — blur above ~4 erases the lens, so the slider's upper half stops adding frost while refraction is on | LiquidLens "keep LOW (0-4)" |
| saturation | 1.6, everywhere (CSS fallback and filter chain — they disagreed 1.55/1.8 through 0.0.2) | compromise between LiquidLens 1.8 and the 1.55 banding-reduction |
| melt | `feGaussianBlur std 0.6` immediately AFTER the displacement — dissolves the 8-bit displacement field's quantization steps (λ=1px gain ≈ 0.0001%) without touching the fold (λ≥8px gain ≥ 80%) | this project |
| dither | `feTurbulence 0.8` + ±1-level zero-centered arithmetic composite at chain end — breaks up 8-bit contour banding in the refracted backdrop (the ballot's no-dither variant showed 2–5 visible contour steps) | this project |
| rim light | strict one-way Fresnel 1px glint ON the border (`::before`, `inset: -1px`, `corner-shape: inherit`, mask xor ring): peak .30 light / .16 dark at the lit corner, .06/.03 at 22%, transparent by 45% — no back-corner bounce | ballot (D variant) |
| a11y gate | `prefers-reduced-transparency: reduce` skips the lens | LiquidLens |

A plain smoothstep magnitude was the first attempt — its flat top read as
a smeared band, not a lens; the Snell profile's edge-hugging peak is what
makes the fold read as glass. The rim-light ring initially sat at `inset: 0`
(padding box) and traced a concentric arc 1px inside the border arc —
visible as a split "double arc" at every corner in review; `inset: -1px`
puts the 1px frame exactly on the border line, where light belongs.

**The inner-seam tail work (historical, 0.0.2 — see the SDF bug below
for why the seam existed at all).** The bare Snell tail dies within a few
pixels (compression ratio ≈ 0.19–0.24 px/px at t≈0.35–0.4) and then hits
the hard `depth < RIM` branch — the distortion field had a perceptible
END, which read (fold-on/off diff evidence) as the edge of a smaller card
nested inside a bigger one. Two measures closed it: the quintic tail
window lands the profile at zero with zero slope (content-scale factor
eases to 1 over the last ~40% of the band — verified inner-boundary
differential ≤ 0.13 px/px, t≥0.9 ≤ 0.001), and the 0.6px post-displacement
melt buries the 8-bit field's residual single-level steps. Both survive
the SDF fix — they now smooth the terminus of a band that actually hugs
the edge.

**The folded-inside SDF bug (0.0.3, the real 断层 root cause).** Through
all of 0.0.2 the straight-edge branch of the map's rounded-rect SDF
omitted the final `− R` of the IQ formula (while the superellipse corner
branch was exact) — every straight-edge distance was offset +R, so the
whole fold band sat 18.4px INSIDE the card: the visible rim stayed flat
neutral gray while an invisible warp lived under the text, and the corner
arcs bent against dead-straight edges. Decoding the generated map showed
the displacement signal only at 20–32px depth (G-channel dip to 21 at the
true edge = none). The historical "nested-card annulus seam" above was
this bug's shadow — the misplaced band's terminus read as an inner card
edge, and the tail-window/melt work masked its end instead of exposing
that the band itself was in the wrong place. Fix: one character class —
`… + Math.max(qy, 0) − R` — after which the fold peaks AT the edge
(G ≈ 21 at depth 0) and the lens finally renders where eyes look for it.
(Cross-validated: pixel-decode measurement, an independent full report,
and an A/B with the displacement baked at scale 0 vs 18 into the initial
DOM — mutating a live filter's scale does not reliably re-render a
CSS-referenced backdrop filter, so such A/Bs must come from fresh loads.)

**The optics ballot.** With the fold finally on the edge, three tunings —
A RIM14/SCALE10, B RIM16/SCALE18, C RIM22/SCALE26 — went to a blind taste
review (3× corner zooms, light + dark): A lost all materiality, C
compressed corner strokes into jelly and moiré'd grid lines in dark, B
won as "perceptibly bent, never jelly" — text strokes entering the rim
bend 1–2px with structure intact, and the dark-theme fold reads as a soft
caustic contour light. The same review moved the finish to a neutral
cool-white sheen + strict Fresnel rim (both above) and kept the dither on
(its no-dither variant grew visible 8-bit contour steps).

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
