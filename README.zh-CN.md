<p align="right">English · <a href="README.md">简体中文</a></p>

<h1><img src="docs/img/logo-marks.svg" width="26" alt="" valign="-4"> dsh-ui-outline</h1>

> 为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）web 端打造的轮次导航轨道——官方 TurnNavigator 设计语言，加上官方轨道没有给你的选择。

<p align="center">
  <img src="docs/img/rail-hero.svg" width="760" alt="会话旁的轨道：悬停刻度伸至全长并带动邻近波浪，毛玻璃预览卡片展示该轮的提问与回答">
</p>

## 为什么

- **官方基因。** 轨道贴会话列边缘（details 面板打开也不冲突），垂直居中于实时阅读带，列宽低于 900px 一同隐藏——与官方导航一致。颜色、圆角、阴影、动效全部实时读取宿主设计 token。
- **会呼吸的刻度语言。** 静息时刻度齐平等长；当前轮仅以颜色高亮；悬停伸展全长并带动邻近波浪。一套语言、两种密度——`compact` 紧凑（14px 间距，整段历史尽收眼底）或 `loose` 宽松（每轮真实 30px 行高）。
- **宽容的输入。** 44px 宽点击条，点击附近自动吸附到最近可见轮次——不必精确点中 2px 横线。拖拽可擦洗整个会话；点击到达有轻量落点闪烁，快速擦洗不残留动画。
- **认真的玻璃。** 单轮预览卡片三种质感：`none`（官方不透明 token）、`frost` 毛玻璃（默认）、`liquid` 液态玻璃（光从朝向会话的角落柔和射入）。支持的浏览器圆角升级为 G2 连续曲率（`corner-shape: squircle`，与官方 10px 半径对角线等效），外圈为均匀 1px 环。纯 CSS——绝不让页面溢出。
- **一等公民的设置。** 位于 *设置 → 插件 → 插件配置*，持久化到宿主设置文档——偏好跟随你跨浏览器、跨机器。不是 localStorage。
- **比影子还便宜。** 滚动每帧只读一次矩形加一次二分查找；所有动画仅走合成器；指针移动合帧处理；静止大纲在阅读期间零渲染。
- **绝不双轨。** 本轨道启用时官方轨道退位；轮次少于 2（官方最小值）时本轨道退位、官方回归。

## 安装

需要 dsh ≥ `0.1.0-rc.7`（keyed 插件设置槽位 + 开放设置命名空间）。

```sh
dsh plugin --profile web add dsh-ui-outline
```

重启 `dsh web` 并刷新页面。更新：`dsh plugin --profile web update dsh-ui-outline`；卸载：`dsh plugin --profile web remove dsh-ui-outline`。

## 设置

三项均实时生效并持久化到宿主设置文档：

| 设置 | 选项 | 默认 |
|:--|:--|:--|
| **位置** | 右侧 · 左侧 | 右侧 |
| **预览材质** | 无 · 毛玻璃 · 液态玻璃 | 毛玻璃 |
| **刻度分布** | 紧凑 · 宽松 | 紧凑 |

<p align="center">
  <img src="docs/img/mark-language.svg" width="760" alt="紧凑为 14px 间距加比例压缩；宽松为每轮 30px 行高；44px 点击条把点击吸附到最近刻度">
</p>

设置卡片中英双语、跟随应用语言。设置命名空间为 `outline`；手动覆盖形如 `~/.dsh/settings.yaml` 中的 `outline: { side: left, material: frost, layout: loose }`。

## 性能

- **阅读零开销。** 滚动每帧仅一次矩形读取，在缓存的轮次偏移上二分查找，仅当会话 DOM 变化时重填。
- **流式不泛涟漪。** 未变化的行复用对象；静止的大纲阅读期间零渲染。摘要读 `textContent` 而非触发强制重排的 `innerText`，且每轮只读最新一步。
- **纯合成器动画。** 波浪、预览卡滑移、所有入场只动 `transform`/`opacity`——动画坐标会让固定轨道每帧重排，所以什么都不这么做。
- **指针合帧。** 指针移动合并为每动画帧一次“先读后写”，无论指针设备频率多高，擦洗都是 O(1) 次布局。
- **天然受控。** 轨道位于点击穿透浮层内、`position: fixed`：不可能撑出页面或产生滚动条。

## 设计说明

- 设计 token（`--dsw-alias-*`）优先实时读取宿主页面、官方首帧兜底值备用，主题切换与未来 token 更新自动跟随。
- 轨道锚点、阅读带几何、预览交互跟随官方 TurnNavigator。刻度语言（齐平静息 + 颜色高亮 + 波浪）与 14/30px 密度分层是本插件自己的取舍。
- G2 圆角：`corner-shape: squircle` 18.4px 半径——与官方 10px G1 圆弧对角线等效（实测 Chrome squircle 为 superellipse(4)）。不支持的浏览器回退官方 10px。
- 全程尊重减少动态效果偏好。

## 致谢与许可

- 设计语言参考：官方 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 中的 **TurnNavigator**（MIT，© DeepSeek）——经过测量与尊重；本插件实现为原创，未复制任何代码。
- 运行于 dsh 之上，依赖 **cordis**（插件宿主）与 **React**（运行时由宿主提供）；设置 schema 使用 **@deepseek-ai/schemastery**（MIT）。
- 本插件捆绑产物不含任何第三方代码。所涉组件均为 MIT；除保留你已在运行的软件自身的许可声明外，无传递性许可义务。

MIT © iluluyu

## 开发

零构建：`lib/` 既是源码也是产物。轮次发现基于 DOM data 属性，与快照 API 解耦；几何直接从滚动容器读取官方 CSS 变量。

```sh
git clone https://github.com/iluluyu/dsh-ui-outline
npm run check        # 语法检查
```

| 文件 | 职责 |
|:--|:--|
| `cordis.yml` | bundle patch：向 Web profile 注入一行 loader |
| `lib/index.js` | node 侧：注册 `outline` 设置命名空间 |
| `lib/client.js` | 浏览器侧：轨道 + 预览卡（注入 `shell.overlay`）与设置卡片（注入 `settings.plugin.item`） |

本地开发：profile 依赖指向工作副本（`"dsh-ui-outline": "link:/path/to/outline"`，双侧 `pnpm install`），重启 `dsh web` 后强制刷新。
