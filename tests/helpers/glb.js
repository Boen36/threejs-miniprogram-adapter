function alignToFour(value) {
  return (value + 3) & ~3;
}

function createGlb(json, binaryData) {
  const binary = binaryData instanceof Uint8Array
    ? binaryData
    : new Uint8Array(binaryData);
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = alignToFour(jsonBytes.byteLength);
  const binaryLength = alignToFour(binary.byteLength);
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength;
  const glb = new ArrayBuffer(totalLength);
  const view = new DataView(glb);
  const bytes = new Uint8Array(glb);

  view.setUint32(0, 0x46546c67, true); // glTF
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true); // JSON
  bytes.fill(0x20, 20, 20 + jsonLength);
  bytes.set(jsonBytes, 20);

  const binaryHeader = 20 + jsonLength;
  view.setUint32(binaryHeader, binaryLength, true);
  view.setUint32(binaryHeader + 4, 0x004e4942, true); // BIN
  bytes.set(binary, binaryHeader + 8);
  return glb;
}

function createTriangleGlb() {
  const positionByteLength = 3 * 3 * Float32Array.BYTES_PER_ELEMENT;
  const indexByteLength = 3 * Uint16Array.BYTES_PER_ELEMENT;
  const binary = new ArrayBuffer(positionByteLength + indexByteLength);
  const view = new DataView(binary);
  const positions = [
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
  ];
  positions.forEach((value, index) => {
    view.setFloat32(index * Float32Array.BYTES_PER_ELEMENT, value, true);
  });
  [0, 1, 2].forEach((value, index) => {
    view.setUint16(positionByteLength + index * Uint16Array.BYTES_PER_ELEMENT, value, true);
  });

  return createGlb({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionByteLength, target: 34962 },
      { buffer: 0, byteOffset: positionByteLength, byteLength: indexByteLength, target: 34963 }
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0]
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: 3,
        type: 'SCALAR'
      }
    ]
  }, new Uint8Array(binary));
}

export { createGlb, createTriangleGlb };
