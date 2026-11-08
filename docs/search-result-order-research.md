# 搜索结果的编号与排序：调研 + 落地规格

> 起因：`#1` / `#2` 这类轮次标注不需要灰底；结果列表「从大到小」的排布不符合直觉。
> 结论已写进 §4 / §5 的规格，实现清单在 §6。原型：`docs/prototypes/turn-number-options.html`。

## 1 主流产品怎么做

| 产品 | 有结果列表吗 | 每行标什么 | 排序 | 当前位置怎么表达 |
|---|---|---|---|---|
| Chrome 查找（含 macOS/Windows） | 没有 | —— | 文档序 | 只给计数 `1/5`；页内黄色高亮；**滚动条上的黄色刻度**标出所有命中的位置 |
| Chromium find-in-page API | 没有 | —— | `FindMatchRects` 的注释写明：`sorted by frame traversal order starting in the main frame, then by DOM order` | `number_of_matches` + `active_match_ordinal`；Android 另有 `ActivateNearestFindResult(point)`——按几何距离激活最近的一条 |
| PDF.js（Firefox 内置 PDF、多数网页 PDF） | 没有 | —— | 页序 | `current` = 前面所有页的命中数 + 本页序号，即**文档序里的第几个**；`total` 为总数 |
| Word 导航窗格（搜索） | 有 | 上下文片段（**无编号**） | 文档序 | 点击跳转；上下箭头逐个走 |
| Acrobat / macOS 预览 | 有 | 页码 + 片段 | 页序 | 点击跳转 |
| VS Code 搜索 | 有 | `文件:42` 行号（**绝对锚点**） | 按文件路径分组，文件内按行；可切换按结果数排 | 选中项高亮 |

## 2 可以复用的四条规律

1. **没人给每条结果加序号**。序号会被"多打一个字"打乱（命中集合变了，第 3 条可能变成第 5 条），所以主流只用一个 `第几个/共几个` 的计数器表达"当前在哪个"，而不是每行一个标签。
2. **行标签用绝对位置**：页码、行号、轮次号。它们稳定、可以口头复述（"第 12 轮"）、天然单调递增，这正是 VS Code 用 `:42` 而不是 `#3` 的原因。
3. **列表排序永远是文档序**（Word、Acrobat、VS Code、PDF.js 全一样）。只有"按相关度"的搜索框（Spotlight、Slack、Notion）才打破文档序，而它们恰恰**不编号**——两件事在主流里是互斥的：既然编号是文档位置，列表就得按文档位置排。
4. **"我在哪"靠位置信号，不靠序号**：Chrome 用的是滚动条刻度，Word/Acrobat 用的是"点一下跳过去"，VS Code 用的是选中项。我们的轨道刻度就是 Chrome 的那条黄线。

## 3 我们的处境（为什么这条对我们是强约束）

dsh-ui-outline 同时有两套位置信号：

- **轨道**（刻度）：对应 Chrome 的滚动条刻度，不标数字，只表达"命中/当前阅读在整段对话里的位置"；
- **⌘F 列表**：对应 VS Code 的结果列表，需要能复述的绝对锚点 → `#12` 就是"第 12 轮"。

两套信号必须**同向**。现在的问题正是方向相反：轨道从上到下是 1→N（旧→新），列表却是 N→1（新→旧），用户在两套坐标之间来回翻译。所以：

> 编号保留 `#N`（它是轮次号，不是"第几个命中"），列表改成升序，把"离得最近"交给**定位**解决，而不是靠倒序伪装的"就近"。

这与用户直觉一致：站在第 3 轮，看到 `#2` 在上、`#3` 在下，`#1` 滚出视口上方——位置感是连续的，不用做任何心算。

## 4 方案 A：编号去底色（规格）

保留 `#N` 文本，去掉药丸底色。`#` 是装饰性符号（不承载信息），降一档；数字是锚点，保持主对比。

| 项 | 值 | 理由 |
|---|---|---|
| 槽宽 | `width: 30px` + **左对齐** | `#` 落在一条竖线上，数字从固定 x 起排；固定槽宽保证文字列不动，只有槽内空白在变。30px 容得下 `#100`（3 位） |
| 字号/行高 | `12px / 16px` | 比正文 13.5/20 小一档，不抢行首；与 footer 的 11.5 拉开层次 |
| 字重 | `500`；选中行 `600` | 选中行靠"加重"而非底色区分，和轨道"当前刻度靠颜色"同一逻辑 |
| 数字体 | `font-variant-numeric: tabular-nums` | 等宽数字，纵向对齐不抖 |
| 颜色 | `--dsw-alias-label-secondary`（#61666b，白底 5.6:1 ✓） | 现状用的 tertiary #81858c 只有 3.6:1，12px 不达标 |
| `#` 字形 | `11px`，`opacity: .72`，与数字间距 `1px` | 让 `#` 退成符号，数字读作"第几轮" |
| 行内距 | 行 `padding-left: 12px` 不变，编号右缘到文本 `gap: 10px` | 正文起点落在 48px 的直线上，扫读列对齐 |
| 删除 | `background`、`padding: 2px 7px`、`border-radius: 6px`、深色主题下的底色覆盖 | 一屏 50 行不再出现 50 个灰块 |

### 多档数字怎么对齐

- **当数值比大小**（金额、统计、排行）→ 右对齐 + tabular-nums，右缘对齐才好比较量级。
- **当编号/标签**（页码、行号、轮次、脚注）→ 左对齐：读者要的是"这是第几号"，不是"哪个更大"；带固定前缀（`#`、`第`）时左对齐会让前缀成一条竖线，视觉最稳。
- 两种都要求 `font-variant-numeric: tabular-nums`，否则等宽不成立、对齐无意义。
- 位数会浮动到 3 位时，槽宽按最大位数定死（这里 30px），别用 `min-width` 让列宽跟着内容跳。

CSS 前后对照（`client.js` 约 474 行）：

```css
/* 现状 */
.ol-resultBadge{
  flex:none; padding:2px 7px; border-radius:6px;
  font-size:11.5px; line-height:16px; font-weight:500;
  font-variant-numeric:tabular-nums;
  background:var(--dsw-alias-bg-layer-2, rgba(0,0,0,.05));
  color:var(--dsw-alias-label-secondary, #61666b);
}

/* 建议 */
.ol-resultNo{
  flex:none; width:30px; text-align:left;
  font-size:12px; line-height:16px; font-weight:500;
  font-variant-numeric:tabular-nums;
  color:var(--dsw-alias-label-secondary, #61666b);
}
.ol-resultNo .ol-hash{ font-size:11px; opacity:.72; margin-right:1px; }
.ol-resultItem[data-selected] .ol-resultNo{ font-weight:600; color:var(--dsw-alias-label-primary); }
body[data-ds-dark-theme] .ol-resultNo{ color:var(--dsw-alias-label-secondary, #c8c8c8); }
```

### 高亮（分档 + 变淡）

| 层 | 浅色 | 深色 | 说明 |
|---|---|---|---|
| 选中行底 | brand 6% | brand 12% | 只做"这一行在动"的提示 |
| 悬停行底 | brand 3% | brand 6% | 比选中再弱一档 |
| 命中 `mark` | brand 10%（1.16:1） | brand 20% | 底纹级，字重保持 500；10% 是 13px 小字仍可辨认的下限 |
| 选中行的 `mark` | brand 20%（1.40:1） | brand 34% | 活动命中更强——同浏览器"活动命中 vs 全部命中"的分档，2:1 的层级差 |

原则：行底 < 命中 < 选中行命中，三档不同时打满；`mark` 不再改 `font-weight`（CJK 加粗会把命中块压成一块墨）。

保持不动的：行高 48px、`padding: 0 10px 0 12px`、双行片段、`mark` 高亮、选中/悬停的 10%/6% 品牌色底。

## 5 方案 B：排布 = 文档序（升序）+ 就近定位

| 规则 | 内容 |
|---|---|
| R1 排序 | 结果恒定按轮次**升序**（= 文档序），输入变化不改变顺序，编号永远从小到大 |
| R2 定位 | 打开面板 / 结果集变化时：默认选中「距当前阅读轮次最近的那条命中」，并把它滚到列表第一行（`scroll-padding-top: 22px` + 锚点行 `block:"start"`）。上一条命中因此只露出**半行**（22px，顶部 6–8px 渐隐），"上面还有东西"由这条被切开的行表达，不写文字；锚点本身是第一条命中时不留任何空隙 |
| R3 位置信号 | **列表里不加任何提示行 / 分隔行 / 辅助文案。**"上面还有吗"交给半行 peek（有则露、无则无），"我在哪"交给右侧轨道刻度；列表只回答"有哪些命中、都是第几轮" |
| R4 键盘 | `↑` 往旧、`↓` 往新（沿列表顺序），`↵` 跳转，`esc` 关闭——不变 |
| R5 上限 | 50 条上限从"文档前 50 条"改成"**最近 50 条**"：从最近命中向两侧各取，被截断时顶部提示 `↑ 上方还有 12 条更早的命中`，footer 的 `仅显示前 50 条命中` 文案随之改写 |
| R6 数据 | 搜索侧需要知道"当前阅读轮次"：`navBridge.active`（`client.js` 1322 行）由轨道组件的 `active` 状态下发，`OutlineNav` 在 `active` 变化时 `navBridge.version += 1` |

代价（诚实列出）：

- 最新命中不再在首屏顶部。习惯"我刚说完的那轮"的用户要多滚一下；若后续需要，可加"跳到最新命中"的快捷键（不在本期，且不加提示行）。
- 需要把 `active` 从轨道下发到搜索侧（一处状态下发 + 一处 version 递增）。
- 默认选中从"第 0 行"变成"锚点行"：`setSel(0)`（2613 行）要改成锚点索引，且结果集变化时要重算而不是清零。

## 6 落地清单

| 位置（`lib/client.js`） | 改动 |
|---|---|
| 474 `.ol-resultBadge` | 按 §4 换成 `.ol-resultNo` + `.ol-hash`，删掉底色三件套；`mark` 与选中/悬停底色按上表调百分比 |
| 2566 `ResultRow` | 徽标拆两段：`<span class="ol-hash">#</span>` + 数字 |
| 1639 `searchScanSlice` | 仍从尾部扫（早停依赖它），但结果按 `n` 升序落盘；锚点索引在扫描完成时按 `Math.abs(n - active)` 计算（取最小，平手取更旧的一条） |
| 1613 `searchBuildFinish` / `searchRevalidate` | 把 `navBridge.active` 一并带进 `searchState`（新增 `anchor` 字段） |
| 2613 `setSel(0)` | 改成 `setSel(anchorIdx)`；锚点缺失（当前轮无命中）时回退到 0 |
| 1322 `navBridge` | 增加 `active: 0`；在 `active` 的 effect（2060 行附近）里 `navBridge.active = active` 并 `version += 1` |
| 261/269 `searchCapped` | 文案改为"最近 50 条命中" / "Nearest 50 matches"（不再有"前 50 条"的方向歧义） |
| 结果列表渲染 | 不加分隔行/提示行；列表只有 option 行 |

## 7 版本

`0.2.0 → 0.2.1`：编号样式 + 排序/定位修正，属于 UI 微调与行为修正，按工作区规则只升 patch。

## 8 参考

- Chromium `find_in_page.mojom`（match rects 的 DOM 序注释、`number_of_matches` / `active_match_ordinal`、`ActivateNearestFindResult`）：<https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/public/mojom/frame/find_in_page.mojom>
- Chrome 帮助「在网页中查找」原文：命中高亮 + 滚动条上的黄色刻度：<https://support.google.com/chrome/answer/95440>
- PDF.js `web/pdf_find_controller.js` 的 `#requestMatchesCount()`：`current` 由前面各页命中数累加得到（文档序）
- VS Code 文档：搜索结果按文件分组、文件内按行、`Sort By` 可切换
- Word 导航窗格搜索：结果按文档顺序、每行为上下文片段、点击跳转（Microsoft 支持文档口径）
