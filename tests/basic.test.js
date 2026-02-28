/**
 * 基础功能测试
 */

import { adaptForMiniProgram, checkCompatibility } from '../src/index.js';

// 模拟测试环境
const mockCanvas = {
  id: 'test-canvas',
  width: 375,
  height: 667,
  getContext: (type) => ({
    getParameter: (pname) => 'WebGL 2.0',
    getExtension: (name) => null,
    getSupportedExtensions: () => []
  }),
  createImage: () => ({
    src: '',
    onload: null,
    onerror: null
  }),
  requestAnimationFrame: (cb) => setTimeout(cb, 16)
};

describe('threejs-miniprogram', () => {
  test('checkCompatibility should return report', () => {
    const report = checkCompatibility();
    expect(report).toHaveProperty('compatible');
    expect(report).toHaveProperty('issues');
    expect(report).toHaveProperty('warnings');
    expect(report).toHaveProperty('info');
  });

  test('adaptForMiniProgram should throw without canvas', () => {
    expect(() => {
      adaptForMiniProgram(null);
    }).toThrow('Canvas is required');
  });

  test('adaptForMiniProgram should return adapted objects', () => {
    // 注意：这个测试需要在小程序环境中运行
    // 这里只是一个示例结构
    const result = adaptForMiniProgram(mockCanvas, {
      injectGlobals: true,
      debug: false
    });

    expect(result).toHaveProperty('canvas');
    expect(result).toHaveProperty('miniProgramCanvas');
    expect(result).toHaveProperty('document');
    expect(result).toHaveProperty('environment');
    expect(result).toHaveProperty('dispose');
  });
});

// 简单的手动测试
console.log('Running basic tests...');

const report = checkCompatibility();
console.log('Compatibility Report:', report);

console.log('Tests completed.');
