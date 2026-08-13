/**
 * 微信平台信息读取。
 * 基础库 2.20.1 起，getSystemInfoSync 停止维护并拆分为三个同步 API。
 * 现代 API 优先；仅当某一类信息缺失或读取失败时调用一次旧 API 补缺。
 */

function resolveRuntime(runtime) {
  if (runtime !== undefined) return runtime;
  return typeof wx !== 'undefined' ? wx : null;
}

function isInfoObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readMethod(runtime, method, errors) {
  if (!runtime || typeof runtime[method] !== 'function') {
    return { value: null };
  }
  try {
    const value = runtime[method]();
    return {
      value: isInfoObject(value) ? value : null
    };
  } catch (error) {
    errors.push({ method, error });
    return { value: null };
  }
}

function hasAll(info, keys) {
  return Boolean(info && keys.every(key => info[key] !== undefined && info[key] !== null));
}

const windowKeys = ['windowWidth', 'windowHeight', 'pixelRatio'];
const deviceKeys = ['platform'];
const appKeys = ['SDKVersion'];

function readPlatformInfo(runtime) {
  const host = resolveRuntime(runtime);
  const errors = [];
  const windowResult = readMethod(host, 'getWindowInfo', errors);
  const deviceResult = readMethod(host, 'getDeviceInfo', errors);
  const appResult = readMethod(host, 'getAppBaseInfo', errors);
  const needsLegacy = !hasAll(windowResult.value, windowKeys) ||
    !hasAll(deviceResult.value, deviceKeys) ||
    !hasAll(appResult.value, appKeys);
  const legacyResult = needsLegacy
    ? readMethod(host, 'getSystemInfoSync', errors)
    : { value: null };
  const legacy = legacyResult.value || {};
  const info = {
    ...legacy,
    ...(windowResult.value || {}),
    ...(deviceResult.value || {}),
    ...(appResult.value || {})
  };

  return {
    info,
    sections: {
      window: hasAll(info, windowKeys),
      device: hasAll(info, deviceKeys),
      app: hasAll(info, appKeys)
    },
    sources: {
      window: hasAll(windowResult.value, windowKeys) ? 'getWindowInfo' : (legacyResult.value ? 'getSystemInfoSync' : null),
      device: hasAll(deviceResult.value, deviceKeys) ? 'getDeviceInfo' : (legacyResult.value ? 'getSystemInfoSync' : null),
      app: hasAll(appResult.value, appKeys) ? 'getAppBaseInfo' : (legacyResult.value ? 'getSystemInfoSync' : null)
    },
    errors
  };
}

function getWindowMetrics(runtime) {
  const host = resolveRuntime(runtime);
  const errors = [];
  const modern = readMethod(host, 'getWindowInfo', errors);
  if (hasAll(modern.value, windowKeys)) {
    return modern.value;
  }
  const legacy = readMethod(host, 'getSystemInfoSync', errors);
  return {
    ...(legacy.value || {}),
    ...(modern.value || {})
  };
}

function hasPlatformInfoSupport(runtime) {
  const host = resolveRuntime(runtime);
  if (!host) return false;
  const hasLegacy = typeof host.getSystemInfoSync === 'function';
  return (typeof host.getWindowInfo === 'function' || hasLegacy) &&
    (typeof host.getDeviceInfo === 'function' || hasLegacy) &&
    (typeof host.getAppBaseInfo === 'function' || hasLegacy);
}

export { getWindowMetrics, hasPlatformInfoSupport, readPlatformInfo };
