/**
 * Window 对象适配
 * 模拟浏览器 window 对象的核心功能
 */

import { readPlatformInfo } from '../platform.js';

class Window {
  constructor() {
    const { info } = readPlatformInfo();
    const windowWidth = info.windowWidth || 375;
    const windowHeight = info.windowHeight || 667;
    this.innerWidth = windowWidth;
    this.innerHeight = windowHeight;
    this.devicePixelRatio = info.pixelRatio || 2;
    this.screen = {
      width: info.screenWidth || windowWidth,
      height: info.screenHeight || windowHeight,
      availWidth: windowWidth,
      availHeight: windowHeight
    };
    this.location = {
      href: '',
      protocol: 'https:',
      host: '',
      hostname: '',
      port: '',
      pathname: '',
      search: '',
      hash: ''
    };
    this.navigator = {
      userAgent: 'WeChat MiniProgram',
      platform: info.platform || 'ios',
      language: info.language || 'zh-CN',
      languages: [info.language || 'zh-CN'],
      onLine: true,
      hardwareConcurrency: 4
    };
    this.performance = {
      now: () => Date.now()
    };
    this.localStorage = null;
    this.sessionStorage = null;

    // 存储 RAF 回调
    this._rafCallbacks = new Map();
    this._rafId = 0;
  }

  requestAnimationFrame(callback) {
    this._rafId++;
    const id = this._rafId;
    this._rafCallbacks.set(id, callback);

    // 使用 setTimeout 模拟 RAF
    setTimeout(() => {
      if (this._rafCallbacks.has(id)) {
        this._rafCallbacks.delete(id);
        callback(Date.now());
      }
    }, 16);

    return id;
  }

  cancelAnimationFrame(id) {
    this._rafCallbacks.delete(id);
  }

  setTimeout(callback, delay, ...args) {
    return setTimeout(callback, delay, ...args);
  }

  clearTimeout(id) {
    clearTimeout(id);
  }

  setInterval(callback, delay, ...args) {
    return setInterval(callback, delay, ...args);
  }

  clearInterval(id) {
    clearInterval(id);
  }

  open(url, target, features) {
    console.warn('window.open is not supported in mini program');
    return null;
  }

  close() {
    console.warn('window.close is not supported in mini program');
  }

  alert(message) {
    if (typeof wx !== 'undefined' && wx.showModal) {
      wx.showModal({
        title: 'Alert',
        content: String(message),
        showCancel: false
      });
    } else {
      console.log('Alert:', message);
    }
  }

  confirm(message) {
    return new Promise((resolve) => {
      if (typeof wx !== 'undefined' && wx.showModal) {
        wx.showModal({
          title: 'Confirm',
          content: String(message),
          success: (res) => resolve(res.confirm)
        });
      } else {
        resolve(false);
      }
    });
  }

  prompt(message, defaultValue = '') {
    return new Promise((resolve) => {
      console.warn('window.prompt is not fully supported in mini program');
      resolve(null);
    });
  }

  // 事件监听（空实现）
  addEventListener(type, listener, options) {
    // 小程序不支持全局 window 事件
  }

  removeEventListener(type, listener, options) {
    // 小程序不支持全局 window 事件
  }

  dispatchEvent(event) {
    return true;
  }
}

// 创建全局 window 实例
const windowInstance = new Window();

// 导出
export { Window };
export default windowInstance;
