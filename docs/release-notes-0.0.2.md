# Release notes — 0.0.2 (draft for GitHub Release, post after push)

Title: `0.0.2 — official design language, first-class settings, glass`

English primary; Chinese condensation appended. Do not post before `git push` + `npm publish`.

---

## English

0.0.2 is a ground-up rework around the official TurnNavigator design language. Same mission — a turn rail for the conversation — now native to dsh, deeply configurable, and measurably cheap.

### The rail
- **Official geometry & tokens.** Hugs the conversation column edge (details-panel safe), centers on the live reading band, hides below a 900px column. All colors/radii/shadows/motion resolve live from `--dsw-alias-*` tokens with official fallbacks.
- **Takeover handshake.** While this rail is up, the official navigator stands down; below two turns (the official minimum) this one stands down and the official returns. Never two rails.
- **A living mark language.** Idle ticks rest aligned; the current turn is color-highlighted only; hover/focus sweeps a neighbor wave (1 / .7 / .4 / .2 → 20 / 14 / 8 px). One language, two densities:
  - `compact` — 14px pitch, official proportional compression, capped `min(natural, band − 64px, 420px)`.
  - `loose` — one real 30px row per turn (a 44×30px target), capped `min(natural, band − 64px, 70vh, 640px)`, internal scroll with edge fade.

### Input you don't have to aim
- 44px hit strip: any click snaps to the nearest visible turn — the 2px line is never the target.
- Drag anywhere in the strip to scrub the conversation (5px threshold separates click from scrub; pointer capture keeps it through fast moves; touch drags are owned via `touch-action: none`).
- Click-arrivals get a quiet landing flash; scrubs stay animation-free.
- Full keyboard path: tab to a mark, Enter to jump, focus drives the same wave.

### Preview card, in glass
- Hover/focus/scrub shows that turn's prompt + response (two short lines each), centered on the mark, clamped inside the rail.
- Three materials — `none` (official opaque tokens), `frost` (default: 45% token tint + `blur(6px)`), `liquid` (42% tint + `blur(5px)` + a soft light from the conversation-facing corner; pure CSS, no SVG filters, never overflows).
- G2 corners where supported: `corner-shape: squircle` at 18.4px, measured diagonal-equivalent to the official 10px G1 arc; uniform 1px ring (a stroked border rasterizes unevenly on superellipse diagonals).

### First-class settings
- New settings card under *Settings → Plugins → Plugin configuration*: **Side** (right/left, mirrored automatically), **Preview material** (none/frost/liquid), **Mark layout** (compact/loose). Bilingual zh/en, applies live.
- Preferences persist in the host's settings document (`outline` namespace) — they follow you across browsers and machines. Requires dsh ≥ `0.1.0-rc.7`. Not localStorage.
- The plugin's `cordis.yml` row now carries a `config:` block, registered as the namespace's composition (base) layer — profile owners can pin fleet-wide defaults that personal settings always override (the layered shape the settings cookbook prescribes).

### Performance (measured, not promised)
- Scroll tracking: one rect read + binary search per frame; offsets refill only on conversation DOM change.
- Every animation is compositor-only (`transform`/`opacity`) — including the preview card's glide.
- Pointer moves coalesce to one read-then-write job per animation frame: scrubbing costs O(1) layouts at any pointer frequency.
- Streaming: unchanged rows reuse objects; per-turn snippets read `textContent` (never `innerText`), newest step only.
- The rail is `position: fixed` in the click-through overlay — cannot stretch the page or add a scrollbar.

### Fixed since 0.0.1
- Loose-mode marks rendering invisible (missing `background-color: currentColor`).
- Liquid material dropping a leaked 300×150 default box into the host — the SVG machinery is gone; liquid is pure CSS now.
- Minimum-turns parity between layouts; preview re-placement on layout/geometry changes; response text legibility (secondary token, separate font declarations).

### Docs
- Theme-adaptive SVG illustrations (light/dark via `prefers-color-scheme` inside the SVG), English-primary README with a Chinese mirror (`README.zh-CN.md`).

---

## 中文

0.0.2 围绕官方 TurnNavigator 设计语言全面重写：

- **官方几何与 token**：贴会话列边缘、居中阅读带、<900px 隐藏；颜色/圆角/阴影/动效实时读取 `--dsw-alias-*`，官方兜底。
- **接管握手**：本轨道启用时官方退位；少于 2 轮本轨道退位。绝不双轨。
- **会呼吸的刻度**：静息齐平、当前轮纯颜色高亮、悬停邻近波浪；紧凑 14px / 宽松 30px 两种密度。
- **宽容输入**：44px 点击条吸附最近轮次；拖拽擦洗整个会话；点击落点轻闪、擦洗无残留；完整键盘路径。
- **玻璃预览卡**：无/毛玻璃/液态三材质，光从朝向会话的角落射入；G2 squircle 圆角（18.4px 与官方 10px 对角线等效）+ 均匀 1px 外环；纯 CSS 不溢出。
- **一等公民设置**：设置 → 插件 → 插件配置，位置/材质/刻度分布三项，实时生效、持久化到宿主设置文档（跟随跨机器），需 dsh ≥ rc.7。
- **性能**：滚动每帧 1 次矩形 + 二分；全动画仅合成器；指针合帧（擦洗 O(1) 布局）；流式零泛涟漪；`position: fixed` 不可能撑出页面。
- **修复**：宽松刻度不可见、液态 SVG 宿主泄漏、双布局最小轮次不一致、预览布局变化不重排、回答小字可读性。
- **文档**：明暗自适应 SVG 插图；英文主 README + 中文镜像。
