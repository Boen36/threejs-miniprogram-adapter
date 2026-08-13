/**
 * HTMLCanvasElement 适配
 * 包装小程序 Canvas 实例，提供与浏览器 Canvas API 兼容的接口
 */

import { HTMLElement } from './element.js';
import { Event } from '../events/event.js';
import { WebGL2RenderingContextWrapper } from '../webgl/webgl2-context.js';

class HTMLCanvasElement extends HTMLElement {
  constructor(canvas) {
    super('canvas');
    this._canvas = canvas;
    this._context = null;
    this._width = 300;
    this._height = 150;
    this._rafId = 0;
    this._rafCallbacks = new Map();

    // 如果传入了小程序 canvas，同步尺寸
    if (canvas) {
      this._syncSize();
    }
  }

  _syncSize() {
    if (this._canvas) {
      // 小程序 canvas 的宽高通常是从布局获取的；
      // wx.getSystemInfoSync 自 2.20.1 起停维护，可能返回空对象，需兜底
      let info = {};
      try {
        info = (typeof wx !== 'undefined' && wx.getSystemInfoSync) ? wx.getSystemInfoSync() : {};
      } catch {
        info = {};
      }
      this._width = this._canvas.width || info.windowWidth || 375;
      this._height = this._canvas.height || info.windowHeight || 667;
    }
  }

  get width() {
    return this._width;
  }

  set width(value) {
    this._width = value;
    if (this._canvas) {
      this._canvas.width = value;
    }
  }

  get height() {
    return this._height;
  }

  set height(value) {
    this._height = value;
    if (this._canvas) {
      this._canvas.height = value;
    }
  }

  get clientWidth() {
    return this._width;
  }

  get clientHeight() {
    return this._height;
  }

  // 小程序 Canvas 专有方法
  getContext(contextType, contextAttributes) {
    if (!this._canvas) {
      console.error('Canvas not initialized. Please pass the mini-program canvas to adaptForMiniProgram()');
      return null;
    }

    // 已创建过上下文：同类型直接复用，不同类型按浏览器语义返回 null
    if (this._context) {
      return this._contextType === contextType ? this._context : null;
    }

    this._contextType = contextType;

    // 构造传给原生 getContext 的属性（默认值与浏览器一致）
    const requestContext = (type) => this._canvas.getContext(type, {
      alpha: contextAttributes?.alpha !== false,
      depth: contextAttributes?.depth !== false,
      stencil: contextAttributes?.stencil === true,
      antialias: contextAttributes?.antialias === true,
      premultipliedAlpha: contextAttributes?.premultipliedAlpha !== false,
      preserveDrawingBuffer: contextAttributes?.preserveDrawingBuffer === true,
      powerPreference: contextAttributes?.powerPreference || 'default',
      failIfMajorPerformanceCaveat: contextAttributes?.failIfMajorPerformanceCaveat === true,
      ...contextAttributes
    });

    switch (contextType) {
      case 'webgl2': {
        // WebGL2 需要基础库 >= 2.24.0；失败时不自动回退 WebGL1，
        // 因为调用方（three r163+）假定拿到的是 WebGL2 上下文。
        const gl = requestContext('webgl2');
        if (!gl) {
          console.error(
            '[threejs-miniprogram-adapter] Failed to get WebGL2 context. ' +
            'WebGL2 requires base library >= 2.24.0. On older base libraries, ' +
            "request a 'webgl' (WebGL1) context instead."
          );
          return null;
        }
        this._context = new WebGL2RenderingContextWrapper(gl, this, true);
        return this._context;
      }

      case 'webgl': {
        // 真实 WebGL1 请求，不再映射到 webgl2（three r160 的回退链依赖此分支）
        const gl = requestContext('webgl');
        if (!gl) {
          console.error('[threejs-miniprogram-adapter] Failed to get WebGL context');
          return null;
        }
        this._context = new WebGL2RenderingContextWrapper(gl, this, false);
        return this._context;
      }

      case '2d':
        // 小程序 2D 上下文
        const ctx2d = this._canvas.getContext('2d', contextAttributes);
        if (ctx2d) {
          // 包装 2D 上下文以提供兼容性
          this._context = new CanvasRenderingContext2DWrapper(ctx2d);
          return this._context;
        }
        return null;

      default:
        return this._canvas.getContext(contextType, contextAttributes);
    }
  }

  // 小程序 canvas 专有方法
  createImage() {
    if (this._canvas && this._canvas.createImage) {
      return this._canvas.createImage();
    }
    // 回退到 wx.createImage
    if (typeof wx !== 'undefined' && wx.createImage) {
      return wx.createImage();
    }
    console.warn('createImage is not available');
    return null;
  }

  createImageData(width, height) {
    if (this._canvas && this._canvas.createImageData) {
      return this._canvas.createImageData(width, height);
    }
    // 模拟 ImageData
    return {
      width: width,
      height: height,
      data: new Uint8ClampedArray(width * height * 4)
    };
  }

  requestAnimationFrame(callback) {
    if (this._canvas && this._canvas.requestAnimationFrame) {
      return this._canvas.requestAnimationFrame(callback);
    }
    // 回退到 setTimeout
    this._rafId++;
    const id = this._rafId;
    this._rafCallbacks.set(id, callback);
    setTimeout(() => {
      if (this._rafCallbacks.has(id)) {
        this._rafCallbacks.delete(id);
        callback(Date.now());
      }
    }, 16);
    return id;
  }

  cancelAnimationFrame(id) {
    if (this._canvas && this._canvas.cancelAnimationFrame) {
      this._canvas.cancelAnimationFrame(id);
    }
    this._rafCallbacks.delete(id);
  }

  toDataURL(type, quality) {
    // 小程序 Canvas 不支持 toDataURL，需要使用 wx.canvasToTempFilePath
    console.warn('Canvas toDataURL is limited in mini program. Use wx.canvasToTempFilePath instead.');
    return '';
  }

  toBlob(callback, type, quality) {
    console.warn('Canvas toBlob is not supported in mini program');
    if (callback) callback(null);
  }

  transferControlToOffscreen() {
    console.warn('OffscreenCanvas is not supported in mini program');
    return null;
  }

  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    // 触摸事件会自动通过事件桥接处理
  }

  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, options);
  }

  dispatchEvent(event) {
    return super.dispatchEvent(event);
  }

  // 获取原始小程序 canvas
  get _miniProgramCanvas() {
    return this._canvas;
  }

  /**
   * 恢复 WebGL 上下文（iOS 切后台/锁屏后系统可能销毁原上下文）。
   * 页面 onShow 时调用：重新获取上下文并热替换到 wrapper，然后分发
   * webglcontextrestored 让 three.js 重建 GL 状态。失败时分发
   * webglcontextlost。返回是否成功恢复。
   */
  recoverContext() {
    if (!this._contextType || this._contextType === '2d' || !this._canvas || !this._context) {
      return false;
    }
    if (typeof this._context._replaceContext !== 'function') {
      return false;
    }

    let gl = null;
    try {
      gl = this._canvas.getContext(this._contextType);
    } catch {
      gl = null;
    }

    // 使用真实 Event 实例：three.js 的 context lost 处理器会调用 preventDefault()
    if (!gl) {
      this.dispatchEvent(new Event('webglcontextlost'));
      return false;
    }

    if (gl === this._context._rawContext) {
      // 上下文未销毁，仍分发给 three 重建状态
      this.dispatchEvent(new Event('webglcontextrestored'));
      return true;
    }

    const replaced = (() => {
      try {
        return this._context._replaceContext(gl);
      } catch {
        return false;
      }
    })();
    this.dispatchEvent(new Event(replaced ? 'webglcontextrestored' : 'webglcontextlost'));
    return replaced;
  }
}

// 2D 上下文包装器
class CanvasRenderingContext2DWrapper {
  constructor(ctx) {
    this._ctx = ctx;

    // 代理所有方法
    const methods = [
      'save', 'restore', 'scale', 'rotate', 'translate', 'transform',
      'setTransform', 'resetTransform', 'createLinearGradient', 'createRadialGradient',
      'createPattern', 'clearRect', 'fillRect', 'strokeRect', 'beginPath',
      'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
      'arc', 'arcTo', 'ellipse', 'rect', 'fill', 'stroke', 'clip',
      'isPointInPath', 'isPointInStroke', 'fillText', 'strokeText',
      'measureText', 'drawImage', 'createImageData', 'getImageData',
      'putImageData', 'getLineDash', 'setLineDash', 'drawFocusIfNeeded',
      'scrollPathIntoView'
    ];

    methods.forEach(method => {
      if (ctx[method]) {
        this[method] = (...args) => ctx[method](...args);
      }
    });
  }

  // 属性代理
  get canvas() {
    return this._ctx.canvas;
  }

  get fillStyle() {
    return this._ctx.fillStyle;
  }
  set fillStyle(value) {
    this._ctx.fillStyle = value;
  }

  get strokeStyle() {
    return this._ctx.strokeStyle;
  }
  set strokeStyle(value) {
    this._ctx.strokeStyle = value;
  }

  get globalAlpha() {
    return this._ctx.globalAlpha;
  }
  set globalAlpha(value) {
    this._ctx.globalAlpha = value;
  }

  get globalCompositeOperation() {
    return this._ctx.globalCompositeOperation;
  }
  set globalCompositeOperation(value) {
    this._ctx.globalCompositeOperation = value;
  }

  get lineWidth() {
    return this._ctx.lineWidth;
  }
  set lineWidth(value) {
    this._ctx.lineWidth = value;
  }

  get lineCap() {
    return this._ctx.lineCap;
  }
  set lineCap(value) {
    this._ctx.lineCap = value;
  }

  get lineJoin() {
    return this._ctx.lineJoin;
  }
  set lineJoin(value) {
    this._ctx.lineJoin = value;
  }

  get miterLimit() {
    return this._ctx.miterLimit;
  }
  set miterLimit(value) {
    this._ctx.miterLimit = value;
  }

  get font() {
    return this._ctx.font;
  }
  set font(value) {
    this._ctx.font = value;
  }

  get textAlign() {
    return this._ctx.textAlign;
  }
  set textAlign(value) {
    this._ctx.textAlign = value;
  }

  get textBaseline() {
    return this._ctx.textBaseline;
  }
  set textBaseline(value) {
    this._ctx.textBaseline = value;
  }
}

export { HTMLCanvasElement, CanvasRenderingContext2DWrapper };
