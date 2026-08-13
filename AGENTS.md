# AGENTS.md

本文件为接手维护的 AI 代理提供项目背景与约定。人类维护约定见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 项目是什么

`threejs-miniprogram-adapter` 是微信小程序 WebGL2 环境的 three.js 兼容层（ESM，`"type": "module"`）。它把小程序原生 canvas 包装成 three.js 可用的 DOM/WebGL 表面：注入缺失的全局对象（window/document/Event/fetch 等）、把 WXML 触摸事件桥接为 PointerEvent、代理 WebGL2 上下文。

**关键认知（不可扩大声明）**：自动化测试通过 ≠ 真机可用。小程序运行时行为（基础库、开发者工具、iOS/Android）只能靠真机验证。README 的能力表是唯一可信的能力声明，改它之前先有真实证据。

## 环境

- 本机 node/npm 不在默认 PATH：`export PATH="/opt/homebrew/opt/node@24/bin:$PATH"`（v24.15.0）。
- 完整检查：`npm run check`（语法 → 测试 → types 编译 → publint/pack）。CI 额外跑 three r160/r183/r185 矩阵。
- 测试：`npm test`（`node --test`）。测试用手写的 wx/canvas mock（tests/basic.test.js:23-84），不依赖真机。

## 架构速览（文件级）

- `src/index.js` — 主入口：`adaptForMiniProgram`（包装 canvas → 注入 polyfill → 能力探测延迟到 `inspectWebGL()`，避免在 `THREE.WebGLRenderer` 前锁定上下文属性）、`quickAdapt`、`checkCompatibility`、`waitForCanvas`。
- `src/adaptor/` — 环境层：
  - `dom/` — 伪造的 DOM 树（Element/HTMLElement/canvas/document/window/image/video）。canvas 的 `getContext('webgl')` 返回真实 WebGL1 上下文（基础库 <2.24.0 时），`recoverContext()` 用于 iOS 切后台后恢复；video/audio 是模拟实现，VideoTexture 默认不可用。
  - `events/` — Event/EventTarget、触摸→Pointer 转换（`pointer-event.js`）、WXML 触摸桥（`bridge.js`：只维护处理器表，不直赋原生对象 — 微信无"赋属性即事件"机制）。
  - `network/` — 基于 `wx.request` 的 fetch/XHR、Blob/File、手写 URL 解析；本地文件读取限沙箱（`file://`/`wxfile://`/`USER_DATA_PATH` 前缀，拒绝 `..`）。
  - `webgl/` — `WebGL2RenderingContextWrapper`（构造时快照原生上下文全部成员并代理，`constructor.name` 伪装为 WebGL2RenderingContext 供 three 判定，`_replaceContext` 支持热替换）、扩展与能力检测。
- `src/plugins/loaders.js` — 绕过 three.js 图片路径、走 wx 图片层；`createFileLoader`/`resolvePath`/各 `enhance*Loader`。
- `src/plugins/draco-loader.js` — `MiniProgramDRACOLoader`：主线程 WASM 解码（不走 Worker），实现 GLTFLoader `setDRACOLoader` 所需的 `preload`/`decodeDracoFile`/`dispose` 契约；decoder 工厂与 WASM 由业务方注入。解码逻辑移植自 three DRACOLoader 的 Worker 实现。
- `src/plugins/controls.js` — 真正有用的是 `createTouchControls`/`createGestureControls`；`adaptPointerLockControls`（补丁 lock/unlock 为警告）与 `adaptDeviceOrientationControls`（wx 设备运动桥，connect/disconnect 成对注册/注销）有真实行为。OrbitControls/Trackball 等靠触摸→Pointer 桥工作，无适配函数（2026-08 已删除空壳）。
- `types/index.d.ts` — 公共类型。运行时导出与 .d.ts 必须同步（曾有漂移，已修复）。
- `examples/` — 可导入微信开发者工具的示例工程（basic/controls/loaders/draco 四个页面；draco 页面自带 decoder 资源 `libs/draco/` 与压缩模型 `assets/cube-draco.glb`）。

## 维护约定

1. **版本号单一来源**：`src/version.js`。改版本时同步改 package.json，测试会校验两者一致。
2. **测试先行**：修 bug 先补失败测试（node:test + wx mock），再 `npm run check`。
3. **不扩大兼容声明**：新增 addon 支持必须同时更新 README 能力表、类型声明、示例、测试矩阵（见 CONTRIBUTING.md）。
4. **微信宿主行为**：涉及运行时改动的 PR 需要说明"自动化证明了什么 + 还需真机确认什么"。

## 已知限制与坑
- DRACO 压缩 glTF 经 `MiniProgramDRACOLoader` 实验支持（主线程 WASM 解码，decoder 资源随代码包分发，大模型会阻塞 UI；wx.createWorker 离线方案仍跟踪在 Issue #1）。KTX2/WebGPU/WebXR 不支持。
- WebGL2 需要基础库 >= 2.24.0（`checkCompatibility`/`detectEnvironment` 阈值已按此设置）；`getContext('webgl')` 返回真实 WebGL1。
- `bindTouchEvents` 只准备处理器表，触摸必须走 WXML `bindtouch*` → `touchEventHandlers` 转发。
- iOS 切后台上下文可能被销毁：页面 `onShow` 调 `adapter.canvas.recoverContext()`（examples 四个页面已示范）。
- `updateSize()` 只返回建议尺寸，不应用到 canvas/renderer（README 已声明）。
- 尚未发布到 npm；README 安装说明目前用 GitHub 直装。
- 发布前人工清单（未完成）：微信开发者工具、Android、iOS、基础渲染、OrbitControls、远程 GLB、本地 GLB、DRACO GLB、销毁重进页面。

## 发布流程（npm）

**状态：暂缓。** 维护者决定项目成熟前不发布（当前无真机验证背书，README 能力表多为"实验支持"）。只有维护者明确要求时才启动此流程。

尚未发布到 npm；README 安装说明目前用 GitHub 直装。发布前按此清单执行（README 说发布后会把安装说明切换为 registry 方式）：

1. **真机验证**（不可跳过）：微信开发者工具导入 `examples/`，跑通四个页面（basic / controls / loaders / draco），再覆盖 Android 与 iOS：基础渲染、OrbitControls、远程 GLB、本地 GLB、DRACO GLB、销毁重进页面。
2. **版本号**：同步更新 `src/version.js` 与 `package.json` 的 `version`（tests 校验两者一致）。按 semver：破坏性 API 变更 → major；新能力 → minor；修复 → patch。
3. **README**：把「安装」节切换为 `npm install threejs-miniprogram-adapter`；「项目状态」横幅若含未发布说明则更新；确认能力表与现状一致（不要扩大声明）。
4. **检查**：`npm run check` 全绿；确认 `npm pack --dry-run` 的 tarball 只含 `src/`、`types/`、LICENSE、README、package.json（`files` 白名单已配好，AGENTS.md 不会进包）。
5. **发布**：`npm publish`（需 npm registry 账号权限）。发布后验证 `npm view threejs-miniprogram-adapter` 与从干净工程 `npm i threejs-miniprogram-adapter && npm run check`（types consumer fixture 已在 CI）。
6. **收尾**：examples/package.json 的 `"file:.."` 依赖可保持（示例用本地源码更方便）；给发布 commit 打 tag。
