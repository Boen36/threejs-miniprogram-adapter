import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as THREE from 'three';

import { HTMLCanvasElement } from '../src/adaptor/dom/canvas.js';
import { installPolyfills } from '../src/index.js';
/**
 * 构建可渲染的 mock WebGL2 上下文：关键方法显式实现，
 * 其余方法 no-op。返回的对象用于驱动真实 three.js WebGLRenderer。
 */
function createRenderableGL() {
  const constants = {
    VERSION: 0x1f02,
    VENDOR: 0x1f00,
    RENDERER: 0x1f01,
    SHADING_LANGUAGE_VERSION: 0x8b8c,
    MAX_TEXTURE_SIZE: 0x0d33,
    MAX_CUBE_MAP_TEXTURE_SIZE: 0x851c,
    MAX_RENDERBUFFER_SIZE: 0x84e8,
    MAX_VIEWPORT_DIMS: 0x0d3a,
    MAX_VERTEX_ATTRIBS: 0x8869,
    MAX_VERTEX_UNIFORM_VECTORS: 0x8dfb,
    MAX_FRAGMENT_UNIFORM_VECTORS: 0x8dfd,
    MAX_TEXTURE_IMAGE_UNITS: 0x8872,
    MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8b4c,
    MAX_DRAW_BUFFERS: 0x8824,
    MAX_COLOR_ATTACHMENTS: 0x8cdf,
    MAX_SAMPLES: 0x8d57,
    ACTIVE_UNIFORMS: 0x8b86,
    ACTIVE_ATTRIBUTES: 0x8b89
  };

  const gl = {
    ...constants,
    getParameter(parameter) {
      if (parameter === this.VERSION) return 'WebGL 2.0';
      if (parameter === this.SHADING_LANGUAGE_VERSION) return 'WebGL GLSL ES 3.00';
      if (parameter === this.MAX_VIEWPORT_DIMS) return new Int32Array([4096, 4096]);
      if (parameter === this.MAX_TEXTURE_SIZE || parameter === this.MAX_CUBE_MAP_TEXTURE_SIZE ||
          parameter === this.MAX_RENDERBUFFER_SIZE) {
        return 4096;
      }
      return 16;
    },
    getShaderPrecisionFormat() {
      return { precision: 23, rangeMin: 127, rangeMax: 127 };
    },
    getExtension() {
      return null;
    },
    getSupportedExtensions() {
      return [];
    },
    getShaderParameter() {
      return true;
    },
    getProgramParameter(program, parameter) {
      if (parameter === this.ACTIVE_UNIFORMS || parameter === this.ACTIVE_ATTRIBUTES) return 0;
      return true;
    },
    getShaderInfoLog() {
      return '';
    },
    getProgramInfoLog() {
      return '';
    },
    getError() {
      return 0;
    },
    getAttribLocation() {
      return 0;
    },
    getUniformLocation() {
      return {};
    },
    isContextLost() {
      return false;
    },
    getContextAttributes() {
      return {};
    }
  };

  // 其余 WebGL2 方法 no-op（wrapper 按 ownKeys 快照成员，必须显式存在）
  const noopMethods = [
    'createBuffer', 'createTexture', 'createProgram', 'createShader', 'createVertexArray',
    'createFramebuffer', 'createRenderbuffer', 'createQuery', 'createSampler',
    'createTransformFeedback',
    'deleteBuffer', 'deleteTexture', 'deleteProgram', 'deleteShader', 'deleteVertexArray',
    'deleteFramebuffer', 'deleteRenderbuffer', 'deleteQuery', 'deleteSampler',
    'deleteTransformFeedback',
    'bufferData', 'bufferSubData', 'bindBuffer', 'bindVertexArray', 'bindTexture',
    'bindFramebuffer', 'bindRenderbuffer', 'bindSampler', 'bindTransformFeedback',
    'bindBufferBase', 'bindBufferRange',
    'texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D', 'texParameteri',
    'texParameterf', 'texStorage2D', 'texStorage3D', 'pixelStorei', 'generateMipmap',
    'shaderSource', 'compileShader', 'linkProgram', 'useProgram', 'attachShader',
    'detachShader', 'validateProgram', 'bindAttribLocation',
    'drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced',
    'drawRangeElements', 'drawBuffers',
    'enable', 'disable', 'enableVertexAttribArray', 'disableVertexAttribArray',
    'vertexAttribPointer', 'vertexAttribDivisor',
    'viewport', 'clear', 'clearColor', 'clearDepth', 'clearStencil', 'cullFace',
    'frontFace', 'depthFunc', 'depthMask', 'depthRange', 'scissor', 'colorMask',
    'lineWidth', 'polygonOffset', 'pointSize',
    'blendFunc', 'blendFuncSeparate', 'blendEquation', 'blendEquationSeparate',
    'activeTexture', 'sampleCoverage', 'hint', 'finish', 'flush',
    'uniform1f', 'uniform1i', 'uniform2f', 'uniform2i', 'uniform3f', 'uniform3i',
    'uniform4f', 'uniform4i', 'uniform1fv', 'uniform2fv', 'uniform3fv', 'uniform4fv',
    'uniform1iv', 'uniform2iv', 'uniform3iv', 'uniform4iv',
    'uniformMatrix2fv', 'uniformMatrix3fv', 'uniformMatrix4fv',
    'readPixels', 'getBufferSubData', 'getActiveUniform', 'getActiveAttrib',
    'getUniformIndices', 'getUniformBlockIndex', 'uniformBlockBinding',
    'blitFramebuffer', 'renderbufferStorage', 'renderbufferStorageMultisample',
    'framebufferTexture2D', 'framebufferTextureLayer', 'framebufferRenderbuffer',
    'checkFramebufferStatus', 'stencilFunc', 'stencilFuncSeparate', 'stencilMask',
    'stencilMaskSeparate', 'stencilOp', 'stencilOpSeparate'
  ];
  noopMethods.forEach(name => {
    gl[name] = () => undefined;
  });

  return gl;
}

describe('WebGLRenderer smoke test', () => {
  test('constructs a renderer and renders a scene against the adapted canvas', () => {
    const gl = createRenderableGL();
    const native = { width: 300, height: 150, getContext: () => gl };
    const canvas = new HTMLCanvasElement(native);

    // 注入适配器 polyfills：three 的动画循环经全局 self 取 rAF/cancelAF
    installPolyfills(globalThis);

    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setPixelRatio(1);
    renderer.setSize(300, 150, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 100);
    camera.position.set(0, 0, 4);
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial()));

    renderer.setAnimationLoop(() => {});
    renderer.render(scene, camera);
    renderer.setAnimationLoop(null);
    renderer.dispose();

    // 构造 + 启动/停止动画循环 + 渲染一帧 + 销毁全程未抛错
    assert.ok(true);
  });
});
