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
 * 绑定小程序触摸事件到 canvas
 * @param {HTMLCanvasElement} canvas - 适配后的 canvas 元素
 * @param {Object} options - 配置选项
 */
function bindTouchEvents(canvas, options = {}) {
  if (!canvas || !canvas._miniProgramCanvas) {
    console.error('Invalid canvas for binding touch events');
    return;
  }

  const miniCanvas = canvas._miniProgramCanvas;
  const { capture = false, passive = true } = options;

  if (canvas._touchHandlers) {
    unbindTouchEvents(canvas);
  }

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

    // 阻止默认行为（如果需要）
    if (!passive) {
      // 小程序无法 preventDefault，需要设置 catch
    }
  };

  // 触摸移动
  const onTouchMove = (e) => {
    const pointers = convertTouchesToPointers(e.touches, 'pointermove', canvas);

    pointers.forEach(pointer => {
      dispatchPointerEvent(canvas, pointer);
    });

    if (!passive) {
      // 小程序无法 preventDefault
    }
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
    // 可以转换为 contextmenu 事件
    const contextMenuEvent = new PointerEvent('contextmenu', {
      clientX: e.x || 0,
      clientY: e.y || 0,
      pointerId: 0,
      pointerType: 'touch',
      button: 2, // 右键
      buttons: 2
    });
    dispatchPointerEvent(canvas, contextMenuEvent);
  };

  // 绑定事件
  // 小程序使用特定的属性绑定方式
  const previousHandlers = {
    touchStart: miniCanvas.touchStart,
    touchMove: miniCanvas.touchMove,
    touchEnd: miniCanvas.touchEnd,
    touchCancel: miniCanvas.touchCancel,
    longPress: miniCanvas.longPress
  };
  miniCanvas.touchStart = onTouchStart;
  miniCanvas.touchMove = onTouchMove;
  miniCanvas.touchEnd = onTouchEnd;
  miniCanvas.touchCancel = onTouchCancel;
  miniCanvas.longPress = onLongPress;

  // 存储处理器以便后续解绑
  canvas._touchHandlers = {
    touchStart: onTouchStart,
    touchMove: onTouchMove,
    touchEnd: onTouchEnd,
    touchCancel: onTouchCancel,
    longPress: onLongPress,
    previousHandlers
  };

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

  const miniCanvas = canvas._miniProgramCanvas;

  const previous = canvas._touchHandlers.previousHandlers || {};
  miniCanvas.touchStart = previous.touchStart;
  miniCanvas.touchMove = previous.touchMove;
  miniCanvas.touchEnd = previous.touchEnd;
  miniCanvas.touchCancel = previous.touchCancel;
  miniCanvas.longPress = previous.longPress;

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
  return {
    touchstart: (e) => {
      if (canvas._touchHandlers) {
        canvas._touchHandlers.touchStart(e);
      }
    },
    touchmove: (e) => {
      if (canvas._touchHandlers) {
        canvas._touchHandlers.touchMove(e);
      }
    },
    touchend: (e) => {
      if (canvas._touchHandlers) {
        canvas._touchHandlers.touchEnd(e);
      }
    },
    touchcancel: (e) => {
      if (canvas._touchHandlers) {
        canvas._touchHandlers.touchCancel(e);
      }
    },
    longpress: (e) => {
      if (canvas._touchHandlers) {
        canvas._touchHandlers.longPress(e);
      }
    }
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
