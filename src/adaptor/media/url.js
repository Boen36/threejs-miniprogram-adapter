/**
 * URL 工具适配
 * 提供 URL.createObjectURL 和 URL.revokeObjectURL 的模拟实现
 */

// 临时文件存储
const objectURLs = new Map();
let objectURLCounter = 0;

// 对象 URL 上限：数量与估算字节双上限，防止长时间运行的 Map 与临时文件无限增长
const MAX_OBJECT_URLS = 50;
const MAX_OBJECT_URL_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * 淘汰最旧的对象 URL（LRU），数量或估算字节超过上限时自动 revoke。
 */
function evictOldestIfNeeded() {
  let totalBytes = 0;
  objectURLs.forEach(stored => {
    totalBytes += stored.size || 0;
  });

  while (objectURLs.size > MAX_OBJECT_URLS || totalBytes > MAX_OBJECT_URL_BYTES) {
    let oldestKey = null;
    let oldestCreated = Infinity;
    let oldestSize = 0;
    objectURLs.forEach((stored, key) => {
      if (stored.created < oldestCreated) {
        oldestCreated = stored.created;
        oldestKey = key;
        oldestSize = stored.size || 0;
      }
    });
    if (oldestKey === null) break;
    totalBytes -= oldestSize;
    revokeObjectURL(oldestKey);
  }
}

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
  const origin = typeof location !== 'undefined' && location.origin ? location.origin : 'miniapp';
  const id = `blob:${origin}/${objectURLCounter}`;

  // 存储 blob 数据
  objectURLs.set(id, {
    blob: blob,
    size: blob.size || 0,
    created: Date.now()
  });

  // 数量/容量超限时淘汰最旧项（含其临时文件）
  evictOldestIfNeeded();

  // 如果是小程序环境，尝试写入临时文件
  if (typeof wx !== 'undefined' && wx.getFileSystemManager) {
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
  if (typeof blob._toUint8ArraySync !== 'function') return null;

  const fs = wx.getFileSystemManager();
  const tempFilePath = `${wx.env.USER_DATA_PATH}/blob_${Date.now()}_${objectURLCounter}`;
  const bytes = blob._toUint8ArraySync();
  fs.writeFileSync(tempFilePath, bytes.buffer);

  // 存储映射
  const stored = objectURLs.get(id);
  if (stored) {
    stored.tempFilePath = tempFilePath;
    objectURLs.delete(id);
    objectURLs.set(tempFilePath, stored);
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

// 容错解码：+ 表示空格；无效百分号序列按原样保留（WHATWG 不抛错）
function decodeSearchParam(value) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value.replace(/\+/g, ' ');
  }
}

// WHATWG application/x-www-form-urlencoded 序列化：空格 -> '+'
function serializeSearchParam(value) {
  return encodeURIComponent(String(value))
    .replace(/%20/g, '+')
    .replace(/[!'()~]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

class URLSearchParams {
  constructor(init) {
    // 查询对列表，保持插入顺序（WHATWG 语义）
    this._pairs = [];

    if (init) {
      if (typeof init === 'string') {
        // 解析查询字符串
        const query = init.startsWith('?') ? init.slice(1) : init;
        if (query) {
          query.split('&').forEach(pair => {
            if (!pair) return;
            const eq = pair.indexOf('=');
            const rawKey = eq === -1 ? pair : pair.slice(0, eq);
            const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
            // 规范允许空 key（如 '=1'），不做过滤
            this.append(decodeSearchParam(rawKey), decodeSearchParam(rawValue));
          });
        }
      } else if (init instanceof URLSearchParams) {
        init.forEach((value, key) => this.append(key, value));
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.append(key, value));
      } else if (typeof init === 'object') {
        Object.keys(init).forEach(key => this.append(key, init[key]));
      }
    }
  }

  append(name, value) {
    this._pairs.push([String(name), String(value)]);
  }

  delete(name) {
    const target = String(name);
    this._pairs = this._pairs.filter(([key]) => key !== target);
  }

  get(name) {
    const target = String(name);
    const pair = this._pairs.find(([key]) => key === target);
    return pair ? pair[1] : null;
  }

  getAll(name) {
    const target = String(name);
    return this._pairs.filter(([key]) => key === target).map(([, value]) => value);
  }

  has(name) {
    const target = String(name);
    return this._pairs.some(([key]) => key === target);
  }

  set(name, value) {
    const target = String(name);
    const first = this._pairs.findIndex(([key]) => key === target);
    if (first === -1) {
      this._pairs.push([target, String(value)]);
      return;
    }
    this._pairs[first] = [target, String(value)];
    // 移除其余同名项，保持首个位置不变
    this._pairs = this._pairs.filter(([key], index) => index === first || key !== target);
  }

  sort() {
    // 按 name 的 UTF-16 码元稳定排序（Array.prototype.sort 稳定）
    this._pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }

  forEach(callback, thisArg) {
    this._pairs.forEach(([key, value]) => {
      callback.call(thisArg, value, key, this);
    });
  }

  entries() {
    return this._pairs.map(pair => [...pair])[Symbol.iterator]();
  }

  keys() {
    return this._pairs.map(([key]) => key)[Symbol.iterator]();
  }

  values() {
    return this._pairs.map(([, value]) => value)[Symbol.iterator]();
  }

  toString() {
    return this._pairs
      .map(([key, value]) => `${serializeSearchParam(key)}=${serializeSearchParam(value)}`)
      .join('&');
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
