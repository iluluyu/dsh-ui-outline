<p align="right"><a href="README.md">简体中文</a> · <a href="README.en.md">English</a></p>

# dsh-ui-outline

长对话，不必来回翻。轨道随你摆，窄列也常驻，⌘F 搜当前对话。

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供的轮次导航轨与对话搜索。

<p align="center"><img src="docs/img/rail-hero.svg" width="700" alt="dsh-ui-outline 总览"></p>

[安装](#安装) · [设置](#设置)

## 导航轨，按你的阅读习惯摆放

轨道贴合会话列边缘，停靠左侧或右侧由你选择，两种刻度密度各有取舍：

- **紧凑 `compact`**：10px 间距，几十上百轮也放得下，超出后轨道内滚动。停靠与密度可独立选择。
- **宽松 `loose`**：每轮 30px 行高，刻度疏朗、一眼可数。

点击条 44px 宽并吸附最近轮次，不必瞄准细线；按住拖动即可连续浏览。

<p align="center"><img src="docs/img/rail-placement.svg" width="640" alt="左/右停靠与紧凑/宽松密度"></p>

## 悬停预览，滚轮速览

悬停任意刻度，该轮的提问与最终回答以一张玻璃质感预览卡浮现在轨道旁——不用跳过去就能确认这是不是要找的那一轮。

在轨道上滚动滚轮则逐轮步进：波浪与预览卡跟随游标移动，**会话本身不动**；找到目标，点击（或聚焦后回车）才跳转，落点有闪光提示。先浏览、后确认，长对话里的往返翻页明显减少。

<p align="center"><img src="docs/img/rail-interactions.svg" width="640" alt="悬停预览、滚轮逐轮预览与点击跳转"></p>

## 列再窄，导航也不退场

拉开侧栏或分屏阅读时，官方轮次轨会收起，本轨默认仍在列边缘，快速跳转不中断。也可以在设置中改为窄列隐藏；收起后，列边缘会留下开关，随时可再打开。

## ⌘F / Ctrl+F，搜索当前对话

呼出 Spotlight 式搜索浮层：空查询时是一条跑道形胶囊搜索条，键入首字即向下展开为结果卡片。

- **分词 AND 匹配**：空格分词、全部命中才算数，中英文皆可。
- **命中高亮**：每条结果给出该轮提问/回答的上下文摘录（前后各 30 字），命中词块高亮。
- **键盘优先**：`↑` `↓` 选择，`↵` 跳转并在落点闪光，`Esc` 或点击浮层外关闭。
- **长对话不卡顿**：索引后台分片构建，输入防抖，展示最新 50 条命中。

预览卡与搜索浮层支持不透明、毛玻璃和液态玻璃三种外观，材质与参数实时可调。

<p align="center"><img src="docs/img/search-spotlight.svg" width="640" alt="胶囊搜索条展开为结果卡片"></p>

<details>
<summary><b>交互细节</b></summary>

- 搜索浮层胶囊高 52px，折叠与展开共用 26px 圆角，形变是纯高度生长、圆角全程不动。
- 滚轮步进：空查询起点为当前轮；100 归一化滚动单位/轮，150ms 静止清零余量；拖拽/聚焦即时接管游标。
- 输入 60ms 防抖 + 分片扫描，首字符到结果的延迟与对话长度基本无关。
- 液态玻璃搜索浮层的实际模糊不低于 10px，保证文字可读性。

</details>

## 安装

需要 dsh `>= 0.2.0-rc.1`。支持网页端，以及复用同一 web client 的桌面端。

```sh
dsh plugin --profile web add dsh-ui-outline
```

安装后重启 `dsh web` 并刷新页面。

<details>
<summary><b>其他安装方式</b></summary>

```sh
dsh plugin --profile web add github:iluluyu/dsh-ui-outline
dsh plugin --profile web add .   # 在插件目录下执行；相对路径以当前执行位置为准
dsh plugin --profile web add file:/absolute/path/to/plugin
```

卸载：`dsh plugin --profile web remove dsh-ui-outline`。

</details>

## 设置

在 **插件 → dsh-ui-outline** 中调整，全部即时生效。

| 设置 | 选项与默认值 |
| --- | --- |
| 停靠边缘 | 左侧 / 右侧；默认右侧 |
| 刻度密度 | 紧凑 `compact` / 宽松 `loose`；默认紧凑 |
| 预览材质 | 不透明 `none` / 毛玻璃 `frost` / 液态玻璃 `liquid`；默认毛玻璃 |
| 窄列显示 | 显示 / 隐藏；默认显示 |

<details>
<summary><b>材质参数</b></summary>

毛玻璃默认透明度 **80**、模糊 **6**；液态玻璃更薄透，标准预设为透明度 **75**、模糊 **4**。**清透 / 标准 / 朦胧**预设一次更新两项，不闪出自定义滑条。搜索浮层跟随预览材质设置。

</details>

## 许可

MIT © iluluyu
