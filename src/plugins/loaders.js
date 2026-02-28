/**
 * Loader 插件增强
 * 为 three.js 的各种 Loader 提供小程序环境适配
 */

/**
 * 创建适配小程序的文件加载函数
 * 用于替换 Loader 的加载方法
 */
function createFileLoader() {
  return {
    load: function(url, onLoad, onProgress, onError) {
      // 处理小程序路径
      const resolvedUrl = resolvePath(url);

      // 使用适配的 fetch
      if (typeof fetch !== 'undefined') {
        fetch(resolvedUrl)
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
        request.open('GET', resolvedUrl, true);
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
 * 解析路径
 * 处理小程序特有的路径格式
 */
function resolvePath(url) {
  if (!url) return url;

  // 已经是完整 URL
  if (url.startsWith('http://') || url.startsWith('https://') ||
      url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // 小程序本地文件路径
  if (url.startsWith('wxfile://') || url.startsWith('file://')) {
    return url;
  }

  // 相对路径，可能需要处理
  return url;
}

/**
 * 增强 TextureLoader
 * 添加小程序图片加载支持
 */
function enhanceTextureLoader(THREE) {
  if (!THREE || !THREE.TextureLoader) {
    console.warn('THREE.TextureLoader not available');
    return;
  }

  const originalLoad = THREE.TextureLoader.prototype.load;

  THREE.TextureLoader.prototype.load = function(url, onLoad, onProgress, onError) {
    const resolvedUrl = resolvePath(url);

    // 创建小程序图片
    const image = new Image();
    image.crossOrigin = 'anonymous';

    const texture = new THREE.Texture();
    texture.image = image;

    image.onload = () => {
      texture.needsUpdate = true;
      if (onLoad) onLoad(texture);
    };

    image.onerror = (err) => {
      console.error('Failed to load texture:', url, err);
      if (onError) onError(err);
    };

    image.src = resolvedUrl;

    return texture;
  };
}

/**
 * 增强 GLTFLoader
 * 处理 GLTF 资源路径和资源加载
 */
function enhanceGLTFLoader(THREE) {
  if (!THREE || !THREE.GLTFLoader) {
    return;
  }

  const originalSetDRACOLoader = THREE.GLTFLoader.prototype.setDRACOLoader;
  const originalSetKTX2Loader = THREE.GLTFLoader.prototype.setKTX2Loader;

  // 确保路径处理正确
  const originalLoad = THREE.GLTFLoader.prototype.load;
  THREE.GLTFLoader.prototype.load = function(url, onLoad, onProgress, onError) {
    const resolvedUrl = resolvePath(url);
    return originalLoad.call(this, resolvedUrl, onLoad, onProgress, onError);
  };
}

/**
 * 增强 OBJLoader
 */
function enhanceOBJLoader(THREE) {
  if (!THREE || !THREE.OBJLoader) {
    return;
  }

  const originalLoad = THREE.OBJLoader.prototype.load;
  THREE.OBJLoader.prototype.load = function(url, onLoad, onProgress, onError) {
    const resolvedUrl = resolvePath(url);
    return originalLoad.call(this, resolvedUrl, onLoad, onProgress, onError);
  };
}

/**
 * 增强 MTLLoader
 */
function enhanceMTLLoader(THREE) {
  if (!THREE || !THREE.MTLLoader) {
    return;
  }

  const originalLoad = THREE.MTLLoader.prototype.load;
  THREE.MTLLoader.prototype.load = function(url, onLoad, onProgress, onError) {
    const resolvedUrl = resolvePath(url);
    return originalLoad.call(this, resolvedUrl, onLoad, onProgress, onError);
  };

  // 设置材质路径
  const originalSetPath = THREE.MTLLoader.prototype.setPath;
  THREE.MTLLoader.prototype.setPath = function(path) {
    const resolvedPath = resolvePath(path);
    return originalSetPath.call(this, resolvedPath);
  };
}

/**
 * 增强 FBXLoader
 */
function enhanceFBXLoader(THREE) {
  if (!THREE || !THREE.FBXLoader) {
    return;
  }

  const originalLoad = THREE.FBXLoader.prototype.load;
  THREE.FBXLoader.prototype.load = function(url, onLoad, onProgress, onError) {
    const resolvedUrl = resolvePath(url);
    return originalLoad.call(this, resolvedUrl, onLoad, onProgress, onError);
  };
}

/**
 * 应用所有 Loader 增强
 * @param {Object} THREE - three.js 实例
 */
function enhanceAllLoaders(THREE) {
  if (!THREE) {
    console.warn('THREE is not available');
    return;
  }

  enhanceTextureLoader(THREE);
  enhanceGLTFLoader(THREE);
  enhanceOBJLoader(THREE);
  enhanceMTLLoader(THREE);
  enhanceFBXLoader(THREE);

  // 增强 FileLoader（基础加载器）
  if (THREE.FileLoader) {
    const originalLoad = THREE.FileLoader.prototype.load;
    THREE.FileLoader.prototype.load = function(url, onLoad, onProgress, onError) {
      const resolvedUrl = resolvePath(url);
      return originalLoad.call(this, resolvedUrl, onLoad, onProgress, onError);
    };
  }
}

/**
 * 创建带缓存的加载器
 * 小程序网络请求较慢，缓存很重要
 */
function createCachedLoader(THREE, LoaderClass) {
  const cache = new Map();

  return class CachedLoader extends LoaderClass {
    load(url, onLoad, onProgress, onError) {
      // 检查缓存
      if (cache.has(url)) {
        const cached = cache.get(url);
        if (onLoad) {
          setTimeout(() => onLoad(cached), 0);
        }
        return cached;
      }

      // 包装 onLoad 以缓存结果
      const wrappedOnLoad = (result) => {
        cache.set(url, result);
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
function loadTextureFromBase64(THREE, base64Data, onLoad, onError) {
  if (!THREE || !THREE.TextureLoader) {
    if (onError) onError(new Error('THREE not available'));
    return null;
  }

  const image = new Image();
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
function loadTextureFromFile(THREE, filePath, onLoad, onError) {
  if (!THREE || !THREE.TextureLoader) {
    if (onError) onError(new Error('THREE not available'));
    return null;
  }

  const image = new Image();
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
  createCachedLoader,
  loadTextureFromBase64,
  loadTextureFromFile
};
