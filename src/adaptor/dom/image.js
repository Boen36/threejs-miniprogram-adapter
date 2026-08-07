/**
 * HTMLImageElement 适配
 * 模拟浏览器 Image 对象，使用小程序 wx.createImage
 */

import { HTMLElement } from './element.js';

class HTMLImageElement extends HTMLElement {
  constructor(imageFactory = null) {
    super('img');
    this._src = '';
    this._crossOrigin = null;
    this._width = 0;
    this._height = 0;
    this._naturalWidth = 0;
    this._naturalHeight = 0;
    this._complete = false;
    this._loading = false;
    this._image = null;
    this._imageFactory = imageFactory;
    this._loadToken = 0;
  }

  get src() {
    return this._src;
  }

  set src(value) {
    if (this._src === value) return;
    this._src = value;
    this._complete = false;
    this._loading = true;
    // 使进行中的旧请求失效，避免旧图完成后覆盖新 src 的状态
    this._loadToken++;

    if (!value) {
      this._handleError(new Error('Empty source'));
      return;
    }

    // 创建小程序图片对象
    this._loadImage(value);
  }

  _loadImage(src) {
    // 记录本次请求令牌：旧请求完成时不得覆盖新请求的状态
    const token = this._loadToken;

    // 使用小程序的 createImage
    let img;
    if (this._imageFactory) {
      img = this._imageFactory();
    }
    if (!img && typeof wx !== 'undefined' && wx.createImage) {
      img = wx.createImage();
    }
    if (!img) {
      console.error('wx.createImage is not available');
      this._handleError(new Error('wx.createImage is not available'));
      return;
    }

    img.crossOrigin = this._crossOrigin || 'anonymous';

    img.onload = () => {
      if (token !== this._loadToken) return; // 旧请求，忽略
      this._image = img;
      this._width = img.width || 0;
      this._height = img.height || 0;
      this._naturalWidth = img.width || 0;
      this._naturalHeight = img.height || 0;
      this._complete = true;
      this._loading = false;

      if (this.onload) {
        this.onload();
      }
      this.dispatchEvent({ type: 'load' });
    };

    img.onerror = (err) => {
      if (token !== this._loadToken) return; // 旧请求，忽略
      this._complete = false;
      this._loading = false;
      this._handleError(err || new Error('Failed to load image'));
    };

    img.src = src;
  }

  _handleError(error) {
    if (this.onerror) {
      this.onerror(error);
    }
    this.dispatchEvent({ type: 'error', error });
  }

  get crossOrigin() {
    return this._crossOrigin;
  }

  set crossOrigin(value) {
    this._crossOrigin = value;
  }

  get width() {
    return this._width;
  }

  set width(value) {
    this._width = value;
  }

  get height() {
    return this._height;
  }

  set height(value) {
    this._height = value;
  }

  get naturalWidth() {
    return this._naturalWidth;
  }

  get naturalHeight() {
    return this._naturalHeight;
  }

  get complete() {
    return this._complete;
  }

  get loading() {
    return this._loading;
  }

  // 获取原始小程序图片对象
  get _miniProgramImage() {
    return this._image;
  }

  decode() {
    // 返回一个 Promise，模拟图片解码
    return new Promise((resolve, reject) => {
      if (this._complete) {
        resolve();
      } else if (this._loading) {
        const onLoad = () => {
          this.removeEventListener('load', onLoad);
          this.removeEventListener('error', onError);
          resolve();
        };
        const onError = (e) => {
          this.removeEventListener('load', onLoad);
          this.removeEventListener('error', onError);
          reject(e.error || new Error('Image decode failed'));
        };
        this.addEventListener('load', onLoad);
        this.addEventListener('error', onError);
      } else {
        reject(new Error('Image not loaded'));
      }
    });
  }
}

// 导出 Image 构造函数作为别名
const Image = HTMLImageElement;

export { HTMLImageElement, Image };
export default HTMLImageElement;
