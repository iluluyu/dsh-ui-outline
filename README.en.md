<p align="right"><a href="README.md">简体中文</a> · <a href="README.en.md">English</a></p>

# dsh-ui-outline

A customizable turn navigation rail and conversation search for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web, built to help you find your way through long conversations.

<p align="center"><img src="docs/img/rail-hero.svg" width="700"></p>

## A rail that fits how you read

Dock the rail to either edge of the conversation column and choose between two tick densities:

- **Compact `compact`**: 10px spacing, with scrolling inside the rail when turns overflow.
- **Loose `loose`**: a 30px row per turn for more breathing room.

The 44px-wide hit strip snaps clicks to the nearest turn, so you do not need to aim at a thin tick. Hold and drag to scrub through turns; hover to preview a short excerpt of the prompt and response.

## Keep navigation in narrow columns

Opening a sidebar or using split-screen can reduce the conversation column below 900px. The official turn rail then hides; this plugin stays at the column edge by default, keeping quick jumps within reach.

Prefer it hidden? Change the narrow-column setting. An edge switch remains available to bring the rail back.

## ⌘F / Ctrl+F to search the conversation

Press `⌘F` / `Ctrl+F` to open a Spotlight-style search overlay. With an empty query, it is a 52px-high G2 capsule bar with 26px half-superellipse ends. The first character expands it downward into a card, keeping the same 26px corner radius throughout.

Search covers each turn's prompt and final response in the current conversation:

- **Whitespace-separated terms, AND matching**: every term must match.
- **Highlighted matches**: snippets include 30 characters of context on either side of a match.
- **Keyboard controls**: `↑` / `↓` to select, `↵` to jump with a brief landing flash, and `Esc` or an outside click to close.
- **Long-conversation handling**: the index builds in background chunks on first open; chunked scanning and a 60ms debounce reduce typing stalls. Results show up to the newest 50 matches.

Preview cards and the search overlay offer frosted glass `frost`, liquid glass `liquid`, or the official opaque appearance.

## Install

Requires dsh `0.2.1`.

Choose one installation method:

```sh
dsh plugin --profile web add dsh-ui-outline
dsh plugin --profile web add github:iluluyu/dsh-ui-outline
dsh plugin --profile web add .   # run from the plugin directory; relative paths resolve from the invoking directory
dsh plugin --profile web add file:/absolute/path/to/plugin
```

Restart `dsh web` after installation, then reload the page.

Uninstall: `dsh plugin --profile web remove dsh-ui-outline`.

Built for the web version. The DeepSeek desktop app has not been specifically adapted for; you are welcome to try it.

## Settings

Open **Plugins → dsh-ui-outline**.

| Setting | Options and defaults |
| --- | --- |
| Dock edge | Left / Right; defaults to Right |
| Tick density | Compact `compact` / Loose `loose`; defaults to Compact |
| Preview material | Opaque `none` / Frosted glass `frost` / Liquid glass `liquid`; defaults to Frosted glass |
| Narrow-column visibility | Show / Hide; defaults to Show |

Frosted glass defaults to transparency **80** and blur **6**, combining a soft veil, a bright rim, and extra blur. Liquid glass uses a thinner, more translucent surface; its Standard preset sets transparency to **75** and blur to **4**.

The **Airy / Standard / Misty** presets update transparency and blur together, without briefly exposing the custom sliders. The search overlay follows the preview material setting; liquid-glass search uses a minimum effective blur of **10px** for readability.

Set narrow-column visibility to Hide to collapse the rail below **900px**. The edge switch brings it back and updates the same setting.

## License

MIT © iluluyu
