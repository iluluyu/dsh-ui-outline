# Outline 客户端模块拆分与按需加载调研

> 调研日期：2026-11-12。结论基于本机 dsh `0.2.2-rc.1`、本地 deepseek-harness 源码（`5badb15009`）以及 npm 发布的 `@deepseek-ai/dsh-client-modules@0.2.0-rc.1`。尚未对改造后的 Outline 做端到端验证。

## 结论

- 将 Outline 的维护源码按轨道、收藏、搜索、设置等职责拆分可行；源码组织本身不改变宿主协议，也不会自动减少浏览器下载。
- 宿主原生支持包内客户端 chunk，可将搜索等功能延迟至首次使用。静态核查表明本机 `0.2.2-rc.1` 及插件声明的最低版本 `0.2.0-rc.1` 都包含此机制；最终仍需在这两个版本上对实际产物进行端到端验证。
- 不应把普通 ESM 文件或多个同步相对 `require()` 直接作为当前客户端插件产物。入口和按需 chunk 均须遵循宿主的 lazy-CJS factory 协议，且 chunk 必须自包含。
- 不建议为了按需加载再注册一个独立插件包、复制 React、或借用其他功能插件的内部导出。

## 规范与证据

1. 外部插件在 `package.json` 中声明 `dsh.client.platform: web`，通过 `exports["./client"]` 导出已构建的客户端入口。入口是向 `window.__ModuleLoader__.load({ id, factory })` 注册的 lazy-CJS factory。官方设置卡指南指出，构建用 `clientBundle` 预设是 dsh 仓库内文件，**没有作为公开 npm 包提供**，仓库外插件需要自行实现兼容构建。参见 `deepseek-harness/docs/cookbook/adding-a-settings-card.zh.md` 第 5 节。
2. 客户端模块系统文档说明，应用启动 combo 只携带 `client.js` 入口；由兼容构建处理的 `import()` 会编译为 `require.async("./client.<name>.js")`，执行到该表达式时才请求同目录 chunk。入口脚本是否随应用启动下载，与 chunk 何时下载是两个不同问题。参见 `deepseek-harness/packages/client/modules/README.zh.md`「浏览器加载什么」「惰性 CJS 模型」。
3. `client.<name>.js` 需要按同一插件 ID 及自身 chunk 文件名注册 factory；宿主按所属插件的版本化 URL 提供同级文件。命名受 `^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$` 约束。同步相对 `require("./client*.js")` 不受支持；每个 chunk 应自行包含其静态相对依赖。参见 `deepseek-harness/packages/client/AGENTS.md`「Shared modules and the module graph」以及 `packages/client/tsdown.client.ts` 的 outputOptions。
4. 本机 `@deepseek-ai/dsh-client-modules@0.2.2-rc.1` 的 `lib/client.js` 有 `require.async` 和 `importChunk`，`lib/index.js` 有版本化 chunk 路由。npm 下载的 `@deepseek-ai/dsh-client-modules@0.2.0-rc.1` 发布包在对应文件中也包含这些实现；`@deepseek-ai/dsh-web-app@0.2.0-rc.1` 依赖该版本。因此最低版本具备协议基础，但尚不等于 Outline 的实际构建和所有版本组合已经过验证。
5. React 等宿主基座模块通过模块表共享；功能插件之间不应运行时导入或重导出彼此内部值。自定义模块、依赖身份和 `dsh.client.external` 应按宿主契约处理，而不是为了功能拆分而增加插件间依赖。参见 `deepseek-harness/packages/client/AGENTS.md`「Dependency declaration」「Shared modules and the module graph」。
6. 打包必须包含所有实际运行时 chunk。Outline 当前 `package.json` 的 `files` 包含整个 `lib`，原则上覆盖 `lib/client.search.js`；仍须用 `npm pack --dry-run` 检查实际产物。版本修订由入口产物的文件元数据驱动，只重建 chunk 时也要在完整构建完成后更新入口，避免旧 revision 缓存。

## 建议实施顺序

1. 建立启动、首次/重复搜索、轨道交互和会话切换的性能与行为基线；同时保存当前收藏、轨道、搜索与设置的回归基线。
2. 拆源码并构建为**单个**符合宿主协议的 `lib/client.js`；先验证代码组织变化不改变行为，再让纯函数测试直接导入源码，不再依赖按注释截取大文件。
3. 独立做最小 chunk 样例：入口通过宿主 `require.async` 加载自包含的 `client.search.js`，在 `0.2.0-rc.1` 和本机 `0.2.2-rc.1` 验证网络、注册、打包、HMR/版本、停用和报错行为。先验证外部构建如何实现宿主的 wrapper 和动态导入转换；不要直接依赖 dsh 仓库的私有 tsdown 配置路径。
4. 原型通过后再将搜索 UI、引擎和对应样式归入搜索 chunk；快捷键入口保持轻量，处理首次加载状态、并发/重试、关闭或切换会话、插件停用清理，并保留现有空闲分片与五分钟索引缓存。
5. 测量首次搜索的额外延迟与启动节省；如果收益小或交互变差，保留源码拆分和单包构建，不为拆包而拆包。设置面板等其余 chunk 也要先测量再决定。

## 尚未验证

- 上述机制已由发布包和源码静态核实，**尚未证明本插件的构建工具可以直接生成符合规范的产物**。
- 尚未在两个宿主版本中完成真实搜索 chunk 的加载与网络验证，也未测量性能收益。
- 收藏持久化、轨道动效、搜索语义及设置行为在拆分后必须保持原样；本调研未修改这些实现。
