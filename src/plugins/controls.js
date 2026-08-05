/**
 * Controls 插件适配
 * 为 three.js 的各种 Controls 提供小程序触摸事件支持
 */

import { bindTouchEvents } from '../adaptor/events/bridge.js';

/**
 * 适配 OrbitControls 到小程序
 * @param {Object} THREE - three.js 实例
 */
function adaptOrbitControls(THREE) {
  if (!THREE || !THREE.OrbitControls) {
    console.warn('THREE.OrbitControls not available');
    return;
  }

  // OrbitControls 使用 Pointer Events，应该在适配器的事件桥接后自动工作
  // 这里添加一些小程序特定的优化

  // 添加小程序特定的初始化
  THREE.OrbitControls.prototype.initialize = function() {
    // 确保 canvas 支持指针事件
    const domElement = this.domElement;

    if (domElement && !domElement._touchHandlers) {
      // 如果 canvas 没有绑定触摸事件，尝试重新绑定
      bindTouchEvents(domElement);
    }
  };

  // 覆盖 connect 方法以确保正确连接
  if (THREE.OrbitControls.prototype.connect) {
    const originalConnect = THREE.OrbitControls.prototype.connect;
    THREE.OrbitControls.prototype.connect = function(domElement) {
      originalConnect.call(this, domElement);

      // 小程序优化：确保触摸事件正确传递
      if (domElement && domElement._miniProgramCanvas) {
        // 已经通过适配器绑定
      }
    };
  }
}

/**
 * 创建小程序优化的触摸控制器
 * 当 OrbitControls 无法工作时使用
 */
function createTouchControls(camera, domElement, options = {}) {
  const config = {
    enableRotate: true,
    enableZoom: true,
    enablePan: true,
    rotateSpeed: 1.0,
    zoomSpeed: 1.0,
    panSpeed: 1.0,
    minDistance: 0,
    maxDistance: Infinity,
    minPolarAngle: 0,
    maxPolarAngle: Math.PI,
    ...options
  };

  const target = options.target || { x: 0, y: 0, z: 0 };
  const offsetX = camera.position.x - target.x;
  const offsetY = camera.position.y - target.y;
  const offsetZ = camera.position.z - target.z;
  const initialRadius = Math.sqrt(offsetX ** 2 + offsetY ** 2 + offsetZ ** 2) || 10;
  const state = {
    pointers: new Map(),
    lastPoint: null,
    lastDistance: 0,
    theta: Math.atan2(offsetX, offsetZ),
    phi: Math.acos(Math.max(-1, Math.min(1, offsetY / initialRadius))),
    radius: initialRadius
  };

  function updateCamera() {
    const x = target.x + state.radius * Math.sin(state.phi) * Math.sin(state.theta);
    const y = target.y + state.radius * Math.cos(state.phi);
    const z = target.z + state.radius * Math.sin(state.phi) * Math.cos(state.theta);

    camera.position.set(x, y, z);
    camera.lookAt(target.x, target.y, target.z);
  }

  function distanceBetweenPointers() {
    const points = Array.from(state.pointers.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function onPointerDown(event) {
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointers.size === 1) {
      state.lastPoint = { x: event.clientX, y: event.clientY };
    } else if (state.pointers.size === 2) {
      state.lastDistance = distanceBetweenPointers();
    }
    domElement?.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!state.pointers.has(event.pointerId)) return;
    event.preventDefault();
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (state.pointers.size === 1 && config.enableRotate) {
      const deltaX = event.clientX - state.lastPoint.x;
      const deltaY = event.clientY - state.lastPoint.y;

      state.theta -= deltaX * 0.01 * config.rotateSpeed;
      state.phi += deltaY * 0.01 * config.rotateSpeed;
      state.phi = Math.max(config.minPolarAngle, Math.min(config.maxPolarAngle, state.phi));
      state.lastPoint = { x: event.clientX, y: event.clientY };
      updateCamera();
    } else if (state.pointers.size === 2 && config.enableZoom) {
      const distance = distanceBetweenPointers();
      if (!distance || !state.lastDistance) return;
      const scale = state.lastDistance / distance;
      state.radius *= scale;
      state.radius = Math.max(config.minDistance, Math.min(config.maxDistance, state.radius));
      state.lastDistance = distance;
      updateCamera();
    }
  }

  function onPointerEnd(event) {
    state.pointers.delete(event.pointerId);
    domElement?.releasePointerCapture?.(event.pointerId);
    const remaining = Array.from(state.pointers.values());
    state.lastPoint = remaining[0] || null;
    state.lastDistance = state.pointers.size === 2 ? distanceBetweenPointers() : 0;
  }

  // 绑定事件
  if (domElement) {
    domElement.addEventListener('pointerdown', onPointerDown, { passive: false });
    domElement.addEventListener('pointermove', onPointerMove, { passive: false });
    domElement.addEventListener('pointerup', onPointerEnd);
    domElement.addEventListener('pointercancel', onPointerEnd);
  }

  return {
    update: updateCamera,
    dispose: () => {
      if (domElement) {
        domElement.removeEventListener('pointerdown', onPointerDown);
        domElement.removeEventListener('pointermove', onPointerMove);
        domElement.removeEventListener('pointerup', onPointerEnd);
        domElement.removeEventListener('pointercancel', onPointerEnd);
      }
    },
    setTarget: (x, y, z) => {
      target.x = x;
      target.y = y;
      target.z = z;
      updateCamera();
    },
    setRadius: (r) => {
      state.radius = r;
      updateCamera();
    }
  };
}

/**
 * 适配 TrackballControls
 */
function adaptTrackballControls(THREE) {
  if (!THREE || !THREE.TrackballControls) {
    return;
  }

  // TrackballControls 同样依赖 Pointer Events
  // 适配器的事件桥接应该已经处理了
}

/**
 * 适配 FlyControls
 */
function adaptFlyControls(THREE) {
  if (!THREE || !THREE.FlyControls) {
    return;
  }

  // FlyControls 使用键盘事件，小程序支持有限
}

/**
 * 适配 FirstPersonControls
 */
function adaptFirstPersonControls(THREE) {
  if (!THREE || !THREE.FirstPersonControls) {
    return;
  }
}

/**
 * 适配 PointerLockControls
 * 小程序不支持 Pointer Lock API
 */
function adaptPointerLockControls(THREE) {
  if (!THREE || !THREE.PointerLockControls) {
    return;
  }

  // 覆盖 lock 方法，因为小程序不支持 Pointer Lock
  THREE.PointerLockControls.prototype.lock = function() {
    console.warn('Pointer Lock API is not supported in mini program');
  };

  THREE.PointerLockControls.prototype.unlock = function() {
    console.warn('Pointer Lock API is not supported in mini program');
  };

  THREE.PointerLockControls.prototype.isLocked = function() {
    return false;
  };
}

/**
 * 适配 DeviceOrientationControls
 * 小程序支持设备方向 API
 */
function adaptDeviceOrientationControls(THREE) {
  if (!THREE || !THREE.DeviceOrientationControls) {
    return;
  }

  // 小程序的设备方向 API 有所不同
  const originalConnect = THREE.DeviceOrientationControls.prototype.connect;
  THREE.DeviceOrientationControls.prototype.connect = function() {
    if (typeof wx !== 'undefined' && wx.onDeviceMotionChange) {
      // 使用小程序的设备运动 API
      wx.onDeviceMotionChange((res) => {
        // 转换数据格式
        this.deviceOrientation = {
          alpha: res.alpha,
          beta: res.beta,
          gamma: res.gamma
        };
      });

      wx.startDeviceMotionListening({
        interval: 'game'
      });
    } else {
      // 回退到标准 API
      if (originalConnect) {
        originalConnect.call(this);
      }
    }
  };

  const originalDisconnect = THREE.DeviceOrientationControls.prototype.disconnect;
  THREE.DeviceOrientationControls.prototype.disconnect = function() {
    if (typeof wx !== 'undefined' && wx.stopDeviceMotionListening) {
      wx.stopDeviceMotionListening();
    }

    if (originalDisconnect) {
      originalDisconnect.call(this);
    }
  };
}

/**
 * 应用所有 Controls 适配
 */
function adaptAllControls(THREE) {
  if (!THREE) {
    console.warn('THREE is not available');
    return;
  }

  adaptOrbitControls(THREE);
  adaptTrackballControls(THREE);
  adaptFlyControls(THREE);
  adaptFirstPersonControls(THREE);
  adaptPointerLockControls(THREE);
  adaptDeviceOrientationControls(THREE);
}

/**
 * 创建自定义手势控制器
 * 支持缩放、旋转、平移
 */
function createGestureControls(camera, domElement, options = {}) {
  const controls = createTouchControls(camera, domElement, options);

  // 添加双击重置
  let lastTapTime = 0;
  domElement.addEventListener('pointerdown', (e) => {
    const currentTime = Date.now();
    const tapLength = currentTime - lastTapTime;
    if (tapLength < 300 && tapLength > 0) {
      // 双击，重置视角
      if (options.onDoubleTap) {
        options.onDoubleTap();
      }
    }
    lastTapTime = currentTime;
  });

  return controls;
}

export {
  adaptOrbitControls,
  createTouchControls,
  adaptTrackballControls,
  adaptFlyControls,
  adaptFirstPersonControls,
  adaptPointerLockControls,
  adaptDeviceOrientationControls,
  adaptAllControls,
  createGestureControls
};

export default {
  adaptAllControls,
  createTouchControls,
  createGestureControls
};
