import adapter, {
  ControlPlugins,
  LoaderPlugins,
  VERSION,
  adaptForMiniProgram,
  checkCompatibility,
  detectEnvironment,
  getVersion,
  installPolyfills,
  waitForCanvas,
  type AdaptOptions,
  type AdaptResult,
  type TouchControls,
  type TouchControlsOptions
} from 'threejs-miniprogram-adapter';

const options: AdaptOptions = {
  globalObject: {},
  checkWebGLCapabilities: false,
  webglContextAttributes: { antialias: true }
};

declare const canvas: unknown;
const result: AdaptResult = adaptForMiniProgram(canvas, options);
const report = result.inspectWebGL();
report?.supported.forEach(extension => extension.toUpperCase());

// —— Loader 插件：运行时导出与声明对齐 ——
// 旧补丁入口只保留类型兼容，并在运行时发出一次性弃用告警。
adapter.LoaderPlugins.enhanceAllLoaders({});
LoaderPlugins.enhanceAllLoaders({});
LoaderPlugins.enhanceTextureLoader({});
LoaderPlugins.enhanceTextureLoader({}, { document: result.document });
LoaderPlugins.enhanceGLTFLoader({});
LoaderPlugins.enhanceOBJLoader({});
LoaderPlugins.enhanceMTLLoader({});
LoaderPlugins.enhanceFBXLoader({});

const fileLoader = LoaderPlugins.createFileLoader();
fileLoader.load(
  'wxfile://tmp/model.glb',
  (buffer: ArrayBuffer) => void buffer,
  (event: unknown) => void event,
  (error: unknown) => void error
);

const resolvedPath: string = LoaderPlugins.resolvePath('file:///tmp/a.glb');
void resolvedPath;

LoaderPlugins.createCachedLoader({}, class {});
// 显式纹理 helper 与 DRACO Loader 是 LoaderPlugins 保留的能力。
LoaderPlugins.loadTextureFromBase64({}, 'data:image/png;base64,AAA=');
LoaderPlugins.loadTextureFromFile({}, 'wxfile://tmp/tex.png');
LoaderPlugins.loadTextureFromFile({}, 'wxfile://tmp/tex.png', undefined, undefined, { document: result.document });

const dracoLoader = new adapter.MiniProgramDRACOLoader();
dracoLoader
  .setDecoderModule((config: Record<string, unknown>) => Promise.resolve({ Decoder: class {} }))
  .setDecoderBinary(new ArrayBuffer(8));
dracoLoader.preload();
dracoLoader.parse(new ArrayBuffer(8), (geometry: unknown) => void geometry);
dracoLoader
  .decodeDracoFile(new ArrayBuffer(8), (geometry: unknown) => void geometry, { position: 0 }, { position: 'Float32Array' }, 'srgb', (error: unknown) => void error)
  .then((geometry: unknown) => void geometry);
dracoLoader.dispose();
const namespaceDracoLoader = new LoaderPlugins.MiniProgramDRACOLoader();
void namespaceDracoLoader;

// —— Controls 插件：adapt 系列与手势控制器 ——
ControlPlugins.adaptAllControls({});
ControlPlugins.adaptPointerLockControls({});
ControlPlugins.adaptDeviceOrientationControls({});

const touchOptions: TouchControlsOptions = {
  enableRotate: true,
  enableZoom: false,
  rotateSpeed: 2,
  minDistance: 1,
  maxDistance: 100,
  target: { x: 0, y: 0, z: 0 },
  onDoubleTap: () => {}
};
const gestureControls: TouchControls = ControlPlugins.createGestureControls({}, result.canvas, touchOptions);
gestureControls.update();
gestureControls.setTarget(1, 2, 3);
gestureControls.setRadius(5);
gestureControls.dispose();

const touchControls: TouchControls = ControlPlugins.createTouchControls({}, result.canvas, touchOptions);
void touchControls;

// —— 其他顶层导出 ——
checkCompatibility();
detectEnvironment();
getVersion();
installPolyfills({});
waitForCanvas('#webgl');
VERSION.toUpperCase();
