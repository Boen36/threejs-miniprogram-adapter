/**
 * WebGL 扩展支持检测和报告
 */

/**
 * WebGL 扩展管理器
 * 检测和报告 WebGL 扩展支持情况
 */
class WebGLExtensions {
  constructor(gl) {
    this._gl = gl;
    this._supportedExtensions = new Set();
    this._unsupportedExtensions = new Set();
    this._capabilities = {};

    this._detectExtensions();
  }

  _detectExtensions() {
    const gl = this._gl;

    if (!gl || !gl._rawContext) {
      return;
    }

    const rawGl = gl._rawContext;

    // 常见扩展列表
    const commonExtensions = [
      // 纹理压缩
      'WEBGL_compressed_texture_s3tc',
      'WEBGL_compressed_texture_s3tc_srgb',
      'WEBGL_compressed_texture_etc',
      'WEBGL_compressed_texture_etc1',
      'WEBGL_compressed_texture_astc',
      'WEBGL_compressed_texture_pvrtc',

      // 纹理功能
      'EXT_color_buffer_float',
      'EXT_color_buffer_half_float',
      'WEBGL_color_buffer_float',
      'OES_texture_float_linear',
      'OES_texture_half_float_linear',
      'EXT_texture_filter_anisotropic',
      'WEBGL_depth_texture',

      // 着色器
      'EXT_shader_texture_lod',
      'OES_standard_derivatives',
      'OES_fbo_render_mipmap',
      'WEBGL_draw_buffers',

      // 调试和性能
      'WEBGL_debug_renderer_info',
      'WEBGL_lose_context',
      'EXT_disjoint_timer_query',
      'EXT_disjoint_timer_query_webgl2',

      // 其他
      'OES_element_index_uint',
      'OES_vertex_array_object',
      'ANGLE_instanced_arrays',
      'KHR_parallel_shader_compile'
    ];

    // 检测每个扩展
    commonExtensions.forEach(name => {
      const ext = rawGl.getExtension(name);
      if (ext) {
        this._supportedExtensions.add(name);
      } else {
        this._unsupportedExtensions.add(name);
      }
    });

    // 获取能力
    this._detectCapabilities();
  }

  _detectCapabilities() {
    const gl = this._gl;
    if (!gl || !gl._rawContext) return;

    const rawGl = gl._rawContext;

    this._capabilities = {
      // 纹理尺寸
      maxTextureSize: this._getSafeParameter(rawGl.MAX_TEXTURE_SIZE, 2048),
      maxCubeMapSize: this._getSafeParameter(rawGl.MAX_CUBE_MAP_TEXTURE_SIZE, 2048),
      maxRenderBufferSize: this._getSafeParameter(rawGl.MAX_RENDERBUFFER_SIZE, 2048),

      // 视口
      maxViewportDims: this._getSafeParameter(rawGl.MAX_VIEWPORT_DIMS, new Int32Array([2048, 2048])),

      // 顶点属性
      maxVertexAttribs: this._getSafeParameter(rawGl.MAX_VERTEX_ATTRIBS, 16),

      // Uniform
      maxVertexUniforms: this._getSafeParameter(rawGl.MAX_VERTEX_UNIFORM_VECTORS, 256),
      maxFragmentUniforms: this._getSafeParameter(rawGl.MAX_FRAGMENT_UNIFORM_VECTORS, 256),

      // 纹理单元
      maxTextureImageUnits: this._getSafeParameter(rawGl.MAX_TEXTURE_IMAGE_UNITS, 8),
      maxVertexTextureImageUnits: this._getSafeParameter(rawGl.MAX_VERTEX_TEXTURE_IMAGE_UNITS, 0),

      // 多重渲染目标
      maxDrawBuffers: this._getSafeParameter(rawGl.MAX_DRAW_BUFFERS, 1),
      maxColorAttachments: this._getSafeParameter(rawGl.MAX_COLOR_ATTACHMENTS, 1),

      // MSAA
      maxSamples: this._getSafeParameter(rawGl.MAX_SAMPLES, 1),

      // 变换反馈
      maxTransformFeedbackSeparateComponents: this._getSafeParameter(rawGl.MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS, 4),

      // Uniform Buffer
      maxUniformBufferBindings: this._getSafeParameter(rawGl.MAX_UNIFORM_BUFFER_BINDINGS, 24),

      // 版本信息
      version: rawGl.getParameter(rawGl.VERSION),
      shadingLanguageVersion: rawGl.getParameter(rawGl.SHADING_LANGUAGE_VERSION),
      vendor: rawGl.getParameter(rawGl.VENDOR),
      renderer: rawGl.getParameter(rawGl.RENDERER)
    };
  }

  _getSafeParameter(pname, defaultValue) {
    try {
      return this._gl._rawContext.getParameter(pname) || defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  // 检查是否支持某个扩展
  hasExtension(name) {
    return this._supportedExtensions.has(name);
  }

  // 获取支持的扩展列表
  getSupportedExtensions() {
    return Array.from(this._supportedExtensions);
  }

  // 获取不支持的扩展列表
  getUnsupportedExtensions() {
    return Array.from(this._unsupportedExtensions);
  }

  // 获取所有能力
  getCapabilities() {
    return { ...this._capabilities };
  }

  // 获取特定能力
  getCapability(name) {
    return this._capabilities[name];
  }

  // 获取扩展报告
  getReport() {
    return {
      supported: this.getSupportedExtensions(),
      unsupported: this.getUnsupportedExtensions(),
      capabilities: this.getCapabilities()
    };
  }

  // 检查必需扩展
  checkRequiredExtensions(required) {
    const missing = required.filter(ext => !this._supportedExtensions.has(ext));
    return {
      satisfied: missing.length === 0,
      missing
    };
  }

  // 检查 three.js 所需的最小能力
  checkThreeJSRequirements() {
    const required = {
      minTextureSize: 2048,
      minCubeMapSize: 1024,
      minVertexAttribs: 8,
      minVertexUniforms: 128,
      minFragmentUniforms: 64
    };

    const caps = this._capabilities;
    const issues = [];

    if (caps.maxTextureSize < required.minTextureSize) {
      issues.push(`Max texture size (${caps.maxTextureSize}) is less than recommended (${required.minTextureSize})`);
    }

    if (caps.maxCubeMapSize < required.minCubeMapSize) {
      issues.push(`Max cube map size (${caps.maxCubeMapSize}) is less than recommended (${required.minCubeMapSize})`);
    }

    if (caps.maxVertexAttribs < required.minVertexAttribs) {
      issues.push(`Max vertex attribs (${caps.maxVertexAttribs}) is less than required (${required.minVertexAttribs})`);
    }

    if (caps.maxVertexUniforms < required.minVertexUniforms) {
      issues.push(`Max vertex uniforms (${caps.maxVertexUniforms}) is less than recommended (${required.minVertexUniforms})`);
    }

    if (caps.maxFragmentUniforms < required.minFragmentUniforms) {
      issues.push(`Max fragment uniforms (${caps.maxFragmentUniforms}) is less than recommended (${required.minFragmentUniforms})`);
    }

    return {
      compatible: issues.length === 0,
      issues,
      capabilities: caps
    };
  }

  // 打印报告到控制台
  printReport() {
    const report = this.getReport();

    console.log('=== WebGL Extensions Report ===');
    console.log('Supported Extensions:', report.supported.join(', ') || 'None');
    console.log('Unsupported Extensions:', report.unsupported.join(', ') || 'None');
    console.log('Capabilities:', report.capabilities);

    const threejsCheck = this.checkThreeJSRequirements();
    console.log('Three.js Compatibility:', threejsCheck.compatible ? 'Compatible' : 'Issues Found');
    if (!threejsCheck.compatible) {
      console.warn('Issues:', threejsCheck.issues);
    }
  }
}

// 快速检测函数
function detectWebGLExtensions(gl) {
  const detector = new WebGLExtensions(gl);
  return detector.getReport();
}

// 检查小程序特定的限制
function checkMiniProgramLimitations(gl) {
  const limitations = [];

  // 检查 WebGL 上下文
  if (!gl) {
    limitations.push('WebGL context not available');
    return limitations;
  }

  // 检查是否为 WebGL2
  const rawGl = gl._rawContext || gl;
  try {
    const version = rawGl.getParameter(rawGl.VERSION);
    if (!version || !version.includes('WebGL 2')) {
      limitations.push('WebGL 2.0 not supported, some features may not work');
    }
  } catch (e) {
    limitations.push('Unable to query WebGL version');
  }

  // 检查小程序特定扩展
  const requiredForMiniProgram = [
    'WEBGL_debug_renderer_info'
  ];

  requiredForMiniProgram.forEach(extName => {
    if (!rawGl.getExtension(extName)) {
      limitations.push(`${extName} not available`);
    }
  });

  return limitations;
}

export { WebGLExtensions, detectWebGLExtensions, checkMiniProgramLimitations };
export default WebGLExtensions;
