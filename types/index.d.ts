/**
 * threejs-miniprogram TypeScript 类型定义
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
}

export interface AdaptResult {
  /**
   * 适配后的 HTMLCanvasElement
   */
  canvas: HTMLCanvasElement;

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
  config?: { debug?: boolean }
): void;

/**
 * 绑定触摸事件
 */
export function bindTouchEvents(
  canvas: HTMLCanvasElement,
  options?: { capture?: boolean; passive?: boolean }
): () => void;

/**
 * 解绑触摸事件
 */
export function unbindTouchEvents(canvas: HTMLCanvasElement): void;

/**
 * 创建适配的 canvas
 */
export function createAdaptedCanvas(
  miniProgramCanvas: any,
  options?: { bindTouchEvents?: boolean }
): HTMLCanvasElement;

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

// Loader 插件
export namespace LoaderPlugins {
  function enhanceAllLoaders(THREE: any): void;
  function loadTextureFromBase64(
    THREE: any,
    base64Data: string,
    onLoad?: (texture: any) => void,
    onError?: (error: any) => void
  ): any;
  function loadTextureFromFile(
    THREE: any,
    filePath: string,
    onLoad?: (texture: any) => void,
    onError?: (error: any) => void
  ): any;
}

// Controls 插件
export namespace ControlPlugins {
  function adaptAllControls(THREE: any): void;
  function createTouchControls(
    camera: any,
    domElement: HTMLCanvasElement,
    options?: {
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
  ): {
    update: () => void;
    dispose: () => void;
    setTarget: (x: number, y: number, z: number) => void;
    setRadius: (r: number) => void;
  };
  function createGestureControls(
    camera: any,
    domElement: HTMLCanvasElement,
    options?: any
  ): any;
}

// 版本号
export const VERSION: string;

// 默认导出
export default {
  adaptForMiniProgram,
  quickAdapt,
  checkCompatibility,
  waitForCanvas,
  VERSION
};
