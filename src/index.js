/**
 * threejs-miniprogram 主入口
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

// 版本信息
const VERSION = '1.0.0';

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
 * import { adaptForMiniProgram } from 'threejs-miniprogram';
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
    throw new Error('[threejs-miniprogram] Canvas is required. Please pass the mini-program canvas instance.');
  }

  // 默认选项
  const config = {
    injectGlobals: true,
    bindTouchEvents: true,
    debug: false,
    canvasWidth: null,
    canvasHeight: null,
    pixelRatio: null,
    ...options
  };

  if (config.debug) {
    console.log('[threejs-miniprogram] Initializing adapter...');
  }

  // 1. 注入全局 polyfills
  if (config.injectGlobals) {
    installPolyfills(global, { debug: config.debug });
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

  // 5. 检查 WebGL 能力
  let webglReport = null;
  try {
    const gl = adaptedCanvas.getContext('webgl2');
    if (gl) {
      const extensions = new WebGLExtensions(gl);
      webglReport = extensions.getReport();

      if (config.debug) {
        extensions.printReport();
      }

      // 检查小程序特定限制
      const limitations = checkMiniProgramLimitations(gl);
      if (limitations.length > 0 && config.debug) {
        console.warn('[threejs-miniprogram] Limitations:', limitations);
      }
    }
  } catch (e) {
    console.error('[threejs-miniprogram] Failed to check WebGL capabilities:', e);
  }

  // 6. 创建响应式尺寸更新（如果需要）
  const updateSize = () => {
    try {
      const systemInfo = wx.getSystemInfoSync();
      const pixelRatio = config.pixelRatio || systemInfo.pixelRatio;

      return {
        width: systemInfo.windowWidth,
        height: systemInfo.windowHeight,
        pixelRatio: pixelRatio
      };
    } catch (e) {
      return null;
    }
  };

  if (config.debug) {
    console.log('[threejs-miniprogram] Adapter initialized successfully');
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
    webglReport: webglReport,

    // 工具方法
    updateSize: updateSize,

    // 事件处理器（可用于 WXML）
    touchEventHandlers: createTouchEventHandlers(adaptedCanvas),

    // 版本信息
    version: VERSION,

    // 销毁方法
    dispose: () => {
      unbindTouchEvents(adaptedCanvas);
      document.setCanvas(null);
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
  const env = detectEnvironment();
  const report = {
    compatible: true,
    issues: [],
    warnings: [],
    info: {}
  };

  // 检查运行环境
  if (!env.isMiniProgram) {
    report.warnings.push('Not running in mini program environment');
  }

  // 检查 wx API
  if (typeof wx === 'undefined') {
    report.compatible = false;
    report.issues.push('wx object not available');
  } else {
    if (!wx.createSelectorQuery) {
      report.issues.push('wx.createSelectorQuery not available');
    }
    if (!wx.getSystemInfoSync) {
      report.issues.push('wx.getSystemInfoSync not available');
    }
  }

  // 检查基础库版本
  if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
    const info = wx.getSystemInfoSync();
    report.info.SDKVersion = info.SDKVersion;
    report.info.platform = info.platform;
    report.info.version = info.version;

    // 检查 WebGL2 支持
    if (info.SDKVersion < '2.9.0') {
      report.warnings.push(`SDK version ${info.SDKVersion} may not support WebGL2 properly. Recommended: 2.9.0+`);
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
  checkMiniProgramLimitations
};

// 默认导出
export default {
  adaptForMiniProgram,
  quickAdapt,
  checkCompatibility,
  waitForCanvas,
  VERSION
};
