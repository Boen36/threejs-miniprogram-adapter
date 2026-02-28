/**
 * PointerEvent 类适配
 * three.js 主要使用 Pointer Events，需要将小程序触摸事件转换为 PointerEvent
 */

import { MouseEvent } from './event.js';

class PointerEvent extends MouseEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);

    // Pointer Event 特有属性
    this.pointerId = eventInitDict.pointerId || 0;
    this.pointerType = eventInitDict.pointerType || ''; // "mouse", "pen", "touch"
    this.isPrimary = eventInitDict.isPrimary || false;

    // 压力和接触几何
    this.pressure = eventInitDict.pressure || 0;
    this.tangentialPressure = eventInitDict.tangentialPressure || 0;
    this.tiltX = eventInitDict.tiltX || 0;
    this.tiltY = eventInitDict.tiltY || 0;
    this.twist = eventInitDict.twist || 0;
    this.width = eventInitDict.width || 0;
    this.height = eventInitDict.height || 0;

    // 坐标
    this.altitudeAngle = eventInitDict.altitudeAngle || 0;
    this.azimuthAngle = eventInitDict.azimuthAngle || 0;
  }

  getCoalescedEvents() {
    // 返回共同事件数组（简化实现）
    return [this];
  }

  getPredictedEvents() {
    // 返回预测事件数组（简化实现）
    return [];
  }
}

// PointerEvent 类型常量
PointerEvent.POINTER_CANCEL = 'pointercancel';
PointerEvent.POINTER_DOWN = 'pointerdown';
PointerEvent.POINTER_ENTER = 'pointerenter';
PointerEvent.POINTER_LEAVE = 'pointerleave';
PointerEvent.POINTER_MOVE = 'pointermove';
PointerEvent.POINTER_OUT = 'pointerout';
PointerEvent.POINTER_OVER = 'pointerover';
PointerEvent.POINTER_UP = 'pointerup';

// 全局指针状态追踪
const pointerState = {
  activePointers: new Map(),
  pointerIdCounter: 0
};

/**
 * 将小程序触摸点转换为 PointerEvent
 * @param {Object} touch - 小程序触摸点对象
 * @param {string} type - 事件类型
 * @param {HTMLElement} target - 目标元素
 * @param {Object} options - 额外选项
 * @returns {PointerEvent}
 */
function convertTouchToPointer(touch, type, target, options = {}) {
  const identifier = touch.identifier || 0;

  // 管理指针状态
  if (type === 'pointerdown') {
    pointerState.pointerIdCounter++;
    pointerState.activePointers.set(identifier, {
      pointerId: pointerState.pointerIdCounter,
      startX: touch.x,
      startY: touch.y
    });
  }

  const pointerInfo = pointerState.activePointers.get(identifier);
  const pointerId = pointerInfo ? pointerInfo.pointerId : identifier + 1;
  const isPrimary = identifier === 0;

  // 计算移动距离（用于 movementX/Y）
  let movementX = 0;
  let movementY = 0;
  if (pointerInfo) {
    movementX = touch.x - (pointerInfo.lastX || pointerInfo.startX);
    movementY = touch.y - (pointerInfo.lastY || pointerInfo.startY);
    pointerInfo.lastX = touch.x;
    pointerInfo.lastY = touch.y;
  }

  // pointerup 和 pointercancel 清理状态
  if (type === 'pointerup' || type === 'pointercancel') {
    pointerState.activePointers.delete(identifier);
  }

  return new PointerEvent(type, {
    // 基础事件属性
    bubbles: true,
    cancelable: true,
    composed: true,

    // 坐标
    clientX: touch.x || 0,
    clientY: touch.y || 0,
    screenX: touch.screenX || touch.x || 0,
    screenY: touch.screenY || touch.y || 0,
    pageX: touch.x || 0,
    pageY: touch.y || 0,

    // 移动
    movementX: movementX,
    movementY: movementY,

    // 按钮状态
    button: type === 'pointerdown' || type === 'pointerup' ? 0 : -1,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,

    // Pointer 特有
    pointerId: pointerId,
    pointerType: 'touch',
    isPrimary: isPrimary,

    // 压力（小程序可能支持，默认 0.5 表示触摸）
    pressure: touch.force !== undefined ? touch.force : 0.5,
    width: touch.radiusX || 20,
    height: touch.radiusY || 20,

    // 目标
    target: target,
    relatedTarget: null,

    // 修饰键（触摸通常没有）
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,

    // 额外选项
    ...options
  });
}

/**
 * 将小程序触摸事件转换为多个 PointerEvent
 * @param {Array} touches - 小程序触摸点数组
 * @param {string} type - 事件类型
 * @param {HTMLElement} target - 目标元素
 * @param {Object} options - 额外选项
 * @returns {Array<PointerEvent>}
 */
function convertTouchesToPointers(touches, type, target, options = {}) {
  if (!touches || touches.length === 0) {
    return [];
  }

  return touches.map((touch, index) => {
    // 第一个触摸点是主指针
    const isPrimary = index === 0;
    return convertTouchToPointer(touch, type, target, {
      ...options,
      isPrimary
    });
  });
}

/**
 * 获取当前活跃的指针数量
 * @returns {number}
 */
function getActivePointerCount() {
  return pointerState.activePointers.size;
}

/**
 * 清除所有指针状态（用于重置）
 */
function clearPointerState() {
  pointerState.activePointers.clear();
  pointerState.pointerIdCounter = 0;
}

export {
  PointerEvent,
  convertTouchToPointer,
  convertTouchesToPointers,
  getActivePointerCount,
  clearPointerState,
  pointerState
};

export default PointerEvent;
