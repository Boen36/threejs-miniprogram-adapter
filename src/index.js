/**
 * threejs-miniprogram-adapter 主入口
 * 提供适配 three.js 运行环境的核心功能
 */

import {
  installPolyfills,
  createAdaptedCanvas,
  getVersion,
  detectEnvironment,
  bindTouchEvents,
  unbindTouchEvents,
  createTouchEventHandlers,
  document,
  WebGLExtensions,
  checkMiniProgramLimitations
} from './adaptor/index.js';
import * as LoaderPlugins from './plugins/loaders.js';
import * as ControlPlugins from './plugins/controls.js';
import { MiniProgramDRACOLoader } from './plugins/draco-loader.js';
import { VERSION } from './version.js';
import {
  getWindowMetrics,
  hasPlatformInfoSupport,
  readPlatformInfo
} from './adaptor/platform.js';

function getGlobalObject() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof global !== 'undefined') return global;
  if (typeof window !== 'undefined') return window;
  return {};
}

function compareVersions(left, right) {
  const normalize = (version) => String(version || '')
    .split('.')
    .map(part => Number.parseInt(part, 10) || 0);
  const a = normalize(left);
  const b = normalize(right);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index++) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * 为小程序适配 three.js
 * 这是主要的入口函数
 *
 * @param {Object} canvas - 小程序原生 canvas 实例
 * @param {Object} options - 适配选项
 * @returns {Object} 适配后的环境对象
 *
 * @example
 * import * as THREE from 'three';
 * import { adaptForMiniProgram } from 'threejs-miniprogram-adapter';
 *
 * Page({
 *   async onReady() {
 *     const query = wx.createSelectorQuery();
 *     const canvas = await new Promise(resolve => {
 *       query.select('#webgl').node().exec(res => resolve(res[0].node));
 *     });
 *
 *     const { canvas: adaptedCanvas } = adaptForMiniProgram(canvas);
 *
 *     const renderer = new THREE.WebGLRenderer({ canvas: adaptedCanvas });
 *     // ... 正常使用 three.js
 *   }
 * });
 */
function adaptForMiniProgram(canvas, options = {}) {
  if (!canvas) {
    throw new Error('[threejs-miniprogram-adapter] Canvas is required. Please pass the mini-program canvas instance.');
  }

  // 默认选项
  const config = {
    injectGlobals: true,
    bindTouchEvents: true,
    debug: false,
    canvasWidth: null,
    canvasHeight: null,
    pixelRatio: null,
    checkWebGLCapabilities: false,
    webglContextAttributes: undefined,
    ...options
  };

  if (config.debug) {
    console.log('[threejs-miniprogram-adapter] Initializing adapter...');
  }

  // 1. 注入全局 polyfills
  if (config.injectGlobals) {
    installPolyfills(config.globalObject || getGlobalObject(), { debug: config.debug });
  }

  // 2. 创建适配的 canvas
  const adaptedCanvas = createAdaptedCanvas(canvas, {
    bindTouchEvents: config.bindTouchEvents,
    touchOptions: {
      capture: false,
      passive: true
    }
  });

  // 3. 设置 canvas 尺寸
  if (config.canvasWidth) {
    adaptedCanvas.width = config.canvasWidth;
  }
  if (config.canvasHeight) {
    adaptedCanvas.height = config.canvasHeight;
  }

  // 4. 检测环境
  const env = detectEnvironment();

  // 5. WebGL capability inspection is opt-in. Creating a context here would
  // lock its attributes before THREE.WebGLRenderer receives its own options.
  const inspectWebGL = () => {
    try {
      // renderer 可能已在 three r160~r162 的回退链中创建 WebGL1；浏览器语义
      // 禁止同一 canvas 再创建另一种 context，此时必须检查现有类型。
      const contextType = adaptedCanvas._contextType === 'webgl' ? 'webgl' : 'webgl2';
      const gl = adaptedCanvas.getContext(contextType, config.webglContextAttributes);
      if (gl) {
        const extensions = new WebGLExtensions(gl);
        const report = extensions.getReport();

        if (config.debug) {
          extensions.printReport();
          const limitations = checkMiniProgramLimitations(gl);
          if (limitations.length > 0) {
            console.warn('[threejs-miniprogram-adapter] Limitations:', limitations);
          }
        }

        return report;
      }
    } catch (error) {
      if (config.debug) {
        console.warn('[threejs-miniprogram-adapter] Failed to check WebGL capabilities:', error);
      }
    }
    return null;
  };
  let webglReport = config.checkWebGLCapabilities ? inspectWebGL() : null;

  // 6. 创建响应式尺寸更新（如果需要）
  const updateSize = () => {
    if (typeof wx === 'undefined') return null;
    const windowInfo = getWindowMetrics();
    const width = windowInfo.windowWidth || adaptedCanvas.clientWidth;
    const height = windowInfo.windowHeight || adaptedCanvas.clientHeight;
    if (!width || !height) return null;

    return {
      width,
      height,
      pixelRatio: config.pixelRatio || windowInfo.pixelRatio || 1
    };
  };

  if (config.debug) {
    console.log('[threejs-miniprogram-adapter] Adapter initialized successfully');
  }

  // 返回适配后的对象
  return {
    // 适配后的 canvas
    canvas: adaptedCanvas,

    // 原始小程序 canvas
    miniProgramCanvas: canvas,

    // document 对象
    document: document,

    // 环境信息
    environment: env,

    // WebGL 报告
    get webglReport() {
      return webglReport;
    },

    // Inspect after creating WebGLRenderer to preserve renderer context options.
    inspectWebGL: () => {
      webglReport = inspectWebGL();
      return webglReport;
    },

    // 工具方法
    updateSize: updateSize,

    // 事件处理器（可用于 WXML）
    touchEventHandlers: createTouchEventHandlers(adaptedCanvas),

    // 版本信息
    version: VERSION,

    // 销毁方法
    dispose: () => {
      unbindTouchEvents(adaptedCanvas);
      document.removeCanvas(adaptedCanvas);
    }
  };
}

/**
 * 快速适配（简化版）
 * 仅注入必要的 polyfills
 */
function quickAdapt(canvas, options = {}) {
  return adaptForMiniProgram(canvas, {
    injectGlobals: true,
    bindTouchEvents: true,
    debug: false,
    ...options
  });
}

/**
 * 检查 three.js 兼容性
 * @returns {Object} 兼容性报告
 */
function checkCompatibility() {
  const report = {
    compatible: true,
    issues: [],
    warnings: [],
    info: {}
  };

  // 检查运行环境
  if (typeof wx === 'undefined') {
    report.warnings.push('Not running in mini program environment');
  }

  // 检查 wx API
  if (typeof wx === 'undefined') {
    report.compatible = false;
    report.issues.push('wx object not available');
  } else {
    if (!wx.createSelectorQuery) {
      report.compatible = false;
      report.issues.push('wx.createSelectorQuery not available');
    }
    if (!hasPlatformInfoSupport(wx)) {
      report.compatible = false;
      report.issues.push('wx platform information APIs not available');
    }
  }

  // 检查基础库版本
  if (typeof wx !== 'undefined' && hasPlatformInfoSupport(wx)) {
    const platform = readPlatformInfo(wx);
    const { info } = platform;
    report.info.SDKVersion = info.SDKVersion;
    report.info.platform = info.platform;
    report.info.version = info.version;

    if (!platform.sections.window || !platform.sections.device || !platform.sections.app) {
      report.compatible = false;
      const failedMethods = platform.errors.map(item => item.method).join(', ');
      report.issues.push(
        failedMethods
          ? `Failed to read WeChat platform information: ${failedMethods}`
          : 'WeChat platform information is incomplete'
      );
    } else if (info.SDKVersion && compareVersions(info.SDKVersion, '2.24.0') < 0) {
      report.warnings.push(`SDK version ${info.SDKVersion} may not support WebGL2 properly. Recommended: 2.24.0+`);
    } else if (!info.SDKVersion) {
      report.warnings.push('SDK version is unavailable; WebGL2 support cannot be confirmed');
    }
  }

  return report;
}

/**
 * 等待 canvas 准备就绪
 * 在 Page.onReady 中使用
 */
function waitForCanvas(selector = '#webgl', component = null) {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.createSelectorQuery) {
      reject(new Error('wx.createSelectorQuery not available'));
      return;
    }

    const query = component ?
      wx.createSelectorQuery().in(component) :
      wx.createSelectorQuery();

    query.select(selector)
      .node()
      .exec((res) => {
        if (res && res[0] && res[0].node) {
          resolve(res[0].node);
        } else {
          reject(new Error(`Canvas not found: ${selector}`));
        }
      });
  });
}

// 导出 API
export {
  adaptForMiniProgram,
  quickAdapt,
  checkCompatibility,
  waitForCanvas,
  VERSION,
  // 从适配器重新导出
  installPolyfills,
  bindTouchEvents,
  unbindTouchEvents,
  createAdaptedCanvas,
  getVersion,
  detectEnvironment,
  WebGLExtensions,
  checkMiniProgramLimitations,
  LoaderPlugins,
  ControlPlugins,
  MiniProgramDRACOLoader
};

// 默认导出
export default {
  adaptForMiniProgram,
  quickAdapt,
  checkCompatibility,
  waitForCanvas,
  VERSION,
  LoaderPlugins,
  MiniProgramDRACOLoader,
  ControlPlugins
};
