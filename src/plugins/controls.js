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
    lastCenter: null,
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

  function centerBetweenPointers() {
    const points = Array.from(state.pointers.values());
    if (points.length < 2) return null;
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    };
  }

  function panTarget(deltaX, deltaY) {
    const forwardX = target.x - camera.position.x;
    const forwardY = target.y - camera.position.y;
    const forwardZ = target.z - camera.position.z;
    const forwardLength = Math.hypot(forwardX, forwardY, forwardZ);
    if (!forwardLength) return false;

    const fx = forwardX / forwardLength;
    const fy = forwardY / forwardLength;
    const fz = forwardZ / forwardLength;
    const cameraUp = camera.up || { x: 0, y: 1, z: 0 };
    let rightX = fy * cameraUp.z - fz * cameraUp.y;
    let rightY = fz * cameraUp.x - fx * cameraUp.z;
    let rightZ = fx * cameraUp.y - fy * cameraUp.x;
    let rightLength = Math.hypot(rightX, rightY, rightZ);

    // 视线与 up 平行时使用球坐标的水平切线作为退化回退。
    if (!rightLength) {
      rightX = Math.cos(state.theta);
      rightY = 0;
      rightZ = -Math.sin(state.theta);
      rightLength = 1;
    }
    rightX /= rightLength;
    rightY /= rightLength;
    rightZ /= rightLength;

    const upX = rightY * fz - rightZ * fy;
    const upY = rightZ * fx - rightX * fz;
    const upZ = rightX * fy - rightY * fx;
    const scale = state.radius * 0.002 * config.panSpeed;
    const horizontal = -deltaX * scale;
    const vertical = deltaY * scale;

    target.x += rightX * horizontal + upX * vertical;
    target.y += rightY * horizontal + upY * vertical;
    target.z += rightZ * horizontal + upZ * vertical;
    return true;
  }

  function onPointerDown(event) {
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointers.size === 1) {
      state.lastPoint = { x: event.clientX, y: event.clientY };
    } else if (state.pointers.size === 2) {
      state.lastDistance = distanceBetweenPointers();
      state.lastCenter = centerBetweenPointers();
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
    } else if (state.pointers.size === 2) {
      const distance = distanceBetweenPointers();
      const center = centerBetweenPointers();
      let changed = false;

      if (config.enableZoom && distance && state.lastDistance) {
        const scale = Math.pow(state.lastDistance / distance, config.zoomSpeed);
        state.radius *= scale;
        state.radius = Math.max(config.minDistance, Math.min(config.maxDistance, state.radius));
        changed = true;
      }
      if (config.enablePan && center && state.lastCenter) {
        changed = panTarget(center.x - state.lastCenter.x, center.y - state.lastCenter.y) || changed;
      }

      state.lastDistance = distance;
      state.lastCenter = center;
      if (changed) updateCamera();
    }
  }

  function onPointerEnd(event) {
    state.pointers.delete(event.pointerId);
    domElement?.releasePointerCapture?.(event.pointerId);
    const remaining = Array.from(state.pointers.values());
    state.lastPoint = remaining[0] || null;
    state.lastDistance = state.pointers.size === 2 ? distanceBetweenPointers() : 0;
    state.lastCenter = state.pointers.size === 2 ? centerBetweenPointers() : null;
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
      state.radius = Math.max(config.minDistance, Math.min(config.maxDistance, r));
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

  // 小程序桥会为每次新触摸分配新的 pointerId，因此以两次完成的主触点 tap 判定双击。
  const activeTaps = new Map();
  let lastTap = null;
  const onTapPointerDown = (event) => {
    if (event.isPrimary === false) {
      for (const tap of activeTaps.values()) tap.moved = true;
      lastTap = null;
      return;
    }
    activeTaps.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp ?? Date.now(),
      moved: false
    });
  };
  const onTapPointerMove = (event) => {
    const tap = activeTaps.get(event.pointerId);
    if (!tap || tap.moved) return;
    tap.moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10;
  };
  const onTapPointerUp = (event) => {
    const tap = activeTaps.get(event.pointerId);
    activeTaps.delete(event.pointerId);
    if (!tap || tap.moved) return;

    const currentTime = event.timeStamp ?? Date.now();
    if (currentTime - tap.time > 300) {
      lastTap = null;
      return;
    }

    const interval = lastTap ? currentTime - lastTap.time : Infinity;
    const distance = lastTap
      ? Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y)
      : Infinity;
    if (interval >= 0 && interval <= 300 && distance <= 30) {
      options.onDoubleTap?.();
      lastTap = null;
    } else {
      lastTap = { x: event.clientX, y: event.clientY, time: currentTime };
    }
  };
  const onTapPointerCancel = (event) => {
    activeTaps.delete(event.pointerId);
  };
  if (domElement) {
    domElement.addEventListener('pointerdown', onTapPointerDown);
    domElement.addEventListener('pointermove', onTapPointerMove);
    domElement.addEventListener('pointerup', onTapPointerUp);
    domElement.addEventListener('pointercancel', onTapPointerCancel);
  }

  const originalDispose = controls.dispose;
  controls.dispose = () => {
    if (domElement) {
      domElement.removeEventListener('pointerdown', onTapPointerDown);
      domElement.removeEventListener('pointermove', onTapPointerMove);
      domElement.removeEventListener('pointerup', onTapPointerUp);
      domElement.removeEventListener('pointercancel', onTapPointerCancel);
    }
    activeTaps.clear();
    lastTap = null;
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
