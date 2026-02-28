/**
 * Document 对象适配
 * 模拟浏览器 document 对象的核心功能
 */

import { Element, HTMLElement } from './element.js';

class Document extends HTMLElement {
  constructor() {
    super('#document');
    this.nodeType = 9;
    this._elementsById = new Map();
    this._head = new HTMLElement('head');
    this._body = new HTMLElement('body');
    this._documentElement = new HTMLElement('html');
    this._documentElement.appendChild(this._head);
    this._documentElement.appendChild(this._body);
    this._canvas = null;
  }

  get documentElement() {
    return this._documentElement;
  }

  get head() {
    return this._head;
  }

  get body() {
    return this._body;
  }

  get defaultView() {
    // 返回 window 对象
    return typeof global !== 'undefined' ? global : this;
  }

  get location() {
    return {
      href: '',
      protocol: 'https:',
      host: '',
      hostname: '',
      port: '',
      pathname: '',
      search: '',
      hash: ''
    };
  }

  get cookie() {
    return '';
  }

  set cookie(value) {
    // 小程序不支持 cookie
    console.warn('document.cookie is not supported in mini program');
  }

  get referrer() {
    return '';
  }

  get title() {
    return '';
  }

  set title(value) {
    // 小程序页面标题通过 wx.setNavigationBarTitle 设置
    if (typeof wx !== 'undefined' && wx.setNavigationBarTitle) {
      wx.setNavigationBarTitle({ title: value });
    }
  }

  setCanvas(canvas) {
    this._canvas = canvas;
    if (canvas.id) {
      this._elementsById.set(canvas.id, canvas);
    }
  }

  getElementById(id) {
    if (this._canvas && this._canvas.id === id) {
      return this._canvas;
    }
    return this._elementsById.get(id) || null;
  }

  getElementsByTagName(tagName) {
    const results = [];
    const search = (element) => {
      if (element.tagName === tagName.toUpperCase()) {
        results.push(element);
      }
      if (element.children) {
        element.children.forEach(search);
      }
    };
    search(this._documentElement);
    return results;
  }

  getElementsByClassName(className) {
    const results = [];
    const search = (element) => {
      if (element.classList && element.classList.contains(className)) {
        results.push(element);
      }
      if (element.children) {
        element.children.forEach(search);
      }
    };
    search(this._documentElement);
    return results;
  }

  getElementsByName(name) {
    // 返回空数组，小程序中不常用
    return [];
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      return this.getElementById(selector.slice(1));
    }
    return this._documentElement.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this._documentElement.querySelectorAll(selector);
  }

  createElement(tagName) {
    tagName = tagName.toLowerCase();
    // 动态导入以避免循环依赖
    switch (tagName) {
      case 'canvas':
        const { HTMLCanvasElement } = require('./canvas.js');
        return new HTMLCanvasElement();
      case 'img':
      case 'image':
        const { HTMLImageElement } = require('./image.js');
        return new HTMLImageElement();
      case 'video':
        const { HTMLVideoElement } = require('./video.js');
        return new HTMLVideoElement();
      case 'div':
      case 'span':
      case 'p':
      case 'a':
      case 'button':
      case 'input':
      case 'textarea':
      case 'select':
      case 'option':
      case 'ul':
      case 'ol':
      case 'li':
        return new HTMLElement(tagName);
      default:
        return new HTMLElement(tagName);
    }
  }

  createElementNS(namespaceURI, qualifiedName) {
    // 小程序不支持 namespace，直接创建普通元素
    return this.createElement(qualifiedName);
  }

  createTextNode(text) {
    return {
      nodeType: 3,
      textContent: String(text),
      data: String(text),
      length: String(text).length
    };
  }

  createComment(data) {
    return {
      nodeType: 8,
      data: String(data),
      textContent: String(data)
    };
  }

  createDocumentFragment() {
    return new Element('#document-fragment');
  }

  createEvent(type) {
    return {
      type: type,
      bubbles: false,
      cancelable: false,
      composed: false,
      defaultPrevented: false,
      target: null,
      currentTarget: null,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {},
      stopImmediatePropagation() {}
    };
  }

  createTouchList() {
    return [];
  }

  elementFromPoint(x, y) {
    if (this._canvas) {
      const rect = this._canvas.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return this._canvas;
      }
    }
    return null;
  }

  hasFocus() {
    return true;
  }

  execCommand(commandId, showUI, value) {
    console.warn('document.execCommand is not supported in mini program');
    return false;
  }

  open() {
    return this;
  }

  close() {
    // 小程序不支持
  }

  write() {
    console.warn('document.write is not supported in mini program');
  }

  writeln() {
    console.warn('document.writeln is not supported in mini program');
  }
}

// 创建 document 实例
const document = new Document();

export { Document, document };
export default document;
