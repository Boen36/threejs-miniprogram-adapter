import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  WebGL2RenderingContextWrapper,
  checkWebGLSupport,
  getWebGLCapabilities
} from '../src/adaptor/webgl/webgl2-context.js';
import { HTMLCanvasElement } from '../src/adaptor/dom/canvas.js';

/** 构建一个可控的 mock WebGL2 上下文。 */
function createMockGL() {
  const calls = [];
  const gl = {
    VERSION: 0x1f02,
    VENDOR: 0x1f00,
    RENDERER: 0x1f01,
    SHADING_LANGUAGE_VERSION: 0x8b8c,
    MAX_TEXTURE_SIZE: 0x0d33,
    MAX_VIEWPORT_DIMS: 0x0d3a,
    clearColor: (r, g, b, a) => calls.push(['clearColor', r, g, b, a]),
    clear: (mask) => calls.push(['clear', mask]),
    getParameter(parameter) {
      calls.push(['getParameter', parameter]);
      if (parameter === this.VERSION) return 'WebGL 2.0';
      if (parameter === this.MAX_VIEWPORT_DIMS) return new Int32Array([1024, 1024]);
      return null; // 其余返回 null，用于测 fallback
    },
    getExtension(name) {
      calls.push(['getExtension', name]);
      return null; // 全部走 fallback 路径
    },
    getSupportedExtensions() {
      calls.push(['getSupportedExtensions']);
      throw new Error('not supported');
    },
    getShaderPrecisionFormat(shaderType, precisionType) {
      calls.push(['getShaderPrecisionFormat', shaderType, precisionType]);
      throw new Error('not supported');
    },
    texImage2D(target, level, internalFormat, ...rest) {
      calls.push(['texImage2D', target, level, internalFormat, ...rest]);
    }
  };
  return { calls, gl };
}

describe('WebGL2RenderingContextWrapper', () => {
  test('requires a context and exposes the raw context', () => {
    assert.throws(() => new WebGL2RenderingContextWrapper(), TypeError);
    const { gl } = createMockGL();
    const wrapper = new WebGL2RenderingContextWrapper(gl);
    assert.equal(wrapper._rawContext, gl);
    assert.equal(wrapper.isWebGL2, true);
  });

  test('proxies method calls to the wrapped context', () => {
    const { calls, gl } = createMockGL();
    const wrapper = new WebGL2RenderingContextWrapper(gl);

    wrapper.clearColor(0.1, 0.2, 0.3, 1);
    wrapper.clear(0x4000);
    assert.deepEqual(calls.find(call => call[0] === 'clearColor'), ['clearColor', 0.1, 0.2, 0.3, 1]);
    assert.deepEqual(calls.find(call => call[0] === 'clear'), ['clear', 0x4000]);
  });

  test('exposes constructor.name for three.js version detection', () => {
    const { gl } = createMockGL();
    const wrapper = new WebGL2RenderingContextWrapper(gl);
    assert.equal(wrapper.constructor.name, 'WebGL2RenderingContext');
    assert.equal(wrapper.isWebGL2, true);
    assert.ok(wrapper instanceof WebGL2RenderingContextWrapper); // instanceof 不受伪装影响

    const webgl1 = new WebGL2RenderingContextWrapper(gl, null, false);
    assert.equal(webgl1.constructor.name, 'WebGLRenderingContext');
    assert.equal(webgl1.isWebGL2, false);
  });

  test('warns when an adapted image exceeds maxTextureSize', () => {
    const gl = {
      MAX_TEXTURE_SIZE: 0x0d33,
      getParameter(parameter) {
        if (parameter === this.MAX_TEXTURE_SIZE) return 4096;
        return null;
      },
      texImage2D() {}
    };
    const wrapper = new WebGL2RenderingContextWrapper(gl);
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(message);
    try {
      const oversized = { _miniProgramImage: { width: 8192, height: 8192 } };
      wrapper.texImage2D(0x0de1, 0, 0x1908, 1, 1, 0, 0x1908, 0x1401, oversized);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /maxTextureSize/);

      // 正常尺寸不警告
      const normal = { _miniProgramImage: { width: 512, height: 512 } };
      wrapper.texImage2D(0x0de1, 0, 0x1908, 1, 1, 0, 0x1908, 0x1401, normal);
      assert.equal(warnings.length, 1);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('proxies constant properties read-only and forwards writes to whitelisted ones', () => {
    const { gl } = createMockGL();
    // 白名单属性（three.js 写入）在原生上下文上存在时被代理并转发
    gl.drawingBufferColorSpace = 'srgb';
    const wrapper = new WebGL2RenderingContextWrapper(gl);

    assert.equal(wrapper.VERSION, 0x1f02);
    assert.equal(wrapper.MAX_TEXTURE_SIZE, 0x0d33);

    // 常量只读：写入不生效（严格模式抛 TypeError，非严格静默失败）
    gl.MAX_TEXTURE_SIZE = 2048;
    assert.equal(wrapper.MAX_TEXTURE_SIZE, 2048);
    try {
      wrapper.MAX_TEXTURE_SIZE = 9999;
    } catch {
      // 严格模式（ESM）下对只读 accessor 赋值抛 TypeError，行为等价
    }
    assert.equal(wrapper.MAX_TEXTURE_SIZE, 2048);

    // 白名单属性仍可转发
    wrapper.drawingBufferColorSpace = 'display-p3';
    assert.equal(gl.drawingBufferColorSpace, 'display-p3');
  });

  test('unwraps adapted image and canvas arguments', () => {
    const { calls, gl } = createMockGL();
    const wrapper = new WebGL2RenderingContextWrapper(gl);

    const adaptedImage = { _miniProgramImage: 'native-image' };
    wrapper.texImage2D(0x0de1, 0, 0x1908, 1, 1, 0, 0x1908, 0x1401, adaptedImage);
    const texCall = calls.find(call => call[0] === 'texImage2D');
    assert.equal(texCall[texCall.length - 1], 'native-image');
  });

  test('falls back to defaults for parameters the context cannot answer', () => {
    const { gl } = createMockGL();
    const wrapper = new WebGL2RenderingContextWrapper(gl);

    assert.equal(wrapper.getParameter(gl.VERSION), 'WebGL 2.0');
    assert.equal(wrapper.getParameter(gl.VENDOR), 'MiniProgram');
    assert.equal(wrapper.getParameter(gl.RENDERER), 'MiniProgram WebGL');
    assert.equal(wrapper.getParameter(gl.MAX_TEXTURE_SIZE), 4096);
    assert.ok(wrapper.getParameter(gl.MAX_VIEWPORT_DIMS) instanceof Int32Array);
  });

  test('caches extensions and falls back for known names', () => {
    const { gl } = createMockGL();
    const wrapper = new WebGL2RenderingContextWrapper(gl);

    const debugInfo = wrapper.getExtension('WEBGL_debug_renderer_info');
    assert.equal(debugInfo.getParameter(0x9245), 'MiniProgram WebGL');
    assert.equal(wrapper.getExtension('WEBGL_debug_renderer_info'), debugInfo); // 缓存命中

    const loseContext = wrapper.getExtension('WEBGL_lose_context');
    assert.equal(typeof loseContext.loseContext, 'function');

    assert.equal(wrapper.getExtension('EXT_color_buffer_float'), null);
    assert.equal(wrapper.getExtension('TOTALLY_UNKNOWN_EXTENSION'), null);
  });

  test('returns a static extension list when the context cannot enumerate', () => {
    const { calls, gl } = createMockGL();
    const wrapper = new WebGL2RenderingContextWrapper(gl);

    const supported = wrapper.getSupportedExtensions();
    assert.ok(supported.includes('WEBGL_debug_renderer_info'));
    assert.ok(calls.some(call => call[0] === 'getSupportedExtensions'));
  });

  test('returns a default shader precision format when unavailable', () => {
    const { gl } = createMockGL();
    const wrapper = new WebGL2RenderingContextWrapper(gl);

    const format = wrapper.getShaderPrecisionFormat(0x8b50, 0x8dfa);
    assert.equal(format.precision, 23);
    assert.equal(format.rangeMax, 127);
  });

  test('exposes canvas and drawing buffer size', () => {
    const { gl } = createMockGL();
    gl.canvas = { width: 375, height: 667 };
    const wrapper = new WebGL2RenderingContextWrapper(gl);

    assert.equal(wrapper.canvas, gl.canvas);
    assert.equal(wrapper.drawingBufferWidth, 375);
    assert.equal(wrapper.drawingBufferHeight, 667);

    const { gl: gl2 } = createMockGL();
    const wrapper2 = new WebGL2RenderingContextWrapper(gl2, { width: 320, height: 480 });
    assert.equal(wrapper2.drawingBufferWidth, 320);
    assert.equal(wrapper2.drawingBufferHeight, 480);
  });
});

describe('context recovery', () => {
  function makeGl(label) {
    const calls = [];
    return {
      label,
      calls,
      MAX_TEXTURE_SIZE: 0x0d33,
      VERSION: 0x1f02,
      getParameter(parameter) {
        calls.push(['getParameter', parameter]);
        return null;
      },
      clear() {
        calls.push(['clear']);
      }
    };
  }

  test('_replaceContext proxies calls to the new context', () => {
    const gl1 = makeGl('old');
    const wrapper = new WebGL2RenderingContextWrapper(gl1);

    const gl2 = makeGl('new');
    assert.equal(wrapper._replaceContext(gl2), true);
    assert.equal(wrapper._rawContext, gl2);
    assert.equal(wrapper.isWebGL2, true);
    assert.equal(wrapper._replaceContext(gl2), false); // 同实例不重复替换

    wrapper.clear();
    assert.equal(gl1.calls.some(call => call[0] === 'clear'), false);
    assert.ok(gl2.calls.some(call => call[0] === 'clear'));
  });

  test('recoverContext swaps in a fresh native context', () => {
    let currentGl = makeGl('old');
    const native = { getContext: () => currentGl };
    const canvas = new HTMLCanvasElement(native);
    const wrapper = canvas.getContext('webgl2');
    const events = [];
    canvas.addEventListener('webglcontextrestored', () => events.push('restored'));
    canvas.addEventListener('webglcontextlost', () => events.push('lost'));

    wrapper.clear();
    assert.ok(currentGl.calls.some(call => call[0] === 'clear'));

    // 系统销毁原上下文后，getContext 返回新实例
    currentGl = makeGl('new');
    assert.equal(canvas.recoverContext(), true);
    assert.deepEqual(events, ['restored']);

    wrapper.clear();
    assert.ok(currentGl.calls.some(call => call[0] === 'clear'));
  });

  test('recoverContext reuses the original context attributes', () => {
    let currentGl = makeGl('old');
    const calls = [];
    const native = {
      getContext(type, attributes) {
        calls.push({ type, attributes });
        return currentGl;
      }
    };
    const canvas = new HTMLCanvasElement(native);
    canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: true
    });

    currentGl = makeGl('new');
    assert.equal(canvas.recoverContext(), true);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], calls[0]);
  });

  test('recoverContext reports loss when the context cannot be recreated', () => {
    let destroyed = false;
    const native = {
      getContext: () => (destroyed ? null : makeGl('old'))
    };
    const canvas = new HTMLCanvasElement(native);
    canvas.getContext('webgl2');
    const events = [];
    canvas.addEventListener('webglcontextrestored', () => events.push('restored'));
    canvas.addEventListener('webglcontextlost', () => events.push('lost'));

    destroyed = true;
    assert.equal(canvas.recoverContext(), false);
    assert.deepEqual(events, ['lost']);
  });

  test('recoverContext dispatches restored when the context is intact', () => {
    const gl = makeGl('same');
    const native = { getContext: () => gl };
    const canvas = new HTMLCanvasElement(native);
    canvas.getContext('webgl2');
    const events = [];
    canvas.addEventListener('webglcontextrestored', () => events.push('restored'));

    assert.equal(canvas.recoverContext(), true);
    assert.deepEqual(events, ['restored']);
  });
});

describe('WebGL helpers', () => {  test('checkWebGLSupport reports unsupported when no context', () => {
    const canvas = {
      getContext(type) {
        assert.equal(type, 'webgl2');
        return null;
      }
    };
    assert.deepEqual(checkWebGLSupport(canvas), { supported: false, reason: 'WebGL2 not supported' });
  });

  test('getWebGLCapabilities reads limits from the raw context', () => {
    const gl = {
      MAX_TEXTURE_SIZE: 0x0d33,
      MAX_CUBE_MAP_TEXTURE_SIZE: 0x851c,
      MAX_RENDERBUFFER_SIZE: 0x84e8,
      MAX_VIEWPORT_DIMS: 0x0d3a,
      MAX_VERTEX_ATTRIBS: 0x8869,
      getParameter(parameter) {
        if (parameter === this.MAX_VIEWPORT_DIMS) return new Int32Array([2048, 1024]);
        return 16;
      }
    };
    const wrapper = new WebGL2RenderingContextWrapper(gl);
    const caps = getWebGLCapabilities(wrapper);

    assert.equal(caps.maxTextureSize, 16);
    assert.equal(caps.maxCubeMapSize, 16);
    assert.equal(caps.maxVertexAttribs, 16);
    assert.deepEqual([...caps.maxViewportDims], [2048, 1024]);
  });

  test('getWebGLCapabilities returns null without a wrapped context', () => {
    assert.equal(getWebGLCapabilities(null), null);
    assert.equal(getWebGLCapabilities({}), null);
  });
});
