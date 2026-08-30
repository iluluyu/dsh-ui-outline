<p align="right"><a href="README.zh-CN.md">简体中文</a> · English</p>

<h1><img src="docs/img/logo-marks.svg" width="26" alt="" valign="-4"> dsh-ui-outline</h1>

> The turn rail for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) web — the official TurnNavigator design language, plus the choices the official rail doesn't give you.

<p align="center">
  <img src="docs/img/rail-hero.svg" width="760" alt="The rail beside the conversation: a hovered mark stretches full-length with a neighbor wave, and a frosted preview card shows that turn's prompt and response">
</p>

## Why

- **Official DNA.** The rail hugs the conversation column edge (the details panel never collides), centers on the live reading band, and hides below a 900px column — exactly like the shipped navigator. Every color, radius, shadow, and motion curve resolves live from the host's design tokens.
- **A living mark language.** Idle ticks rest perfectly aligned; the current turn is highlighted by color alone; hovering sweeps a neighbor wave. One language, two densities — `compact` (14px pitch, whole history in view) or `loose` (one real 30px row per turn).
- **Forgiving input.** The strip is 44px wide and snaps every click to the nearest visible turn — the 2px line is never the target. Drag to scrub the whole conversation; a quiet landing flash marks click-arrivals, while fast scrubs stay animation-free.
- **Glass, done carefully.** The per-turn preview card in three finishes: `none` (official opaque tokens), `frost` (default), or `liquid` with a soft light entering from the conversation-facing corner. Corners are G2-continuous where supported (`corner-shape: squircle`, diagonal-matched to the official 10px radius), outlined by a uniform 1px ring. Pure CSS — never overflows the page.
- **First-class settings.** Lives in *Settings → Plugins → Plugin configuration*, persisted in the host's settings document — preferences follow you across browsers and machines. Not localStorage.
- **Cheaper than a shadow.** Scrolling costs one rect read plus a binary search per frame; every animation is compositor-only; pointer moves coalesce to one job per frame; a settled outline re-renders nothing while you read.
- **Never two rails.** While this rail is up, the official one stands down — and below two turns (the official minimum) this one stands down instead.

## Install

Requires dsh ≥ `0.1.0-rc.7` (keyed plugin-settings slot + open settings namespaces).

```sh
dsh plugin --profile web add dsh-ui-outline
```

Restart `dsh web` and reload the page. Update with `dsh plugin --profile web update dsh-ui-outline`; remove with `dsh plugin --profile web remove dsh-ui-outline`.

## Settings

All three apply live and persist in the host settings document:

| Setting | Options | Default |
|:--|:--|:--|
| **Side** | Right · Left | Right |
| **Preview material** | None · Frosted · Liquid glass | Frosted |
| **Mark layout** | Compact · Loose | Compact |

<p align="center">
  <img src="docs/img/mark-language.svg" width="760" alt="Compact uses a 14px pitch with proportional compression; loose uses one 30px row per turn; the 44px hit strip snaps clicks to the nearest mark">
</p>

The card is bilingual zh/en, tracking the app locale. The settings namespace is `outline`; a manual override looks like `outline: { side: left, material: frost, layout: loose }` in `~/.dsh/settings.yaml`. The plugin's `cordis.yml` row also carries a `config:` block — it layers *under* the user document, so profile owners can pin fleet-wide defaults that personal settings always override.

## Performance

- **Reading is free.** Scroll tracking reads one rect per frame and binary-searches cached turn offsets, refilled only when the conversation DOM changes.
- **Streaming doesn't ripple.** Unchanged rows reuse their objects; a settled outline re-renders nothing while you read. Snippets read `textContent`, never the layout-forcing `innerText`, and only the newest step per turn.
- **Compositor-only motion.** The wave, the preview card's glide, and every entrance animate `transform`/`opacity` — animating coordinates would relayout the fixed rail every frame, so nothing does.
- **Coalesced pointers.** Pointer moves become one read-then-write job per animation frame, so scrubbing costs O(1) layouts regardless of pointing-device frequency.
- **Contained by construction.** The rail is `position: fixed` inside the click-through overlay layer: it can never stretch the page or add a scrollbar.

## Design notes

- Design tokens (`--dsw-alias-*`) resolve live from the host page with the official first-paint fallbacks, so theme changes and future token updates are picked up automatically.
- The rail anchor, reading-band geometry, and preview interaction follow the official TurnNavigator. The mark language (aligned rest + color highlight + wave) and the 14/30px density split are this plugin's own ergonomics.
- G2 corners: `corner-shape: squircle` with an 18.4px radius — measured diagonal-equivalent to the official 10px G1 arc (Chrome's squircle measures as superellipse(4)). Browsers without support fall back to the official 10px.
- Reduced motion is respected throughout.

## Credits & license

- Design-language reference: the official **TurnNavigator** in [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (MIT, © DeepSeek) — measured and honored; this plugin's implementation is original, with no code copied.
- Runs inside dsh on **cordis** (plugin host) and **React** (provided by the host at runtime); settings schema via **@deepseek-ai/schemastery** (MIT).
- This plugin ships no third-party code in its bundle. Everything involved is MIT; no transitive license obligations apply beyond retaining the notices of the software you already run.

MIT © iluluyu

## Development

Zero-build: `lib/` is both source and artifact. Turn discovery is DOM-based (`[data-conversation-scroll]`, `[data-chat-flow-kind="user"]`), decoupled from the snapshot API; geometry reads the official CSS variables off the live scrollport.

```sh
git clone https://github.com/iluluyu/dsh-ui-outline
npm run check        # syntax gate
```

| File | Role |
|:--|:--|
| `cordis.yml` | bundle patch: one loader row into the Web profile |
| `lib/index.js` | node half: registers the `outline` settings namespace |
| `lib/client.js` | browser half: the rail + preview card (into `shell.overlay`) and the settings card (into `settings.plugin.item`) |

Local dev: point the profile at the working copy (`"dsh-ui-outline": "link:/path/to/outline"`, `pnpm install` in both), restart `dsh web`, hard-reload.
