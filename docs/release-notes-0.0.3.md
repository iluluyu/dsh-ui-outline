# Release notes — 0.0.3 (draft for GitHub Release, post after push)

Title: `0.0.3 — glass, tuned by eye`

English primary; Chinese condensation appended. Do not post before `git push` + `npm publish`.

---

## English

0.0.3 is a taste pass over the preview card's glass, driven by multi-model visual review (blind ballots on rendered pixels, not opinions) and two rounds of live user feedback.

### Liquid glass, actually liquid
- **Edge lens retuned.** The displacement rim now bends backdrop content 1–2px with structure intact — perceptible, not jelly. (Scale 18 / rim 16, chosen over stronger candidates that showed jelly edges and dark-theme moiré.)
- **Neutral surface.** The old warm corner light read as a tea stain and the rim's backlight as a neon filament; both replaced with a small neutral cool-white glint at the conversation-facing corner plus a strict one-way Fresnel rim (.30 peak in light, gone by 45% of the edge). Dither stays: without it the veil banded.
- **Readability first.** Liquid·airy's veil is the knob that makes subtitles readable over saturated backdrops (blur barely touches low-frequency bands) — two rounds walked it to 75/4, with the ladder re-spaced so airy and standard differ on both axes.

### Presets re-tuned toward beauty
| Preset | frost t / blur | liquid t / blur |
|---|---|---|
| airy 清透 | 85% / 3px | 75% / 4px |
| standard 标准 | 80% / 6px | 65% / 6px |
| misty 朦胧 | 55% / 18px | 50% / 10px |

- Standard steps off the reverse-engineered iOS `regular` anchor toward airier glass — background color temperature shows through while text stays planted.
- Misty is real fog that glows (18px blur dissolves color bands into light), never a milk wall; all values sit on the slider lattice.
- Defaults follow the standard presets; existing personal settings are untouched.

### Docs & diagrams
- All five diagrams redrawn against the real client parameters: the materials strip now shows the corner glint, Fresnel rim, and the thick-lens fold; the hero and side-mirror scenes match.
- READMEs (en/zh) refreshed for accuracy (preset semantics, neutral light) and lightly polished.

---

## 中文

0.0.3 是对预览卡玻璃的品相轮：多模型盲投票（对渲染像素、不对观点）+ 两轮真实使用反馈驱动。

- **边缘透镜重调**：折射带弯折 1–2px、结构完整——恰好可感、不果冻；暖角光（茶渍感）与背光反弹（霓虹灯丝）换成中性冷白小光斑 + 严格单向菲涅尔边缘光，dither 保留（否则面纱出现色带）。
- **可读性优先**：液态清透档以面纱为可读性旋钮（模糊对低频色带几乎无效），两轮走到 75/4；阶梯双轴重排，清透与标准一眼可辨。
- **预设整体向美观靠拢**：标准档脱离 iOS regular 锚点走向更透的玻璃；朦胧是会发光的真雾，不再是乳白墙；所有取值落在滑杆格点上。默认值跟随标准档，个人已有设置不受影响。
- **文档与示意图**：五张示意图按真实参数重绘（角光斑、菲涅尔边缘光、厚透镜折叠带），双语 README 事实修正与轻度润色。
