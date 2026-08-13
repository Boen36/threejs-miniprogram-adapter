import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  getWindowMetrics,
  hasPlatformInfoSupport,
  readPlatformInfo
} from '../src/adaptor/platform.js';

describe('WeChat platform information', () => {
  test('merges the three modern APIs without touching the legacy API', () => {
    let legacyCalls = 0;
    const runtime = {
      getWindowInfo: () => ({ windowWidth: 320, windowHeight: 640, pixelRatio: 3 }),
      getDeviceInfo: () => ({ platform: 'android', model: 'Device' }),
      getAppBaseInfo: () => ({ SDKVersion: '2.30.0', version: '9.0.0', language: 'zh_CN' }),
      getSystemInfoSync() {
        legacyCalls++;
        return { windowWidth: 1, platform: 'legacy', SDKVersion: '1.0.0' };
      }
    };

    const result = readPlatformInfo(runtime);
    assert.equal(result.info.windowWidth, 320);
    assert.equal(result.info.platform, 'android');
    assert.equal(result.info.SDKVersion, '2.30.0');
    assert.deepEqual(result.sources, {
      window: 'getWindowInfo',
      device: 'getDeviceInfo',
      app: 'getAppBaseInfo'
    });
    assert.equal(legacyCalls, 0);
    assert.equal(hasPlatformInfoSupport(runtime), true);
  });

  test('calls the legacy API once to fill missing modern sections', () => {
    let legacyCalls = 0;
    const runtime = {
      getWindowInfo: () => ({ windowWidth: 320, windowHeight: 640, pixelRatio: 3 }),
      getSystemInfoSync() {
        legacyCalls++;
        return {
          windowWidth: 375,
          windowHeight: 667,
          pixelRatio: 2,
          platform: 'ios',
          SDKVersion: '2.24.0',
          version: '8.0.0'
        };
      }
    };

    const result = readPlatformInfo(runtime);
    assert.equal(legacyCalls, 1);
    assert.equal(result.info.windowWidth, 320, 'modern values should override legacy values');
    assert.equal(result.info.platform, 'ios');
    assert.equal(result.info.SDKVersion, '2.24.0');
    assert.deepEqual(result.sections, { window: true, device: true, app: true });
  });

  test('window-only reads do not call unrelated information APIs', () => {
    const calls = [];
    const runtime = {
      getWindowInfo() {
        calls.push('window');
        return { windowWidth: 300, windowHeight: 500, pixelRatio: 2 };
      },
      getDeviceInfo() {
        calls.push('device');
        return {};
      },
      getAppBaseInfo() {
        calls.push('app');
        return {};
      },
      getSystemInfoSync() {
        calls.push('legacy');
        return {};
      }
    };

    assert.deepEqual(getWindowMetrics(runtime), {
      windowWidth: 300,
      windowHeight: 500,
      pixelRatio: 2
    });
    assert.deepEqual(calls, ['window']);
  });

  test('falls back safely when modern information APIs throw', () => {
    let legacyCalls = 0;
    const runtime = {
      getWindowInfo() { throw new Error('window unavailable'); },
      getDeviceInfo() { throw new Error('device unavailable'); },
      getAppBaseInfo() { throw new Error('app unavailable'); },
      getSystemInfoSync() {
        legacyCalls++;
        return {
          windowWidth: 375,
          windowHeight: 667,
          pixelRatio: 2,
          platform: 'devtools',
          SDKVersion: '2.24.0'
        };
      }
    };

    const result = readPlatformInfo(runtime);
    assert.equal(legacyCalls, 1);
    assert.equal(result.errors.length, 3);
    assert.deepEqual(result.sections, { window: true, device: true, app: true });
    assert.deepEqual(result.sources, {
      window: 'getSystemInfoSync',
      device: 'getSystemInfoSync',
      app: 'getSystemInfoSync'
    });
  });
});
