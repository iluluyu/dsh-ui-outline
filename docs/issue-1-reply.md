# Issue #1 reply — draft (post after push + release)

Issue #1: request for a left-side rail via a side config.

Reply with both languages in one comment (English first, Chinese below). Left side is a first-class product setting — keep the reply framed on our own feature set.

---

**English**

Left side is here — shipped in [`0.0.2`](https://github.com/iluluyu/dsh-ui-outline/releases/tag/v0.0.2) 🎉

Open **Settings → Plugins → Plugin configuration → dsh-ui-outline** and set **Side** to **Left**. The marks and the preview card mirror automatically, the light on the glass card flips to the conversation-facing corner, and the preference persists in your host settings document (it follows you across browsers and machines). You can also pin it manually: `outline: { side: left }` in `~/.dsh/settings.yaml`.

0.0.2 also grew up around this request — same release:

- an official settings card (side / preview material / mark layout), replacing the old localStorage approach;
- a forgiving 44px hit strip that snaps clicks to the nearest turn, plus drag-to-scrub across the whole conversation;
- frosted / liquid-glass preview materials with G2 squircle corners, still following the official design tokens;
- a performance pass — every animation is compositor-only, scroll tracking costs one rect + a binary search per frame.

Welcome aboard, and thank you for the nudge — requests like this one shaped the whole settings layer. Anything else you'd want the rail to do (or do differently), please open another issue.

**中文**

左侧布局已支持——随 [`0.0.2`](https://github.com/iluluyu/dsh-ui-outline/releases/tag/v0.0.2) 发布 🎉

打开 **设置 → 插件 → 插件配置 → dsh-ui-outline**，把 **位置** 切到 **左侧** 即可。刻度与预览卡片会自动镜像，玻璃卡的光照也换到朝向会话的角落；偏好持久化在宿主设置文档中（跨浏览器、跨机器跟随）。也可以手动固定：`~/.dsh/settings.yaml` 里写 `outline: { side: left }`。

围绕这个需求，0.0.2 还一起完成了：

- 官方设置卡片（位置 / 预览材质 / 刻度分布），取代旧的 localStorage 方案；
- 44px 宽容点击条——点击自动吸附最近轮次，并支持拖拽擦洗整个会话；
- 毛玻璃 / 液态玻璃预览材质与 G2 squircle 圆角，全程跟随官方设计 token；
- 性能优化——全部动画仅走合成器，滚动每帧只花一次矩形读取加一次二分查找。

欢迎上手，也谢谢你的提议——正是这类需求推动了整个设置层的成形。轨道还有什么想加的、想改的，欢迎再开 issue。
