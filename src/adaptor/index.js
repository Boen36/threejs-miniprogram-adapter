/**
 * 适配器入口
 * 整合所有适配层模块，提供全局环境注入
 */

import { Window, URL } from './dom/window.js';
import { Document, document } from './dom/document.js';
import { Element, HTMLElement, CSSStyleDeclaration, DOMTokenList } from './dom/element.js';
import { HTMLCanvasElement } from './dom/canvas.js';
import { HTMLImageElement, Image } from './dom/image.js';
import { HTMLVideoElement } from './dom/video.js';
import { EventTarget } from './events/event-target.js';
import { Event, UIEvent, MouseEvent, Touch, TouchList, TouchEvent, KeyboardEvent, WheelEvent } from './events/event.js';
import { PointerEvent, convertTouchToPointer, convertTouchesToPointers } from './events/pointer-event.js';
import { bindTouchEvents, unbindTouchEvents, createTouchEventHandlers, installEventBridge } from './events/bridge.js';
import { fetch, Request, Response, Headers } from './network/fetch.js';
import { XMLHttpRequest, XMLHttpRequestUpload, FormData } from './network/xhr.js';
import { Blob, File, FileReader, btoa } from './network/blob.js';
import { WebGL2RenderingContextWrapper } from './webgl/webgl2-context.js';
import { WebGLExtensions, detectWebGLExtensions, checkMiniProgramLimitations } from './webgl/extensions.js';
import { URL as URLClass, URLSearchParams, createObjectURL, revokeObjectURL } from './media/url.js';
import { AudioContext, Audio, HTMLAudioElement } from './media/audio.js';

/**
 * 全局 polyfills 配置
 */
const defaultConfig = {
  injectGlobals: true,
  bindTouchEvents: true,
  debug: false
};

/**
 * 安装所有 polyfills
 * @param {Object} globalObject - 全局对象（global 或 window）
 * @param {Object} config - 配置选项
 */
function installPolyfills(globalObject = global, config = {}) {
  const options = { ...defaultConfig, ...config };

  if (options.debug) {
    console.log('[threejs-miniprogram] Installing polyfills...');
  }

  // DOM 对象
  globalObject.window = globalObject.window || new Window();
  globalObject.document = globalObject.document || document;
  globalObject.Document = Document;
  globalObject.Element = Element;
  globalObject.HTMLElement = HTMLElement;
  globalObject.HTMLCanvasElement = HTMLCanvasElement;
  globalObject.HTMLImageElement = HTMLImageElement;
  globalObject.HTMLVideoElement = HTMLVideoElement;
  globalObject.Image = Image;
  globalObject.CSSStyleDeclaration = CSSStyleDeclaration;
  globalObject.DOMTokenList = DOMTokenList;

  // Event 对象
  globalObject.EventTarget = EventTarget;
  globalObject.Event = Event;
  globalObject.UIEvent = UIEvent;
  globalObject.MouseEvent = MouseEvent;
  globalObject.Touch = Touch;
  globalObject.TouchList = TouchList;
  globalObject.TouchEvent = TouchEvent;
  globalObject.KeyboardEvent = KeyboardEvent;
  globalObject.WheelEvent = WheelEvent;
  globalObject.PointerEvent = PointerEvent;

  // Network 对象
  globalObject.fetch = globalObject.fetch || fetch;
  globalObject.Request = Request;
  globalObject.Response = Response;
  globalObject.Headers = Headers;
  globalObject.XMLHttpRequest = XMLHttpRequest;
  globalObject.FormData = FormData;
  globalObject.Blob = Blob;
  globalObject.File = File;
  globalObject.FileReader = FileReader;

  // URL 对象
  globalObject.URL = URLClass;
  globalObject.URLSearchParams = URLSearchParams;

  // Audio
  globalObject.AudioContext = AudioContext;
  globalObject.Audio = Audio;
  globalObject.HTMLAudioElement = HTMLAudioElement;

  // WebGL
  globalObject.WebGL2RenderingContext = WebGL2RenderingContextWrapper;

  // 工具函数
  globalObject.btoa = globalObject.btoa || btoa;
  globalObject.atob = globalObject.atob || function(str) {
    // 简化实现
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;
    while (i < str.length) {
      const enc1 = chars.indexOf(str.charAt(i++));
      const enc2 = chars.indexOf(str.charAt(i++));
      const enc3 = chars.indexOf(str.charAt(i++));
      const enc4 = chars.indexOf(str.charAt(i++));
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      output += String.fromCharCode(chr1);
      if (enc3 !== 64) output += String.fromCharCode(chr2);
      if (enc4 !== 64) output += String.fromCharCode(chr3);
    }
    return output;
  };

  if (options.debug) {
    console.log('[threejs-miniprogram] Polyfills installed successfully');
  }
}

/**
 * 创建适配的 canvas
 * @param {Object} miniProgramCanvas - 小程序原生 canvas
 * @param {Object} options - 配置选项
 * @returns {HTMLCanvasElement}
 */
function createAdaptedCanvas(miniProgramCanvas, options = {}) {
  if (!miniProgramCanvas) {
    throw new Error('miniProgramCanvas is required');
  }

  // 创建适配的 canvas 元素
  const canvas = new HTMLCanvasElement(miniProgramCanvas);

  // 设置 canvas ID（如果有）
  if (miniProgramCanvas.id) {
    canvas.id = miniProgramCanvas.id;
    canvas.setAttribute('id', miniProgramCanvas.id);
  }

  // 绑定触摸事件
  if (options.bindTouchEvents !== false) {
    bindTouchEvents(canvas, options.touchOptions);
  }

  // 更新 document 中的 canvas 引用
  document.setCanvas(canvas);

  return canvas;
}

/**
 * 获取适配器版本信息
 */
function getVersion() {
  return {
    version: '1.0.0',
    name: 'threejs-miniprogram',
    description: 'Modular adapter for using three.js in WeChat Mini Program'
  };
}

/**
 * 检测运行环境
 */
function detectEnvironment() {
  return {
    isMiniProgram: typeof wx !== 'undefined',
    platform: typeof wx !== 'undefined' && wx.getSystemInfoSync ?
      wx.getSystemInfoSync().platform : 'unknown',
    supportWebGL2: typeof wx !== 'undefined' && wx.getSystemInfoSync ?
      (wx.getSystemInfoSync().SDKVersion >= '2.9.0') : false
  };
}

export {
  installPolyfills,
  createAdaptedCanvas,
  getVersion,
  detectEnvironment,
  // DOM
  Window,
  Document,
  document,
  Element,
  HTMLElement,
  HTMLCanvasElement,
  HTMLImageElement,
  HTMLVideoElement,
  Image,
  // Events
  EventTarget,
  Event,
  PointerEvent,
  bindTouchEvents,
  unbindTouchEvents,
  createTouchEventHandlers,
  // Network
  fetch,
  Request,
  Response,
  Headers,
  XMLHttpRequest,
  Blob,
  File,
  FileReader,
  // Media
  URLClass as URL,
  URLSearchParams,
  AudioContext,
  Audio,
  // WebGL
  WebGL2RenderingContextWrapper,
  WebGLExtensions,
  detectWebGLExtensions,
  checkMiniProgramLimitations
};

export default {
  installPolyfills,
  createAdaptedCanvas,
  getVersion,
  detectEnvironment
};
