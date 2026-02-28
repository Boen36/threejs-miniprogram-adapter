/**
 * HTMLCanvasElement 适配
 * 包装小程序 Canvas 实例，提供与浏览器 Canvas API 兼容的接口
 */

import { HTMLElement } from './element.js';
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
      // 小程序 canvas 的宽高通常是从布局获取的
      const info = typeof wx !== 'undefined' && wx.getSystemInfoSync ?
        wx.getSystemInfoSync() : { windowWidth: 375, windowHeight: 667 };
      this._width = this._canvas.width || info.windowWidth;
      this._height = this._canvas.height || info.windowHeight;
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

    // 如果已经创建过 context，直接返回
    if (this._context && this._contextType === contextType) {
      return this._context;
    }

    this._contextType = contextType;

    switch (contextType) {
      case 'webgl2':
      case 'webgl':
        // 小程序必须使用 'webgl2' 类型获取 WebGL2 上下文
        const gl = this._canvas.getContext('webgl2', {
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

        if (!gl) {
          console.error('Failed to get WebGL2 context');
          return null;
        }

        this._context = new WebGL2RenderingContextWrapper(gl);
        return this._context;

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
      'scrollPathIntoView', 'setTransform'
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
