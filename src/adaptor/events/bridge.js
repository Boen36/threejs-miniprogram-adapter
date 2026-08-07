/**
 * 事件桥接
 * 自动将小程序触摸事件转换为 PointerEvent 并分发到 canvas
 */

import { PointerEvent, convertTouchesToPointers, clearPointerState } from './pointer-event.js';

function dispatchPointerEvent(canvas, event) {
  canvas.dispatchEvent(event);
  if (!event._stopped && canvas.ownerDocument && canvas.ownerDocument !== canvas) {
    canvas.ownerDocument.dispatchEvent(event);
  }
}

/**
 * 创建触摸处理器（内部）。
 * 处理器表与「是否直赋原生 canvas 属性」解耦：
 * 微信宿主没有"赋属性即注册事件"的机制，事件只能通过 WXML 转发。
 */
function createTouchHandlers(canvas, options = {}) {
  const { passive = true } = options;

  // 触摸开始
  const onTouchStart = (e) => {
    const changedTouches = e.changedTouches || e.touches || [];
    const pointers = convertTouchesToPointers(changedTouches, 'pointerdown', canvas);

    pointers.forEach(pointer => {
      dispatchPointerEvent(canvas, pointer);
    });

    // 触发 pointerenter（如果是第一个指针）
    if (pointers.length > 0 && e.touches.length === e.changedTouches.length) {
      const enterEvent = new PointerEvent('pointerenter', {
        ...pointers[0],
        bubbles: false
      });
      dispatchPointerEvent(canvas, enterEvent);

      // 同时触发 pointerover
      const overEvent = new PointerEvent('pointerover', {
        ...pointers[0]
      });
      dispatchPointerEvent(canvas, overEvent);
    }
  };

  // 触摸移动
  const onTouchMove = (e) => {
    const pointers = convertTouchesToPointers(e.touches, 'pointermove', canvas);

    pointers.forEach(pointer => {
      dispatchPointerEvent(canvas, pointer);
    });
  };

  // 触摸结束
  const onTouchEnd = (e) => {
    // changedTouches 包含结束的触摸点
    const pointers = convertTouchesToPointers(e.changedTouches, 'pointerup', canvas);

    pointers.forEach(pointer => {
      dispatchPointerEvent(canvas, pointer);
    });

    // 检查是否所有触摸都结束了
    if ((e.touches || []).length === 0) {
      // 触发 pointerleave 和 pointerout
      if (pointers.length > 0) {
        const leaveEvent = new PointerEvent('pointerleave', {
          ...pointers[0],
          bubbles: false
        });
        dispatchPointerEvent(canvas, leaveEvent);

        const outEvent = new PointerEvent('pointerout', {
          ...pointers[0]
        });
        dispatchPointerEvent(canvas, outEvent);
      }
    }
  };

  // 触摸取消
  const onTouchCancel = (e) => {
    const pointers = convertTouchesToPointers(e.changedTouches, 'pointercancel', canvas);

    pointers.forEach(pointer => {
      dispatchPointerEvent(canvas, pointer);
    });

    // 清理指针状态
    clearPointerState(canvas);
  };

  // 长按（小程序特有）
  const onLongPress = (e) => {
    const touch = (e.changedTouches || e.touches || [])[0];
    // 可以转换为 contextmenu 事件
    const contextMenuEvent = new PointerEvent('contextmenu', {
      clientX: touch?.clientX || e.x || 0,
      clientY: touch?.clientY || e.y || 0,
      pointerId: touch?.identifier ?? 1,
      pointerType: 'touch',
      button: 2, // 右键
      buttons: 2
    });
    dispatchPointerEvent(canvas, contextMenuEvent);
  };

  return {
    touchStart: onTouchStart,
    touchMove: onTouchMove,
    touchEnd: onTouchEnd,
    touchCancel: onTouchCancel,
    longPress: onLongPress
  };
}

/**
 * 确保 canvas 上存在触摸处理器表（幂等）。
 */
function ensureTouchHandlers(canvas, options = {}) {
  if (!canvas || !canvas._miniProgramCanvas) {
    return null;
  }
  if (!canvas._touchHandlers) {
    canvas._touchHandlers = {
      ...createTouchHandlers(canvas, options),
      previousHandlers: null
    };
  }
  return canvas._touchHandlers;
}

/**
 * 绑定小程序触摸事件到 canvas
 * @param {HTMLCanvasElement} canvas - 适配后的 canvas 元素
 * @param {Object} options - 配置选项
 *
 * 注意：微信小程序没有"给 canvas 节点属性赋函数即注册事件"的机制，
 * 触摸事件必须通过 WXML 的 bindtouch* 绑定后转发到 createTouchEventHandlers()。
 * 本函数只负责创建并保存处理器表，不会（也无法）自动接收事件。
 */
function bindTouchEvents(canvas, options = {}) {
  if (!canvas || !canvas._miniProgramCanvas) {
    console.error('Invalid canvas for binding touch events');
    return undefined;
  }

  const { debug = false } = options;
  ensureTouchHandlers(canvas, options);

  if (debug) {
    console.warn(
      '[threejs-miniprogram-adapter] bindTouchEvents only prepares the touch handler table. ' +
      'To receive touches, bind bindtouchstart/bindtouchmove/bindtouchend/bindtouchcancel ' +
      'in WXML and forward events to adapter.touchEventHandlers.'
    );
  }

  // 返回解绑函数
  return () => {
    unbindTouchEvents(canvas);
  };
}

/**
 * 解绑小程序触摸事件
 * @param {HTMLCanvasElement} canvas - 适配后的 canvas 元素
 */
function unbindTouchEvents(canvas) {
  if (!canvas || !canvas._miniProgramCanvas || !canvas._touchHandlers) {
    return;
  }

  // 清理指针状态
  clearPointerState(canvas);

  delete canvas._touchHandlers;
}

/**
 * 为 WXML 创建触摸事件处理器
 * 用于在 WXML 中绑定事件
 * @param {HTMLCanvasElement} canvas - 适配后的 canvas 元素
 * @returns {Object} 事件处理器对象，可用于 WXML
 */
function createTouchEventHandlers(canvas) {
  const handlers = ensureTouchHandlers(canvas);
  if (!handlers) {
    return {
      touchstart: () => {},
      touchmove: () => {},
      touchend: () => {},
      touchcancel: () => {},
      longpress: () => {}
    };
  }

  return {
    touchstart: (e) => handlers.touchStart(e),
    touchmove: (e) => handlers.touchMove(e),
    touchend: (e) => handlers.touchEnd(e),
    touchcancel: (e) => handlers.touchCancel(e),
    longpress: (e) => handlers.longPress(e)
  };
}

/**
 * 安装全局事件桥接
 * 修改 EventTarget 以支持小程序特定的事件处理
 */
function installEventBridge() {
  // 这里可以添加全局的事件处理增强
  // 例如：支持被动事件监听器、once 选项等
}

export {
  bindTouchEvents,
  unbindTouchEvents,
  createTouchEventHandlers,
  installEventBridge
};

export default bindTouchEvents;
