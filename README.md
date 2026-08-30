# dsh-ui-outline

Turn navigation rail for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) web — the official TurnNavigator design (hover a mark for that turn's preview card, click to jump), extended with left/right placement, compact/loose mark spacing, and preview-card materials (frosted / liquid glass).

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）web 端提供的轮次导航轨道——完全跟随官方 TurnNavigator 交互（悬停刻度显示该轮预览卡片、点击跳转），并扩展左右位置、紧凑/宽松两种刻度分布、预览卡片材质（毛玻璃 / 液态玻璃，默认毛玻璃）。

> dsh 0.1.x ships its own TurnNavigator on the right edge; this plugin replaces it (the official rail stands down while this one is up, so you never see two) and adds what the official one does not offer. dsh 0.1.x 已内置右侧 TurnNavigator；本插件在其启用时接管官方轨道（不会出现双导航栏），并提供官方没有的选项。

---

## Features

- **Official geometry** — hugs the conversation column edge (not the window edge, so it never collides with the details panel), vertically centered on the live reading band (`--dsh-conversation-viewport-height − --dsh-composer-height`, both published by ui-conversation); hides below a 900px column, exactly like the shipped rail.
- **官方几何** —— 贴会话列边缘（不是窗口边缘，details 面板打开也不冲突），垂直居中于实时阅读带（读取官方发布的两个 CSS 变量计算）；列宽低于 900px 时与官方轨道一同隐藏。

- **Mark layout** — one shared, living mark language: idle ticks rest perfectly aligned at one short line while the current turn is highlighted by color alone; hover or focus sweeps that mark to full 20px with a pronounced neighbor wave (±1/±2/±3 decay). A 44px-wide hit strip snaps nearby clicks to the closest visible turn, so the two-pixel line is never the real target. The choice is vertical density:
  - `compact` (default): 14px pitch with the official proportional-compression geometry, capped at `min(natural, band−64px, 420px)`.
  - `loose`: the same marks at one real 30px row per turn (a 44×30px target), capped at `min(natural, reading band−64px, 70vh, 640px)` with internal scroll and a 2.5rem edge fade.
- **刻度分布** —— 共用一套“会呼吸”的刻度语言：静息时所有刻度齐平等长，当前轮仅以颜色高亮；悬停或聚焦时该刻度伸展至 20px 全长并带动 ±1/±2/±3 邻近波浪。轨道提供 44px 宽的宽容点击条，点击附近会吸附到最近的可见轮次，不必精确点中横线。两者只区分上下密度：`compact` 紧凑（默认，14px 间距、官方比例压缩、420px 上限）；`loose` 宽松（每轮真实 30px 行高、44×30px 目标，在阅读带内以 `min(natural, 阅读带−64px, 70vh, 640px)` 限高后内部滚动 + 边缘渐隐）。

- **Rail side** — right (default, official spot) or left; marks and the preview card mirror automatically.
- **轨道位置** —— 右侧（默认，官方位置）或左侧；刻度与预览卡片自动镜像。

- **Per-turn preview card** — hover (or focus, or scrub) a mark and a small card appears beside it, centered on that mark and clamped inside the rail: the turn's prompt plus its response, two short lines each — the official TurnNavigator preview, not a full outline panel. Click or scrub to jump; clicks give a quiet landing flash in either density, while a fast scrub stays animation-free.
- **单轮预览卡片** —— 悬停（或聚焦、擦洗）某条刻度，旁边出现一张小卡片，垂直居中于该刻度并钳制在轨道范围内：该轮的提问与回答各两行——即官方 TurnNavigator 的预览交互，而非整页大纲面板。点击或擦洗跳转；两种密度的点击都会给目标气泡轻量落点闪烁，快速擦洗则不残留动画。

- **Preview material** — the preview card in three finishes: `frost` (default; 78% token tint + `blur(14px) saturate(1.4)`), `none` (official opaque tokens: bg-layer-1 + border-l2 + shadow-lv2), `liquid` (frost-like token base, a gently darkened 11px backdrop, prompt-start radial light, and a contained glass rim — pure CSS, identical in every browser, nothing injected). Response text uses the readable secondary token rather than caption gray. The resting rail stays bare marks in every mode, like the official rail.
- **预览卡片材质** —— 三种质感：`frost` 毛玻璃（默认）、`none`（官方不透明 token）、`liquid`（液态玻璃：沿用毛玻璃 token 底色、11px 压暗背景、从主文本起点发出的径向光与受控玻璃边缘——纯 CSS 实现，所有浏览器一致，零注入元素）。回答小字改用可读性更高的 secondary token。静息轨道始终为官方裸刻度。

- **Settings card** — Settings → Plugins → Plugin configuration: three terse segmented fields (位置 / 材质 / 刻度分布), applied live, persisted in the host's settings document. Bilingual zh/en.
- **设置卡片** —— 设置 → 插件 → 插件配置：三个简洁分段选项（位置 / 材质 / 刻度分布），实时生效，持久化到宿主设置文档。中英双语。

Under 2 turns the plugin stands down and the official rail returns (both layouts, the official minimum).

轮次少于 2 时插件退位、官方轨道回归（两种刻度一致，即官方的最小值）。

## Install

```sh
dsh plugin --profile web add dsh-ui-outline
# or: dsh plugin --profile web add github:iluluyu/dsh-ui-outline
```

Requires dsh ≥ 0.1.0-rc.7 (keyed `settings.plugin.item` slot + open settings namespaces). Restart `dsh web` and reload. Uninstall: `dsh plugin --profile web remove dsh-ui-outline`.

需要 dsh ≥ 0.1.0-rc.7（keyed 设置卡片槽位 + 开放的设置命名空间）。重启 `dsh web` 并刷新浏览器即可。卸载：`dsh plugin --profile web remove dsh-ui-outline`。

## Design parity

Colors, radii, shadows and motion curves follow the official design tokens (`--dsw-alias-*`), resolved live from the host page with fallbacks. The rail anchor and reading-band geometry follow TurnNavigator; the mark language (aligned rest + color highlight + wave) and the 14px/30px density split are deliberate plugin ergonomics, no longer official-parity ticks.

颜色、圆角、阴影、动效均跟随官方设计 token（`--dsw-alias-*`），优先实时读取宿主变量、官方实测值兜底。轨道锚点与阅读带几何跟随 TurnNavigator；刻度语言（齐平静息 + 颜色高亮 + 波浪伸展）与 14px/30px 密度分层是插件自己的取舍，不再逐字复刻官方刻度。

## Development

Zero-build: `lib/` is both source and artifact. Turn discovery is DOM-based (`[data-conversation-scroll]`, `[data-chat-flow-kind="user"]`), decoupled from the snapshot API; geometry reads the official CSS variables off the live scrollport.

零构建：`lib/` 既是源码也是发布产物。轮次发现基于稳定 data 属性，与快照 API 解耦；几何信息直接从滚动容器读取官方 CSS 变量。

```sh
node --check lib/client.js      # syntax gate
```

| File | Role |
|---|---|
| `cordis.yml` | bundle patch: one loader row into the Web profile |
| `lib/index.js` | node half: registers the `outline` settings namespace |
| `lib/client.js` | browser half: the rail + preview card (into `shell.overlay`) and the settings card (into `settings.plugin.item`) |

Local dev: point the profile at the working copy (`"dsh-ui-outline": "link:/home/luyu/dsh-plugin/outline"`, `pnpm install` inside both the profile and the package once for `@deepseek-ai/schemastery`), restart `dsh web`, hard-reload.

## Performance

The rail costs nothing while you read: scroll tracking reads one rect per frame and binary-searches cached turn offsets, refilled only when the conversation DOM changes; streaming reuses unchanged row objects, so a settled outline re-renders nothing; snippets read `textContent`, never the layout-forcing `innerText`; the rail element itself is `position: fixed` inside the click-through overlay layer, so it can never stretch the page or add a scrollbar.

阅读期间轨道零开销：滚动每帧仅读一次矩形，在缓存的轮次偏移上二分查找，仅当会话 DOM 变化时重填；流式输出时复用未变化的行对象，静止的大纲不产生任何渲染；摘要读取 `textContent`，绝不触发强制重排；轨道本体位于点击穿透的浮层内、`position: fixed`，不可能撑出页面或产生滚动条。
