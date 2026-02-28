/**
 * Fetch API 适配
 * 基于 wx.request 实现标准的 fetch 接口
 */

// Headers 类
class Headers {
  constructor(init) {
    this._headers = new Map();

    if (init) {
      if (init instanceof Headers) {
        init.forEach((value, key) => this.append(key, value));
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.append(key, value));
      } else if (typeof init === 'object') {
        Object.keys(init).forEach(key => this.append(key, init[key]));
      }
    }
  }

  append(name, value) {
    const normalizedName = String(name).toLowerCase();
    const existing = this._headers.get(normalizedName);
    if (existing) {
      this._headers.set(normalizedName, `${existing}, ${value}`);
    } else {
      this._headers.set(normalizedName, String(value));
    }
  }

  delete(name) {
    this._headers.delete(String(name).toLowerCase());
  }

  get(name) {
    return this._headers.get(String(name).toLowerCase()) || null;
  }

  has(name) {
    return this._headers.has(String(name).toLowerCase());
  }

  set(name, value) {
    this._headers.set(String(name).toLowerCase(), String(value));
  }

  forEach(callback, thisArg) {
    this._headers.forEach((value, key) => {
      callback.call(thisArg, value, key, this);
    });
  }

  entries() {
    return this._headers.entries();
  }

  keys() {
    return this._headers.keys();
  }

  values() {
    return this._headers.values();
  }

  [Symbol.iterator]() {
    return this._headers[Symbol.iterator]();
  }
}

// Request 类
class Request {
  constructor(input, init = {}) {
    if (input instanceof Request) {
      this.url = input.url;
      this.method = init.method || input.method;
      this.headers = new Headers(init.headers || input.headers);
      this.body = init.body !== undefined ? init.body : input.body;
      this.mode = init.mode || input.mode;
      this.credentials = init.credentials || input.credentials;
      this.cache = init.cache || input.cache;
      this.redirect = init.redirect || input.redirect;
      this.referrer = init.referrer || input.referrer;
      this.referrerPolicy = init.referrerPolicy || input.referrerPolicy;
      this.integrity = init.integrity || input.integrity;
      this.keepalive = init.keepalive !== undefined ? init.keepalive : input.keepalive;
      this.signal = init.signal || input.signal;
    } else {
      this.url = String(input);
      this.method = (init.method || 'GET').toUpperCase();
      this.headers = new Headers(init.headers);
      this.body = init.body || null;
      this.mode = init.mode || 'cors';
      this.credentials = init.credentials || 'same-origin';
      this.cache = init.cache || 'default';
      this.redirect = init.redirect || 'follow';
      this.referrer = init.referrer || '';
      this.referrerPolicy = init.referrerPolicy || '';
      this.integrity = init.integrity || '';
      this.keepalive = init.keepalive || false;
      this.signal = init.signal || null;
    }

    // 处理 body
    if (this.body) {
      if (this.body instanceof URLSearchParams) {
        this.body = this.body.toString();
        if (!this.headers.has('content-type')) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded');
        }
      } else if (typeof this.body === 'object' && !(this.body instanceof Blob) && !(this.body instanceof ArrayBuffer)) {
        this.body = JSON.stringify(this.body);
        if (!this.headers.has('content-type')) {
          this.headers.set('content-type', 'application/json');
        }
      }
    }
  }

  clone() {
    return new Request(this);
  }

  text() {
    return Promise.resolve(this.body ? String(this.body) : '');
  }

  json() {
    return Promise.resolve(this.body ? JSON.parse(String(this.body)) : null);
  }

  blob() {
    return Promise.resolve(new Blob([this.body || '']));
  }

  arrayBuffer() {
    return Promise.resolve(this.body instanceof ArrayBuffer ? this.body : new ArrayBuffer(0));
  }

  formData() {
    return Promise.reject(new Error('FormData not supported'));
  }
}

// Response 类
class Response {
  constructor(body, init = {}) {
    this.type = 'default';
    this.url = init.url || '';
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new Headers(init.headers);
    this.redirected = init.redirected || false;

    this._body = body;
    this._bodyUsed = false;

    // 是否可以读取 body
    this.bodyUsed = false;
  }

  get bodyUsed() {
    return this._bodyUsed;
  }

  clone() {
    if (this._bodyUsed) {
      throw new TypeError('Cannot clone a used Response');
    }
    return new Response(this._body, {
      url: this.url,
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      redirected: this.redirected
    });
  }

  _consumeBody() {
    if (this._bodyUsed) {
      throw new TypeError('Body has already been consumed');
    }
    this._bodyUsed = true;
    return this._body;
  }

  async text() {
    const body = this._consumeBody();
    if (typeof body === 'string') return body;
    if (body instanceof ArrayBuffer) {
      return new TextDecoder().decode(body);
    }
    return String(body || '');
  }

  async json() {
    const text = await this.text();
    return JSON.parse(text);
  }

  async blob() {
    const body = this._consumeBody();
    return new Blob([body || '']);
  }

  async arrayBuffer() {
    const body = this._consumeBody();
    if (body instanceof ArrayBuffer) return body;
    if (typeof body === 'string') {
      const encoder = new TextEncoder();
      return encoder.encode(body).buffer;
    }
    return new ArrayBuffer(0);
  }

  async formData() {
    throw new Error('FormData not supported');
  }

  // 静态方法创建特定响应
  static error() {
    return new Response(null, { status: 0, statusText: '' });
  }

  static redirect(url, status = 302) {
    return new Response(null, {
      status,
      headers: { location: String(url) }
    });
  }
}

// fetch 函数实现
async function fetch(input, init = {}) {
  const request = input instanceof Request ? input : new Request(input, init);

  // 检查 signal
  if (request.signal && request.signal.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError');
  }

  return new Promise((resolve, reject) => {
    // 构建请求参数
    const requestOptions = {
      url: request.url,
      method: request.method,
      header: {},
      data: request.body,
      responseType: 'arraybuffer',
      enableHttp2: true,
      enableQuic: true,
      enableCache: request.cache !== 'no-store',
      success: (res) => {
        const headers = new Headers();
        if (res.header) {
          Object.keys(res.header).forEach(key => {
            headers.set(key, res.header[key]);
          });
        }

        // 处理响应数据
        let body = res.data;
        if (body instanceof ArrayBuffer) {
          // 已经是 ArrayBuffer
        } else if (typeof body === 'string') {
          const encoder = new TextEncoder();
          body = encoder.encode(body).buffer;
        } else {
          body = new ArrayBuffer(0);
        }

        const response = new Response(body, {
          url: request.url,
          status: res.statusCode,
          statusText: getStatusText(res.statusCode),
          headers
        });

        resolve(response);
      },
      fail: (err) => {
        reject(new Error(`Request failed: ${err.errMsg || err.message || 'Unknown error'}`));
      }
    };

    // 转换 headers
    request.headers.forEach((value, key) => {
      requestOptions.header[key] = value;
    });

    // 处理本地文件
    if (request.url.startsWith('file://') || request.url.startsWith('wxfile://')) {
      readLocalFile(request.url, resolve, reject);
      return;
    }

    // 处理 data URL
    if (request.url.startsWith('data:')) {
      resolve(handleDataUrl(request.url));
      return;
    }

    // 执行请求
    if (typeof wx !== 'undefined' && wx.request) {
      const task = wx.request(requestOptions);

      // 处理 abort
      if (request.signal) {
        request.signal.addEventListener('abort', () => {
          if (task && task.abort) {
            task.abort();
          }
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      }
    } else {
      reject(new Error('wx.request is not available'));
    }
  });
}

// 读取本地文件
function readLocalFile(filePath, resolve, reject) {
  if (typeof wx === 'undefined' || !wx.getFileSystemManager) {
    reject(new Error('FileSystemManager is not available'));
    return;
  }

  const fs = wx.getFileSystemManager();
  const cleanPath = filePath.replace(/^file:\/\//, '').replace(/^wxfile:\/\//, '');

  fs.readFile({
    filePath: cleanPath,
    encoding: 'binary',
    success: (res) => {
      let data = res.data;
      if (typeof data === 'string') {
        const encoder = new TextEncoder();
        data = encoder.encode(data).buffer;
      }

      resolve(new Response(data, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'application/octet-stream'
        })
      }));
    },
    fail: (err) => {
      reject(new Error(`Failed to read file: ${err.errMsg || err.message}`));
    }
  });
}

// 处理 data URL
function handleDataUrl(url) {
  const match = url.match(/^data:([^;,]+)?(;base64)?,(.+)$/);
  if (!match) {
    return Response.error();
  }

  const [, mimeType = 'text/plain', isBase64, data] = match;
  let buffer;

  if (isBase64) {
    buffer = base64ToArrayBuffer(data);
  } else {
    const encoder = new TextEncoder();
    buffer = encoder.encode(decodeURIComponent(data)).buffer;
  }

  return new Response(buffer, {
    status: 200,
    statusText: 'OK',
    headers: new Headers({
      'content-type': mimeType
    })
  });
}

// Base64 解码
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// atob polyfill
function atob(str) {
  // 小程序环境可能需要自己实现
  if (typeof global !== 'undefined' && global.atob) {
    return global.atob(str);
  }

  // 简单实现
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
}

// 获取状态文本
function getStatusText(status) {
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

// DOMException 简单实现
class DOMException extends Error {
  constructor(message, name) {
    super(message);
    this.name = name;
  }
}

export { fetch, Request, Response, Headers, DOMException };
export default fetch;
