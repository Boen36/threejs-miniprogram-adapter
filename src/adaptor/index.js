/**
 * 适配器入口
 * 整合所有适配层模块，提供全局环境注入
 */

import { Window } from './dom/window.js';
import { Document, document } from './dom/document.js';
import { Element, HTMLElement, CSSStyleDeclaration, DOMTokenList } from './dom/element.js';
import { HTMLCanvasElement } from './dom/canvas.js';
import { HTMLImageElement, Image } from './dom/image.js';
import { HTMLVideoElement } from './dom/video.js';
import { EventTarget } from './events/event-target.js';
import { Event, UIEvent, MouseEvent, Touch, TouchList, TouchEvent, KeyboardEvent, WheelEvent } from './events/event.js';
import { PointerEvent, convertTouchToPointer, convertTouchesToPointers } from './events/pointer-event.js';
import { bindTouchEvents, unbindTouchEvents, createTouchEventHandlers, installEventBridge } from './events/bridge.js';
import { fetch, Request, Response, Headers, DOMException, atob } from './network/fetch.js';
import { XMLHttpRequest, XMLHttpRequestUpload, FormData } from './network/xhr.js';
import { Blob, File, FileReader, btoa } from './network/blob.js';
import { WebGL2RenderingContextWrapper } from './webgl/webgl2-context.js';
import { WebGLExtensions, detectWebGLExtensions, checkMiniProgramLimitations } from './webgl/extensions.js';
import { URL as URLClass, URLSearchParams, createObjectURL, revokeObjectURL } from './media/url.js';
import { Audio, HTMLAudioElement } from './media/audio.js';
import { VERSION, PACKAGE_NAME, PACKAGE_DESCRIPTION } from '../version.js';
import { readPlatformInfo } from './platform.js';

/**
 * 全局 polyfills 配置
 */
const defaultConfig = {
  injectGlobals: true,
  bindTouchEvents: true,
  debug: false
};

function setDefault(target, key, value) {
  if (target[key] !== undefined && target[key] !== null) return target[key];
  try {
    target[key] = value;
  } catch (error) {
    // Some runtimes expose non-writable host globals. Keeping the native value is safer.
  }
  return target[key];
}

function setManagedDefault(target, key, value, isManaged) {
  const current = target[key];
  if (current !== undefined && current !== null && !isManaged(current)) return current;
  try {
    target[key] = value;
  } catch (error) {
    // 宿主全局不可写时保持原值。
  }
  return target[key];
}

function createImageConstructor(documentObject) {
  function Image(width, height) {
    const image = documentObject.createElement('img');
    if (width !== undefined) image.width = width;
    if (height !== undefined) image.height = height;
    return image;
  }
  Image.prototype = HTMLImageElement.prototype;
  Object.setPrototypeOf(Image, HTMLImageElement);
  Object.defineProperty(Image, '_miniProgramDocument', {
    configurable: false,
    enumerable: false,
    value: documentObject
  });
  return Image;
}

/**
 * 安装所有 polyfills
 * @param {Object} globalObject - 全局对象（global 或 window）
 * @param {Object} config - 配置选项
 */
function installPolyfills(globalObject = globalThis, config = {}) {
  const options = { ...defaultConfig, ...config };

  if (options.debug) {
    console.log('[threejs-miniprogram-adapter] Installing polyfills...');
  }

  // DOM 对象
  const windowObject = setDefault(globalObject, 'window', new Window());
  const requestedDocument = options.document instanceof Document ? options.document : document;
  const documentObject = setManagedDefault(
    globalObject,
    'document',
    requestedDocument,
    value => value instanceof Document
  );
  setDefault(globalObject, 'Document', Document);
  setDefault(globalObject, 'Element', Element);
  setDefault(globalObject, 'HTMLElement', HTMLElement);
  setDefault(globalObject, 'HTMLCanvasElement', HTMLCanvasElement);
  setDefault(globalObject, 'HTMLImageElement', HTMLImageElement);
  setDefault(globalObject, 'HTMLVideoElement', HTMLVideoElement);
  const imageConstructor = createImageConstructor(
    documentObject instanceof Document ? documentObject : requestedDocument
  );
  const installedImage = setManagedDefault(
    globalObject,
    'Image',
    imageConstructor,
    value => value === Image || value?._miniProgramDocument instanceof Document
  );
  setDefault(globalObject, 'CSSStyleDeclaration', CSSStyleDeclaration);
  setDefault(globalObject, 'DOMTokenList', DOMTokenList);

  // Event 对象
  setDefault(globalObject, 'EventTarget', EventTarget);
  setDefault(globalObject, 'Event', Event);
  setDefault(globalObject, 'UIEvent', UIEvent);
  setDefault(globalObject, 'MouseEvent', MouseEvent);
  setDefault(globalObject, 'Touch', Touch);
  setDefault(globalObject, 'TouchList', TouchList);
  setDefault(globalObject, 'TouchEvent', TouchEvent);
  setDefault(globalObject, 'KeyboardEvent', KeyboardEvent);
  setDefault(globalObject, 'WheelEvent', WheelEvent);
  setDefault(globalObject, 'PointerEvent', PointerEvent);

  // Network 对象
  setDefault(globalObject, 'fetch', fetch);
  setDefault(globalObject, 'Request', Request);
  setDefault(globalObject, 'Response', Response);
  setDefault(globalObject, 'Headers', Headers);
  setDefault(globalObject, 'XMLHttpRequest', XMLHttpRequest);
  setDefault(globalObject, 'FormData', FormData);
  setDefault(globalObject, 'Blob', Blob);
  setDefault(globalObject, 'File', File);
  setDefault(globalObject, 'FileReader', FileReader);
  setDefault(globalObject, 'DOMException', DOMException);

  // URL 对象
  setDefault(globalObject, 'URL', URLClass);
  setDefault(globalObject, 'URLSearchParams', URLSearchParams);

  // 基础音频播放。Web Audio 图不做伪实现；宿主若已有原生 AudioContext 则保持原值。
  setDefault(globalObject, 'Audio', Audio);
  setDefault(globalObject, 'HTMLAudioElement', HTMLAudioElement);

  // WebGL
  setDefault(globalObject, 'WebGL2RenderingContext', WebGL2RenderingContextWrapper);

  // WebAssembly：微信在逻辑层以 WXWebAssembly 暴露（基础库 >= 2.13.0），
  // 原版 WebAssembly 全局不一定存在；three 的 DRACOLoader 与 emscripten 胶水按 WebAssembly 探测。
  if (typeof globalObject.WebAssembly === 'undefined' && typeof globalObject.WXWebAssembly === 'object') {
    try {
      globalObject.WebAssembly = globalObject.WXWebAssembly;
    } catch (error) {
      // 宿主全局不可写时保持原状
    }
  }

  setManagedDefault(windowObject, 'document', documentObject, value => value instanceof Document);
  setManagedDefault(
    windowObject,
    'Image',
    installedImage,
    value => value === Image || value?._miniProgramDocument instanceof Document
  );
  if (documentObject instanceof Document) {
    documentObject.setDefaultView(windowObject);
  }
  setDefault(windowObject, 'window', windowObject);
  setDefault(windowObject, 'self', windowObject);
  setDefault(globalObject, 'self', windowObject);
  setDefault(globalObject, 'location', windowObject.location);
  setDefault(globalObject, 'navigator', windowObject.navigator);
  setDefault(globalObject, 'performance', windowObject.performance);
  setDefault(globalObject, 'requestAnimationFrame', windowObject.requestAnimationFrame.bind(windowObject));
  setDefault(globalObject, 'cancelAnimationFrame', windowObject.cancelAnimationFrame.bind(windowObject));

  // 工具函数
  setDefault(globalObject, 'btoa', btoa);
  setDefault(globalObject, 'atob', atob);

  // 浏览器中全局对象、window 与 self 暴露同一组 Web API。小程序通常没有
  // 原生 window/self，若只把 polyfill 放到 globalThis，GLTFLoader 等 addon
  // 通过 self.URL 或 window.URL 访问时仍会失败。保留宿主已有成员，只补缺失项。
  const browserGlobalKeys = [
    'document', 'Document', 'Element', 'HTMLElement', 'HTMLCanvasElement',
    'HTMLImageElement', 'HTMLVideoElement', 'Image', 'CSSStyleDeclaration', 'DOMTokenList',
    'EventTarget', 'Event', 'UIEvent', 'MouseEvent', 'Touch', 'TouchList', 'TouchEvent',
    'KeyboardEvent', 'WheelEvent', 'PointerEvent',
    'fetch', 'Request', 'Response', 'Headers', 'XMLHttpRequest', 'FormData', 'Blob', 'File',
    'FileReader', 'DOMException', 'URL', 'URLSearchParams',
    'AudioContext', 'webkitAudioContext', 'Audio', 'HTMLAudioElement',
    'WebGL2RenderingContext', 'WebAssembly',
    'location', 'navigator', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame',
    'btoa', 'atob'
  ];
  browserGlobalKeys.forEach(key => {
    const value = globalObject[key];
    if (value !== undefined && value !== null) {
      setDefault(windowObject, key, value);
    }
  });

  if (options.debug) {
    console.log('[threejs-miniprogram-adapter] Polyfills installed successfully');
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

  // 每个 adapter 可传入独立 document，避免多页面图片工厂串到最后一个 canvas。
  const ownerDocument = options.document instanceof Document ? options.document : document;
  ownerDocument.setCanvas(canvas);

  return canvas;
}

/**
 * 获取适配器版本信息
 */
function getVersion() {
  return {
    version: VERSION,
    name: PACKAGE_NAME,
    description: PACKAGE_DESCRIPTION
  };
}

function isVersionAtLeast(version, minimum) {
  const left = String(version || '').split('.').map(value => Number.parseInt(value, 10) || 0);
  const right = String(minimum || '').split('.').map(value => Number.parseInt(value, 10) || 0);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index++) {
    if ((left[index] || 0) > (right[index] || 0)) return true;
    if ((left[index] || 0) < (right[index] || 0)) return false;
  }
  return true;
}

/**
 * 检测运行环境
 */
function detectEnvironment() {
  const { info } = readPlatformInfo();

  return {
    isMiniProgram: typeof wx !== 'undefined',
    platform: info.platform || 'unknown',
    supportWebGL2: Boolean(info.SDKVersion && isVersionAtLeast(info.SDKVersion, '2.24.0'))
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
