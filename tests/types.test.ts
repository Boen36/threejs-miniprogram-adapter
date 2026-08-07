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

adapter.LoaderPlugins.enhanceAllLoaders({});
LoaderPlugins.enhanceAllLoaders({});

// —— Loader 插件：运行时导出与声明对齐 ——
LoaderPlugins.enhanceTextureLoader({});
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
LoaderPlugins.loadTextureFromBase64({}, 'data:image/png;base64,AAA=');
LoaderPlugins.loadTextureFromFile({}, 'wxfile://tmp/tex.png');

// —— Controls 插件：adapt 系列与手势控制器 ——
ControlPlugins.adaptAllControls({});
ControlPlugins.adaptOrbitControls({});
ControlPlugins.adaptTrackballControls({});
ControlPlugins.adaptFlyControls({});
ControlPlugins.adaptFirstPersonControls({});
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
