<p align="right"><a href="README.md">简体中文</a> · <a href="README.en.md">English</a></p>

# dsh-ui-outline

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh 0.2.1) 提供可自定义的轮次导航轨与对话搜索，方便在长对话中快速定位。web 端与桌面端（复用同一 web client）均可使用。

<p align="center"><img src="docs/img/rail-hero.svg" width="700"></p>

## 导航轨，按你的阅读习惯摆放

轨道贴合会话列左侧或右侧边缘，提供两种刻度密度：

- **紧凑 `compact`**：10px 间距，轮次较多时在轨道内滚动。
- **宽松 `loose`**：每轮 30px 行高，刻度更疏朗。

44px 宽的点击条会吸附到最近轮次，不必精确点中细线；按住拖拽即可擦洗浏览。悬停时显示该轮提问与回答的简短预览；在轨道上滚动滚轮可逐轮步进预览（波浪与预览卡跟随，会话不动），点击提交跳转。

## 窄列里，也能快速跳转

拉开侧栏或分屏阅读时，会话列可能窄于 900px。此时官方轮次轨会收起，本插件默认仍在列边缘显示，保留快速跳转入口。

也可以在设置中改为窄列隐藏；收起后，列边缘会留下开关，随时可再打开。

## ⌘F / Ctrl+F，搜索当前对话

按 `⌘F` / `Ctrl+F` 呼出类 Spotlight 搜索浮层。空查询时是一条高 52px 的跑道形 G2 胶囊横条，两端为 26px 半超椭圆；键入首字后，横条向下展开为卡片，圆角始终保持 26px。

搜索覆盖当前对话各轮的提问与最终回答：

- **按空白分词，AND 匹配**：所有关键词都需命中。
- **命中高亮**：展示命中处前后各 30 字的上下文。
- **键盘操作**：`↑` / `↓` 选择，`↵` 跳转并在落点闪光提示，`Esc` 或点击浮层外关闭。
- **长对话处理**：首次打开时后台分片建索引，检索分片扫描，并以 60ms 防抖减少输入卡顿；最多展示最新 50 条命中。

预览卡与搜索浮层可选毛玻璃 `frost` 或液态玻璃 `liquid`，也可保留官方不透明外观。

## 安装

需要 dsh `0.2.1`。

以下安装方式任选其一：

```sh
dsh plugin --profile web add dsh-ui-outline
dsh plugin --profile web add github:iluluyu/dsh-ui-outline
dsh plugin --profile web add .   # 在插件目录下执行；相对路径以当前执行位置为准
dsh plugin --profile web add file:/absolute/path/to/plugin
```

安装后重启 `dsh web`，再刷新页面。

卸载：`dsh plugin --profile web remove dsh-ui-outline`。

web 端与 DeepSeek Harness 桌面端（复用同一 web client）均可使用。

## 设置

在 **插件 → dsh-ui-outline** 中调整。

| 设置 | 选项与默认值 |
| --- | --- |
| 停靠边缘 | 左侧 / 右侧；默认右侧 |
| 刻度密度 | 紧凑 `compact` / 宽松 `loose`；默认紧凑 |
| 预览材质 | 不透明 `none` / 毛玻璃 `frost` / 液态玻璃 `liquid`；默认毛玻璃 |
| 窄列显示 | 显示 / 隐藏；默认显示 |

毛玻璃默认透明度 **80**、模糊 **6**，以雾感面纱、亮边与额外虚化柔化背景。液态玻璃采用更薄透的外观，标准预设为透明度 **75**、模糊 **4**。

**清透 / 标准 / 朦胧**预设会一次更新透明度与模糊两项，不会在切换时闪出自定义滑条。搜索浮层跟随预览材质设置；液态玻璃搜索浮层的实际模糊至少为 **10px**，以保证文字可读性。

窄列选「隐藏」后，会话列宽度低于 **900px** 时轨道收起；列边缘开关可再次打开，并同步更新该设置。

## 许可

MIT © iluluyu
