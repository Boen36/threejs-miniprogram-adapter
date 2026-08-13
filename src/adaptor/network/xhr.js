/**
 * XMLHttpRequest 适配
 * 基于 wx.request 实现标准的 XHR 接口
 */

import { EventTarget } from '../events/event-target.js';
import { Blob } from './blob.js';

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
    this._sendFlag = false;
    this._requestId = 0;
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
    // 规范：仅在请求进行中（OPENED/HEADERS_RECEIVED/LOADING）禁止 open；
    // DONE 时允许重置实例复用（连接池场景）。
    if (this.readyState !== XMLHttpRequest.UNSENT && this.readyState !== XMLHttpRequest.DONE) {
      throw new Error('Invalid state');
    }

    // 复用实例时重置请求状态
    this._requestHeaders = {};
    this._responseHeaders = {};
    this.status = 0;
    this.statusText = '';
    this.response = '';
    this.responseText = '';
    this.responseXML = null;
    this.responseURL = '';
    this._requestTask = null;
    this._aborted = false;
    this._sendFlag = false;

    this._method = method.toUpperCase();
    this._url = url;
    this._async = async;
    this._user = user;
    this._password = password;

    this.readyState = XMLHttpRequest.OPENED;
    this._callOnReadyStateChange();
  }

  setRequestHeader(header, value) {
    if (this.readyState !== XMLHttpRequest.OPENED || this._sendFlag) {
      throw new Error('Invalid state');
    }
    this._requestHeaders[header] = value;
  }

  send(body = null) {
    if (this.readyState !== XMLHttpRequest.OPENED || this._sendFlag) {
      throw new Error('Invalid state');
    }

    if (!this._async) {
      console.warn('Synchronous XHR is not supported in mini program');
    }

    this._aborted = false;
    this._sendFlag = true;
    const requestId = ++this._requestId;

    // 构建请求参数
    const requestOptions = {
      url: this._url,
      method: this._method,
      header: { ...this._requestHeaders },
      timeout: this._timeout || undefined,
      responseType: this._responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
      success: (res) => {
        if (!this._isActiveRequest(requestId)) return;

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
        this._sendFlag = false;
        this._requestTask = null;
        this._callOnReadyStateChange();
        this._callOnLoad();
      },
      fail: (err) => {
        if (!this._isActiveRequest(requestId)) return;
        this._finishRequestError(err, requestId);
      }
    };

    // 添加 body
    if (body !== null && body !== undefined) {
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
      let task;
      try {
        task = wx.request(requestOptions);
      } catch (error) {
        this._finishRequestError(error, requestId);
        return;
      }

      // success/fail 在部分 mock 中可能同步触发；已结束的请求不得重新挂回 task。
      if (!this._isActiveRequest(requestId)) return;
      this._requestTask = task;

      // 下载进度：把 DownloadTask 的 onProgressUpdate 转发为 progress 事件
      if (this._requestTask && typeof this._requestTask.onProgressUpdate === 'function') {
        this._requestTask.onProgressUpdate((res) => {
          if (!this._isActiveRequest(requestId)) return;
          this._callOnProgress(
            res.totalBytesWritten ?? res.totalBytesSent ?? 0,
            res.totalBytesExpectedToWrite ?? res.totalLength ?? 0
          );
        });
      }
    } else {
      this._finishRequestError(new Error('wx.request is not available'), requestId);
    }
  }

  abort() {
    const wasActive = this._sendFlag;
    const task = this._requestTask;

    this._aborted = wasActive;
    this._sendFlag = false;
    this._requestTask = null;
    this._requestId++;

    if (wasActive && task && typeof task.abort === 'function') {
      try {
        task.abort();
      } catch {
        // 无论底层任务是否成功取消，对外都完成 abort 生命周期。
      }
    }

    this.readyState = XMLHttpRequest.UNSENT;
    this.status = 0;
    this.statusText = '';
    this.response = '';
    this.responseText = '';
    this.responseXML = null;
    this.responseURL = '';
    this._responseHeaders = {};

    if (wasActive) {
      this._callOnAbort();
    }
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
  _isActiveRequest(requestId) {
    return this._sendFlag && !this._aborted && requestId === this._requestId;
  }

  _finishRequestError(error, requestId) {
    if (!this._isActiveRequest(requestId)) return;

    this.status = 0;
    this.statusText = '';
    this.response = '';
    this.responseText = '';
    this.responseXML = null;
    this.responseURL = '';
    this._responseHeaders = {};
    this.readyState = XMLHttpRequest.DONE;
    this._sendFlag = false;
    this._requestTask = null;
    this._callOnReadyStateChange();

    if (error?.errMsg?.includes('timeout') || error?.message?.includes('timeout')) {
      this._callOnTimeout();
    } else {
      this._callOnError(error);
    }
  }

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

// FormData 简单实现（WHATWG 条目列表语义：同名可多值）
class FormData {
  constructor() {
    this._entries = [];
  }

  append(name, value, filename) {
    this._entries.push({ name, value, filename: filename || null });
  }

  delete(name) {
    this._entries = this._entries.filter((entry) => entry.name !== name);
  }

  get(name) {
    const entry = this._entries.find((entry) => entry.name === name);
    return entry ? entry.value : null;
  }

  getAll(name) {
    return this._entries.filter((entry) => entry.name === name).map((entry) => entry.value);
  }

  has(name) {
    return this._entries.some((entry) => entry.name === name);
  }

  set(name, value, filename) {
    this._entries = this._entries
      .filter((entry) => entry.name !== name)
      .concat([{ name, value, filename: filename || null }]);
  }

  forEach(callback, thisArg) {
    for (const entry of this._entries) {
      callback.call(thisArg, entry.value, entry.name, this);
    }
  }

  entries() {
    return this._entries.map((entry) => [entry.name, entry.value])[Symbol.iterator]();
  }

  keys() {
    return this._entries.map((entry) => entry.name)[Symbol.iterator]();
  }

  values() {
    return this._entries.map((entry) => entry.value)[Symbol.iterator]();
  }
}

export { XMLHttpRequest, XMLHttpRequestUpload, FormData };
export default XMLHttpRequest;
