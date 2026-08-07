/**
 * WebGL2RenderingContext 包装器
 * 包装小程序的 WebGL 上下文，提供兼容性增强
 */

/**
 * WebGL2RenderingContext 包装类
 * 代理所有 WebGL 方法调用
 */
class WebGL2RenderingContextWrapper {
  constructor(gl, canvas = null, isWebGL2 = true) {
    if (!gl) {
      throw new TypeError('A WebGL context is required');
    }

    this._gl = gl;
    this._canvas = canvas;
    this._isWebGL2 = Boolean(isWebGL2);
    this._extensions = new Map();
    this._maxTextureSize = null;
    this._proxiedNames = [];

    // 读取最大纹理尺寸，用于超限贴图预警
    try {
      if (gl.MAX_TEXTURE_SIZE !== undefined) {
        this._maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || null;
      }
    } catch {
      this._maxTextureSize = null;
    }

    // three.js 通过 gl.constructor.name 判定 WebGL 版本（r160~r162），
    // 这里伪装构造器名避免走错代码路径。instanceof 不受影响。
    Object.defineProperty(this, 'constructor', {
      configurable: true,
      value: { name: this._isWebGL2 ? 'WebGL2RenderingContext' : 'WebGLRenderingContext' }
    });

    // Mini-program contexts expose members inconsistently: some are own
    // properties, while others live on one of several prototypes.
    this._createPropertyProxies();
    this._ensureFallbackMethods();
  }

  /**
   * 兜底宿主缺失的上下文方法（部分小程序实现不提供）。
   */
  _ensureFallbackMethods() {
    const gl = this._gl;
    if (typeof gl.isContextLost !== 'function' && typeof this.isContextLost !== 'function') {
      this.isContextLost = () => false;
    }
    if (typeof gl.getContextAttributes !== 'function' && typeof this.getContextAttributes !== 'function') {
      this.getContextAttributes = () => ({});
    }
  }

  _getPropertyNames() {
    const names = new Set();
    let current = this._gl;

    while (current && current !== Object.prototype) {
      Reflect.ownKeys(current).forEach(name => {
        if (typeof name === 'string') names.add(name);
      });
      current = Object.getPrototypeOf(current);
    }

    return names;
  }

  _unwrapArgument(value) {
    if (value && value._miniProgramImage) return value._miniProgramImage;
    if (value && value._miniProgramCanvas) return value._miniProgramCanvas;
    return value;
  }

  _createPropertyProxies() {
    const gl = this._gl;
    const reserved = new Set([
      'constructor', '_gl', '_canvas', '_extensions', 'canvas',
      'drawingBufferWidth', 'drawingBufferHeight'
    ]);

    this._getPropertyNames().forEach(name => {
      if (reserved.has(name)) return;

      let value;
      try {
        value = gl[name];
      } catch (error) {
        return;
      }

      if (typeof value === 'function') {
        const specialMethods = {
          getExtension: (...args) => this._getExtension(...args),
          getSupportedExtensions: (...args) => this._getSupportedExtensions(...args),
          getParameter: (...args) => this._getParameter(...args),
          getShaderPrecisionFormat: (...args) => this._getShaderPrecisionFormat(...args),
          texImage2D: (...args) => {
            this._checkOversizedTexture(args[args.length - 1]);
            return Reflect.apply(value, gl, args.map(argument => this._unwrapArgument(argument)));
          },
          texSubImage2D: (...args) => {
            this._checkOversizedTexture(args[args.length - 1]);
            return Reflect.apply(value, gl, args.map(argument => this._unwrapArgument(argument)));
          },
          texImage3D: (...args) => {
            this._checkOversizedTexture(args[args.length - 1]);
            return Reflect.apply(value, gl, args.map(argument => this._unwrapArgument(argument)));
          },
          texSubImage3D: (...args) => {
            this._checkOversizedTexture(args[args.length - 1]);
            return Reflect.apply(value, gl, args.map(argument => this._unwrapArgument(argument)));
          }
        };

        this[name] = specialMethods[name] || ((...args) =>
          Reflect.apply(value, gl, args.map(argument => this._unwrapArgument(argument))));
        this._proxiedNames.push(name);
        return;
      }

      // 常量属性只读（three.js 会写 drawingBufferColorSpace/unpackColorSpace）
      const writable = new Set(['drawingBufferColorSpace', 'unpackColorSpace']);
      Object.defineProperty(this, name, {
        configurable: true,
        enumerable: true,
        get: () => gl[name],
        set: writable.has(name)
          ? (nextValue) => {
            gl[name] = nextValue;
          }
          : undefined
      });
      this._proxiedNames.push(name);
    });

    Object.defineProperty(this, 'canvas', {
      configurable: true,
      get: () => this._canvas || gl.canvas
    });
    Object.defineProperty(this, 'drawingBufferWidth', {
      configurable: true,
      get: () => gl.drawingBufferWidth || gl.canvas?.width || this._canvas?.width || 0
    });
    Object.defineProperty(this, 'drawingBufferHeight', {
      configurable: true,
      get: () => gl.drawingBufferHeight || gl.canvas?.height || this._canvas?.height || 0
    });
    this._proxiedNames.push('canvas', 'drawingBufferWidth', 'drawingBufferHeight');
  }

  /**
   * 热替换底层原生上下文（iOS 切后台后系统可能销毁原上下文）。
   * 返回是否替换成功；three.js 持有的 wrapper 引用不变，所有 GL 调用自动走新上下文。
   */
  _replaceContext(newGl) {
    if (!newGl || newGl === this._gl) return false;

    this._gl = newGl;
    this._proxiedNames.forEach(name => {
      try {
        delete this[name];
      } catch {
        // 忽略不可删除的属性
      }
    });
    this._proxiedNames = [];
    this._extensions.clear();
    try {
      if (newGl.MAX_TEXTURE_SIZE !== undefined) {
        this._maxTextureSize = newGl.getParameter(newGl.MAX_TEXTURE_SIZE) || null;
      }
    } catch {
      this._maxTextureSize = null;
    }
    this._createPropertyProxies();
    this._ensureFallbackMethods();
    return true;
  }

  // 获取扩展（增强版）
  _getExtension(name) {
    // 检查缓存
    if (this._extensions.has(name)) {
      return this._extensions.get(name);
    }

    const gl = this._gl;
    let extension = gl.getExtension(name);

    // 如果获取不到，尝试一些兼容处理
    if (!extension) {
      extension = this._createExtensionFallback(name);
    }

    // 包装扩展以提供额外功能
    if (extension) {
      extension = this._wrapExtension(extension, name);
    }

    this._extensions.set(name, extension);
    return extension;
  }

  // 创建扩展降级方案
  _createExtensionFallback(name) {
    const fallbackExtensions = {
      'EXT_color_buffer_float': null,
      'EXT_color_buffer_half_float': null,
      'WEBGL_compressed_texture_s3tc': null,
      'WEBGL_compressed_texture_etc': null,
      'WEBGL_compressed_texture_astc': null,
      'WEBGL_debug_renderer_info': {
        UNMASKED_VENDOR_WEBGL: 0x9245,
        UNMASKED_RENDERER_WEBGL: 0x9246,
        getParameter: (pname) => {
          if (pname === 0x9245) return 'MiniProgram WebGL';
          if (pname === 0x9246) return 'MiniProgram Renderer';
          return null;
        }
      },
      'WEBGL_lose_context': {
        loseContext: () => console.warn('loseContext not supported'),
        restoreContext: () => console.warn('restoreContext not supported')
      },
      'WEBGL_depth_texture': null,
      'OES_texture_float_linear': null,
      'OES_texture_half_float_linear': null,
      'OES_texture_float': null,
      'OES_texture_half_float': null,
      'EXT_shader_texture_lod': null
    };

    return fallbackExtensions[name] || null;
  }

  // 包装扩展对象
  _wrapExtension(extension, name) {
    if (!extension) return null;

    // 如果扩展只是一个常量对象，添加基础方法
    const wrapper = Object.create(extension);

    // 确保扩展常量可用
    Object.keys(extension).forEach(key => {
      if (typeof extension[key] === 'number') {
        wrapper[key] = extension[key];
      }
    });

    // 方法绑定到原始扩展对象，避免调用时 this 错绑（Illegal invocation）
    Object.getOwnPropertyNames(extension).forEach(key => {
      if (typeof extension[key] === 'function') {
        wrapper[key] = (...args) => Reflect.apply(extension[key], extension, args);
      }
    });

    return wrapper;
  }

  // 获取支持的扩展列表
  _getSupportedExtensions() {
    const gl = this._gl;
    try {
      return gl.getSupportedExtensions() || [];
    } catch (e) {
      // 返回常见扩展的静态列表
      return [
        'WEBGL_debug_renderer_info',
        'WEBGL_lose_context',
        'EXT_texture_filter_anisotropic',
        'WEBGL_compressed_texture_s3tc',
        'WEBGL_compressed_texture_etc',
        'WEBGL_compressed_texture_astc'
      ];
    }
  }

  // 获取参数（增强版）
  _getParameter(pname) {
    const gl = this._gl;

    try {
      // 特殊处理某些参数
      switch (pname) {
        case gl.VERSION:
          return gl.getParameter(pname) ?? 'WebGL 2.0 (MiniProgram)';
        case gl.VENDOR:
          return gl.getParameter(pname) ?? 'MiniProgram';
        case gl.RENDERER:
          return gl.getParameter(pname) ?? 'MiniProgram WebGL';
        case gl.SHADING_LANGUAGE_VERSION:
          return gl.getParameter(pname) ?? 'WebGL GLSL ES 3.00';
        case gl.MAX_TEXTURE_SIZE:
          return gl.getParameter(pname) ?? 4096;
        case gl.MAX_CUBE_MAP_TEXTURE_SIZE:
          return gl.getParameter(pname) ?? 4096;
        case gl.MAX_RENDERBUFFER_SIZE:
          return gl.getParameter(pname) ?? 4096;
        case gl.MAX_VIEWPORT_DIMS:
          return gl.getParameter(pname) ?? new Int32Array([4096, 4096]);
        default:
          return gl.getParameter(pname);
      }
    } catch (e) {
      console.warn(`Error getting parameter ${pname}:`, e);
      return null;
    }
  }

  // 获取着色器精度格式
  _getShaderPrecisionFormat(shaderType, precisionType) {
    const gl = this._gl;
    try {
      const format = gl.getShaderPrecisionFormat(shaderType, precisionType);
      if (format) return format;
    } catch (e) {
      // 返回默认值
    }

    // 默认精度格式
    return {
      precision: 23,
      rangeMin: 127,
      rangeMax: 127
    };
  }

  // 获取原始 WebGL 上下文
  get _rawContext() {
    return this._gl;
  }

  // 工具方法：检查是否为 WebGL2 上下文
  get isWebGL2() {
    return this._isWebGL2;
  }

  // 超限贴图预警：three.js 会用 2D canvas 缩放超大贴图，小程序环境没有
  // 可用的 2D canvas（getContext('2d') 返回 null），提前警告避免难排查的崩溃。
  _checkOversizedTexture(image) {
    if (!image || typeof image !== 'object' || !image._miniProgramImage) return;
    const img = image._miniProgramImage;
    if (typeof img.width !== 'number' || typeof img.height !== 'number') return;
    if (this._maxTextureSize && (img.width > this._maxTextureSize || img.height > this._maxTextureSize)) {
      console.warn(
        `[threejs-miniprogram-adapter] Texture size ${img.width}x${img.height} exceeds ` +
        `maxTextureSize ${this._maxTextureSize}; three.js needs a 2D canvas to resize it, ` +
        'which is unavailable in mini program. The upload may fail — please downscale the image.'
      );
    }
  }
}

// 辅助函数：检查 WebGL 支持
function checkWebGLSupport(canvas) {
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    return {
      supported: false,
      reason: 'WebGL2 not supported'
    };
  }

  return {
    supported: true,
    context: gl,
    vendor: gl.getParameter(gl.VENDOR),
    renderer: gl.getParameter(gl.RENDERER),
    version: gl.getParameter(gl.VERSION)
  };
}

// 辅助函数：获取 WebGL 能力报告
function getWebGLCapabilities(gl) {
  if (!gl || !gl._rawContext) {
    return null;
  }

  const rawGl = gl._rawContext;

  return {
    maxTextureSize: rawGl.getParameter(rawGl.MAX_TEXTURE_SIZE),
    maxCubeMapSize: rawGl.getParameter(rawGl.MAX_CUBE_MAP_TEXTURE_SIZE),
    maxRenderBufferSize: rawGl.getParameter(rawGl.MAX_RENDERBUFFER_SIZE),
    maxViewportDims: rawGl.getParameter(rawGl.MAX_VIEWPORT_DIMS),
    maxVertexAttribs: rawGl.getParameter(rawGl.MAX_VERTEX_ATTRIBS),
    maxVertexUniformVectors: rawGl.getParameter(rawGl.MAX_VERTEX_UNIFORM_VECTORS),
    maxFragmentUniformVectors: rawGl.getParameter(rawGl.MAX_FRAGMENT_UNIFORM_VECTORS),
    maxTextureImageUnits: rawGl.getParameter(rawGl.MAX_TEXTURE_IMAGE_UNITS),
    maxVertexTextureImageUnits: rawGl.getParameter(rawGl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
    maxDrawBuffers: rawGl.getParameter(rawGl.MAX_DRAW_BUFFERS),
    maxColorAttachments: rawGl.getParameter(rawGl.MAX_COLOR_ATTACHMENTS),
    maxSamples: rawGl.getParameter(rawGl.MAX_SAMPLES)
  };
}

export { WebGL2RenderingContextWrapper, checkWebGLSupport, getWebGLCapabilities };
export default WebGL2RenderingContextWrapper;
