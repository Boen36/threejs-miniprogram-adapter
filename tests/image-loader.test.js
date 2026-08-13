import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { TextureLoader } from 'three';

import { HTMLImageElement } from '../src/adaptor/dom/image.js';
import { LoaderPlugins, adaptForMiniProgram } from '../src/index.js';
import { exposeInstalledGlobals } from './helpers/installed-globals.js';

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

describe('LoaderPlugins compatibility surface', () => {
  test('standard TextureLoader works after adaptation without an enhancer', async () => {
    const images = [];
    const canvas = {
      id: 'texture-canvas',
      width: 64,
      height: 64,
      getContext() {
        return null;
      },
      createImage() {
        const image = {
          width: 8,
          height: 8,
          onload: null,
          onerror: null,
          _src: '',
          get src() {
            return this._src;
          },
          set src(value) {
            this._src = value;
            queueMicrotask(() => this.onload?.());
          }
        };
        images.push(image);
        return image;
      }
    };
    const host = {};
    const adapter = adaptForMiniProgram(canvas, { globalObject: host });
    const restoreGlobals = exposeInstalledGlobals(host);

    try {
      const texture = await new Promise((resolve, reject) => {
        new TextureLoader().load('wxfile://usr/standard.png', resolve, undefined, reject);
      });

      assert.equal(images.length, 1);
      assert.equal(images[0].src, 'wxfile://usr/standard.png');
      texture.dispose();
    } finally {
      restoreGlobals();
      adapter.dispose();
    }
  });

  test('deprecated enhance functions warn once without patching loader prototypes', () => {
    const makeLoader = () => class {
      load() {}
      setPath() {}
    };
    const THREE = {
      TextureLoader: makeLoader(),
      GLTFLoader: makeLoader(),
      OBJLoader: makeLoader(),
      MTLLoader: makeLoader(),
      FBXLoader: makeLoader(),
      FileLoader: makeLoader()
    };
    const originals = Object.fromEntries(
      Object.entries(THREE).map(([name, Loader]) => [name, {
        load: Loader.prototype.load,
        setPath: Loader.prototype.setPath
      }])
    );
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = message => warnings.push(message);

    try {
      LoaderPlugins.enhanceTextureLoader(THREE);
      LoaderPlugins.enhanceGLTFLoader(THREE);
      LoaderPlugins.enhanceOBJLoader(THREE);
      LoaderPlugins.enhanceMTLLoader(THREE);
      LoaderPlugins.enhanceFBXLoader(THREE);
      LoaderPlugins.enhanceAllLoaders(THREE);
      LoaderPlugins.enhanceAllLoaders(THREE);
    } finally {
      console.warn = originalWarn;
    }

    for (const [name, Loader] of Object.entries(THREE)) {
      assert.equal(Loader.prototype.load, originals[name].load, `${name}.load must stay untouched`);
      assert.equal(Loader.prototype.setPath, originals[name].setPath, `${name}.setPath must stay untouched`);
    }
    assert.equal(warnings.length, 6, 'each deprecated enhancer should warn once');
    assert.ok(warnings.every(message => /deprecated/i.test(message)));
  });

  test('legacy utilities stay callable and warn only once per API', () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = message => warnings.push(message);

    try {
      assert.equal(typeof LoaderPlugins.createFileLoader().load, 'function');
      assert.equal(typeof LoaderPlugins.createFileLoader().load, 'function');
      assert.equal(LoaderPlugins.resolvePath('wxfile://usr/model.glb'), 'wxfile://usr/model.glb');
      assert.equal(LoaderPlugins.resolvePath('second.glb'), 'second.glb');
      assert.equal(typeof LoaderPlugins.createCachedLoader({}, class {}), 'function');
      assert.equal(typeof LoaderPlugins.createCachedLoader({}, class {}), 'function');
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(warnings.length, 3);
    assert.ok(warnings.every(message => /deprecated/i.test(message)));
  });

  test('retained texture helpers use the selected document without requiring TextureLoader', () => {
    const nativeImage = { width: 8, height: 8, src: '' };
    const image = new HTMLImageElement(() => nativeImage);
    const document = { createElementNS: () => image };
    const THREE = {
      Texture: class {
        constructor() {
          this.image = null;
          this.needsUpdate = false;
        }
      }
    };
    let loaded = null;

    const texture = LoaderPlugins.loadTextureFromFile(
      THREE,
      'wxfile://usr/texture.png',
      item => { loaded = item; },
      undefined,
      { document }
    );

    assert.ok(texture instanceof THREE.Texture);
    assert.equal(nativeImage.src, 'wxfile://usr/texture.png');
    nativeImage.onload();
    assert.equal(loaded, texture);
    assert.equal(texture.needsUpdate, true);
  });

  test('base64 texture helper adds a data URL prefix and propagates image errors', () => {
    const nativeImage = { width: 0, height: 0, src: '' };
    const image = new HTMLImageElement(() => nativeImage);
    const document = { createElementNS: () => image };
    const THREE = { Texture: class {} };
    let receivedError = null;

    const texture = LoaderPlugins.loadTextureFromBase64(
      THREE,
      'AAAA',
      undefined,
      error => { receivedError = error; },
      { document }
    );

    assert.ok(texture instanceof THREE.Texture);
    assert.equal(nativeImage.src, 'data:image/png;base64,AAAA');
    const failure = new Error('image failed');
    nativeImage.onerror(failure);
    assert.equal(receivedError, failure);
  });
});
