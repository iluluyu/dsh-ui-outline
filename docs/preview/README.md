# README 预览页

本地渲染 `README.md` / `README.en.md`，用来检查改动前后的可读性与图片衔接。不参与 npm 打包（`docs/` 不在 `files` 里）。

```sh
# 在仓库根目录
python3 -m http.server 8931
# 打开 http://127.0.0.1:8931/docs/preview/
```

- 顶部可切换 **中文 / English** 与 **新版 / 旧版**；旧版取自当前 git HEAD 的 README，用于对比。
- 左侧目录、正文字号与表格样式都按 GitHub 阅读宽度设计；主图与动图就是 README 的同名资源。
- 首屏 `docs/img/board.webp` 是 880×635、2x 的实拍拼盒：左上轨道+预览卡（刻度在左、空白底）、右上三种材质（1:1 不缩放）、底部 ⌘F 搜索。

## 资源从哪来

真实界面截图与动图由 `video/tools/visuals.mjs` 采集（独立的 `.work` 演示会话，不碰真实数据），`video/tools/build-readme-visuals.mjs` 负责裁切、压成 WebP、编码 GIF 并渲染拼盒：

```sh
cd video
node tools/seed-demo.mjs
DSH_HOME="$PWD/.work/dsh-home" dsh web --no-open --port 7418 &
node tools/visuals.mjs
node tools/build-readme-visuals.mjs
```

产物写入 `docs/img/`：`board.webp`（由 `board.html` 合成）、`loop-rail.gif`、`loop-search.gif`，以及拼盒用的 2x 切片。
