# DSH 0.1.6+ 插件配置 Slot 适配与向后兼容退役计划

## 1. 背景与现状

DeepSeek Harness（dsh）在 `0.1.6-alpha.2` 版本中对插件配置体系进行了重大重构：

- **旧版（dsh <= 0.1.5）**：
  - 插件配置位于 **「设置（Settings）→ 插件」** 页面；
  - 依赖 keyed slot **`settings.plugin.item`**（按 namespace 如 `outline` 挂载）。
- **新版（dsh >= 0.1.6）**：
  - 设置页原插件配置入口被移除，改为只读的内置插件清单；
  - 左侧导航栏新增独立的 **「插件（Plugins）」** 面板（`PANEL_ID = 'plugins'`）；
  - 引入全新的分级配置 Slot：
    1. **`plugins.bundle.config`**（keyed slot，key 为组合包名，如 `dsh-ui-outline`）：在插件管理页点击该插件进入 Bundle 详情页时，配置表单直接嵌入在页面描述与组件行之间；
    2. **`plugins.row.config`**（keyed slot，key 为 `<包名>#<行ID>`，如 `dsh-ui-outline#outline`）：在组件行右侧提供「配置」按钮，点击进入该 Row 专属的配置页面；通过 `PluginConfigViewProps` 支持 `view: 'summary'`（单行简述）与 `view: 'page'`（表单页面）。

为了解决升级后配置界面丢失的问题，我们在 `lib/client.js` 中新增了新版 Slot 挂载，并暂时保留了对旧版本的兼容层。

---

## 2. 当前实现结构

在 `lib/client.js` 的 `apply(ctx)` 中：

```javascript
// 1. Bundle 级别配置 (dsh >= 0.1.6)
const unregisterBundle = ctx.slots.inject("plugins.bundle.config", () =>
    ctx.slots.register({ name: "plugins.bundle.config", key: "dsh-ui-outline" }, (props) => renderConfig(props, true)));

// 2. Row 级别配置 (dsh >= 0.1.6)
const unregisterRow = ctx.slots.inject("plugins.row.config", () =>
    ctx.slots.register({ name: "plugins.row.config", key: "dsh-ui-outline#outline" }, (props) => renderConfig(props, true)));

// 3. 旧版兼容层 (dsh <= 0.1.5，待退役)
const unregisterLegacy = ctx.slots.inject("settings.plugin.item", () =>
    ctx.slots.register({ name: "settings.plugin.item", key: "outline" }, (props) => renderConfig(props, false)));
```

---

## 3. 渐进式退役与移除计划 (Sunset Plan)

### 为什么需要退役
- `settings.plugin.item` 在 `dsh >= 0.1.6` 中已完全不再被任何官方组件消费；
- 保留该兼容层只用于照顾停留在旧版 dsh 的环境，长期保留会造成无用的 slot inject 监听与维护负担。

### 退役时机与路线图
1. **兼容期（当前）**：
   - 维持三路注册，确保在 `0.1.5` 与 `0.1.6+` 环境下都能正常显示并修改配置；
   - 随下一个 patch 版本合并发布。
2. **退出触发条件**：
   - DeepSeek 官方发布 `0.1.6` 正式版或后续 `0.2.0` 版本；
   - 官方宣布弃用/移除旧 settings 插件路径；
   - 用户及本地开发环境均已确认迁移至 `0.1.6+`。
3. **退役操作步骤**：
   - 从 `lib/client.js` 中彻底删除 `settings.plugin.item` 的 `ctx.slots.inject` 与 `ctx.slots.register` 代码段；
   - 删除 `unregisterLegacy()` 及其注销调用；
   - 移除相关的向后兼容说明与临时变量。

---

## 4. 本地测试与回归验证指南

### 本地开发模式验证（当前与未来退役时通用）

1. **链接本地工作副本**：
   在 `~/.dsh/profiles/web/package.json` 中配置：
   ```json
   "dependencies": {
     "dsh-ui-outline": "link:/home/luyu/dsh-plugin/outline"
   }
   ```
   并在 `~/.dsh/profiles/web` 执行 `pnpm install`。

2. **启动验证**：
   运行 `dsh web` 启动本地端。

3. **测试项清单**：
   - **Bundle 详情页测试**：
     - 进入左侧导航栏 **「插件（Plugins）」**；
     - 在 **已安装（Installed）** 列表中找到 `dsh-ui-outline`；
     - 点击卡片进入详情页，确认配置区域能够正确展开并展示：
       - 位置（右侧/左侧）；
       - 材质（无/毛玻璃/液态玻璃）及对应透明度/虚化滑块；
       - 刻度分布（紧凑/宽松）。
     - 调整参数后刷新页面或打开会话，确认配置生效并持久化到 `settings.yaml`。
   - **Row 页面测试**：
     - 在组件列表中，确认 `outline` 行右侧有「配置」按钮；
     - 点击「配置」进入 Row 详情页，确认标题下有一句话描述（`view: 'summary'`），下方表单正常交互。
   - **退役后验证**：
     - 在移除 `settings.plugin.item` 后，控制台应无任何 Slot 警告或未捕获异常；
     - 插件各项功能及配置页面表现应与兼容期完全一致。
