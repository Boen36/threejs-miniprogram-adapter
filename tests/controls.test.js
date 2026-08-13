import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import {
  adaptAllControls,
  adaptDeviceOrientationControls,
  adaptPointerLockControls
} from '../src/plugins/controls.js';

const originalWx = globalThis.wx;

afterEach(() => {
  if (originalWx === undefined) {
    delete globalThis.wx;
  } else {
    globalThis.wx = originalWx;
  }
});

function installMockWx() {
  const calls = { listeners: [], offed: [], started: 0, stopped: 0 };
  globalThis.wx = {
    onDeviceMotionChange(callback) {
      calls.listeners.push(callback);
    },
    offDeviceMotionChange(callback) {
      calls.offed.push(callback);
    },
    startDeviceMotionListening() {
      calls.started++;
    },
    stopDeviceMotionListening() {
      calls.stopped++;
    }
  };
  return calls;
}

describe('adaptPointerLockControls', () => {
  test('patches lock/unlock to warn and isLocked to false', () => {
    class PointerLockControls {}
    adaptPointerLockControls({ PointerLockControls });

    const controls = new PointerLockControls();
    assert.doesNotThrow(() => controls.lock());
    assert.doesNotThrow(() => controls.unlock());
    assert.equal(controls.isLocked(), false);
  });

  test('ignores THREE without PointerLockControls', () => {
    assert.doesNotThrow(() => adaptPointerLockControls({}));
  });
});

describe('adaptDeviceOrientationControls', () => {
  test('bridges wx device motion and removes the listener on disconnect', () => {
    const calls = installMockWx();
    let originalDisconnectCalled = 0;

    class DeviceOrientationControls {
      constructor() {
        this.deviceOrientation = {};
      }
      connect() {}
      disconnect() {
        originalDisconnectCalled++;
      }
    }
    adaptDeviceOrientationControls({ DeviceOrientationControls });

    const controls = new DeviceOrientationControls();
    controls.connect();
    assert.equal(calls.listeners.length, 1);
    assert.equal(calls.started, 1);

    // 重复 connect 不叠加监听
    controls.connect();
    assert.equal(calls.listeners.length, 1);
    assert.equal(calls.started, 1);

    // wx 回调映射为 three 期望的 deviceOrientation 形状
    calls.listeners[0]({ alpha: 10, beta: 20, gamma: 30 });
    assert.deepEqual(controls.deviceOrientation, { alpha: 10, beta: 20, gamma: 30 });

    controls.disconnect();
    assert.equal(calls.stopped, 1);
    assert.deepEqual(calls.offed, [calls.listeners[0]]);
    assert.equal(originalDisconnectCalled, 1);

    // disconnect 后可重新 connect
    controls.connect();
    assert.equal(calls.listeners.length, 2);
    assert.equal(calls.started, 2);
  });

  test('falls back to the standard API when wx device motion is unavailable', () => {
    delete globalThis.wx;
    let connected = 0;
    let disconnected = 0;

    class DeviceOrientationControls {
      connect() {
        connected++;
      }
      disconnect() {
        disconnected++;
      }
    }
    adaptDeviceOrientationControls({ DeviceOrientationControls });

    const controls = new DeviceOrientationControls();
    controls.connect();
    controls.disconnect();
    assert.equal(connected, 1);
    assert.equal(disconnected, 1);
  });
});

describe('adaptAllControls', () => {
  test('handles a missing THREE instance', () => {
    assert.doesNotThrow(() => adaptAllControls(null));
  });

  test('applies the real adapters', () => {
    class PointerLockControls {}
    adaptAllControls({ PointerLockControls });
    assert.equal(new PointerLockControls().isLocked(), false);
  });
});
