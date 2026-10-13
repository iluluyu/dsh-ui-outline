<p align="right"><a href="README.md">简体中文</a> · <a href="README.en.md">English</a></p>

# dsh-ui-outline

Find your place in long conversations. Position the rail your way, keep it in narrow columns, and search with ⌘F / Ctrl+F.

A turn navigation rail and conversation search for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

<p align="center"><img src="docs/img/rail-hero.svg" width="700"></p>

## A rail that fits how you read

Dock the rail to either edge of the conversation column and pick a tick density: **compact** keeps long conversations in view, **loose** gives every turn its own row.

The hit strip is wide, so you never aim at a thin tick; hold and drag to browse. Hover previews a turn's prompt and response; scroll the wheel to step through turns one by one, and click to jump.

## Navigation that stays in narrow columns

Opening a sidebar or split-screen hides the official turn rail; this one stays at the column edge by default, so quick jumps never disappear. Prefer it hidden? Change the narrow-column setting — an edge switch remains to bring it back.

## ⌘F / Ctrl+F to search the conversation

A Spotlight-style overlay: an empty query shows a track-shaped capsule bar; the first keystroke expands it into a result card. Whitespace AND matching, highlighted hits with context excerpts; `↑` `↓` to select, `↵` to jump with a landing flash, `Esc` or an outside click to close. Long conversations stay smooth.

Preview cards and the search overlay come in opaque, frosted glass, and liquid glass.

<details>
<summary><b>Interaction details</b></summary>

- Tick density: compact at 10px spacing (scrolls inside the rail when turns overflow) or loose at 30px per turn; the 44px hit strip snaps clicks to the nearest turn.
- Wheel stepping: starts at the current turn, previews one turn at a time while the conversation stays put; click to jump.
- Search overlay: a 52px capsule sharing one 26px corner radius across both states (G2 continuous-curvature superellipse ends); ±30 characters of context per hit; the index builds in background slices on first open behind a 60ms input debounce, showing the newest 50 matches.
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

Open **Plugins → dsh-ui-outline**.

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
