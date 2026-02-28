/**
 * Controls 插件适配
 * 为 three.js 的各种 Controls 提供小程序触摸事件支持
 */

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

  const originalConstructor = THREE.OrbitControls.prototype.constructor;

  // 保存原始的 addEventListener
  const originalAddEventListener = THREE.OrbitControls.prototype.addEventListener;

  // 添加小程序特定的初始化
  THREE.OrbitControls.prototype.initialize = function() {
    // 确保 canvas 支持指针事件
    const domElement = this.domElement;

    if (domElement && !domElement._touchHandlers) {
      // 如果 canvas 没有绑定触摸事件，尝试重新绑定
      const { bindTouchEvents } = require('../adaptor/events/bridge.js');
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

  const state = {
    isDragging: false,
    isPinching: false,
    lastTouch: null,
    lastDistance: 0,
    theta: 0,
    phi: Math.PI / 2,
    radius: 10
  };

  // 初始化
  const target = options.target || { x: 0, y: 0, z: 0 };

  function updateCamera() {
    const x = target.x + state.radius * Math.sin(state.phi) * Math.sin(state.theta);
    const y = target.y + state.radius * Math.cos(state.phi);
    const z = target.z + state.radius * Math.sin(state.phi) * Math.cos(state.theta);

    camera.position.set(x, y, z);
    camera.lookAt(target.x, target.y, target.z);
  }

  function onTouchStart(event) {
    if (event.touches.length === 1) {
      state.isDragging = true;
      state.lastTouch = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    } else if (event.touches.length === 2 && config.enableZoom) {
      state.isPinching = true;
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      state.lastDistance = Math.sqrt(dx * dx + dy * dy);
    }
  }

  function onTouchMove(event) {
    event.preventDefault();

    if (state.isDragging && config.enableRotate && event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - state.lastTouch.x;
      const deltaY = touch.clientY - state.lastTouch.y;

      state.theta -= deltaX * 0.01 * config.rotateSpeed;
      state.phi += deltaY * 0.01 * config.rotateSpeed;

      // 限制 phi 范围
      state.phi = Math.max(config.minPolarAngle, Math.min(config.maxPolarAngle, state.phi));

      state.lastTouch = {
        x: touch.clientX,
        y: touch.clientY
      };

      updateCamera();
    } else if (state.isPinching && config.enableZoom && event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const scale = state.lastDistance / distance;
      state.radius *= scale;

      // 限制缩放范围
      state.radius = Math.max(config.minDistance, Math.min(config.maxDistance, state.radius));

      state.lastDistance = distance;
      updateCamera();
    }
  }

  function onTouchEnd() {
    state.isDragging = false;
    state.isPinching = false;
    state.lastTouch = null;
  }

  // 绑定事件
  if (domElement) {
    domElement.addEventListener('pointerdown', onTouchStart, { passive: false });
    domElement.addEventListener('pointermove', onTouchMove, { passive: false });
    domElement.addEventListener('pointerup', onTouchEnd);
    domElement.addEventListener('pointercancel', onTouchEnd);
  }

  return {
    update: updateCamera,
    dispose: () => {
      if (domElement) {
        domElement.removeEventListener('pointerdown', onTouchStart);
        domElement.removeEventListener('pointermove', onTouchMove);
        domElement.removeEventListener('pointerup', onTouchEnd);
        domElement.removeEventListener('pointercancel', onTouchEnd);
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
