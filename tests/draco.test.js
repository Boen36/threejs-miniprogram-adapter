import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';
import vm from 'node:vm';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import adapter, {
  LoaderPlugins,
  MiniProgramDRACOLoader,
  installPolyfills
} from '../src/index.js';

const require = createRequire(import.meta.url);
const FIXTURES = new URL('./fixtures/', import.meta.url);

function readFixture(name) {
  const buffer = readFileSync(new URL(name, FIXTURES));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * 从 three 包里取出消费者实际会拷贝进小程序代码包的两个 decoder 文件，
 * 在独立 vm 上下文中按 CommonJS 语义求值
 * （等价于小程序里 require('./libs/draco/draco_wasm_wrapper.js')）。
 */
function loadThreeDracoFactory(variant = 'standard') {
  const dir = variant === 'gltf'
    ? 'three/examples/jsm/libs/draco/gltf/'
    : 'three/examples/jsm/libs/draco/';
  const wrapperSource = readFileSync(require.resolve(dir + 'draco_wasm_wrapper.js'), 'utf8');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    WebAssembly: globalThis.WebAssembly,
    TextDecoder: globalThis.TextDecoder,
    console
  };
  vm.runInNewContext(wrapperSource, sandbox, { filename: 'draco_wasm_wrapper.js' });
  const factory = sandbox.module.exports;
  const wasmBinary = readFileSync(require.resolve(dir + 'draco_decoder.wasm'));
  return {
    factory,
    wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength)
  };
}

function createLoader(variant) {
  const { factory, wasmBinary } = loadThreeDracoFactory(variant);
  return new MiniProgramDRACOLoader()
    .setDecoderModule(factory)
    .setDecoderBinary(wasmBinary);
}

function parseGlb(glb, loader) {
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(loader);
  return new Promise((resolve, reject) => {
    gltfLoader.parse(glb, '', resolve, reject);
  });
}

describe('MiniProgramDRACOLoader standalone .drc', () => {
  test('decodes a compressed mesh with positions, normals, uvs and indices', async () => {
    const loader = createLoader();
    const geometry = await new Promise((resolve, reject) => {
      loader.parse(readFixture('cube.drc'), resolve, reject);
    });

    assert.equal(geometry.index.count, 36);
    assert.equal(geometry.attributes.position.count, 24);
    assert.equal(geometry.attributes.position.itemSize, 3);
    assert.equal(geometry.attributes.normal.count, 24);
    assert.equal(geometry.attributes.uv.count, 24);

    // 单位立方体，顶点坐标 ±0.5（draco 量化，允许误差）
    const position = geometry.attributes.position;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < position.count; i++) {
      min = Math.min(min, position.getX(i), position.getY(i), position.getZ(i));
      max = Math.max(max, position.getX(i), position.getY(i), position.getZ(i));
    }
    assert.ok(Math.abs(min - -0.5) < 0.01, `min ${min}`);
    assert.ok(Math.abs(max - 0.5) < 0.01, `max ${max}`);

    // 法线近似单位向量
    const normal = geometry.attributes.normal;
    for (let i = 0; i < normal.count; i++) {
      const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      assert.ok(Math.abs(length - 1) < 0.01, `normal length ${length} at ${i}`);
    }

    loader.dispose();
  });

  test('rejects an invalid draco buffer', async () => {
    const loader = createLoader();
    // parse() 把解码错误转给 onError（与 three DRACOLoader 语义一致）
    await assert.rejects(
      new Promise((resolve, reject) => {
        loader.parse(new ArrayBuffer(16), resolve, reject);
      }),
      /Decoding failed|Unexpected geometry type/
    );
    loader.dispose();
  });

  test('reports a missing decoder module at decode time', async () => {
    const loader = new MiniProgramDRACOLoader();
    await assert.rejects(
      new Promise((resolve, reject) => {
        loader.decodeDracoFile(readFixture('cube.drc'), resolve, null, null, null, reject);
      }),
      /No decoder module configured/
    );
  });

  test('preload is synchronous and safe without configuration', () => {
    const loader = new MiniProgramDRACOLoader();
    assert.equal(loader.preload(), loader);
    loader.dispose();
  });
});

describe('MiniProgramDRACOLoader with GLTFLoader', () => {
  test('decodes KHR_draco_mesh_compression GLB end to end', async () => {
    const loader = createLoader();
    const gltf = await parseGlb(readFixture('cube-draco.glb'), loader);

    const mesh = gltf.scene.children[0];
    assert.ok(mesh.isMesh);
    const geometry = mesh.geometry;

    assert.equal(geometry.index.count, 36);
    assert.equal(geometry.attributes.position.count, 24);
    assert.equal(geometry.attributes.normal.count, 24);
    assert.equal(geometry.attributes.uv.count, 24);

    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    assert.ok(Math.abs(min.x - -0.5) < 0.01, `min.x ${min.x}`);
    assert.ok(Math.abs(max.x - 0.5) < 0.01, `max.x ${max.x}`);

    loader.dispose();
  });

  test('works with the gltf decoder variant recommended for KHR_draco_mesh_compression', async () => {
    const loader = createLoader('gltf');
    const gltf = await parseGlb(readFixture('cube-draco.glb'), loader);

    const geometry = gltf.scene.children[0].geometry;
    assert.equal(geometry.index.count, 36);
    assert.equal(geometry.attributes.position.count, 24);

    loader.dispose();
  });

  test('fails cleanly when a GLB needs a decoder that was not configured', async () => {
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(new MiniProgramDRACOLoader());
    await assert.rejects(
      new Promise((resolve, reject) => {
        gltfLoader.parse(readFixture('cube-draco.glb'), '', resolve, reject);
      }),
      /No decoder module configured/
    );
  });
});

describe('WXWebAssembly alias', () => {
  test('maps WXWebAssembly to WebAssembly when the host lacks it', () => {
    const hostWasm = globalThis.WebAssembly;
    const host = { WXWebAssembly: hostWasm };
    installPolyfills(host);
    assert.equal(host.WebAssembly, hostWasm);
  });

  test('keeps an existing WebAssembly global', () => {
    const hostWasm = globalThis.WebAssembly;
    const other = {};
    const host = { WebAssembly: other, WXWebAssembly: hostWasm };
    installPolyfills(host);
    assert.equal(host.WebAssembly, other);
  });

  test('does nothing when WXWebAssembly is absent', () => {
    const host = {};
    installPolyfills(host);
    assert.equal(host.WebAssembly, undefined);
  });
});

describe('public API wiring', () => {
  test('exposes the loader on named, default and LoaderPlugins exports', () => {
    assert.equal(typeof MiniProgramDRACOLoader, 'function');
    assert.equal(adapter.MiniProgramDRACOLoader, MiniProgramDRACOLoader);
    assert.equal(LoaderPlugins.MiniProgramDRACOLoader, MiniProgramDRACOLoader);
  });
});
