> **现状（2026-11）**：主 README 不再嵌 47 秒成片，改用真实界面的首屏拼盒 + 两段 GIF
> （`../docs/img/board*.webp`、`loop-*.gif`）。本目录保留**采集管线**：在隔离的 `$DSH_HOME`
> 里起一份真实 dsh web，抓静图/动图，再合成拼盒。成片文件（av1/h264/gif/poster）与 GitHub Pages
> 播放页已随 0.2.2 从仓库移除。

# 采集管线

真实界面 · 2x 设备像素比 · 中英两套会话语料 · 产物 <300 KB。

## 重建

依赖：`dsh >= 0.2.0`、Node 20+、`magick`（ImageMagick 7）、`/usr/sbin/chromium`
（或 `CHROME_PATH`），Playwright 由 `video/node_modules` 提供。

```sh
cd outline/video
npm install

# 1. 隔离的 $DSH_HOME + 36 轮演示会话（不碰 ~/.dsh）；--lang=en 换英文语料
node tools/seed-demo.mjs

# 2. 起 demo 服务（token 从日志里取，脚本读 .work/server2.log）
cd .work && DSH_HOME=$PWD/dsh-home nohup dsh web --no-open --port 7418 > serverN.log 2>&1 &
sleep 12 && cp serverN.log server2.log && cd ..
```

```sh
# 3. 截图：hero / 三种材质 / ⌘F 结果卡，或滚轮与搜索两段 GIF 的逐帧
node tools/visuals.mjs --take=stills   # 或 --take=loops；--lang=en 出 -en 后缀
# 4. 合成 880×635 拼盒并重编码 GIF
node tools/build-readme-visuals.mjs    # 或 --lang=en
```

产物写入 `../docs/img/`。中文与英文各一套：`--lang=en` 的输出带 `-en` 后缀，
`README.en.md` 引用英文那一套。

## 说明

- `seed-demo.mjs` 只写 `.work/dsh-home`：重建一个仅含 `dsh-base`、`dsh-web-app`、
  `dsh-ui-outline` 的 profile，并写入一段真实的 v4 JSONL 会话（header 帧 + 追加帧，无模型调用）。
  语料来自 `demo/transcript.mjs`（中）与 `demo/transcript.en.mjs`（英），均为合成的 36 轮技术讨论。
- `.work/` 全是可丢弃的中间文件（演练 home、截图、逐帧、拼盒切片），已在 `.gitignore` 里。
- **材质瓦片来自真实配置**：脚本点开设置卡里的材质与预设（毛玻璃=清透，液态玻璃=标准），
  模糊半径、`saturate()`、veil 底色与投影都从运行时 computed style 读取，不手写数值。
- **模糊换算**：CSS `blur(r)` 的高斯标准差是 `r/2`（CSS px），2x 截图上对应的 ImageMagick
  sigma 正好是 `r`，写成 `2r` 会把背景糊成白纸。
- **选位**：`materialCard()` 先量每个刻度卡片的真实高度，再按「模糊后仍是正文的行覆盖率」
  打分（粗扫 200px → 三处邻域 12px 精扫），最后验证该刻度确实渲染出卡片才落定。
- **滚动**：这套应用的虚拟滚动不认 `element.scrollTop = t`，必须用滚轮（`gotoScroll()`），
  否则每次扫描拍到的都是同一屏。
- **圆角**：卡片只在圆角内不透明，包围盒四角的缺口会漏出清晰正文字形，瓦片最后按真实
  18.4px 圆角做遮罩并压白（`maskCorners()`）。
- 找不到 Chromium 时：`CHROME_PATH=/path/to/chrome node tools/visuals.mjs ...`。

## 已废弃：47 秒成片流水线

`tools/record-hq.mjs`、`tools/cards-hq.mjs`、`tools/captions-hq.mjs`、`tools/build-hq.mjs`
（以及更早的 `record.mjs` / `build-video.mjs`）是上一版 1920×1080 AV1 成片的流水线，脚本仍在，
但成片文件与播放页已从仓库删除；需要时按脚本顺序自行重建，依赖 `ffmpeg`（含 `libsvtav1`）。
