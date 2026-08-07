/**
 * Fetch API 适配
 * 基于 wx.request 实现标准的 fetch 接口
 */

import { Blob } from './blob.js';
import { URLSearchParams } from '../media/url.js';

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
      this.body = init.body ?? null;
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
    this.status = init.status ?? 200;
    this.statusText = init.statusText ?? 'OK';
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new Headers(init.headers);
    this.redirected = init.redirected || false;

    this._body = body;
    this._bodyUsed = false;

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
      // enableHttp2/enableQuic 交由宿主默认（强制开启在部分企业网络/代理下会失败）
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

    // 处理本地文件（file://、wxfile://、或 wx.env.USER_DATA_PATH 前缀；
    // 后者兼容开发者工具的 http://usr 形态）
    if (isLocalFilePath(request.url)) {
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

/**
 * 判断 URL 是否指向小程序沙箱内的本地文件。
 * 兼容三种形态：file://（浏览器风格）、wxfile://（真机）、
 * wx.env.USER_DATA_PATH 前缀（开发者工具为 http://usr）。
 */
function isLocalFilePath(url) {
  if (url.startsWith('file://') || url.startsWith('wxfile://')) return true;
  const userDataPath = typeof wx !== 'undefined' && wx.env ? wx.env.USER_DATA_PATH : null;
  if (userDataPath && (url === userDataPath || url.startsWith(`${userDataPath}/`))) return true;
  return false;
}

/**
 * 归一化本地文件路径：file:// 映射为 wxfile://（fs 可读的协议路径），
 * wxfile:// 与开发者工具的 http://usr 形态原样保留。
 */
function normalizeLocalFilePath(filePath) {
  if (filePath.startsWith('file://')) {
    const rest = filePath.slice('file://'.length);
    return `wxfile://${rest.startsWith('/') ? rest.slice(1) : rest}`;
  }
  return filePath;
}

/**
 * 沙箱白名单校验：只允许读取小程序自身的数据目录（usr）与代码包（store），
 * 拒绝路径遍历，包括宿主 fs 可能 URL 解码的编码形式：
 * %2e（.）、%2f（/）、%5c（\）、%25（% —— 双编码纵深防御）、%00（NUL 截断）；
 * 以及 Windows 风格归一化后的 '..' 变体（尾部点/空格，如 '.. '、'...'）与字面 NUL。
 * 合法沙箱路径（USER_DATA_PATH + 自生成文件名）不含这些模式，拒绝零误伤；
 * %20 等普通编码文件名仍可用。
 */
function isSafeLocalPath(filePath) {
  // 编码形式统一小写匹配（大小写不敏感）
  const forbiddenEncodings = ['%2e', '%2f', '%5c', '%25', '%00'];
  if (filePath.split(/[\\/]/).some(segment => {
    // Windows 风格归一化：%20 先解码为空格，再匹配 '..' 变体（'.. '、'...' 等）
    const decoded = segment.replace(/%20/gi, ' ');
    const lower = segment.toLowerCase();
    return segment === '..' ||
      /^\.{2,}[ .]*$/.test(decoded) ||
      forbiddenEncodings.some(encoding => lower.includes(encoding)) ||
      segment.includes('\u0000');
  })) {
    return false;
  }
  if (filePath.startsWith('wxfile://')) {
    return filePath === 'wxfile://usr' || filePath.startsWith('wxfile://usr/') ||
      filePath === 'wxfile://store' || filePath.startsWith('wxfile://store/');
  }
  const userDataPath = typeof wx !== 'undefined' && wx.env ? wx.env.USER_DATA_PATH : null;
  if (userDataPath && (filePath === userDataPath || filePath.startsWith(`${userDataPath}/`))) {
    return true;
  }
  return false;
}

// 读取本地文件
function readLocalFile(filePath, resolve, reject) {
  if (typeof wx === 'undefined' || !wx.getFileSystemManager) {
    reject(new Error('FileSystemManager is not available'));
    return;
  }

  const fs = wx.getFileSystemManager();
  const normalizedPath = normalizeLocalFilePath(filePath);

  if (!isSafeLocalPath(normalizedPath)) {
    reject(new Error('Local file access is restricted to the mini program sandbox'));
    return;
  }

  fs.readFile({
    filePath: normalizedPath,
    success: (res) => {
      let data = res.data;
      if (typeof data === 'string') {
        const bytes = new Uint8Array(data.length);
        for (let index = 0; index < data.length; index++) {
          bytes[index] = data.charCodeAt(index) & 0xff;
        }
        data = bytes.buffer;
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
    let decoded;
    try {
      decoded = decodeURIComponent(data);
    } catch {
      // 非法百分号序列：按原样保留，避免 URIError 外泄
      decoded = data;
    }
    const encoder = new TextEncoder();
    buffer = encoder.encode(decoded).buffer;
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

  // 补齐 padding，避免末尾越界产生 '\0'；length%4===1 必然是非法输入
  let input = String(str).replace(/\s/g, '');
  if (input.length % 4 === 1) {
    throw new DOMException('The string to be decoded is not correctly encoded.', 'InvalidCharacterError');
  }
  while (input.length % 4 !== 0) {
    input += '=';
  }

  // 简单实现
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;

  while (i < input.length) {
    const enc1 = chars.indexOf(input.charAt(i++));
    const enc2 = chars.indexOf(input.charAt(i++));
    const enc3 = chars.indexOf(input.charAt(i++));
    const enc4 = chars.indexOf(input.charAt(i++));

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

export { fetch, Request, Response, Headers, DOMException, atob };
export default fetch;
