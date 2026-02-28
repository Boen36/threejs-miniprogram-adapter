/**
 * URL 工具适配
 * 提供 URL.createObjectURL 和 URL.revokeObjectURL 的模拟实现
 */

// 临时文件存储
const objectURLs = new Map();
let objectURLCounter = 0;

/**
 * 创建对象 URL
 * 在小程序中，这会创建一个临时文件路径或使用 base64 数据 URL
 * @param {Blob|File} blob
 * @returns {string}
 */
function createObjectURL(blob) {
  if (!blob) {
    throw new TypeError('Argument 1 is not valid for any of the 1-argument overloads of URL.createObjectURL.');
  }

  // 生成唯一 ID
  objectURLCounter++;
  const id = `blob:${location?.origin || 'miniapp'}/${objectURLCounter}`;

  // 存储 blob 数据
  objectURLs.set(id, {
    blob: blob,
    created: Date.now()
  });

  // 如果是小程序环境，尝试写入临时文件
  if (typeof wx !== 'undefined' && wx.getFileSystemManager && blob instanceof Blob) {
    try {
      const tempPath = saveBlobToTempFile(blob, id);
      if (tempPath) {
        return tempPath;
      }
    } catch (e) {
      console.warn('Failed to save blob to temp file:', e);
    }
  }

  // 回退到返回 ID，后续使用时再处理
  return id;
}

/**
 * 将 Blob 保存为小程序临时文件
 * @param {Blob} blob
 * @param {string} id
 * @returns {string|null}
 */
function saveBlobToTempFile(blob, id) {
  const fs = wx.getFileSystemManager();
  const tempFilePath = `${wx.env.USER_DATA_PATH}/blob_${Date.now()}_${objectURLCounter}`;

  blob.arrayBuffer().then(buffer => {
    try {
      fs.writeFileSync(tempFilePath, buffer, 'binary');
    } catch (e) {
      console.warn('Failed to write temp file:', e);
    }
  }).catch(e => {
    console.warn('Failed to read blob:', e);
  });

  // 存储映射
  const stored = objectURLs.get(id);
  if (stored) {
    stored.tempFilePath = tempFilePath;
  }

  return tempFilePath;
}

/**
 * 释放对象 URL
 * @param {string} url
 */
function revokeObjectURL(url) {
  if (!url) return;

  const stored = objectURLs.get(url);
  if (stored) {
    // 删除临时文件
    if (stored.tempFilePath && typeof wx !== 'undefined' && wx.getFileSystemManager) {
      const fs = wx.getFileSystemManager();
      try {
        fs.unlinkSync(stored.tempFilePath);
      } catch (e) {
        // 忽略删除错误
      }
    }

    objectURLs.delete(url);
  }
}

/**
 * 获取 blob 数据（内部使用）
 * @param {string} url
 * @returns {Blob|null}
 */
function getBlobFromURL(url) {
  const stored = objectURLs.get(url);
  return stored ? stored.blob : null;
}

/**
 * 解析 URL
 * @param {string} url
 * @param {string} base
 * @returns {URL}
 */
function parseURL(url, base) {
  // 简单 URL 解析
  let fullURL = url;

  if (base && !url.match(/^[a-z][a-z0-9+.-]*:/i)) {
    // 相对 URL
    const baseObj = new URL(base);
    if (url.startsWith('/')) {
      fullURL = `${baseObj.protocol}//${baseObj.host}${url}`;
    } else if (url.startsWith('#')) {
      fullURL = `${baseObj.protocol}//${baseObj.host}${baseObj.pathname}${url}`;
    } else {
      const basePath = baseObj.pathname.replace(/\/[^\/]*$/, '/');
      fullURL = `${baseObj.protocol}//${baseObj.host}${basePath}${url}`;
    }
  }

  return new URL(fullURL);
}

/**
 * URL 类实现
 */
class URL {
  constructor(url, base) {
    if (base) {
      url = this._resolveURL(url, base);
    }

    this.href = url;
    this._parse(url);
  }

  _parse(url) {
    // 简单解析
    const match = url.match(/^(https?):\/\/([^\/]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i);

    if (match) {
      this.protocol = match[1].toLowerCase() + ':';
      this.host = match[2];
      this.hostname = match[2].split(':')[0];
      this.port = match[2].includes(':') ? match[2].split(':')[1] : '';
      this.pathname = match[3] || '/';
      this.search = match[4] || '';
      this.hash = match[5] || '';
      this.origin = `${this.protocol}//${this.host}`;
    } else {
      // blob: 或其他协议
      this.protocol = url.split(':')[0] + ':';
      this.host = '';
      this.hostname = '';
      this.port = '';
      this.pathname = url.replace(/^[^:]*:/, '');
      this.search = '';
      this.hash = '';
      this.origin = 'null';
    }
  }

  _resolveURL(url, base) {
    // 简化实现
    if (url.match(/^[a-z][a-z0-9+.-]*:/i)) {
      return url;
    }

    const baseURL = new URL(base);
    if (url.startsWith('//')) {
      return `${baseURL.protocol}${url}`;
    }
    if (url.startsWith('/')) {
      return `${baseURL.protocol}//${baseURL.host}${url}`;
    }

    const basePath = baseURL.pathname.replace(/\/[^\/]*$/, '/');
    return `${baseURL.protocol}//${baseURL.host}${basePath}${url}`;
  }

  toString() {
    return this.href;
  }

  toJSON() {
    return this.href;
  }

  static createObjectURL(blob) {
    return createObjectURL(blob);
  }

  static revokeObjectURL(url) {
    revokeObjectURL(url);
  }

  // 搜索参数
  get searchParams() {
    if (!this._searchParams) {
      this._searchParams = new URLSearchParams(this.search);
    }
    return this._searchParams;
  }
}

/**
 * URLSearchParams 类
 */
class URLSearchParams {
  constructor(init) {
    this._params = new Map();

    if (init) {
      if (typeof init === 'string') {
        // 解析查询字符串
        const query = init.startsWith('?') ? init.slice(1) : init;
        query.split('&').forEach(pair => {
          const [key, value] = pair.split('=').map(decodeURIComponent);
          if (key) {
            this.append(key, value || '');
          }
        });
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.append(key, value));
      } else if (typeof init === 'object') {
        Object.keys(init).forEach(key => this.append(key, init[key]));
      }
    }
  }

  append(name, value) {
    if (this._params.has(name)) {
      this._params.set(name, [...this._params.get(name), String(value)]);
    } else {
      this._params.set(name, [String(value)]);
    }
  }

  delete(name) {
    this._params.delete(name);
  }

  get(name) {
    const values = this._params.get(name);
    return values ? values[0] : null;
  }

  getAll(name) {
    return this._params.get(name) || [];
  }

  has(name) {
    return this._params.has(name);
  }

  set(name, value) {
    this._params.set(name, [String(value)]);
  }

  sort() {
    const sorted = new Map([...this._params.entries()].sort());
    this._params = sorted;
  }

  forEach(callback, thisArg) {
    this._params.forEach((values, key) => {
      values.forEach(value => {
        callback.call(thisArg, value, key, this);
      });
    });
  }

  entries() {
    const entries = [];
    this._params.forEach((values, key) => {
      values.forEach(value => entries.push([key, value]));
    });
    return entries[Symbol.iterator]();
  }

  keys() {
    return this._params.keys();
  }

  values() {
    const values = [];
    this._params.forEach(vals => values.push(...vals));
    return values[Symbol.iterator]();
  }

  toString() {
    const pairs = [];
    this._params.forEach((values, key) => {
      values.forEach(value => {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      });
    });
    return pairs.join('&');
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}

export {
  createObjectURL,
  revokeObjectURL,
  getBlobFromURL,
  URL,
  URLSearchParams
};

export default URL;
