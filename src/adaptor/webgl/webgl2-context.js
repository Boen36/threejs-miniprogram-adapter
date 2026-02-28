/**
 * WebGL2RenderingContext 包装器
 * 包装小程序的 WebGL 上下文，提供兼容性增强
 */

/**
 * WebGL2RenderingContext 包装类
 * 代理所有 WebGL 方法调用
 */
class WebGL2RenderingContextWrapper {
  constructor(gl) {
    this._gl = gl;

    // 复制所有 WebGL 常量
    this._copyConstants();

    // 创建方法代理
    this._createMethodProxies();

    // 存储扩展
    this._extensions = new Map();
  }

  _copyConstants() {
    const gl = this._gl;
    const constants = Object.keys(gl).filter(key => typeof gl[key] === 'number');
    constants.forEach(key => {
      this[key] = gl[key];
    });
  }

  _createMethodProxies() {
    const gl = this._gl;
    const proto = Object.getPrototypeOf(gl);
    const methodNames = Object.getOwnPropertyNames(proto).filter(name => {
      return typeof gl[name] === 'function' && name !== 'constructor';
    });

    methodNames.forEach(name => {
      // 特殊处理方法
      if (name === 'getExtension') {
        this[name] = (...args) => this._getExtension(...args);
      } else if (name === 'getSupportedExtensions') {
        this[name] = (...args) => this._getSupportedExtensions(...args);
      } else if (name === 'getParameter') {
        this[name] = (...args) => this._getParameter(...args);
      } else if (name === 'getShaderPrecisionFormat') {
        this[name] = (...args) => this._getShaderPrecisionFormat(...args);
      } else {
        // 通用代理
        this[name] = (...args) => {
          try {
            return gl[name](...args);
          } catch (e) {
            console.warn(`WebGL error in ${name}:`, e);
            return null;
          }
        };
      }
    });

    // 确保 canvas 属性可用
    Object.defineProperty(this, 'canvas', {
      get: () => gl.canvas
    });

    // 确保 drawingBufferWidth/Height 可用
    Object.defineProperty(this, 'drawingBufferWidth', {
      get: () => gl.drawingBufferWidth || gl.canvas.width
    });
    Object.defineProperty(this, 'drawingBufferHeight', {
      get: () => gl.drawingBufferHeight || gl.canvas.height
    });
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
          return gl.getParameter(pname) || 'WebGL 2.0 (MiniProgram)';
        case gl.VENDOR:
          return gl.getParameter(pname) || 'MiniProgram';
        case gl.RENDERER:
          return gl.getParameter(pname) || 'MiniProgram WebGL';
        case gl.SHADING_LANGUAGE_VERSION:
          return gl.getParameter(pname) || 'WebGL GLSL ES 3.00';
        case gl.MAX_TEXTURE_SIZE:
          return gl.getParameter(pname) || 4096;
        case gl.MAX_CUBE_MAP_TEXTURE_SIZE:
          return gl.getParameter(pname) || 4096;
        case gl.MAX_RENDERBUFFER_SIZE:
          return gl.getParameter(pname) || 4096;
        case gl.MAX_VIEWPORT_DIMS:
          return gl.getParameter(pname) || new Int32Array([4096, 4096]);
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
    return true;
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
