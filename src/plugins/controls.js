/**
 * Controls 插件适配
 * 为 three.js 的 Controls 提供小程序环境支持。
 *
 * OrbitControls / TrackballControls / FlyControls / FirstPersonControls
 * 不需要显式适配：它们基于 Pointer Events 工作，适配器的
 * WXML touch* -> PointerEvent 桥已提供所需输入。
 */


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
      // 幂等：重复 connect 不叠加监听
      if (this._wxDeviceMotionHandler) return;

      // 使用小程序的设备运动 API
      const handler = (res) => {
        // 转换数据格式
        this.deviceOrientation = {
          alpha: res.alpha,
          beta: res.beta,
          gamma: res.gamma
        };
      };
      this._wxDeviceMotionHandler = handler;

      wx.onDeviceMotionChange(handler);
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
      if (this._wxDeviceMotionHandler && wx.offDeviceMotionChange) {
        wx.offDeviceMotionChange(this._wxDeviceMotionHandler);
        this._wxDeviceMotionHandler = null;
      }
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

  adaptPointerLockControls(THREE);
  adaptDeviceOrientationControls(THREE);
}

/**
 * 创建自定义手势控制器
 * 支持缩放、旋转、平移
 */
function createGestureControls(camera, domElement, options = {}) {
  const controls = createTouchControls(camera, domElement, options);

  // 添加双击重置（只统计同一指针的两次点击）
  let lastTapTime = 0;
  let lastTapPointerId = null;
  const onPointerDown = (e) => {
    const currentTime = Date.now();
    const tapLength = currentTime - lastTapTime;
    if (e.pointerId !== lastTapPointerId) {
      // 不同指针的点击不算双击，重新计时
      lastTapTime = 0;
    } else if (tapLength < 300 && tapLength > 0) {
      // 双击，重置视角
      if (options.onDoubleTap) {
        options.onDoubleTap();
      }
    }
    lastTapTime = currentTime;
    lastTapPointerId = e.pointerId;
  };
  if (domElement) {
    domElement.addEventListener('pointerdown', onPointerDown);
  }

  const originalDispose = controls.dispose;
  controls.dispose = () => {
    if (domElement) {
      domElement.removeEventListener('pointerdown', onPointerDown);
    }
    originalDispose.call(controls);
  };

  return controls;
}

export {
  createTouchControls,
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
