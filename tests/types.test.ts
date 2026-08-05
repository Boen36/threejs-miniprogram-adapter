import adapter, {
  ControlPlugins,
  LoaderPlugins,
  adaptForMiniProgram,
  type AdaptOptions,
  type AdaptResult
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
ControlPlugins.createTouchControls({}, result.canvas).dispose();
