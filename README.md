<p align="right"><a href="README.md">简体中文</a> · <a href="README.en.md">English</a></p>

# dsh-ui-outline

长对话，不必来回翻。轨道随你摆，窄列也常驻，⌘F 搜当前对话。

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供的轮次导航轨与对话搜索。

<p align="center"><img src="docs/img/rail-hero.svg" width="700"></p>

## 导航轨，按你的阅读习惯摆放

轨道贴合会话列左侧或右侧边缘，两种刻度密度：**紧凑**轮次再多也放得下，**宽松**每轮一行、更易辨认。

点击条很宽，不必瞄准细线；按住拖动即可浏览。悬停显示该轮提问与回答的预览；在轨道上滚动滚轮可逐轮预览，点击后跳转。

## 列再窄，导航也不退场

拉开侧栏或分屏阅读时，官方轮次轨会收起，本轨默认仍在列边缘，快速跳转不中断。也可以在设置中改为窄列隐藏；收起后，列边缘会留下开关，随时可再打开。

## ⌘F / Ctrl+F，搜索当前对话

呼出 Spotlight 式搜索浮层：空查询是一条跑道形胶囊搜索条，键入首字即展开为结果卡片。分词匹配、命中高亮、上下文摘录；`↑` `↓` 选择、`↵` 跳转并在落点闪光、`Esc` 或点击浮层外关闭。长对话不卡顿。

预览卡与搜索浮层支持不透明、毛玻璃和液态玻璃三种外观。

<details>
<summary><b>交互细节</b></summary>

- 刻度密度：紧凑 10px 间距（超出后轨道内滚动），宽松每轮 30px 行高；点击条 44px 宽，吸附最近轮次。
- 滚轮步进：空查询起点为当前轮，逐轮预览，会话不动；点击提交跳转。
- 搜索浮层：胶囊高 52px，折叠与展开共用 26px 圆角（G2 连续曲率超椭圆端）；命中上下文前后各 30 字；首次打开后台分片建索引，输入 60ms 防抖，展示最新 50 条命中。
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

在 **插件 → dsh-ui-outline** 中调整。

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
