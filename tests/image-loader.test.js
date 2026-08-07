import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { HTMLImageElement } from '../src/adaptor/dom/image.js';
import { LoaderPlugins } from '../src/index.js';

const originalWx = globalThis.wx;

afterEach(() => {
  if (originalWx === undefined) {
    delete globalThis.wx;
  } else {
    globalThis.wx = originalWx;
  }
});

describe('HTMLImageElement loading', () => {
  test('ignores stale load completions after src changes', () => {
    const img1 = { width: 100, height: 50, src: '' };
    const img2 = { width: 200, height: 100, src: '' };
    let first = true;
    const image = new HTMLImageElement(() => (first ? (first = false, img1) : img2));
    const loads = [];
    image.onload = () => loads.push(image._miniProgramImage);

    image.src = 'a.png'; // -> img1
    image.src = 'b.png'; // -> img2（旧 img1 请求仍在进行中）

    img1.onload(); // 旧请求先完成 -> 应被忽略
    assert.equal(image._miniProgramImage, null);
    assert.equal(loads.length, 0);
    assert.equal(image._complete, false);

    img2.onload(); // 新请求完成 -> 生效
    assert.equal(image._miniProgramImage, img2);
    assert.equal(image.naturalWidth, 200);
    assert.equal(loads.length, 1);
  });

  test('ignores stale error completions after src changes', () => {
    const img1 = { width: 0, height: 0, src: '' };
    const img2 = { width: 0, height: 0, src: '' };
    let first = true;
    const image = new HTMLImageElement(() => (first ? (first = false, img1) : img2));
    const errors = [];
    image.onerror = (error) => errors.push(error);

    image.src = 'a.png';
    image.src = 'b.png';

    img1.onerror(new Error('old failed')); // 旧错误忽略
    assert.equal(errors.length, 0);
    assert.equal(image._loading, true);

    img2.onload();
    assert.equal(errors.length, 0);
  });
});

describe('enhanceTextureLoader LoadingManager', () => {
  function installLoaderMock() {
    const manager = {
      started: [],
      ended: [],
      errors: [],
      itemStart(url) {
        this.started.push(url);
      },
      itemEnd(url) {
        this.ended.push(url);
      },
      itemError(url) {
        this.errors.push(url);
      }
    };
    const THREE = {
      DefaultLoadingManager: manager,
      Texture: class {
        constructor() {
          this.image = null;
          this.needsUpdate = false;
        }
      },
      TextureLoader: class {
        constructor() {
          this.manager = manager;
        }
      }
    };
    return { manager, THREE };
  }

  test('calls itemStart/itemEnd around a successful texture load', () => {
    const { manager, THREE } = installLoaderMock();
    const img = { width: 8, height: 8, src: '' };
    globalThis.wx = { createImage: () => img };

    LoaderPlugins.enhanceTextureLoader(THREE);
    const loader = new THREE.TextureLoader();
    let loaded = null;
    const texture = loader.load('https://example.com/tex.png', (item) => { loaded = item; });

    const resolved = LoaderPlugins.resolvePath('https://example.com/tex.png');
    assert.deepEqual(manager.started, [resolved]);
    assert.equal(loaded, null);

    img.onload();
    assert.equal(loaded, texture);
    assert.equal(texture.needsUpdate, true);
    assert.deepEqual(manager.ended, [resolved]);
  });

  test('calls itemError and itemEnd on failure', () => {
    const { manager, THREE } = installLoaderMock();
    const img = { width: 0, height: 0, src: '' };
    globalThis.wx = { createImage: () => img };

    LoaderPlugins.enhanceTextureLoader(THREE);
    const loader = new THREE.TextureLoader();
    let error = null;
    loader.load('https://example.com/tex.png', undefined, undefined, (item) => { error = item; });

    img.onerror(new Error('network'));
    assert.ok(error instanceof Error);
    assert.deepEqual(manager.errors, [LoaderPlugins.resolvePath('https://example.com/tex.png')]);
    assert.deepEqual(manager.ended, [LoaderPlugins.resolvePath('https://example.com/tex.png')]);
  });
});
