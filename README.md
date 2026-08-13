# threejs-miniprogram-adapter

微信小程序 WebGL2 环境的 three.js 兼容层。它把 Canvas、DOM 事件、网络和部分浏览器 API 适配为 three.js 可用的接口，并提供 WXML 触摸事件到 PointerEvent 的桥接。

> 项目状态：维护恢复中，API 仍属于实验阶段。当前已有 Node 自动化测试和 three.js 版本矩阵，但尚未完成微信开发者工具、iOS 与 Android 真机验证。请不要把“自动化通过”理解为“所有 three.js 功能均已支持”。

当前迭代顺序、真机验收范围和首发条件见 [Roadmap](https://github.com/Boen36/threejs-miniprogram-adapter/blob/main/ROADMAP.md)。

## 当前能力

| 能力 | 状态 | 验证范围 |
| --- | --- | --- |
| WebGL2 Canvas 适配 | 实验支持 | 原生上下文代理与 WebGLRenderer 恢复集成测试 |
| three.js 基础 API | 实验支持 | r160、r174、r183、r185 测试矩阵；r160~r162 建议升级（见下方说明） |
| OrbitControls 触摸 | 支持手动转发 | PointerEvent 集成测试；需绑定 WXML 事件 |
| 普通 glTF/GLB | 实验支持 | 远程、本地、内嵌纹理 GLB 的 GLTFLoader 集成测试；待真机验证 |
| DRACO 压缩 glTF | 实验支持（主线程 WASM 解码） | 真实 Draco 位流单元测试 + GLTFLoader 集成测试；需自带 decoder 资源；待真机验证 |
| KTX2、WebGPU、WebXR | 不支持 | — |
| VideoTexture / Web Audio | 有限占位实现 | 不建议用于生产 |

包声明的 three.js 范围为 `>=0.160.0 <0.186.0`。范围表示自动化兼容目标，并不代表所有 addon 都已验证。

**基础库要求**：WebGL2 上下文需要基础库 `>= 2.24.0`（`wx.canvas.getContext('webgl2')` 的最低版本）。基础库较低时 `getContext('webgl')` 会返回真实的 WebGL1 上下文（wrapper 会按实际版本报告 `isWebGL2`），three.js r160 的回退链可以工作；r163+ 只请求 WebGL2，低基础库上会得到明确的错误提示而非黑屏。建议使用 `checkCompatibility()` 或 `detectEnvironment()` 校验。

**three.js r160~r162**：three 通过 `gl.constructor.name` 判定 WebGL 版本，适配器已伪装该名称，但仍建议使用 r163+（r163 起 three 直接假定 WebGL2）。

## 安装

该包目前尚未发布到 npm registry，直接运行 `npm install threejs-miniprogram-adapter` 会得到 404。发布前请从 GitHub 安装：

```bash
npm install three@0.185.1 github:Boen36/threejs-miniprogram-adapter
```

在微信开发者工具中执行“工具 → 构建 npm”。项目需启用 npm 支持，且依赖必须安装在 `miniprogramRoot` 对应目录内。正式发布到 npm 后，本节会切换为 registry 安装方式。

## 最小用法

### WXML

```xml
<canvas type="webgl" id="webgl" class="webgl-canvas"></canvas>
```

### Page

```javascript
import * as THREE from 'three';
import {
  adaptForMiniProgram,
  waitForCanvas
} from 'threejs-miniprogram-adapter';

Page({
  async onReady() {
    const nativeCanvas = await waitForCanvas('#webgl', this);
    const adapter = adaptForMiniProgram(nativeCanvas);

    // WebGLRenderer 必须先创建，避免能力探测提前锁定 context attributes。
    const renderer = new THREE.WebGLRenderer({
      canvas: adapter.canvas,
      antialias: true,
      alpha: true
    });

    const { width, height, pixelRatio } = adapter.updateSize();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 4;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshNormalMaterial()
    );
    scene.add(mesh);

    const animate = () => {
      this._frame = nativeCanvas.requestAnimationFrame(animate);
      mesh.rotation.x += 0.01;
      mesh.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();

    console.log(adapter.inspectWebGL());
    this._adapter = adapter;
    this._renderer = renderer;
    this._nativeCanvas = nativeCanvas;
  },

  onUnload() {
    if (this._frame) this._nativeCanvas.cancelAnimationFrame(this._frame);
    this._renderer?.dispose();
    this._adapter?.dispose();
  }
});
```

`updateSize()` 读取系统窗口尺寸和像素比；它不会替你修改 renderer。页面尺寸变化后，请再次读取并调用 `renderer.setSize()`。

## OrbitControls 与触摸事件

给 Canvas node 写属性不会自动收到小程序触摸事件。必须在 WXML 中绑定，再转发给适配器（`adaptForMiniProgram` 的 `touchEventHandlers` 内部已准备好处理器表，无需先调用 `bindTouchEvents`）：

```xml
<canvas
  type="webgl"
  id="webgl"
  bindtouchstart="onTouchStart"
  catchtouchmove="onTouchMove"
  bindtouchend="onTouchEnd"
  bindtouchcancel="onTouchCancel"
></canvas>
```

```javascript
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

Page({
  async onReady() {
    const nativeCanvas = await waitForCanvas('#webgl', this);
    this._adapter = adaptForMiniProgram(nativeCanvas);
    this._controls = new OrbitControls(camera, this._adapter.canvas);
  },

  onTouchStart(event) {
    this._adapter?.touchEventHandlers.touchstart(event);
  },
  onTouchMove(event) {
    this._adapter?.touchEventHandlers.touchmove(event);
  },
  onTouchEnd(event) {
    this._adapter?.touchEventHandlers.touchend(event);
  },
  onTouchCancel(event) {
    this._adapter?.touchEventHandlers.touchcancel(event);
  }
});
```

完整代码见 `examples/controls/`。

## 加载 glTF / GLB

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load(
  'https://example.com/model.glb',
  gltf => scene.add(gltf.scene),
  undefined,
  error => console.error('模型加载失败', error)
);
```

注意：

- 真机网络请求必须使用 HTTPS，并在小程序后台配置合法域名。
- 本地临时文件和 data URL 由适配网络层处理。
- `LoaderPlugins` 保留给兼容旧用法；普通 GLTFLoader 不需要调用 `enhanceAllLoaders()`。
- 带 `KHR_draco_mesh_compression` 的模型使用 `MiniProgramDRACOLoader`，见下一节。

## 加载 DRACO 压缩 glTF

three.js 标准 `DRACOLoader` 动态生成 Blob URL 再调用浏览器形式的 `new Worker(blobURL)`，与微信小程序的 Worker 模型不兼容，无法直接使用。适配器提供 `MiniProgramDRACOLoader`：在主线程上用 WASM decoder 完成解码，接口兼容 `gltfLoader.setDRACOLoader()`。

先把 three 包里的两个 decoder 文件复制进小程序代码包（例如 `libs/draco/`）：

- `three/examples/jsm/libs/draco/draco_wasm_wrapper.js`
- `three/examples/jsm/libs/draco/gltf/draco_decoder.wasm`（推荐 glTF 专用构建，约 285KB；也可用 `libs/draco/draco_decoder.wasm`）

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { adaptForMiniProgram, MiniProgramDRACOLoader } from 'threejs-miniprogram-adapter';

// 适配器会把微信的 WXWebAssembly 映射为全局 WebAssembly
adaptForMiniProgram(canvas);

// 代码包内文件：CommonJS require + FileSystemManager 读取
const DracoDecoderModule = require('./libs/draco/draco_wasm_wrapper.js');
const wasmBinary = wx.getFileSystemManager().readFileSync('./libs/draco/draco_decoder.wasm');

const dracoLoader = new MiniProgramDRACOLoader()
  .setDecoderModule(DracoDecoderModule)
  .setDecoderBinary(wasmBinary);

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.load('https://example.com/model-draco.glb', gltf => scene.add(gltf.scene));
```

注意：

- 解码在主线程同步执行，大模型会短暂阻塞 UI；建议在 loading 界面期间解码。基于 `wx.createWorker` 的离线方案仍跟踪在 [Issue #1](https://github.com/Boen36/threejs-miniprogram-adapter/issues/1)。
- WASM 依赖基础库 `>= 2.13.0`（`WXWebAssembly`）；WebGL2 本身要求 `>= 2.24.0`，不构成额外限制。
- decoder 文件需随代码包分发；远程 URL 也可通过适配器 fetch 加载，但需配置合法域名。
- 独立 `.drc` 文件可直接 `dracoLoader.load(url, onLoad)` 加载；也支持 `draco3d` 包导出的 `DracoDecoderModule` 作为工厂。

## API

### `adaptForMiniProgram(canvas, options?)`

主要选项：

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `injectGlobals` | `true` | 补齐缺失的 DOM、Event、fetch 等全局对象 |
| `bindTouchEvents` | `true` | 创建触摸桥；仍需 WXML 转发 |
| `debug` | `false` | 输出诊断信息 |
| `canvasWidth` / `canvasHeight` | 原生尺寸 | 覆盖 Canvas backing size |
| `pixelRatio` | 系统值 | 作为 `updateSize()` 的返回值 |
| `checkWebGLCapabilities` | `false` | 适配时立即创建上下文；通常应保持关闭 |
| `webglContextAttributes` | — | 仅供立即能力检查使用 |
| `globalObject` | `globalThis` | 自定义 polyfill 注入目标，主要用于隔离测试 |

返回值包括：

- `canvas`：供 `THREE.WebGLRenderer` 使用的 Canvas。
- `touchEventHandlers`：WXML 事件转发目标。
- `updateSize()`：优先通过 `wx.getWindowInfo()` 读取建议的窗口尺寸与像素比；旧基础库回退到 `getSystemInfoSync()`。
- `inspectWebGL()`：在 renderer 创建后读取 WebGL 能力。
- `webglReport`：最近一次能力报告，未检查时为 `null`。
- `dispose()`：解绑触摸桥并移除 document 中的 Canvas 引用。

### 其他导出

- `waitForCanvas(selector, component?)`
- `checkCompatibility()`
- `quickAdapt(canvas, options?)`
- `installPolyfills(globalObject?, config?)`
- `MiniProgramDRACOLoader`：主线程 WASM 解码的 DRACO 加载器，见「加载 DRACO 压缩 glTF」
- `LoaderPlugins`

TypeScript 声明位于 `types/index.d.ts`，并由 CI 编译 consumer fixture。

## 运行示例

仓库提供可导入微信开发者工具的最小示例工程：

```bash
git clone https://github.com/Boen36/threejs-miniprogram-adapter.git
cd threejs-miniprogram-adapter/examples
npm install
```

然后在微信开发者工具中导入 `examples/`，执行“构建 npm”。`project.config.json` 使用游客 AppID；真机测试请替换为自己的 AppID，并配置模型域名。

## 开发与验证

```bash
npm ci
npm run check
```

`npm run check` 会执行：

1. JavaScript 语法检查；
2. Node 单元与 three.js 集成测试；
3. TypeScript 声明 consumer 编译；
4. publint 与 npm tarball 检查。

CI 额外覆盖 three.js r160、r174、r183、r185。发布前仍需完成人工清单：微信开发者工具、Android、iOS、基础渲染、OrbitControls、远程 GLB、本地 GLB、DRACO GLB 与销毁重进页面。

## 已知限制

- 仅面向微信小程序 WebGL2 Canvas，不支持 WebGPU、WebXR 和浏览器完整 DOM。
- WebGL2 需要基础库 `>= 2.24.0`；更低基础库上 `getContext('webgl')` 返回 WebGL1 上下文，`inspectWebGL()` 会如实报告。
- iOS 切后台/锁屏后 WebGL 上下文可能被系统销毁。页面 `onShow` 时调用 `adapter.canvas.recoverContext()` 可尝试恢复（重新获取上下文并分发 `webglcontextrestored` 让 three.js 重建状态）。
- 本地文件读取（`file://`、`wxfile://`、`wx.env.USER_DATA_PATH` 前缀）仅限小程序沙箱（`usr`/`store` 目录），拒绝路径遍历。开发者工具中本地路径前缀为 `http://usr`，已自动兼容。
- DRACO 解码在主线程同步执行，解码期间 UI 会阻塞；decoder 资源（wrapper + WASM）需由业务方随代码包分发。
- `fetch` 支持 `AbortSignal`；本地 FileSystemManager 读取无法从宿主层中止，但取消后会立即拒绝并忽略晚到回调。
- `createObjectURL` 写入的临时文件按 LRU 自动回收（上限 50 个 / 50MB）。新创建的单个超大 Blob 不会在返回前自我淘汰，可能暂时超过容量阈值；使用完仍应调用 `URL.revokeObjectURL()`。
- DOM、Audio、Video、URL、Blob 等均是最小兼容实现，不等价于浏览器标准实现。
- `checkCompatibility()` 的 WebGL2 结论基于基础库版本（2.24.0）；实际能力以创建 renderer 和 `inspectWebGL()` 为准。
- 平台信息优先读取 `getWindowInfo()`、`getDeviceInfo()`、`getAppBaseInfo()`；单次合并读取中，仅在现代 API 缺失、返回不完整或抛错时调用一次 `getSystemInfoSync()` 补缺。
- 多页面或多 Canvas 可用，但仍建议每页独立创建并在 `onUnload` 调用 `dispose()`。

## 贡献

欢迎提交可复现 Issue 和 PR。Bug 报告请附：three.js 版本、基础库版本、开发者工具版本、平台/机型、最小模型或代码、完整错误栈。涉及渲染或交互时，请同时提供录屏或截图。

## License

[MIT](./LICENSE)
