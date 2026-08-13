/**
 * threejs-miniprogram-adapter TypeScript 类型定义
 */

export interface AdaptOptions {
  /**
   * 是否注入全局 polyfills（window, document 等）
   * @default true
   */
  injectGlobals?: boolean;

  /**
   * 是否自动绑定触摸事件
   * @default true
   */
  bindTouchEvents?: boolean;

  /**
   * 是否启用调试输出
   * @default false
   */
  debug?: boolean;

  /**
   * 设置 canvas 宽度
   */
  canvasWidth?: number;

  /**
   * 设置 canvas 高度
   */
  canvasHeight?: number;

  /**
   * 设置像素比
   */
  pixelRatio?: number;

  /** 注入 polyfill 的目标对象，默认使用 globalThis。 */
  globalObject?: Record<string, any>;

  /**
   * 是否在适配时立即创建 WebGL 上下文并生成能力报告。
   * 默认关闭，以免在 WebGLRenderer 之前锁定上下文属性。
   * @default false
   */
  checkWebGLCapabilities?: boolean;

  /** 立即检查 WebGL 能力时使用的上下文属性。 */
  webglContextAttributes?: WebGLContextAttributes;
}

/**
 * 适配后的 canvas：在标准 HTMLCanvasElement 之上提供小程序特有的恢复方法。
 */
export interface AdaptedCanvas extends HTMLCanvasElement {
  /**
   * 恢复被系统销毁的 WebGL 上下文（iOS 切后台/锁屏后页面 onShow 时调用）。
   * 重新获取上下文并分发 webglcontextrestored 让 three.js 重建状态；
   * 失败时返回 false 并分发 webglcontextlost。
   */
  recoverContext(): boolean;
}

export interface AdaptResult {
  /**
   * 适配后的 HTMLCanvasElement
   */
  canvas: AdaptedCanvas;

  /**
   * 原始小程序 canvas
   */
  miniProgramCanvas: any;

  /**
   * 适配后的 document 对象
   */
  document: Document;

  /**
   * 环境信息
   */
  environment: EnvironmentInfo;

  /**
   * WebGL 扩展和能力的报告
   */
  webglReport: WebGLReport | null;

  /** 在 WebGLRenderer 创建后安全地读取能力报告。 */
  inspectWebGL: () => WebGLReport | null;

  /**
   * 更新尺寸的函数
   */
  updateSize: () => { width: number; height: number; pixelRatio: number } | null;

  /**
   * 触摸事件处理器（可用于 WXML）
   */
  touchEventHandlers: TouchEventHandlers;

  /**
   * 版本号
   */
  version: string;

  /**
   * 销毁适配器，清理资源
   */
  dispose: () => void;
}

export interface EnvironmentInfo {
  /**
   * 是否在小程序环境中
   */
  isMiniProgram: boolean;

  /**
   * 平台（ios/android/windows/mac/devtools）
   */
  platform: string;

  /**
   * 是否支持 WebGL2
   */
  supportWebGL2: boolean;
}

export interface WebGLReport {
  /**
   * 支持的扩展列表
   */
  supported: string[];

  /**
   * 不支持的扩展列表
   */
  unsupported: string[];

  /**
   * WebGL 能力
   */
  capabilities: WebGLCapabilities;
}

export interface WebGLCapabilities {
  maxTextureSize: number;
  maxCubeMapSize: number;
  maxRenderBufferSize: number;
  maxViewportDims: Int32Array;
  maxVertexAttribs: number;
  maxVertexUniforms: number;
  maxFragmentUniforms: number;
  maxTextureImageUnits: number;
  maxVertexTextureImageUnits: number;
  maxDrawBuffers: number;
  maxColorAttachments: number;
  maxSamples: number;
  version: string;
  shadingLanguageVersion: string;
  vendor: string;
  renderer: string;
}

export interface TouchEventHandlers {
  touchstart: (e: any) => void;
  touchmove: (e: any) => void;
  touchend: (e: any) => void;
  touchcancel: (e: any) => void;
  longpress: (e: any) => void;
}

export interface CompatibilityReport {
  /**
   * 是否兼容
   */
  compatible: boolean;

  /**
   * 不兼容的问题列表
   */
  issues: string[];

  /**
   * 警告信息
   */
  warnings: string[];

  /**
   * 环境信息
   */
  info: Record<string, any>;
}

export interface VersionInfo {
  version: string;
  name: string;
  description: string;
}

/**
 * 主适配函数
 * @param canvas - 小程序原生 canvas 实例
 * @param options - 适配选项
 */
export function adaptForMiniProgram(
  canvas: any,
  options?: AdaptOptions
): AdaptResult;

/**
 * 快速适配（简化版）
 */
export function quickAdapt(
  canvas: any,
  options?: AdaptOptions
): AdaptResult;

/**
 * 检查兼容性
 */
export function checkCompatibility(): CompatibilityReport;

/**
 * 等待 canvas 准备就绪
 * @param selector - CSS 选择器，默认 '#webgl'
 * @param component - 自定义组件实例
 */
export function waitForCanvas(
  selector?: string,
  component?: any
): Promise<any>;

/**
 * 安装全局 polyfills
 */
export function installPolyfills(
  globalObject?: any,
  config?: { debug?: boolean; document?: Document }
): void;

/**
 * 绑定触摸事件
 * 注意：微信宿主没有"赋属性即注册事件"机制，触摸事件必须通过
 * WXML 的 bindtouch* 转发到 createTouchEventHandlers()。
 */
export function bindTouchEvents(
  canvas: HTMLCanvasElement,
  options?: { capture?: boolean; passive?: boolean; debug?: boolean }
): (() => void) | undefined;

/**
 * 解绑触摸事件
 */
export function unbindTouchEvents(canvas: HTMLCanvasElement): void;

/**
 * 创建适配的 canvas
 */
export function createAdaptedCanvas(
  miniProgramCanvas: any,
  options?: {
    bindTouchEvents?: boolean;
    document?: Document;
    touchOptions?: { capture?: boolean; passive?: boolean; debug?: boolean };
  }
): AdaptedCanvas;

/**
 * 获取版本信息
 */
export function getVersion(): VersionInfo;

/**
 * 检测运行环境
 */
export function detectEnvironment(): EnvironmentInfo;

/**
 * WebGL 扩展检测器
 */
export class WebGLExtensions {
  constructor(gl: WebGLRenderingContext);
  hasExtension(name: string): boolean;
  getSupportedExtensions(): string[];
  getUnsupportedExtensions(): string[];
  getCapabilities(): WebGLCapabilities;
  getReport(): WebGLReport;
  checkRequiredExtensions(required: string[]): { satisfied: boolean; missing: string[] };
  checkThreeJSRequirements(): { compatible: boolean; issues: string[]; capabilities: WebGLCapabilities };
  printReport(): void;
}

/**
 * 检查小程序特定的限制
 */
export function checkMiniProgramLimitations(gl: WebGLRenderingContext): string[];

/**
 * 小程序 DRACO 加载器：在主线程用注入的 WASM decoder 解码 Draco 几何，
 * 实现 GLTFLoader 所需的 DRACOLoader 兼容接口（gltfLoader.setDRACOLoader）。
 */
export class MiniProgramDRACOLoader {
  constructor(manager?: any);

  /** 注入 decoder 模块工厂（three 的 draco_wasm_wrapper.js 或 draco3d 的 DracoDecoderModule）。 */
  setDecoderModule(moduleFactory: (config: Record<string, unknown>) => any): this;

  /** 注入 WASM 二进制（如 wx.getFileSystemManager().readFileSync 的结果）。 */
  setDecoderBinary(binary: ArrayBuffer): this;

  /** 预加载 decoder；GLTFLoader 在扩展构造时同步调用。 */
  preload(): this;

  /** 加载独立的 .drc 文件。 */
  load(
    url: string,
    onLoad?: (geometry: any) => void,
    onProgress?: (event: any) => void,
    onError?: (error: any) => void
  ): void;

  /** 解析 .drc 数据，顶点颜色按 sRGB 处理。 */
  parse(buffer: ArrayBuffer, onLoad?: (geometry: any) => void, onError?: (error: any) => void): void;

  /** GLTFLoader 内部调用入口（KHR_draco_mesh_compression）。 */
  decodeDracoFile(
    buffer: ArrayBuffer,
    callback: (geometry: any) => void,
    attributeIDs?: Record<string, number>,
    attributeTypes?: Record<string, string>,
    vertexColorSpace?: string,
    onError?: (error: any) => void
  ): Promise<any>;

  /** 释放 decoder 状态，之后再使用会重新初始化。 */
  dispose(): this;
}

type MiniProgramDRACOLoaderClass = typeof MiniProgramDRACOLoader;

// Loader 插件
export interface LoaderPluginOptions {
  /** 固定使用某个 adapter 的 document/Canvas 图片工厂。 */
  document?: Document;
}

export namespace LoaderPlugins {
  function enhanceAllLoaders(THREE: any, options?: LoaderPluginOptions): void;
  function enhanceTextureLoader(THREE: any, options?: LoaderPluginOptions): void;
  function enhanceGLTFLoader(THREE: any): void;
  function enhanceOBJLoader(THREE: any): void;
  function enhanceMTLLoader(THREE: any): void;
  function enhanceFBXLoader(THREE: any): void;
  /** 创建适配小程序路径的 FileLoader（load 返回 Promise 风格回调）。 */
  function createFileLoader(): {
    load: (
      url: string,
      onLoad?: (buffer: ArrayBuffer) => void,
      onProgress?: (event: any) => void,
      onError?: (error: any) => void
    ) => void;
  };
  /** 解析路径，处理小程序特有的路径格式。 */
  function resolvePath(url: string): string;
  const MiniProgramDRACOLoader: MiniProgramDRACOLoaderClass;
  function createCachedLoader(THREE: any, LoaderClass: any): any;
  function loadTextureFromBase64(
    THREE: any,
    base64Data: string,
    onLoad?: (texture: any) => void,
    onError?: (error: any) => void,
    options?: LoaderPluginOptions
  ): any;
  function loadTextureFromFile(
    THREE: any,
    filePath: string,
    onLoad?: (texture: any) => void,
    onError?: (error: any) => void,
    options?: LoaderPluginOptions
  ): any;
}

export interface TouchControlsOptions {
  enableRotate?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  rotateSpeed?: number;
  zoomSpeed?: number;
  panSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  target?: { x: number; y: number; z: number };
  onDoubleTap?: () => void;
}

export interface TouchControls {
  update: () => void;
  dispose: () => void;
  setTarget: (x: number, y: number, z: number) => void;
  setRadius: (r: number) => void;
}

// Controls 插件
export namespace ControlPlugins {
  function adaptAllControls(THREE: any): void;
  function adaptPointerLockControls(THREE: any): void;
  function adaptDeviceOrientationControls(THREE: any): void;
  function createTouchControls(
    camera: any,
    domElement: HTMLCanvasElement,
    options?: TouchControlsOptions
  ): TouchControls;
  function createGestureControls(
    camera: any,
    domElement: HTMLCanvasElement,
    options?: TouchControlsOptions
  ): TouchControls;
}

// 版本号
export const VERSION: string;

declare const adapter: {
  adaptForMiniProgram: typeof adaptForMiniProgram;
  quickAdapt: typeof quickAdapt;
  checkCompatibility: typeof checkCompatibility;
  waitForCanvas: typeof waitForCanvas;
  VERSION: typeof VERSION;
  LoaderPlugins: typeof LoaderPlugins;
  ControlPlugins: typeof ControlPlugins;
  MiniProgramDRACOLoader: MiniProgramDRACOLoaderClass;
};

export default adapter;
