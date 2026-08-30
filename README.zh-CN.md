<p align="right"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a></p>

<h1><img src="docs/img/logo-marks.svg" width="26" alt="" valign="-4"> dsh-ui-outline</h1>

> 为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）web 端打造的轮次导航轨道——沿用官方 TurnNavigator 的设计语言，同时把官方没给你的选择权交还给你。

<p align="center">
  <img src="docs/img/rail-hero.svg" width="760" alt="会话旁的轨道：悬停时刻度伸至全长、带动邻近波浪，玻璃预览卡展示该轮的提问与回答">
</p>

## 为什么

- **与官方同源。** 轨道贴合会话列边缘（打开 details 面板也不冲突），垂直居中于当前阅读带，列宽不足 900px 时自动隐藏——这些行为与官方导航逐项一致。颜色、圆角、阴影、动效全部实时读取宿主设计 token。
- **一套会呼吸的刻度。** 平时所有刻度等长对齐，当前轮只用颜色点亮；指针扫过时目标刻度伸至全长，邻近刻度随之起伏。两种密度、同一套语言——`compact` 紧凑（14px 间距，整段历史一屏可见）或 `loose` 宽松（每轮独占 30px 行高）。
- **点击不挑位置。** 44px 宽的点击条上，点下即吸附到最近的可见轮次——不必瞄准那根 2px 细线。按住拖动即可擦洗整段会话；跳转落点轻闪一下即止，快速擦洗不留残影。
- **玻璃做足了细节。** 预览卡三种质感任选：`none`（官方不透明 token）、`frost` 毛玻璃（默认）、`liquid` 液态玻璃——光从朝向会话的角落斜入。支持的浏览器上圆角升级为 G2 连续曲率（`corner-shape: squircle`，与官方 10px 圆弧对角线等效），外圈是一圈均匀的 1px 环。全部纯 CSS，绝不撑破页面。
- **设置是一等公民。** 位于 *设置 → 插件 → 插件配置*，写入宿主设置文档——换浏览器、换机器，偏好都在。不走 localStorage。
- **开销低到可以忽略。** 滚动每帧只读一次矩形、做一次二分查找；动画全部走合成器；指针移动合帧处理；大纲静止时，阅读期间零渲染。
- **永不双轨。** 本轨道在场时官方导航自动退位；轮次不足 2（官方最小值）时本轨道让位、官方导航回归。

## 安装

需要 dsh ≥ `0.1.0-rc.7`（keyed 插件设置槽位 + 开放的设置命名空间）。

```sh
dsh plugin --profile web add dsh-ui-outline
```

重启 `dsh web` 后刷新页面即可。更新：`dsh plugin --profile web update dsh-ui-outline`；卸载：`dsh plugin --profile web remove dsh-ui-outline`。

## 设置

三项均即时生效，并写入宿主设置文档：

| 设置 | 选项 | 默认 |
|:--|:--|:--|
| **位置** | 右侧 · 左侧 | 右侧 |
| **预览材质** | 无 · 毛玻璃 · 液态玻璃 | 毛玻璃 |
| **刻度分布** | 紧凑 · 宽松 | 紧凑 |

<p align="center">
  <img src="docs/img/side-mirror.svg" width="760" alt="轨道随位置设置左右镜像：刻度锚点、卡片开口与玻璃光照同步翻转">
</p>

<p align="center">
  <img src="docs/img/materials.svg" width="760" alt="预览卡三种材质：无（官方不透明 token）、毛玻璃（模糊透底）、液态玻璃（角光加内缘）">

<p align="center">
  <img src="docs/img/mark-language.svg" width="760" alt="紧凑为 14px 间距的等长刻度；宽松为每轮 30px 行高，同一套刻度语言">
</p>

<p align="center">
  <img src="docs/img/hit-strip.svg" width="760" alt="两帧说明：点击落在 44px 点击条内任意位置，最近一刻度伸长接住点击，不必瞄准 2px 细线">
</p>

设置卡片中英双语、跟随应用语言。设置命名空间为 `outline`；也可以在 `~/.dsh/settings.yaml` 手动覆盖，例如 `outline: { side: left, material: frost, layout: loose }`。插件的 `cordis.yml` 里另有一个 `config:` 块——它垫在用户文档之下，供 profile 管理者钉住全局默认值，个人设置永远优先。

## 性能

- **阅读时零负担。** 滚动每帧只读取一次矩形，在缓存的轮次偏移上二分定位，仅当会话 DOM 变化时才重建。
- **流式更新不起涟漪。** 未变化的行直接复用；静止的大纲在阅读期间一次都不重绘。摘要读取 `textContent`（而非会触发强制重排的 `innerText`），且每轮只看最新一步。
- **动画全在合成器。** 波浪、预览卡滑移、所有入场只动 `transform` 和 `opacity`——动画坐标会让固定定位的轨道每帧重排，所以一处也不用。
- **指针移动合帧。** 无论指针设备报点频率多高，都合并为每动画帧一次“先读后写”，擦洗期间的布局读取恒为 O(1)。
- **天生守规矩。** 轨道躺在可点击穿透的浮层内、`position: fixed`——既撑不宽页面，也不会多出滚动条。

## 设计说明

- 设计 token（`--dsw-alias-*`）优先从宿主页面实时读取，官方首帧值兜底——主题切换、未来的 token 调整都自动跟上。
- 轨道锚点、阅读带几何、预览交互对齐官方 TurnNavigator；刻度语言（等长静息 + 颜色高亮 + 波浪）与 14/30px 两档密度是本插件自己的取舍。
- G2 圆角：18.4px 的 `corner-shape: squircle`——与官方 10px G1 圆弧对角线等效（实测 Chrome 的 squircle 即 superellipse(4)）；不支持的浏览器回落官方 10px 圆角。
- 全程尊重系统的“减少动态效果”偏好。

## 致谢与许可

- 设计语言跟随官方 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 中的 **TurnNavigator**（MIT，© DeepSeek）：轨道几何、阅读带居中与隐藏阈值一并对齐官方行为。
- 刻度的邻域波浪（悬停时邻近刻度随距离衰减伸长）与拖拽擦洗，参考了 **OpenAI ChatGPT 桌面版**（Codex desktop）内置的浮动轮次导航轨道。
- 液态玻璃的“高光与折射分层”手法，参考了 [DevBehindYou/LiquidLens](https://github.com/DevBehindYou/LiquidLens) 与 [tomagranate/liquid-glass](https://github.com/tomagranate/liquid-glass)（均 MIT）；本插件的实现为纯 CSS，未使用位移滤镜。
- 运行于 dsh 之上：插件宿主为 **cordis**，React 运行时由宿主提供；设置 schema 基于 **@deepseek-ai/schemastery**（MIT）。
- 捆绑产物不含第三方代码，无传递性许可义务。

MIT © iluluyu

## 开发

零构建：`lib/` 既是源码也是产物。轮次发现基于 DOM data 属性、与快照 API 解耦；几何信息直接从滚动容器读取官方 CSS 变量。

```sh
git clone https://github.com/iluluyu/dsh-ui-outline
npm run check        # 语法检查
```

| 文件 | 职责 |
|:--|:--|
| `cordis.yml` | bundle patch：向 Web profile 注入一行 loader |
| `lib/index.js` | node 侧：注册 `outline` 设置命名空间 |
| `lib/client.js` | 浏览器侧：轨道 + 预览卡（注入 `shell.overlay`）与设置卡片（注入 `settings.plugin.item`） |

本地开发：profile 依赖指向工作副本（`"dsh-ui-outline": "link:/path/to/outline"`，两侧各跑 `pnpm install`），重启 `dsh web` 后强制刷新。

---

**关键词**：dsh 插件 · dsh plugin | DeepSeek Harness 插件 · deepseek-harness | 轮次导航 · turn navigation | 对话导航 · thread navigator | 会话大纲 · conversation outline | 目录 · table of contents | 对话记录 · chat history | 侧边栏导航条 · sidebar rail | 玻璃拟态 · glassmorphism | 毛玻璃 · frosted glass | 液态玻璃 · liquid glass | 背景滤镜 · backdrop filter
