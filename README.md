<p align="right"><a href="README.md">简体中文</a> · <a href="README.en.md">English</a></p>

# dsh-ui-outline

<p align="center"><img src="docs/img/rail-hero.svg" width="700" alt="dsh-ui-outline"></p>

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh 0.2.1) web 端提供的轮次导航轨道（桌面端复用同一 web client）。贴合会话列边缘，居中于阅读带。列宽不足 900px（右侧面板、并排浏览器窗口）时官方轨会收起，本轨道默认仍留在边缘，方便跳转；设置或列边缘开关可以改回收起。44px 宽点击条吸附最近轮次，支持拖拽擦洗。

- **刻度密度**：紧凑 `compact`（官方 10px 间距，超出后内部滚动）或宽松 `loose`（每轮 30px 行高）。
- **预览材质**：`none`（官方不透明卡片）、`frost`（默认毛玻璃：雾感面纱 + 亮边描边 + 额外虚化）、`liquid`（液态玻璃薄透镜：同款亮边 + 微虚化，透底无反光，无 SVG）。
- **对话搜索**：`⌘F` / `Ctrl+F` 呼出类 Spotlight 居中搜索浮层，实时检索全部轮次的提问与最终回答（分词 AND、命中词高亮、±30 字上下文），材质跟随预览卡设置；↑↓ 选择、↵ 跳转落地闪光、esc 或点外关闭。长对话不卡顿：首次打开后台分片建索引，扫描切片 + 60ms 防抖，最多展示最新 50 条命中。

## 安装

需要 dsh `0.2.1`。

```sh
dsh plugin --profile web add dsh-ui-outline
dsh plugin --profile web add github:iluluyu/dsh-ui-outline
dsh plugin --profile web add .   # 插件目录下执行（相对路径相对当前执行位置）
dsh plugin --profile web add file:/absolute/path/to/plugin
```

重启 `dsh web` 并刷新页面。卸载：`dsh plugin --profile web remove dsh-ui-outline`。

## 设置

*插件 → dsh-ui-outline*。默认：右侧、紧凑、毛玻璃（透明度 80，模糊 6）、窄列显示。液态玻璃标准是透明度 75、模糊 4。清透 / 标准 / 朦胧会一次写入两项，不会闪出自定义滑条。窄列选「隐藏」后，会话列窄于 900px 时跟官方轨一起收起，列边缘留开关可再打开。

## 许可

MIT © iluluyu
