<p align="right"><a href="README.md">简体中文</a> · <a href="README.en.md">English</a></p>

# dsh-ui-outline

Find your place in long conversations. Position the rail your way, keep it in narrow columns, and search with ⌘F / Ctrl+F.

A turn navigation rail and conversation search for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

<p align="center"><img src="docs/img/rail-hero.svg" width="700" alt="dsh-ui-outline overview"></p>

[Install](#install) · [Settings](#settings)

## A rail that fits how you read

Dock the rail to either edge of the conversation column and pick between two tick densities:

- **Compact `compact`**: 10px spacing — dozens or hundreds of turns stay in view, scrolling inside the rail when they overflow. Docking side and density are independent choices.
- **Loose `loose`**: a 30px row per turn, sparse enough to count at a glance.

The 44px hit strip snaps clicks to the nearest turn, so you never aim at a thin tick; hold and drag to browse continuously.

<p align="center"><img src="docs/img/rail-placement.svg" width="640" alt="Left/right docking and compact/loose densities"></p>

## Hover previews, wheel-speed browsing

Hover any tick and a glass preview card appears beside the rail with that turn's prompt and final response — confirm it is the right one before going there.

Scroll the wheel over the rail to step through turns: the wave and preview card follow the cursor while **the conversation itself stays put**. Found it? Click (or focus and press Enter) to jump, with a landing flash at the destination. Browse first, commit second — far less back-and-forth paging in long conversations.

<p align="center"><img src="docs/img/rail-interactions.svg" width="640" alt="Hover preview, wheel stepping, and click-to-jump"></p>

## Navigation that stays in narrow columns

Opening a sidebar or split-screen hides the official turn rail; this one stays at the column edge by default, so quick jumps never disappear. Prefer it hidden? Change the narrow-column setting — an edge switch remains to bring it back.

## ⌘F / Ctrl+F to search the conversation

A Spotlight-style overlay: an empty query shows a track-shaped capsule bar; the first keystroke expands it downward into a result card.

- **Whitespace AND matching**: terms split on spaces, every term must hit — Chinese and English alike.
- **Highlighted hits**: each result shows a context excerpt of that turn's prompt/response (30 characters either side) with the matched terms highlighted.
- **Keyboard first**: `↑` `↓` to select, `↵` to jump with a landing flash, `Esc` or an outside click to close.
- **Smooth on long conversations**: the index builds in background slices, input is debounced, and the newest 50 matches are shown.

Preview cards and the search overlay come in opaque, frosted glass, and liquid glass, with live-tunable parameters.

<p align="center"><img src="docs/img/search-spotlight.svg" width="640" alt="The capsule bar expanding into a result card"></p>

<details>
<summary><b>Interaction details</b></summary>

- The search capsule is 52px high and shares one 26px corner radius across both states; the morph is a pure height growth with the radius never changing.
- Wheel stepping: starts at the current turn; 100 normalized scroll units per step with a 150ms idle remainder reset; drags and focus take the cursor over instantly.
- A 60ms input debounce plus sliced scanning keeps first-keystroke-to-results latency independent of conversation length.
- Liquid-glass search keeps a minimum effective blur of 10px for readability.

</details>

## Install

Requires dsh `>= 0.2.0-rc.1`. Supports the web client and the desktop app that reuses it.

```sh
dsh plugin --profile web add dsh-ui-outline
```

Restart `dsh web` after installation, then reload the page.

<details>
<summary><b>Other install methods</b></summary>

```sh
dsh plugin --profile web add github:iluluyu/dsh-ui-outline
dsh plugin --profile web add .   # run from the plugin directory; relative paths resolve from the invoking directory
dsh plugin --profile web add file:/absolute/path/to/plugin
```

Uninstall: `dsh plugin --profile web remove dsh-ui-outline`.

</details>

## Settings

Open **Plugins → dsh-ui-outline**; every option applies live.

| Setting | Options and defaults |
| --- | --- |
| Dock edge | Left / Right; defaults to Right |
| Tick density | Compact `compact` / Loose `loose`; defaults to Compact |
| Preview material | Opaque `none` / Frosted glass `frost` / Liquid glass `liquid`; defaults to Frosted glass |
| Narrow-column visibility | Show / Hide; defaults to Show |

<details>
<summary><b>Material parameters</b></summary>

Frosted glass defaults to transparency **80**, blur **6**; liquid glass is thinner, with its Standard preset at transparency **75**, blur **4**. The **Airy / Standard / Misty** presets update both values together without flashing the custom sliders. The search overlay follows the preview material setting.

</details>

## License

MIT © iluluyu
