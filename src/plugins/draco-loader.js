/**
 * 小程序 DRACO 加载器
 *
 * three.js 标准 DRACOLoader 依赖 Blob URL + `new Worker(blobURL)`，
 * 与微信小程序的 Worker 模型不兼容。本加载器把 Draco 解码搬回主线程：
 * WASM decoder 由业务方通过 setDecoderModule()/setDecoderBinary() 注入，
 * 对外实现 GLTFLoader 所需的 DRACOLoader 兼容接口，
 * 可直接传给 gltfLoader.setDRACOLoader()。
 *
 * 解码算法移植自 three.js DRACOLoader 的 Worker 实现
 * （three.js, MIT License, Copyright 2010-2026 three.js authors）。
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ColorManagement,
  FileLoader,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  LinearSRGBColorSpace,
  Loader,
  SRGBColorSpace
} from 'three';

class MiniProgramDRACOLoader extends Loader {

  constructor(manager) {
    super(manager);

    this.decoderModuleFactory = null;
    this.decoderBinary = null;
    this.decoderPending = null;
    this._draco = null;

    this.defaultAttributeIDs = {
      position: 'POSITION',
      normal: 'NORMAL',
      color: 'COLOR',
      uv: 'TEX_COORD'
    };
    this.defaultAttributeTypes = {
      position: 'Float32Array',
      normal: 'Float32Array',
      color: 'Float32Array',
      uv: 'Float32Array'
    };
  }

  /**
   * 注入 decoder 模块工厂。
   * 小程序中把 three 包的 `draco_wasm_wrapper.js` 复制进代码包后用 CommonJS require：
   *
   *   const DracoDecoderModule = require('./libs/draco/draco_wasm_wrapper.js');
   *   loader.setDecoderModule(DracoDecoderModule);
   *
   * 也支持 draco3d 包导出的 DracoDecoderModule。
   * @param {Function} moduleFactory
   * @return {MiniProgramDRACOLoader}
   */
  setDecoderModule(moduleFactory) {
    this.decoderModuleFactory = moduleFactory;
    this.decoderPending = null;
    this._draco = null;
    return this;
  }

  /**
   * 直接注入 WASM 二进制，跳过工厂内部的 fetch 定位。
   * 代码包内文件可用 wx.getFileSystemManager().readFileSync() 读取：
   *
   *   const wasmBinary = wx.getFileSystemManager()
   *     .readFileSync('./libs/draco/draco_decoder.wasm');
   *   loader.setDecoderBinary(wasmBinary);
   *
   * @param {ArrayBuffer} binary
   * @return {MiniProgramDRACOLoader}
   */
  setDecoderBinary(binary) {
    this.decoderBinary = binary;
    this.decoderPending = null;
    this._draco = null;
    return this;
  }

  /**
   * 预加载 decoder（GLTFLoader 在扩展构造时同步调用，返回 this 即可）。
   * @return {MiniProgramDRACOLoader}
   */
  preload() {
    this._getDecoder().catch(() => {});
    return this;
  }

  /**
   * 加载独立的 .drc 文件。
   * @param {string} url
   * @param {Function} [onLoad]
   * @param {Function} [onProgress]
   * @param {Function} [onError]
   */
  load(url, onLoad, onProgress, onError) {
    const loader = new FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType('arraybuffer');
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);

    loader.load(url, (buffer) => {
      this.parse(buffer, onLoad, onError);
    }, onProgress, onError);
  }

  /**
   * 解析独立的 .drc 数据。顶点颜色按 sRGB 处理（与 three DRACOLoader.parse 一致）。
   * @param {ArrayBuffer} buffer
   * @param {Function} [onLoad]
   * @param {Function} [onError]
   */
  parse(buffer, onLoad, onError = () => {}) {
    this.decodeDracoFile(buffer, onLoad, null, null, SRGBColorSpace, onError).catch(onError);
  }

  /**
   * GLTFLoader 内部调用入口（KHR_draco_mesh_compression）。
   * 签名与 three DRACOLoader 在 r160-r185 的约定一致。
   * @param {ArrayBuffer} buffer
   * @param {Function} callback
   * @param {Object} [attributeIDs] - three 属性名 -> glTF 唯一 attribute ID
   * @param {Object} [attributeTypes] - three 属性名 -> TypedArray 类型名
   * @param {string} [vertexColorSpace]
   * @param {Function} [onError]
   * @return {Promise}
   */
  decodeDracoFile(buffer, callback, attributeIDs, attributeTypes, vertexColorSpace = LinearSRGBColorSpace, onError = () => {}) {
    const taskConfig = {
      attributeIDs: attributeIDs || this.defaultAttributeIDs,
      attributeTypes: attributeTypes || this.defaultAttributeTypes,
      useUniqueIDs: !!attributeIDs,
      vertexColorSpace
    };

    return this.decodeGeometry(buffer, taskConfig).then(callback).catch(onError);
  }

  /**
   * 解码并构造 BufferGeometry。
   * @param {ArrayBuffer} buffer
   * @param {Object} taskConfig
   * @return {Promise<BufferGeometry>}
   */
  async decodeGeometry(buffer, taskConfig) {
    const draco = await this._getDecoder();
    const decoder = new draco.Decoder();

    try {
      const geometryData = decodeGeometryData(draco, decoder, new Int8Array(buffer), taskConfig);
      return this._createGeometry(geometryData, taskConfig.vertexColorSpace);
    } finally {
      draco.destroy(decoder);
    }
  }

  /**
   * 释放 decoder 状态。之后再使用会重新初始化。
   * @return {MiniProgramDRACOLoader}
   */
  dispose() {
    this.decoderPending = null;
    this._draco = null;
    return this;
  }

  async _getDecoder() {
    if (this._draco) return this._draco;

    if (!this.decoderPending) {
      this.decoderPending = this._loadDecoder();
      // preload() 是同步 API：吞掉这里的拒绝，解码时再抛出明确错误。
      this.decoderPending.catch(() => {});
    }

    return this.decoderPending;
  }

  async _loadDecoder() {
    const moduleFactory = this.decoderModuleFactory;
    if (typeof moduleFactory !== 'function') {
      throw new Error('MiniProgramDRACOLoader: No decoder module configured. Call setDecoderModule() first.');
    }

    const config = {};
    if (this.decoderBinary) {
      config.wasmBinary = this.decoderBinary;
    }

    let settled = false;
    const draco = await new Promise((resolve, reject) => {
      // three 的 draco_wasm_wrapper.js 通过 onModuleLoaded 回调交付模块；
      // draco3d 等标准 MODULARIZE 构建通过返回的 Promise 交付。
      config.onModuleLoaded = (module) => {
        if (!settled) {
          settled = true;
          resolve(module);
        }
      };

      let result;
      try {
        result = moduleFactory(config);
      } catch (error) {
        reject(error);
        return;
      }

      if (result && typeof result.then === 'function') {
        result.then(
          (module) => {
            if (!settled) {
              settled = true;
              resolve(module);
            }
          },
          reject
        );
      }
    });

    this._draco = draco;
    return draco;
  }

  _createGeometry(geometryData, vertexColorSpace) {
    const geometry = new BufferGeometry();

    if (geometryData.index) {
      geometry.setIndex(new BufferAttribute(geometryData.index.array, 1));
    }

    for (let i = 0; i < geometryData.attributes.length; i++) {
      const { name, array, itemSize, stride } = geometryData.attributes[i];

      let attribute;
      if (itemSize === stride) {
        attribute = new BufferAttribute(array, itemSize);
      } else {
        const buffer = new InterleavedBuffer(array, stride);
        attribute = new InterleavedBufferAttribute(buffer, itemSize, 0);
      }

      if (name === 'color') {
        this._assignVertexColorSpace(attribute, vertexColorSpace);
        attribute.normalized = (array instanceof Float32Array) === false;
      }

      geometry.setAttribute(name, attribute);
    }

    return geometry;
  }

  _assignVertexColorSpace(attribute, inputColorSpace) {
    // .drc 不记录色彩空间，官方 PLY/OBJ 转换工具按 sRGB 处理。
    // glTF 走 GLTFLoader 时传入 LinearSRGBColorSpace，此处不转换。
    if (inputColorSpace !== SRGBColorSpace) return;

    const color = new Color();

    for (let i = 0, il = attribute.count; i < il; i++) {
      color.fromBufferAttribute(attribute, i);
      ColorManagement.colorSpaceToWorking(color, SRGBColorSpace);
      attribute.setXYZ(i, color.r, color.g, color.b);
    }
  }

}

/**
 * 把 Draco 位流解码为中间几何数据。移植自 three.js DRACOLoader 的 Worker 解码逻辑。
 */
function decodeGeometryData(draco, decoder, array, taskConfig) {
  const attributeIDs = taskConfig.attributeIDs;
  const attributeTypes = taskConfig.attributeTypes;

  let dracoGeometry;
  let decodingStatus;

  const geometryType = decoder.GetEncodedGeometryType(array);

  if (geometryType === draco.TRIANGULAR_MESH) {
    dracoGeometry = new draco.Mesh();
    decodingStatus = decoder.DecodeArrayToMesh(array, array.byteLength, dracoGeometry);
  } else if (geometryType === draco.POINT_CLOUD) {
    dracoGeometry = new draco.PointCloud();
    decodingStatus = decoder.DecodeArrayToPointCloud(array, array.byteLength, dracoGeometry);
  } else {
    throw new Error('MiniProgramDRACOLoader: Unexpected geometry type.');
  }

  if (!decodingStatus.ok() || dracoGeometry.ptr === 0) {
    throw new Error('MiniProgramDRACOLoader: Decoding failed: ' + decodingStatus.error_msg());
  }

  const geometry = { index: null, attributes: [] };

  // 收集全部顶点属性。
  for (const attributeName in attributeIDs) {
    const attributeType = globalThis[attributeTypes[attributeName]];

    let attribute;
    let attributeID;

    // 默认属性按语义名 1:1 映射（独立 .drc）；glTF 使用由唯一 ID 标识的自定义属性集。
    if (taskConfig.useUniqueIDs) {
      attributeID = attributeIDs[attributeName];
      attribute = decoder.GetAttributeByUniqueId(dracoGeometry, attributeID);
    } else {
      attributeID = decoder.GetAttributeId(dracoGeometry, draco[attributeIDs[attributeName]]);
      if (attributeID === -1) continue;
      attribute = decoder.GetAttribute(dracoGeometry, attributeID);
    }

    geometry.attributes.push(decodeAttribute(draco, decoder, dracoGeometry, attributeName, attributeType, attribute));
  }

  if (geometryType === draco.TRIANGULAR_MESH) {
    geometry.index = decodeIndex(draco, decoder, dracoGeometry);
  }

  draco.destroy(dracoGeometry);

  return geometry;
}

function decodeIndex(draco, decoder, dracoGeometry) {
  const numFaces = dracoGeometry.num_faces();
  const numIndices = numFaces * 3;
  const byteLength = numIndices * 4;

  const ptr = draco._malloc(byteLength);
  decoder.GetTrianglesUInt32Array(dracoGeometry, byteLength, ptr);
  const index = new Uint32Array(draco.HEAPF32.buffer, ptr, numIndices).slice();
  draco._free(ptr);

  return { array: index, itemSize: 1 };
}

function decodeAttribute(draco, decoder, dracoGeometry, attributeName, TypedArray, attribute) {
  const count = dracoGeometry.num_points();
  const itemSize = attribute.num_components();
  const dracoDataType = getDracoDataType(draco, TypedArray);

  // 参考 glTF 2.0 数据对齐规范：attribute 数据 4 字节对齐。
  const srcByteStride = itemSize * TypedArray.BYTES_PER_ELEMENT;
  const dstByteStride = Math.ceil(srcByteStride / 4) * 4;

  const dstStride = dstByteStride / TypedArray.BYTES_PER_ELEMENT;

  const srcByteLength = count * srcByteStride;
  const dstByteLength = count * dstByteStride;

  const ptr = draco._malloc(srcByteLength);
  decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, dracoDataType, srcByteLength, ptr);

  const srcArray = new TypedArray(draco.HEAPF32.buffer, ptr, srcByteLength / TypedArray.BYTES_PER_ELEMENT);
  let dstArray;

  if (srcByteStride === dstByteStride) {
    // THREE.BufferAttribute
    dstArray = srcArray.slice();
  } else {
    // THREE.InterleavedBufferAttribute
    dstArray = new TypedArray(dstByteLength / TypedArray.BYTES_PER_ELEMENT);

    let dstOffset = 0;
    for (let i = 0, il = srcArray.length; i < il; i++) {
      for (let j = 0; j < itemSize; j++) {
        dstArray[dstOffset + j] = srcArray[i * itemSize + j];
      }
      dstOffset += dstStride;
    }
  }

  draco._free(ptr);

  return {
    name: attributeName,
    count: count,
    itemSize: itemSize,
    array: dstArray,
    stride: dstStride
  };
}

function getDracoDataType(draco, TypedArray) {
  switch (TypedArray) {
    case Float32Array: return draco.DT_FLOAT32;
    case Int8Array: return draco.DT_INT8;
    case Int16Array: return draco.DT_INT16;
    case Int32Array: return draco.DT_INT32;
    case Uint8Array: return draco.DT_UINT8;
    case Uint16Array: return draco.DT_UINT16;
    case Uint32Array: return draco.DT_UINT32;
  }
}

export { MiniProgramDRACOLoader };
export default MiniProgramDRACOLoader;
