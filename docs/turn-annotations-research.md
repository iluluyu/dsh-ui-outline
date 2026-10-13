# 轮次标注（自定义标题/摘要 + AI 生成）调研结论

> 状态：**已搁置，列入后续计划**（2026-10 拍板）。重启触发条件 = 下文两道验证门槛通过；在此之前不实现。
> 调研方式：本地 dsh 0.2.1 源码核实 + sol（gpt-6.1-sol）裁决，2026-10。

## 1. 需求与目标

- 每轮可自定义「大标题 + 小摘要」，替代预览卡里的原文截取，让读者快速扫读；
- 标注文本进入 ⌘F 搜索索引（检索联动是核心收益）；
- 理想态：模型自动生成/改写标题摘要（用户确认后生效）。

## 2. 已核实的技术事实（dsh 0.2.1 本地源码）

| # | 事实 | 出处 |
|---|---|---|
| 1 | 客户端插件 ctx 仅 `slots / locale / configForms`；无 RPC、无存储、无模型调用 | `lib/client.js` inject 声明（~3090 行） |
| 2 | configForms 双向可写（`scope.set` 持久化到 profile patch），但形状是**全局配置**，非按会话数据 | `lib/index.js` 头注、`writeNarrow` 实现 |
| 3 | 轮次身份 = `el.dataset.chatFlowKey`（渲染于 `routedNode.key`；reasoning 分组是 `JSON.stringify([key, groupPart])`），序号兜底仅当前页可用；**key 在编辑/重发/regenerate 后是否稳定未证实** | `dsh-client-ui-chat/lib/client.js:4550-4559` |
| 4 | 客户端无会话 id 消费；浏览器侧持久化仅 localStorage（browser-local，无同步承诺） | `dsh-client-store/README.md` |
| 5 | **宿主插件可注入通用 LLM**：`Context.llm: LlmRuntime`，`.stream(options)`，供插件/组合调用已配置 provider——模型调用不是阻塞点 | `dsh-llm/lib/types/index.d.ts:28-30,416`、`dsh-llm/README.md:30-59` |
| 6 | 宿主确有 Remote 体系（`ctx.remote.$mount()` 显式装配），但**插件能否挂载自定义 namespace 未证实**；`pluginInventory/list` 是现存先例 | `dsh-api-remotes/README.md:14,75-76`、`dsh-host-plugin-inventory/README.md` |
| 7 | 宿主侧已有 `dsh-session-title-llm`（路由/限额/取消/流式的辅助生成先例）与 `dsh-session-turn-outline`（规范 turn 号 + seq 投影） | 各包 README |
| 8 | 预览卡是 tooltip（`pointer-events: none`），卡片本身不可交互——编辑入口必须另做面板 | `lib/client.js` CSS |

## 3. 架构选项与裁决

| 选项 | 内容 | 裁决 |
|---|---|---|
| A 原案 | 纯客户端 localStorage，「首轮 key+轮数」当会话指纹 | **否决**：追加一轮即改指纹，跨会话可能碰撞；序号兜底不能用于持久绑定 |
| A 修正 | 稳定 session/turn 身份成立后的本地手动试验版 | 门槛通过后可做 |
| B | 宿主半场 LLM + 数据下发客户端 | 技术方向可行（事实 5），但身份/桥/存储三缺，成本超出"小 UI 功能" |
| configForms 当数据库 | 标注 JSON 塞配置字段 | **否决**：领域归属错误、profile patch 膨胀、会话删除/导出/多页写入无治理；配置只放"是否启用/默认策略" |
| **C 修正（选定）** | 分期：先过身份/通道两道门槛 → 手动 MVP → AI 二期 | sol 推荐路径 |

## 4. 两道验证门槛（有退出条件，先于一切 UI）

1. **身份稳定性观察**：记录两场会话在 追加轮次 / 刷新 / 编辑重发 / regenerate 后的会话身份、chatFlowKey、内容变化。验收：追加不丢旧标注、切会话不串、重生成不把旧摘要当新结果。失败即整体放弃（防"标注悄悄绑错轮"这一最大风险）。
2. **插件 Remote 挂载验证**：按官方机制（`ctx.remote.$mount()`）尝试挂一个自定义 namespace 并从客户端调用。失败则 AI 二期冻结，手动 MVP 若做也只能 localStorage（接受不同步）。

## 5. 手动 MVP 形态（门槛 1 通过后）

- 入口：轨道轮次项可聚焦「⋯ → 编辑标题/摘要」，打开**独立编辑浮层**（tooltip 不可交互，右键/长按只做快捷入口）；
- 字段：标题 ≤32 字、摘要 ≤120 字，均可空；未标注回退原预览；
- 检索：标注文本并入现有 ⌘F 索引，不另造检索系统；
- 失效策略：**人工标注保留并标"待复核"；AI 标注过期即回退原预览**；key 不再匹配时不按序号自动迁移（宁弃勿串）。

## 6. AI 二期形态（两道门槛都过后）

- 宿主半场注入 `llm` 服务（`.stream`），按需生成"本轮标题/摘要建议 → 用户确认后写入"；**永不默认自动请求、永不覆盖人工编辑**；
- 路由/限额/取消/请求记录参照 `dsh-session-title-llm` 的执行策略自建；
- 内容变化触发 AI 标注过期（见 §5）。

## 7. 结论

- **现在不实现**。两道验证是低成本观察/试验，可作为下次迭代的第一步；
- 身份若不稳：功能整体不值得做（绑定错轮比没有标注更糟）；
- 身份稳 + Remote 通：手动 MVP → AI 二期的路径清晰，模型调用已被证实可行。

sol 原始裁决要点：分期批准调研门槛，不批准完整开发；不要用配置数据库绕过领域问题。
