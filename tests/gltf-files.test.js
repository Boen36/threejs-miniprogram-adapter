import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { adaptForMiniProgram } from '../src/index.js';
import { createTriangleGlb } from './helpers/glb.js';
import { exposeInstalledGlobals } from './helpers/installed-globals.js';

const originalWx = globalThis.wx;

afterEach(() => {
  if (originalWx === undefined) delete globalThis.wx;
  else globalThis.wx = originalWx;
});

function createCanvas() {
  return {
    id: 'file-gltf-canvas',
    width: 64,
    height: 64,
    getContext() {
      return null;
    }
  };
}

function assertTriangle(gltf) {
  let mesh = null;
  gltf.scene.traverse(object => {
    if (!mesh && object.isMesh) mesh = object;
  });
  assert.ok(mesh, 'GLB should contain a mesh');
  assert.deepEqual([...mesh.geometry.getAttribute('position').array], [
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
  ]);
  assert.deepEqual([...mesh.geometry.index.array], [0, 1, 2]);
  mesh.geometry.dispose();
  mesh.material.dispose();
}

async function withAdapter(run) {
  const host = {};
  const adapter = adaptForMiniProgram(createCanvas(), { globalObject: host });
  const restoreGlobals = exposeInstalledGlobals(host);
  try {
    await run();
  } finally {
    restoreGlobals();
    adapter.dispose();
  }
}

describe('GLTFLoader file integration', () => {
  test('loads a remote GLB through wx.request and the installed fetch', async () => {
    const glb = createTriangleGlb();
    const requests = [];
    globalThis.wx = {
      request(options) {
        requests.push(options);
        queueMicrotask(() => options.success({
          data: glb.slice(0),
          statusCode: 200,
          header: { 'content-type': 'model/gltf-binary' }
        }));
        return { abort() {} };
      }
    };

    await withAdapter(async () => {
      const gltf = await new GLTFLoader().loadAsync('https://example.com/triangle.glb');
      assertTriangle(gltf);
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://example.com/triangle.glb');
    assert.equal(requests[0].responseType, 'arraybuffer');
  });

  test('loads a sandbox GLB through FileSystemManager and the installed fetch', async () => {
    const glb = createTriangleGlb();
    const reads = [];
    globalThis.wx = {
      env: { USER_DATA_PATH: 'wxfile://usr' },
      getFileSystemManager() {
        return {
          readFile({ filePath, success }) {
            reads.push(filePath);
            queueMicrotask(() => success({ data: glb.slice(0) }));
          }
        };
      }
    };

    await withAdapter(async () => {
      const gltf = await new GLTFLoader().loadAsync('wxfile://usr/triangle.glb');
      assertTriangle(gltf);
    });

    assert.deepEqual(reads, ['wxfile://usr/triangle.glb']);
  });
});
