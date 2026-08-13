/**
 * Loader 兼容工具。
 * 标准 Loader 由全局适配层支持；这里只保留显式纹理 helper 与旧 API 迁移层。
 */

import { MiniProgramDRACOLoader } from './draco-loader.js';

import { document as fallbackDocument } from '../adaptor/dom/document.js';

const deprecationWarnings = new Set();

function warnDeprecated(name, migration) {
  if (deprecationWarnings.has(name)) return;
  deprecationWarnings.add(name);
  console.warn(
    `[threejs-miniprogram-adapter] LoaderPlugins.${name}() is deprecated. ${migration}`
  );
}

function createImageElement(documentObject) {
  const activeDocument = documentObject ||
    (typeof globalThis !== 'undefined' ? globalThis.document : null) ||
    fallbackDocument;
  return activeDocument.createElementNS('http://www.w3.org/1999/xhtml', 'img');
}

/**
 * 创建适配小程序的文件加载函数
 * 用于替换 Loader 的加载方法
 * @deprecated 使用适配器安装的 fetch/XMLHttpRequest 与 three.js FileLoader。
 */
function createFileLoader() {
  warnDeprecated('createFileLoader', 'Use THREE.FileLoader with the installed fetch/XMLHttpRequest polyfills.');
  return {
    load: function(url, onLoad, onProgress, onError) {
      // 使用适配的 fetch
      if (typeof fetch !== 'undefined') {
        fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.arrayBuffer();
          })
          .then(buffer => {
            if (onLoad) onLoad(buffer);
          })
          .catch(error => {
            console.error('FileLoader error:', error);
            if (onError) onError(error);
          });
      } else {
        // 回退到 XMLHttpRequest
        const request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';

        request.addEventListener('load', function() {
          if (request.status === 200 || request.status === 0) {
            if (onLoad) onLoad(request.response);
          } else {
            if (onError) onError(new Error(`HTTP ${request.status}: ${request.statusText}`));
          }
        });

        request.addEventListener('progress', function(event) {
          if (onProgress) onProgress(event);
        });

        request.addEventListener('error', function() {
          if (onError) onError(new Error('Network request failed'));
        });

        request.send();
      }
    }
  };
}

/**
 * @deprecated 该函数始终原样返回输入；调用方直接使用 URL 即可。
 */
function resolvePath(url) {
  warnDeprecated('resolvePath', 'Use the original URL directly.');
  return url;
}

/**
 * @deprecated Document/Image polyfill 已支持标准 THREE.TextureLoader；不再改写原型。
 */
function enhanceTextureLoader() {
  warnDeprecated('enhanceTextureLoader', 'Use THREE.TextureLoader directly after adaptForMiniProgram().');
}

/**
 * @deprecated 标准 GLTFLoader 已由全局适配层支持；不再改写原型。
 */
function enhanceGLTFLoader() {
  warnDeprecated('enhanceGLTFLoader', 'Use GLTFLoader directly after adaptForMiniProgram().');
}

/**
 * @deprecated 该函数没有产生有效路径转换；不再改写原型。
 */
function enhanceOBJLoader() {
  warnDeprecated('enhanceOBJLoader', 'Use OBJLoader directly; no adapter-specific patch is applied.');
}

/**
 * @deprecated 该函数没有产生有效路径转换；不再改写原型。
 */
function enhanceMTLLoader() {
  warnDeprecated('enhanceMTLLoader', 'Use MTLLoader directly; no adapter-specific patch is applied.');
}

/**
 * @deprecated 该函数没有产生有效路径转换；不再改写原型。
 */
function enhanceFBXLoader() {
  warnDeprecated('enhanceFBXLoader', 'Use FBXLoader directly; no adapter-specific patch is applied.');
}

/**
 * @deprecated 不再批量改写 three.js Loader 原型。
 */
function enhanceAllLoaders() {
  warnDeprecated('enhanceAllLoaders', 'Use standard three.js loaders after adaptForMiniProgram().');
}

/**
 * 创建带缓存的加载器
 * 小程序网络请求较慢，缓存很重要
 * @deprecated 使用 THREE.Cache 或在业务层管理可释放的资源缓存。
 */
function createCachedLoader(THREE, LoaderClass) {
  warnDeprecated('createCachedLoader', 'Use THREE.Cache or an application-owned resource cache.');
  const cache = new Map();
  const MAX_CACHE_ENTRIES = 50;

  function remember(key, value) {
    if (cache.has(key)) {
      cache.delete(key); // 命中时刷新为最近使用
    } else if (cache.size >= MAX_CACHE_ENTRIES) {
      // 超过上限按 LRU 淘汰最旧条目（与 objectURL 临时文件回收策略一致）
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    cache.set(key, value);
  }

  return class CachedLoader extends LoaderClass {
    load(url, onLoad, onProgress, onError) {
      // 检查缓存
      if (cache.has(url)) {
        const cached = cache.get(url);
        remember(url, cached);
        if (onLoad) {
          setTimeout(() => onLoad(cached), 0);
        }
        return cached;
      }

      // 包装 onLoad 以缓存结果
      const wrappedOnLoad = (result) => {
        remember(url, result);
        if (onLoad) onLoad(result);
      };

      return super.load(url, wrappedOnLoad, onProgress, onError);
    }

    // 清除缓存
    static clearCache() {
      cache.clear();
    }

    // 获取缓存大小
    static getCacheSize() {
      return cache.size;
    }
  };
}

/**
 * 从 base64 加载纹理
 * 小程序中常用
 */
function loadTextureFromBase64(THREE, base64Data, onLoad, onError, options = {}) {
  if (!THREE || !THREE.Texture) {
    if (onError) onError(new Error('THREE not available'));
    return null;
  }

  const image = createImageElement(options?.document);
  image.crossOrigin = 'anonymous';

  const texture = new THREE.Texture();
  texture.image = image;

  image.onload = () => {
    texture.needsUpdate = true;
    if (onLoad) onLoad(texture);
  };

  image.onerror = (err) => {
    if (onError) onError(err);
  };

  image.src = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;

  return texture;
}

/**
 * 从本地文件加载纹理
 * @param {Object} THREE - three.js
 * @param {string} filePath - 本地文件路径（如 wxfile:// 或 file://）
 */
function loadTextureFromFile(THREE, filePath, onLoad, onError, options = {}) {
  if (!THREE || !THREE.Texture) {
    if (onError) onError(new Error('THREE not available'));
    return null;
  }

  const image = createImageElement(options?.document);
  image.crossOrigin = 'anonymous';

  const texture = new THREE.Texture();
  texture.image = image;

  image.onload = () => {
    texture.needsUpdate = true;
    if (onLoad) onLoad(texture);
  };

  image.onerror = (err) => {
    if (onError) onError(err);
  };

  image.src = filePath;

  return texture;
}

export {
  createFileLoader,
  MiniProgramDRACOLoader,
  resolvePath,
  enhanceTextureLoader,
  enhanceGLTFLoader,
  enhanceOBJLoader,
  enhanceMTLLoader,
  enhanceFBXLoader,
  enhanceAllLoaders,
  createCachedLoader,
  loadTextureFromBase64,
  loadTextureFromFile
};

export default {
  enhanceAllLoaders,
  MiniProgramDRACOLoader,
  createCachedLoader,
  loadTextureFromBase64,
  loadTextureFromFile
};
