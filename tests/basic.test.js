import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import adapter, {
  ControlPlugins,
  LoaderPlugins,
  VERSION,
  adaptForMiniProgram,
  checkCompatibility,
  getVersion,
  installPolyfills
} from '../src/index.js';
import { document } from '../src/adaptor/dom/document.js';
import { Event } from '../src/adaptor/events/event.js';
import { EventTarget } from '../src/adaptor/events/event-target.js';
import { fetch as miniProgramFetch, Response } from '../src/adaptor/network/fetch.js';
import { Blob } from '../src/adaptor/network/blob.js';
import { createObjectURL, revokeObjectURL } from '../src/adaptor/media/url.js';

const originalWx = globalThis.wx;

afterEach(() => {
  if (originalWx === undefined) {
    delete globalThis.wx;
  } else {
    globalThis.wx = originalWx;
  }
});

function createMockCanvas() {
  const calls = [];
  const rawContext = {
    VERSION: 0x1f02,
    VENDOR: 0x1f00,
    RENDERER: 0x1f01,
    SHADING_LANGUAGE_VERSION: 0x8b8c,
    MAX_TEXTURE_SIZE: 0x0d33,
    MAX_CUBE_MAP_TEXTURE_SIZE: 0x851c,
    MAX_RENDERBUFFER_SIZE: 0x84e8,
    MAX_VIEWPORT_DIMS: 0x0d3a,
    getParameter(parameter) {
      if (parameter === this.VERSION) return 'WebGL 2.0';
      if (parameter === this.VENDOR) return 'Mock Vendor';
      if (parameter === this.RENDERER) return 'Mock Renderer';
      if (parameter === this.SHADING_LANGUAGE_VERSION) return 'WebGL GLSL ES 3.00';
      if (parameter === this.MAX_VIEWPORT_DIMS) return new Int32Array([1024, 1024]);
      return 1024;
    },
    getExtension() {
      return null;
    },
    getSupportedExtensions() {
      return [];
    },
    texImage2D(value) {
      calls.push(value);
    }
  };

  const canvas = {
    id: 'test-canvas',
    width: 375,
    height: 667,
    getContext(type, attributes) {
      calls.push({ type, attributes });
      rawContext.canvas = canvas;
      return rawContext;
    },
    createImage() {
      return { src: '', onload: null, onerror: null };
    },
    requestAnimationFrame(callback) {
      return setTimeout(() => callback(Date.now()), 1);
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    }
  };

  return { calls, canvas, rawContext };
}

describe('public API', () => {
  test('exports plugin namespaces from named and default exports', () => {
    assert.equal(adapter.LoaderPlugins, LoaderPlugins);
    assert.equal(adapter.ControlPlugins, ControlPlugins);
    assert.equal(typeof LoaderPlugins.enhanceAllLoaders, 'function');
    assert.equal(typeof ControlPlugins.createTouchControls, 'function');
  });

  test('keeps runtime and package versions aligned', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(VERSION, packageJson.version);
    assert.equal(getVersion().version, packageJson.version);
    assert.equal(getVersion().name, packageJson.name);
  });

  test('rejects a missing canvas', () => {
    assert.throws(() => adaptForMiniProgram(null), /Canvas is required/);
  });

  test('does not overwrite read-only host globals', () => {
    const host = {};
    const navigator = { userAgent: 'native' };
    Object.defineProperty(host, 'navigator', { value: navigator, writable: false });
    assert.doesNotThrow(() => installPolyfills(host));
    assert.equal(host.navigator, navigator);
  });
});

describe('compatibility checks', () => {
  test('reports a missing wx runtime as incompatible', () => {
    delete globalThis.wx;
    const report = checkCompatibility();
    assert.equal(report.compatible, false);
    assert.ok(report.issues.includes('wx object not available'));
  });

  test('compares SDK versions numerically', () => {
    globalThis.wx = {
      createSelectorQuery() {},
      getSystemInfoSync: () => ({ SDKVersion: '2.30.0', platform: 'devtools', version: '1' })
    };
    const report = checkCompatibility();
    assert.equal(report.compatible, true);
    assert.equal(report.warnings.length, 0);

    // WebGL2 需要基础库 >= 2.24.0（低于该版本应给出警告）
    globalThis.wx.getSystemInfoSync = () => ({ SDKVersion: '2.10.0', platform: 'devtools', version: '1' });
    const older = checkCompatibility();
    assert.equal(older.compatible, true);
    assert.equal(older.warnings.length, 1);
    assert.match(older.warnings[0], /2\.24\.0/);
  });

  test('marks missing required wx APIs as incompatible', () => {
    globalThis.wx = {};
    const report = checkCompatibility();
    assert.equal(report.compatible, false);
    assert.equal(report.issues.length, 2);
  });
});

describe('canvas adaptation', () => {
  test('does not create WebGL early and cleans up safely', () => {
    const { calls, canvas } = createMockCanvas();
    const globals = {};
    const result = adaptForMiniProgram(canvas, { globalObject: globals });

    assert.equal(calls.length, 0);
    assert.equal(result.canvas.width, 375);
    assert.equal(result.document.getElementById('test-canvas'), result.canvas);
    assert.equal(globals.document, result.document);
    assert.equal(globals.window.document, result.document);

    const context = result.canvas.getContext('webgl2', { antialias: true });
    assert.equal(calls[0].attributes.antialias, true);
    assert.equal(typeof context.getParameter, 'function');
    assert.equal(context.canvas, result.canvas);

    const report = result.inspectWebGL();
    assert.equal(result.webglReport, report);
    assert.equal(report.capabilities.version, 'WebGL 2.0');

    const nativeImage = {};
    context.texImage2D({ _miniProgramImage: nativeImage });
    assert.equal(calls.at(-1), nativeImage);

    assert.doesNotThrow(() => result.dispose());
    assert.equal(document.getElementById('test-canvas'), null);
  });
});

describe('event compatibility', () => {
  test('invokes capture listeners once and honours passive listeners', () => {
    const target = new EventTarget();
    let calls = 0;
    target.addEventListener('move', () => calls++, { capture: true });
    target.dispatchEvent(new Event('move'));
    assert.equal(calls, 1);

    target.addEventListener('passive', event => event.preventDefault(), { passive: true });
    const passiveEvent = new Event('passive');
    assert.equal(target.dispatchEvent(passiveEvent), true);
    assert.equal(passiveEvent.defaultPrevented, false);
  });

  test('only emits pointerdown for changed touches and leaves after the last touch', () => {
    const { canvas } = createMockCanvas();
    const result = adaptForMiniProgram(canvas, { injectGlobals: false });
    const pointerIds = [];
    const primaryFlags = [];
    let leaves = 0;
    result.canvas.addEventListener('pointerdown', event => {
      pointerIds.push(event.pointerId);
      primaryFlags.push(event.isPrimary);
    });
    result.canvas.addEventListener('pointerleave', () => leaves++);

    const first = { identifier: 0, x: 10, y: 10 };
    const second = { identifier: 1, x: 20, y: 20 };
    result.touchEventHandlers.touchstart({ touches: [first], changedTouches: [first] });
    result.touchEventHandlers.touchstart({ touches: [first, second], changedTouches: [second] });
    assert.deepEqual(pointerIds, [1, 2]);
    assert.deepEqual(primaryFlags, [true, false]);

    result.touchEventHandlers.touchend({ touches: [first], changedTouches: [second] });
    assert.equal(leaves, 0);
    result.touchEventHandlers.touchend({ touches: [], changedTouches: [first] });
    assert.equal(leaves, 1);
    result.dispose();
  });

  test('drives the current Three.js OrbitControls through forwarded WXML events', () => {
    const { canvas } = createMockCanvas();
    canvas.height = 200;
    const result = adaptForMiniProgram(canvas, { injectGlobals: false });
    const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 100);
    camera.position.set(0, 0, 5);
    const controls = new OrbitControls(camera, result.canvas);

    const start = { identifier: 0, x: 100, y: 100 };
    const moved = { identifier: 0, x: 140, y: 110 };
    result.touchEventHandlers.touchstart({ touches: [start], changedTouches: [start] });
    result.touchEventHandlers.touchmove({ touches: [moved], changedTouches: [moved] });
    result.touchEventHandlers.touchend({ touches: [], changedTouches: [moved] });
    controls.update();

    // 右移 + 下移应旋转相机：偏离 +Z 轴且保持轨道半径（含 y 分量）
    const [x, y, z] = camera.position.toArray();
    assert.ok(Math.abs(x) > 0.1, 'camera should have rotated around Y');
    assert.ok(Math.abs(Math.hypot(x, y, z) - 5) < 1e-6, 'orbit radius should be preserved');
    assert.ok(z < 5, 'camera should no longer sit on the +Z axis');
    controls.dispose();
    result.dispose();
  });
});

describe('network primitives', () => {
  test('preserves status zero for error responses', () => {
    const response = Response.error();
    assert.equal(response.status, 0);
    assert.equal(response.ok, false);
  });

  test('decodes binary data URLs without corruption', async () => {
    const response = await miniProgramFetch('data:application/octet-stream;base64,AID/');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0, 128, 255]);
  });

  test('writes custom blobs before returning a mini-program object URL', () => {
    const written = new Map();
    globalThis.wx = {
      env: { USER_DATA_PATH: '/mock' },
      getFileSystemManager: () => ({
        writeFileSync(path, buffer) {
          written.set(path, [...new Uint8Array(buffer)]);
        },
        unlinkSync(path) {
          written.delete(path);
        }
      })
    };

    const url = createObjectURL(new Blob([new Uint8Array([0, 128, 255])]));
    assert.deepEqual(written.get(url), [0, 128, 255]);
    revokeObjectURL(url);
    assert.equal(written.has(url), false);
  });

  test('slices blobs with empty leading parts without corruption', async () => {
    const blob = new Blob([new Uint8Array(0), new Uint8Array([1, 2, 3])]);
    const sliced = blob.slice(1);
    assert.deepEqual([...new Uint8Array(await sliced.arrayBuffer())], [2, 3]);
  });
});

describe('controls plugins', () => {
  test('createGestureControls removes its listeners on dispose', () => {
    const listeners = new Map();
    const domElement = {
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        const arr = listeners.get(type);
        if (!arr) return;
        const index = arr.indexOf(fn);
        if (index !== -1) arr.splice(index, 1);
      }
    };
    const camera = {
      position: { x: 0, y: 0, z: 10, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
      lookAt() {}
    };

    const controls = ControlPlugins.createGestureControls(camera, domElement, {
      onDoubleTap: () => {}
    });
    // createTouchControls 注册 4 类 pointer 监听，createGestureControls 额外注册 1 个 pointerdown
    assert.equal(listeners.get('pointerdown').length, 2);
    assert.equal(listeners.get('pointermove').length, 1);

    controls.dispose();
    assert.equal(listeners.get('pointerdown').length, 0);
    assert.equal(listeners.get('pointermove').length, 0);
    assert.equal(listeners.get('pointerup').length, 0);
    assert.equal(listeners.get('pointercancel').length, 0);
  });
});
