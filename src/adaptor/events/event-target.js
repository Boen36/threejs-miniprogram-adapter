/**
 * EventTarget 基类适配
 * 实现浏览器 EventTarget 接口的核心功能
 */

class EventListener {
  constructor(callback, options = {}) {
    this.callback = callback;
    this.capture = Boolean(options.capture);
    this.once = Boolean(options.once);
    this.passive = Boolean(options.passive);
    this.signal = options.signal || null;
  }

  matches(callback, capture) {
    return this.callback === callback && this.capture === capture;
  }
}

class EventTarget {
  constructor() {
    this._listeners = new Map();
  }

  addEventListener(type, callback, options = {}) {
    if (typeof callback !== 'function') {
      return;
    }

    const capture = typeof options === 'boolean' ? options : Boolean(options.capture);
    const listener = new EventListener(callback, typeof options === 'object' ? options : { capture });

    // 处理 AbortSignal
    if (listener.signal) {
      if (listener.signal.aborted) {
        return;
      }
      listener.signal.addEventListener('abort', () => {
        this.removeEventListener(type, callback, options);
      });
    }

    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }

    const listeners = this._listeners.get(type);

    // 检查是否已存在相同的监听器
    const exists = listeners.some(l => l.matches(callback, capture));
    if (exists) {
      return;
    }

    listeners.push(listener);
  }

  removeEventListener(type, callback, options = {}) {
    if (!this._listeners.has(type)) {
      return;
    }

    const capture = typeof options === 'boolean' ? options : Boolean(options.capture);
    const listeners = this._listeners.get(type);
    const index = listeners.findIndex(l => l.matches(callback, capture));

    if (index > -1) {
      listeners.splice(index, 1);
    }

    // 如果没有监听器了，删除该类型的 Map 项
    if (listeners.length === 0) {
      this._listeners.delete(type);
    }
  }

  dispatchEvent(event) {
    if (!event.type) {
      throw new Error('Event type is required');
    }

    // 设置 target
    event.target = this;
    event.currentTarget = this;

    const listeners = this._listeners.get(event.type) || [];

    // 分离捕获和冒泡阶段的监听器
    const captureListeners = listeners.filter(l => l.capture);
    const bubbleListeners = listeners.filter(l => !l.capture);

    // 模拟捕获阶段（从外到内）
    event.eventPhase = 1; // CAPTURING_PHASE
    for (const listener of captureListeners) {
      if (event._stopped) break;
      this._invokeListener(listener, event);
    }

    // 目标阶段
    if (!event._stopped) {
      event.eventPhase = 2; // AT_TARGET
      for (const listener of listeners) {
        if (event._stopped) break;
        this._invokeListener(listener, event);
      }
    }

    // 模拟冒泡阶段（从内到外）
    if (!event._stopped && event.bubbles !== false) {
      event.eventPhase = 3; // BUBBLING_PHASE
      // 小程序没有 DOM 树，不执行冒泡
    }

    event.eventPhase = 0; // NONE

    return !event.defaultPrevented;
  }

  _invokeListener(listener, event) {
    try {
      listener.callback.call(this, event);

      // 一次性监听器
      if (listener.once) {
        this.removeEventListener(event.type, listener.callback, {
          capture: listener.capture
        });
      }
    } catch (error) {
      console.error('Error in event listener:', error);
    }
  }

  // 便捷方法
  on(type, listener, options) {
    this.addEventListener(type, listener, options);
    return this;
  }

  off(type, listener, options) {
    this.removeEventListener(type, listener, options);
    return this;
  }

  once(type, listener, options) {
    this.addEventListener(type, listener, {
      ...options,
      once: true
    });
    return this;
  }

  emit(type, event) {
    if (typeof event === 'object') {
      event.type = type;
    } else {
      event = { type };
    }
    return this.dispatchEvent(event);
  }
}

export { EventTarget, EventListener };
export default EventTarget;
