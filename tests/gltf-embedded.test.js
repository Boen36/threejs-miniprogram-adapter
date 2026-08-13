import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { adaptForMiniProgram } from '../src/index.js';

const originalWx = globalThis.wx;

afterEach(() => {
  if (originalWx === undefined) {
    delete globalThis.wx;
  } else {
    globalThis.wx = originalWx;
  }
});

function createImageCanvas() {
  const images = [];
  const canvas = {
    id: 'gltf-canvas',
    width: 64,
    height: 64,
    getContext() {
      return null;
    },
    createImage() {
      const image = {
        width: 1,
        height: 1,
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
  return { canvas, images };
}

function createEmbeddedTextureGltf() {
  const positions = new Uint8Array(new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
  ]).buffer);
  const png = new Uint8Array(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
    'base64'
  ));
  const bytes = new Uint8Array(positions.byteLength + png.byteLength);
  bytes.set(positions, 0);
  bytes.set(png, positions.byteLength);

  return {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0 },
        material: 0
      }]
    }],
    materials: [{
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 }
      }
    }],
    textures: [{ source: 0 }],
    images: [{ bufferView: 1, mimeType: 'image/png' }],
    accessors: [{
      bufferView: 0,
      componentType: 5126,
      count: 3,
      type: 'VEC3',
      min: [0, 0, 0],
      max: [1, 1, 0]
    }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: png.byteLength }
    ],
    buffers: [{
      byteLength: bytes.byteLength,
      uri: `data:application/octet-stream;base64,${Buffer.from(bytes).toString('base64')}`
    }]
  };
}

function exposeInstalledGlobals(host) {
  const keys = [
    'window', 'self', 'document', 'fetch', 'Request', 'Response', 'Headers',
    'Blob', 'File', 'FileReader', 'DOMException', 'URL', 'URLSearchParams',
    'Image', 'HTMLImageElement', 'Event', 'EventTarget', 'PointerEvent'
  ];
  const descriptors = new Map(keys.map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key)
  ]));

  keys.forEach(key => {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: host[key]
    });
  });

  return () => {
    keys.forEach(key => {
      const descriptor = descriptors.get(key);
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete globalThis[key];
      }
    });
  };
}

describe('GLTFLoader embedded images', () => {
  test('loads a bufferView image through the installed self.URL', async () => {
    const { canvas, images } = createImageCanvas();
    const host = {};
    const adapter = adaptForMiniProgram(canvas, { globalObject: host });
    const restoreGlobals = exposeInstalledGlobals(host);

    try {
      assert.equal(globalThis.self.URL, host.URL);

      const gltf = await new GLTFLoader().parseAsync(
        JSON.stringify(createEmbeddedTextureGltf()),
        ''
      );
      const mesh = gltf.scene.children[0];

      assert.ok(mesh.material.map, 'embedded image should create a texture map');
      assert.equal(images.length, 1);
      assert.match(images[0].src, /^blob:/);
    } finally {
      restoreGlobals();
      adapter.dispose();
    }
  });
});
