import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  configureRendererSize,
  disposeObject3D,
  disposeRenderingPage,
  pauseRendering,
  resumeRendering
} from '../examples/shared/runtime.js';

describe('example runtime helpers', () => {
  test('applies the adapter size to the renderer and camera', () => {
    const calls = [];
    const renderer = {
      setPixelRatio(value) { calls.push(['pixelRatio', value]); },
      setSize(width, height, updateStyle) { calls.push(['size', width, height, updateStyle]); }
    };
    const camera = {
      aspect: 0,
      updateProjectionMatrix() { calls.push(['projection']); }
    };
    const size = configureRendererSize(
      { updateSize: () => ({ width: 320, height: 640, pixelRatio: 3 }) },
      renderer,
      camera,
      { width: 1, height: 1 }
    );

    assert.deepEqual(size, { width: 320, height: 640, pixelRatio: 3 });
    assert.equal(camera.aspect, 0.5);
    assert.deepEqual(calls, [
      ['pixelRatio', 3],
      ['size', 320, 640, false],
      ['projection']
    ]);
  });

  test('pauses, recovers, resizes and resumes a page once', () => {
    const calls = [];
    const page = {
      _animationFrame: 7,
      _nativeCanvas: {
        width: 200,
        height: 100,
        cancelAnimationFrame(id) { calls.push(['cancel', id]); }
      },
      _adapter: {
        canvas: { recoverContext() { calls.push(['recover']); return true; } },
        updateSize: () => ({ width: 200, height: 100, pixelRatio: 2 })
      },
      _renderer: {
        setPixelRatio(value) { calls.push(['pixelRatio', value]); },
        setSize(width, height) { calls.push(['size', width, height]); }
      },
      _camera: { updateProjectionMatrix() { calls.push(['projection']); } },
      _animate() { calls.push(['animate']); this._animationFrame = 8; }
    };

    assert.equal(pauseRendering(page), true);
    assert.equal(page._animationFrame, null);
    assert.equal(resumeRendering(page), true);
    assert.equal(page._animationFrame, 8);
    assert.deepEqual(calls, [
      ['cancel', 7],
      ['recover'],
      ['pixelRatio', 2],
      ['size', 200, 100],
      ['projection'],
      ['animate']
    ]);
  });

  test('deduplicates shared GPU resources during disposal', () => {
    const counts = { geometry: 0, material: 0, texture: 0, renderer: 0, adapter: 0 };
    const texture = { isTexture: true, dispose() { counts.texture++; } };
    const material = { map: texture, dispose() { counts.material++; } };
    const geometry = { dispose() { counts.geometry++; } };
    const scene = {
      background: texture,
      traverse(visitor) {
        visitor({ geometry, material });
        visitor({ geometry, material: [material] });
      }
    };
    const page = {
      _animationFrame: null,
      _scene: scene,
      _renderer: { dispose() { counts.renderer++; } },
      _adapter: { dispose() { counts.adapter++; } }
    };

    disposeObject3D(scene);
    assert.deepEqual(counts, { geometry: 1, material: 1, texture: 1, renderer: 0, adapter: 0 });

    counts.geometry = 0;
    counts.material = 0;
    counts.texture = 0;
    disposeRenderingPage(page);
    assert.deepEqual(counts, { geometry: 1, material: 1, texture: 1, renderer: 1, adapter: 1 });
    assert.equal(page._disposed, true);
    assert.equal(page._scene, null);
  });
});
