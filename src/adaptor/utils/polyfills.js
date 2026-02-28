/**
 * 全局 polyfills 工具
 * 为小程序环境提供缺失的浏览器 API
 */

/**
 * 安装所有全局 polyfills
 */
export function installGlobalPolyfills() {
  // 确保 global 对象存在
  if (typeof global === 'undefined') {
    global = {};
  }

  // requestAnimationFrame polyfill
  if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (callback) => {
      return setTimeout(callback, 1000 / 60);
    };
  }

  if (!global.cancelAnimationFrame) {
    global.cancelAnimationFrame = (id) => {
      clearTimeout(id);
    };
  }

  // performance.now polyfill
  if (!global.performance) {
    global.performance = {};
  }
  if (!global.performance.now) {
    const start = Date.now();
    global.performance.now = () => Date.now() - start;
  }

  // console 增强
  if (typeof console === 'undefined') {
    global.console = {
      log: () => {},
      warn: () => {},
      error: () => {},
      info: () => {}
    };
  }

  // 数学函数扩展
  if (!Math.sign) {
    Math.sign = (x) => {
      x = +x;
      if (x === 0 || isNaN(x)) return x;
      return x > 0 ? 1 : -1;
    };
  }

  if (!Math.trunc) {
    Math.trunc = (x) => {
      return x < 0 ? Math.ceil(x) : Math.floor(x);
    };
  }

  if (!Math.cbrt) {
    Math.cbrt = (x) => {
      const y = Math.pow(Math.abs(x), 1 / 3);
      return x < 0 ? -y : y;
    };
  }

  // Array 方法 polyfill
  if (!Array.prototype.fill) {
    Array.prototype.fill = function(value, start = 0, end = this.length) {
      for (let i = start; i < end; i++) {
        this[i] = value;
      }
      return this;
    };
  }

  if (!Array.prototype.find) {
    Array.prototype.find = function(predicate, thisArg) {
      for (let i = 0; i < this.length; i++) {
        if (predicate.call(thisArg, this[i], i, this)) {
          return this[i];
        }
      }
      return undefined;
    };
  }

  if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function(predicate, thisArg) {
      for (let i = 0; i < this.length; i++) {
        if (predicate.call(thisArg, this[i], i, this)) {
          return i;
        }
      }
      return -1;
    };
  }

  if (!Array.prototype.includes) {
    Array.prototype.includes = function(searchElement, fromIndex = 0) {
      return this.indexOf(searchElement, fromIndex) !== -1;
    };
  }

  // Object 方法 polyfill
  if (!Object.assign) {
    Object.assign = function(target, ...sources) {
      sources.forEach(source => {
        if (source) {
          Object.keys(source).forEach(key => {
            target[key] = source[key];
          });
        }
      });
      return target;
    };
  }

  if (!Object.entries) {
    Object.entries = function(obj) {
      return Object.keys(obj).map(key => [key, obj[key]]);
    };
  }

  if (!Object.values) {
    Object.values = function(obj) {
      return Object.keys(obj).map(key => obj[key]);
    };
  }

  // String 方法 polyfill
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(search, pos = 0) {
      return this.substr(pos, search.length) === search;
    };
  }

  if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(search, length = this.length) {
      return this.substr(length - search.length, search.length) === search;
    };
  }

  if (!String.prototype.includes) {
    String.prototype.includes = function(search, start = 0) {
      return this.indexOf(search, start) !== -1;
    };
  }

  // Promise polyfill（如果基础库不支持）
  if (typeof Promise === 'undefined') {
    console.warn('Promise is not supported in this environment');
  }

  // Symbol polyfill（简化版）
  if (typeof Symbol === 'undefined') {
    global.Symbol = function(description) {
      return `@@${description}_${Math.random()}`;
    };
    global.Symbol.iterator = '@@iterator';
  }

  // WeakMap polyfill（简化版）
  if (typeof WeakMap === 'undefined') {
    global.WeakMap = class WeakMap {
      constructor() {
        this._map = new Map();
      }
      set(key, value) {
        if (typeof key !== 'object' || key === null) {
          throw new TypeError('Invalid value used as weak map key');
        }
        this._map.set(key, value);
        return this;
      }
      get(key) {
        return this._map.get(key);
      }
      has(key) {
        return this._map.has(key);
      }
      delete(key) {
        return this._map.delete(key);
      }
    };
  }

  // WeakSet polyfill（简化版）
  if (typeof WeakSet === 'undefined') {
    global.WeakSet = class WeakSet {
      constructor() {
        this._set = new Set();
      }
      add(value) {
        if (typeof value !== 'object' || value === null) {
          throw new TypeError('Invalid value used in weak set');
        }
        this._set.add(value);
        return this;
      }
      has(value) {
        return this._set.has(value);
      }
      delete(value) {
        return this._set.delete(value);
      }
    };
  }

  // Map polyfill
  if (typeof Map === 'undefined') {
    global.Map = class Map {
      constructor(iterable) {
        this._keys = [];
        this._values = [];
        if (iterable) {
          for (const [key, value] of iterable) {
            this.set(key, value);
          }
        }
      }
      set(key, value) {
        const index = this._keys.indexOf(key);
        if (index === -1) {
          this._keys.push(key);
          this._values.push(value);
        } else {
          this._values[index] = value;
        }
        return this;
      }
      get(key) {
        const index = this._keys.indexOf(key);
        return index === -1 ? undefined : this._values[index];
      }
      has(key) {
        return this._keys.indexOf(key) !== -1;
      }
      delete(key) {
        const index = this._keys.indexOf(key);
        if (index !== -1) {
          this._keys.splice(index, 1);
          this._values.splice(index, 1);
          return true;
        }
        return false;
      }
      clear() {
        this._keys = [];
        this._values = [];
      }
      get size() {
        return this._keys.length;
      }
      forEach(callback, thisArg) {
        for (let i = 0; i < this._keys.length; i++) {
          callback.call(thisArg, this._values[i], this._keys[i], this);
        }
      }
      keys() {
        return this._keys[Symbol.iterator]();
      }
      values() {
        return this._values[Symbol.iterator]();
      }
      entries() {
        return this._keys.map((key, i) => [key, this._values[i]])[Symbol.iterator]();
      }
      [Symbol.iterator]() {
        return this.entries();
      }
    };
  }

  // Set polyfill
  if (typeof Set === 'undefined') {
    global.Set = class Set {
      constructor(iterable) {
        this._values = [];
        if (iterable) {
          for (const value of iterable) {
            this.add(value);
          }
        }
      }
      add(value) {
        if (!this.has(value)) {
          this._values.push(value);
        }
        return this;
      }
      has(value) {
        return this._values.indexOf(value) !== -1;
      }
      delete(value) {
        const index = this._values.indexOf(value);
        if (index !== -1) {
          this._values.splice(index, 1);
          return true;
        }
        return false;
      }
      clear() {
        this._values = [];
      }
      get size() {
        return this._values.length;
      }
      forEach(callback, thisArg) {
        for (const value of this._values) {
          callback.call(thisArg, value, value, this);
        }
      }
      keys() {
        return this._values[Symbol.iterator]();
      }
      values() {
        return this._values[Symbol.iterator]();
      }
      entries() {
        return this._values.map(v => [v, v])[Symbol.iterator]();
      }
      [Symbol.iterator]() {
        return this.values();
      }
    };
  }
}

export default installGlobalPolyfills;
