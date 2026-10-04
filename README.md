<p align="right"><a href="README.md">简体中文</a> · <a href="README.en.md">English</a></p>

# dsh-ui-outline

<p align="center"><img src="docs/img/rail-hero.svg" width="700" alt="dsh-ui-outline"></p>

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh 0.2.1) web 端提供的轮次导航轨道（桌面端复用同一 web client）。贴合会话列边缘，居中于阅读带，列宽不足 900px 自动隐藏。44px 宽点击条吸附最近轮次，支持拖拽擦洗。

- **刻度密度**：紧凑 `compact`（官方 10px 间距，超出后内部滚动）或宽松 `loose`（每轮 30px 行高）。
- **预览材质**：`none`（官方不透明卡片）、`frost`（默认毛玻璃：雾感面纱 + 亮边描边 + 额外虚化）、`liquid`（液态玻璃薄透镜：同款亮边 + 微虚化，透底无反光，无 SVG）。

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

*插件 → dsh-ui-outline*。默认：右侧、紧凑、毛玻璃（透明度 80，模糊 6）。液态玻璃标准是透明度 75、模糊 4。清透 / 标准 / 朦胧会一次写入两项，不会闪出自定义滑条。

## 许可

MIT © iluluyu
