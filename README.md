<p align="right"><a href="README.md">简体中文</a> · <a href="README.en.md">English</a></p>

# dsh-ui-outline

长对话，不必来回翻。轨道随心摆放，窄列依然常驻，⌘F 即刻搜索。

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 打造的轮次导航轨与会话搜索。

<p align="center"><img src="https://raw.githubusercontent.com/iluluyu/dsh-ui-outline/main/docs/img/rail-hero.svg" width="700" alt="dsh-ui-outline 导航轨与毛玻璃预览总览"></p>

[安装](#安装) · [设置](#设置)

## 导航轨，按你的阅读习惯摆放

轨道贴合会话列边缘，停靠左缘或右缘完全由你决定。两种刻度密度各展所长：**宽松**排布刻度疏朗直观、轮次一眼可数；**紧凑**排布则能将上百轮对话容纳于一屏，超出后亦可在轨内平滑滚动。整条轨道具宽域磁吸，无需费力瞄准细线；随手点击或按住拖动，皆可连续自如地穿梭其间。

<p align="center"><img src="https://raw.githubusercontent.com/iluluyu/dsh-ui-outline/main/docs/img/rail-placement.svg" width="640" alt="左侧宽松与右侧紧凑两种排布场景"></p>

## 悬停预览，滚轮速览

鼠标拂过刻度，玻璃预览卡便浮现该轮的提问与回答，不必跳转即可确认上下文。在轨道上滑动滚轮可逐轮步进：虚线游标与预览卡紧随指尖移动，而**当前正在阅读的会话主体始终原地不动**。锁定目标后轻点或回车直达，落点伴有闪光指示——先探查、再落定，长对话里无需反复翻页。

<p align="center"><img src="https://raw.githubusercontent.com/iluluyu/dsh-ui-outline/main/docs/img/rail-interactions.svg" width="640" alt="悬停预览卡与滚轮逐轮步进：会话原地待命，游标与预览随心漫游"></p>

## 列再窄，导航也不退场

分屏阅读或展开侧栏时，会话列常被大幅压缩，原生导航往往随之隐去；而本轨默认贴靠列边缘坚守，快速跳转永不中断。若偏好极致沉浸的阅读视野，亦可在设置中设为窄列隐藏。收起后列缘仍会留存一枚克制的开关，随时轻点即可再次唤出。

## ⌘F / Ctrl+F，搜索当前对话

按下快捷键唤出 Spotlight 搜索条；键入字符瞬间，跑道胶囊顺着固有圆角向下平滑生长为玻璃结果卡片。支持空格分词 AND 检索与中英混排，命中的上下文词块精准高亮，并全程由纯键盘高效驱动（`↑` `↓` 切换、`↵` 闪光跳转、`Esc` 退出）。后台分片构建索引杜绝输入卡顿，且搜索浮层与预览卡同样支持毛玻璃、液态玻璃及不透明等多种材质实时切换。

三种材质并排看：不透明、毛玻璃、液态玻璃——同一轮内容，不同质感。

<p align="center"><img src="https://raw.githubusercontent.com/iluluyu/dsh-ui-outline/main/docs/img/material-comparison.svg" width="640" alt="none / frost / liquid 三种材质对比"></p>

<p align="center"><img src="https://raw.githubusercontent.com/iluluyu/dsh-ui-outline/main/docs/img/search-spotlight.svg" width="640" alt="胶囊搜索条沿同等圆角向下生长为玻璃结果卡片"></p>

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
