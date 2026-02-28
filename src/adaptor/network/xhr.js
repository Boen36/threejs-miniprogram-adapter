/**
 * XMLHttpRequest 适配
 * 基于 wx.request 实现标准的 XHR 接口
 */

import { EventTarget } from '../events/event-target.js';

class XMLHttpRequest extends EventTarget {
  static UNSENT = 0;
  static OPENED = 1;
  static HEADERS_RECEIVED = 2;
  static LOADING = 3;
  static DONE = 4;

  constructor() {
    super();

    this.readyState = XMLHttpRequest.UNSENT;
    this.status = 0;
    this.statusText = '';
    this.response = '';
    this.responseText = '';
    this.responseXML = null;
    this.responseURL = '';

    this._requestHeaders = {};
    this._responseHeaders = {};
    this._method = '';
    this._url = '';
    this._async = true;
    this._user = null;
    this._password = null;
    this._requestTask = null;
    this._timeout = 0;
    this._responseType = '';
    this._withCredentials = false;
    this._upload = new XMLHttpRequestUpload();
    this._aborted = false;
  }

  // 属性
  get upload() {
    return this._upload;
  }

  get timeout() {
    return this._timeout;
  }

  set timeout(value) {
    this._timeout = value;
  }

  get responseType() {
    return this._responseType;
  }

  set responseType(value) {
    this._responseType = value;
  }

  get withCredentials() {
    return this._withCredentials;
  }

  set withCredentials(value) {
    this._withCredentials = Boolean(value);
  }

  // 方法
  open(method, url, async = true, user = null, password = null) {
    if (this.readyState !== XMLHttpRequest.UNSENT) {
      throw new Error('Invalid state');
    }

    this._method = method.toUpperCase();
    this._url = url;
    this._async = async;
    this._user = user;
    this._password = password;

    this.readyState = XMLHttpRequest.OPENED;
    this._callOnReadyStateChange();
  }

  setRequestHeader(header, value) {
    if (this.readyState !== XMLHttpRequest.OPENED) {
      throw new Error('Invalid state');
    }
    this._requestHeaders[header] = value;
  }

  send(body = null) {
    if (this.readyState !== XMLHttpRequest.OPENED) {
      throw new Error('Invalid state');
    }

    if (!this._async) {
      console.warn('Synchronous XHR is not supported in mini program');
    }

    this._aborted = false;

    // 构建请求参数
    const requestOptions = {
      url: this._url,
      method: this._method,
      header: { ...this._requestHeaders },
      timeout: this._timeout || undefined,
      responseType: this._responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
      success: (res) => {
        if (this._aborted) return;

        this.status = res.statusCode;
        this.statusText = this._getStatusText(res.statusCode);
        this._responseHeaders = res.header || {};
        this.responseURL = this._url;

        // 处理响应数据
        if (this._responseType === 'arraybuffer') {
          this.response = res.data instanceof ArrayBuffer ? res.data : new ArrayBuffer(0);
        } else if (this._responseType === 'json') {
          if (typeof res.data === 'object') {
            this.response = res.data;
          } else {
            try {
              this.response = JSON.parse(res.data);
            } catch (e) {
              this.response = null;
            }
          }
        } else if (this._responseType === 'blob') {
          this.response = new Blob([res.data]);
        } else if (this._responseType === 'document') {
          this.response = null; // XML document not supported
        } else {
          this.response = typeof res.data === 'string' ? res.data : '';
          this.responseText = this.response;
        }

        this.readyState = XMLHttpRequest.DONE;
        this._callOnReadyStateChange();
        this._callOnLoad();
      },
      fail: (err) => {
        if (this._aborted) return;

        this.status = 0;
        this.statusText = '';

        if (err.errMsg && err.errMsg.includes('timeout')) {
          this._callOnTimeout();
        } else {
          this._callOnError(err);
        }
      }
    };

    // 添加 body
    if (body) {
      if (body instanceof ArrayBuffer) {
        requestOptions.data = body;
      } else if (typeof body === 'string') {
        requestOptions.data = body;
      } else if (body instanceof FormData) {
        // 小程序 FormData 支持有限
        requestOptions.data = body;
      } else {
        requestOptions.data = String(body);
      }
    }

    // 触发 loadstart
    this._callOnLoadStart();

    // 执行请求
    if (typeof wx !== 'undefined' && wx.request) {
      this._requestTask = wx.request(requestOptions);
    } else {
      this._callOnError(new Error('wx.request is not available'));
    }
  }

  abort() {
    this._aborted = true;

    if (this._requestTask && this._requestTask.abort) {
      this._requestTask.abort();
    }

    this.readyState = XMLHttpRequest.UNSENT;
    this.status = 0;
    this.statusText = '';

    this._callOnAbort();
  }

  getAllResponseHeaders() {
    if (this.readyState < XMLHttpRequest.HEADERS_RECEIVED) {
      return '';
    }

    return Object.keys(this._responseHeaders)
      .map(key => `${key}: ${this._responseHeaders[key]}`)
      .join('\r\n');
  }

  getResponseHeader(header) {
    if (this.readyState < XMLHttpRequest.HEADERS_RECEIVED) {
      return null;
    }

    const lowerHeader = header.toLowerCase();
    for (const key of Object.keys(this._responseHeaders)) {
      if (key.toLowerCase() === lowerHeader) {
        return this._responseHeaders[key];
      }
    }
    return null;
  }

  overrideMimeType(mime) {
    // 小程序不支持
    console.warn('overrideMimeType is not supported');
  }

  // 私有方法
  _getStatusText(status) {
    const statusTexts = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable'
    };
    return statusTexts[status] || '';
  }

  _callOnReadyStateChange() {
    if (this.onreadystatechange) {
      this.onreadystatechange();
    }
    this.dispatchEvent({ type: 'readystatechange' });
  }

  _callOnLoadStart() {
    if (this.onloadstart) {
      this.onloadstart();
    }
    this.dispatchEvent({ type: 'loadstart' });
  }

  _callOnProgress(loaded, total) {
    const event = {
      type: 'progress',
      lengthComputable: total > 0,
      loaded,
      total
    };
    if (this.onprogress) {
      this.onprogress(event);
    }
    this.dispatchEvent(event);
  }

  _callOnLoad() {
    if (this.onload) {
      this.onload();
    }
    this.dispatchEvent({ type: 'load' });
    this._callOnLoadEnd();
  }

  _callOnError(error) {
    if (this.onerror) {
      this.onerror(error);
    }
    this.dispatchEvent({ type: 'error', error });
    this._callOnLoadEnd();
  }

  _callOnAbort() {
    if (this.onabort) {
      this.onabort();
    }
    this.dispatchEvent({ type: 'abort' });
    this._callOnLoadEnd();
  }

  _callOnTimeout() {
    if (this.ontimeout) {
      this.ontimeout();
    }
    this.dispatchEvent({ type: 'timeout' });
    this._callOnLoadEnd();
  }

  _callOnLoadEnd() {
    if (this.onloadend) {
      this.onloadend();
    }
    this.dispatchEvent({ type: 'loadend' });
  }
}

// XMLHttpRequestUpload 类
class XMLHttpRequestUpload extends EventTarget {
  constructor() {
    super();
  }
}

// FormData 简单实现
class FormData {
  constructor() {
    this._data = new Map();
  }

  append(name, value, filename) {
    if (filename && value instanceof Blob) {
      this._data.set(name, { value, filename });
    } else {
      this._data.set(name, value);
    }
  }

  delete(name) {
    this._data.delete(name);
  }

  get(name) {
    return this._data.get(name) || null;
  }

  getAll(name) {
    const value = this._data.get(name);
    return value ? [value] : [];
  }

  has(name) {
    return this._data.has(name);
  }

  set(name, value, filename) {
    this.append(name, value, filename);
  }

  forEach(callback, thisArg) {
    this._data.forEach((value, key) => {
      callback.call(thisArg, value, key, this);
    });
  }

  entries() {
    return this._data.entries();
  }

  keys() {
    return this._data.keys();
  }

  values() {
    return this._data.values();
  }
}

export { XMLHttpRequest, XMLHttpRequestUpload, FormData };
export default XMLHttpRequest;
