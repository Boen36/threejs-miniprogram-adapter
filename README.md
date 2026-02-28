# threejs-miniprogram-adapter

微信小程序 three.js 模块化适配器。支持最新 three.js (0.160.0 - 0.183.1+) 在小程序中运行。

> 注意：此包是新版模块化适配器，与官方已停止维护的 `threejs-miniprogram` 不同。新版无需构建时注入，直接通过 npm 安装使用。

## 特性

- **模块化架构** - 无需构建时注入 three.js 源码，运行时 polyfill 浏览器环境
- **支持最新 three.js** - 兼容 three.js 0.160.0+，包括最新版本 0.183.1
- **完整 DOM API 模拟** - 提供 window、document、EventTarget 等核心 API
- **PointerEvent 支持** - 自动将小程序触摸事件转换为 PointerEvent
- **WebGL2 支持** - 完整支持小程序 WebGL2 上下文
- **Loader 增强** - 为 GLTFLoader、OBJLoader 等提供小程序路径支持
- **Controls 适配** - OrbitControls 等触摸控制器的优化支持

## 安装

```bash
npm install threejs-miniprogram-adapter
```

## 使用

### 基础用法

```javascript
// page.js
import * as THREE from 'three';
import { adaptForMiniProgram } from 'threejs-miniprogram-adapter';

Page({
  async onReady() {
    // 1. 获取小程序 Canvas
    const canvas = await new Promise((resolve) => {
      wx.createSelectorQuery()
        .select('#webgl')
        .node()
        .exec((res) => resolve(res[0].node));
    });

    // 2. 应用适配
    const { canvas: adaptedCanvas } = adaptForMiniProgram(canvas);

    // 3. 正常使用 three.js
    const renderer = new THREE.WebGLRenderer({ canvas: adaptedCanvas });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);

    // 创建物体
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // 动画循环
    const animate = () => {
      canvas.requestAnimationFrame(animate);
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();
  }
});
```

```xml
<!-- page.wxml -->
<canvas type="webgl" id="webgl" style="width: 100vw; height: 100vh;"></canvas>
```

### 使用 OrbitControls

```javascript
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { adaptForMiniProgram } from 'threejs-miniprogram-adapter';

Page({
  async onReady() {
    const canvas = await waitForCanvas();
    const { canvas: adaptedCanvas } = adaptForMiniProgram(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas: adaptedCanvas });
    const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // OrbitControls 会自动使用 PointerEvent
    const controls = new OrbitControls(camera, adaptedCanvas);
    controls.enableDamping = true;

    function animate() {
      canvas.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  }
});
```

### 加载模型

```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LoaderPlugins } from 'threejs-miniprogram-adapter';

// 增强 Loader 以支持小程序路径
LoaderPlugins.enhanceAllLoaders(THREE);

const loader = new GLTFLoader();
loader.load(
  'models/model.gltf', // 支持网络 URL 或小程序本地路径
  (gltf) => {
    scene.add(gltf.scene);
  },
  undefined,
  (error) => {
    console.error('加载失败:', error);
  }
);
```

### 从本地文件加载纹理

```javascript
import { LoaderPlugins } from 'threejs-miniprogram-adapter';

// 使用小程序本地文件路径
LoaderPlugins.loadTextureFromFile(THREE, 'wxfile://tmp/texture.png', (texture) => {
  const material = new THREE.MeshBasicMaterial({ map: texture });
});
```

## API

### adaptForMiniProgram(canvas, options)

主适配函数。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| canvas | Object | 小程序原生 canvas 实例 |
| options | Object | 配置选项 |

**options:**

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| injectGlobals | boolean | true | 是否注入全局 polyfills |
| bindTouchEvents | boolean | true | 是否自动绑定触摸事件 |
| debug | boolean | false | 是否启用调试输出 |
| canvasWidth | number | - | 设置 canvas 宽度 |
| canvasHeight | number | - | 设置 canvas 高度 |
| pixelRatio | number | - | 设置像素比 |

**返回值:**

```typescript
{
  canvas: HTMLCanvasElement;      // 适配后的 canvas
  miniProgramCanvas: Object;      // 原始小程序 canvas
  document: Document;             // 适配后的 document
  environment: EnvironmentInfo;   // 环境信息
  webglReport: WebGLReport;       // WebGL 报告
  updateSize: Function;           // 更新尺寸
  touchEventHandlers: Object;     // 触摸事件处理器
  version: string;                // 版本号
  dispose: Function;              // 销毁资源
}
```

### waitForCanvas(selector, component)

等待 canvas 准备就绪。

```javascript
import { waitForCanvas } from 'threejs-miniprogram-adapter';

const canvas = await waitForCanvas('#webgl');
```

### checkCompatibility()

检查环境兼容性。

```javascript
import { checkCompatibility } from 'threejs-miniprogram-adapter';

const report = checkCompatibility();
console.log(report.compatible); // true/false
console.log(report.issues);     // 问题列表
console.log(report.warnings);   // 警告列表
```

## 已知限制

1. **WebGPU 不支持** - 小程序目前无 WebGPU API
2. **VideoTexture 不支持** - 小程序视频组件无法直接作为纹理
3. **Web Audio 有限支持** - 只能基础播放，无法实时处理
4. **Worker 中的 three.js** - 小程序 Worker 限制较多
5. **某些 WebGL 扩展** - 取决于小程序基础库支持情况

## 项目结构

```
threejs-miniprogram-adapter/
├── src/
│   ├── index.js                 # 主入口
│   ├── adaptor/                 # 核心适配层
│   │   ├── index.js             # 适配器入口
│   │   ├── dom/                 # DOM API 模拟
│   │   │   ├── document.js      # document 对象
│   │   │   ├── window.js        # window 对象
│   │   │   ├── element.js       # HTMLElement/Element
│   │   │   ├── canvas.js        # HTMLCanvasElement
│   │   │   ├── image.js         # HTMLImageElement
│   │   │   └── video.js         # HTMLVideoElement
│   │   ├── events/              # 事件系统
│   │   │   ├── event-target.js  # EventTarget 基类
│   │   │   ├── event.js         # Event 类
│   │   │   ├── pointer-event.js # PointerEvent
│   │   │   └── bridge.js        # 事件桥接
│   │   ├── network/             # 网络请求适配
│   │   │   ├── fetch.js         # fetch API
│   │   │   ├── xhr.js           # XMLHttpRequest
│   │   │   └── blob.js          # Blob/File
│   │   ├── webgl/               # WebGL 上下文适配
│   │   │   ├── webgl2-context.js
│   │   │   └── extensions.js
│   │   └── media/               # 媒体相关适配
│   │       ├── audio.js         # Web Audio API
│   │       └── url.js           # URL.createObjectURL
│   └── plugins/                 # 功能插件
│       ├── loaders.js           # Loader 增强
│       └── controls.js          # Controls 适配
├── types/
│   └── index.d.ts               # TypeScript 类型定义
└── examples/                    # 示例代码
```

## 许可证

MIT
