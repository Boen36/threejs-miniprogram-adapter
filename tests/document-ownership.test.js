import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { LoaderPlugins, adaptForMiniProgram } from '../src/index.js';

function createNativeCanvas(name, id = 'webgl') {
  const images = [];
  return {
    canvas: {
      id,
      width: 320,
      height: 180,
      createImage() {
        const image = { owner: name, src: '', onload: null, onerror: null };
        images.push(image);
        return image;
      },
      getContext() {
        return null;
      }
    },
    images
  };
}

describe('adapter document ownership', () => {
  test('isolates documents, ids and image factories across global objects', () => {
    const first = createNativeCanvas('first');
    const second = createNativeCanvas('second');
    const firstHost = {};
    const secondHost = {};
    const firstAdapter = adaptForMiniProgram(first.canvas, { globalObject: firstHost });
    const secondAdapter = adaptForMiniProgram(second.canvas, { globalObject: secondHost });

    try {
      assert.notEqual(firstAdapter.document, secondAdapter.document);
      assert.equal(firstHost.document, firstAdapter.document);
      assert.equal(secondHost.document, secondAdapter.document);
      assert.equal(firstAdapter.document.getElementById('webgl'), firstAdapter.canvas);
      assert.equal(secondAdapter.document.getElementById('webgl'), secondAdapter.canvas);

      const firstImage = firstAdapter.document.createElement('img');
      const secondImage = secondAdapter.document.createElementNS('http://www.w3.org/1999/xhtml', 'img');
      firstImage.src = 'first.png';
      secondImage.src = 'second.png';

      assert.equal(first.images.length, 1);
      assert.equal(second.images.length, 1);
      assert.equal(first.images[0].src, 'first.png');
      assert.equal(second.images[0].src, 'second.png');
      assert.equal(firstImage.ownerDocument, firstAdapter.document);
      assert.equal(secondImage.ownerDocument, secondAdapter.document);
      assert.equal(firstAdapter.document.documentElement.ownerDocument, firstAdapter.document);
      assert.equal(firstAdapter.document.defaultView, firstHost.window);
      assert.equal(secondAdapter.document.defaultView, secondHost.window);
    } finally {
      firstAdapter.dispose();
      secondAdapter.dispose();
    }
  });

  test('binds the global Image constructor to the owning document and canvas', () => {
    const native = createNativeCanvas('page');
    const host = {};
    const adapter = adaptForMiniProgram(native.canvas, { globalObject: host });

    try {
      const image = new host.Image(64, 32);
      image.src = 'texture.png';

      assert.equal(image.ownerDocument, adapter.document);
      assert.ok(image instanceof host.Image);
      assert.ok(image instanceof host.HTMLImageElement);
      assert.equal(image.width, 64);
      assert.equal(image.height, 32);
      assert.equal(native.images.length, 1);
      assert.equal(native.images[0].src, 'texture.png');
      assert.equal(host.window.Image, host.Image);
    } finally {
      adapter.dispose();
    }
  });

  test('restores the previous page document when the active adapter is disposed', () => {
    const first = createNativeCanvas('first');
    const second = createNativeCanvas('second');
    const host = {};
    const firstAdapter = adaptForMiniProgram(first.canvas, { globalObject: host });
    const secondAdapter = adaptForMiniProgram(second.canvas, { globalObject: host });

    try {
      assert.equal(host.document, secondAdapter.document);
      assert.equal(host.window.document, secondAdapter.document);
      const secondImage = new host.Image();
      secondImage.src = 'second.png';
      assert.equal(second.images.length, 1);
      assert.equal(first.images.length, 0);

      secondAdapter.dispose();
      assert.equal(host.document, firstAdapter.document);
      assert.equal(host.window.document, firstAdapter.document);
      const firstImage = new host.Image();
      firstImage.src = 'first.png';
      assert.equal(first.images.length, 1);
    } finally {
      firstAdapter.dispose();
      secondAdapter.dispose();
    }
  });

  test('loader helpers can pin image creation to an adapter document', () => {
    const first = createNativeCanvas('first');
    const second = createNativeCanvas('second');
    const firstAdapter = adaptForMiniProgram(first.canvas, { globalObject: {} });
    const secondAdapter = adaptForMiniProgram(second.canvas, { globalObject: {} });
    const manager = {
      itemStart() {},
      itemEnd() {},
      itemError() {}
    };
    const THREE = {
      DefaultLoadingManager: manager,
      Texture: class {},
      TextureLoader: class {
        constructor() {
          this.manager = manager;
        }
      }
    };

    try {
      LoaderPlugins.enhanceTextureLoader(THREE, { document: firstAdapter.document });
      new THREE.TextureLoader().load('first.png');

      assert.equal(first.images.length, 1);
      assert.equal(second.images.length, 0);
      assert.equal(first.images[0].src, 'first.png');
    } finally {
      firstAdapter.dispose();
      secondAdapter.dispose();
    }
  });
});
