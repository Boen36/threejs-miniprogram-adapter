/**
 * Event 类适配
 * 实现浏览器 Event 接口
 */

class Event {
  constructor(type, eventInitDict = {}) {
    this.type = type;
    this.bubbles = eventInitDict.bubbles !== false;
    this.cancelable = eventInitDict.cancelable !== false;
    this.composed = eventInitDict.composed === true;
    this._defaultPrevented = false;
    this._stopped = false;
    this._stopImmediatePropagation = false;

    this.timeStamp = Date.now();
    this.target = null;
    this.currentTarget = null;
    this.eventPhase = 0; // NONE
    this.srcElement = null;

    // 返回 true 表示事件没有被取消
    this.returnValue = true;

    // 事件初始化标志
    this._inPassiveListener = false;
  }

  get defaultPrevented() {
    return this._defaultPrevented;
  }

  preventDefault() {
    if (this.cancelable && !this._inPassiveListener) {
      this._defaultPrevented = true;
      this.returnValue = false;
    }
  }

  stopPropagation() {
    this._stopped = true;
  }

  stopImmediatePropagation() {
    this._stopped = true;
    this._stopImmediatePropagation = true;
  }

  composedPath() {
    // 小程序没有 DOM 树，返回简单路径
    const path = [];
    if (this.target) {
      path.push(this.target);
    }
    return path;
  }

  initEvent(type, bubbles, cancelable) {
    this.type = type;
    this.bubbles = bubbles;
    this.cancelable = cancelable;
  }

  // 静态常量
  static NONE = 0;
  static CAPTURING_PHASE = 1;
  static AT_TARGET = 2;
  static BUBBLING_PHASE = 3;
}

// UIEvent 基类
class UIEvent extends Event {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);
    this.view = eventInitDict.view || null;
    this.detail = eventInitDict.detail || 0;
    this.sourceCapabilities = eventInitDict.sourceCapabilities || null;
  }
}

// MouseEvent 类
class MouseEvent extends UIEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);

    this.screenX = eventInitDict.screenX || 0;
    this.screenY = eventInitDict.screenY || 0;
    this.clientX = eventInitDict.clientX || 0;
    this.clientY = eventInitDict.clientY || 0;
    this.pageX = eventInitDict.pageX || this.clientX;
    this.pageY = eventInitDict.pageY || this.clientY;

    this.ctrlKey = eventInitDict.ctrlKey || false;
    this.shiftKey = eventInitDict.shiftKey || false;
    this.altKey = eventInitDict.altKey || false;
    this.metaKey = eventInitDict.metaKey || false;

    this.button = eventInitDict.button || 0;
    this.buttons = eventInitDict.buttons || 0;

    this.relatedTarget = eventInitDict.relatedTarget || null;

    this.movementX = eventInitDict.movementX || 0;
    this.movementY = eventInitDict.movementY || 0;

    this.offsetX = eventInitDict.offsetX || this.clientX;
    this.offsetY = eventInitDict.offsetY || this.clientY;

    this.region = eventInitDict.region || null;
  }

  getModifierState(keyArg) {
    switch (keyArg) {
      case 'Control': return this.ctrlKey;
      case 'Shift': return this.shiftKey;
      case 'Alt': return this.altKey;
      case 'Meta': return this.metaKey;
      default: return false;
    }
  }
}

// Touch 类
class Touch {
  constructor(touchInitDict = {}) {
    this.identifier = touchInitDict.identifier || 0;
    this.target = touchInitDict.target || null;
    this.clientX = touchInitDict.clientX || 0;
    this.clientY = touchInitDict.clientY || 0;
    this.screenX = touchInitDict.screenX || 0;
    this.screenY = touchInitDict.screenY || 0;
    this.pageX = touchInitDict.pageX || this.clientX;
    this.pageY = touchInitDict.pageY || this.clientY;
    this.radiusX = touchInitDict.radiusX || 0;
    this.radiusY = touchInitDict.radiusY || 0;
    this.rotationAngle = touchInitDict.rotationAngle || 0;
    this.force = touchInitDict.force || 0;
    this.altitudeAngle = touchInitDict.altitudeAngle || 0;
    this.azimuthAngle = touchInitDict.azimuthAngle || 0;
  }
}

// TouchList 类
class TouchList {
  constructor(touches = []) {
    this._touches = touches;
    this.length = touches.length;
  }

  item(index) {
    return this._touches[index] || null;
  }

  [Symbol.iterator]() {
    return this._touches[Symbol.iterator]();
  }
}

// TouchEvent 类
class TouchEvent extends UIEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);

    this.touches = new TouchList(eventInitDict.touches || []);
    this.targetTouches = new TouchList(eventInitDict.targetTouches || []);
    this.changedTouches = new TouchList(eventInitDict.changedTouches || []);

    this.altKey = eventInitDict.altKey || false;
    this.metaKey = eventInitDict.metaKey || false;
    this.ctrlKey = eventInitDict.ctrlKey || false;
    this.shiftKey = eventInitDict.shiftKey || false;
  }
}

// KeyboardEvent 类
class KeyboardEvent extends UIEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);

    this.key = eventInitDict.key || '';
    this.code = eventInitDict.code || '';
    this.location = eventInitDict.location || 0;
    this.repeat = eventInitDict.repeat || false;
    this.isComposing = eventInitDict.isComposing || false;

    this.ctrlKey = eventInitDict.ctrlKey || false;
    this.shiftKey = eventInitDict.shiftKey || false;
    this.altKey = eventInitDict.altKey || false;
    this.metaKey = eventInitDict.metaKey || false;

    this.charCode = eventInitDict.charCode || 0;
    this.keyCode = eventInitDict.keyCode || 0;
    this.which = eventInitDict.which || 0;
  }

  getModifierState(keyArg) {
    switch (keyArg) {
      case 'Control': return this.ctrlKey;
      case 'Shift': return this.shiftKey;
      case 'Alt': return this.altKey;
      case 'Meta': return this.metaKey;
      default: return false;
    }
  }
}

// WheelEvent 类
class WheelEvent extends MouseEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);

    this.deltaX = eventInitDict.deltaX || 0;
    this.deltaY = eventInitDict.deltaY || 0;
    this.deltaZ = eventInitDict.deltaZ || 0;
    this.deltaMode = eventInitDict.deltaMode || 0; // DOM_DELTA_PIXEL
  }

  static DOM_DELTA_PIXEL = 0;
  static DOM_DELTA_LINE = 1;
  static DOM_DELTA_PAGE = 2;
}

// FocusEvent 类
class FocusEvent extends UIEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);
    this.relatedTarget = eventInitDict.relatedTarget || null;
  }
}

// InputEvent 类
class InputEvent extends UIEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);
    this.data = eventInitDict.data || '';
    this.isComposing = eventInitDict.isComposing || false;
    this.inputType = eventInitDict.inputType || '';
  }
}

// DragEvent 类
class DragEvent extends MouseEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);
    this.dataTransfer = eventInitDict.dataTransfer || null;
  }
}

export {
  Event,
  UIEvent,
  MouseEvent,
  Touch,
  TouchList,
  TouchEvent,
  KeyboardEvent,
  WheelEvent,
  FocusEvent,
  InputEvent,
  DragEvent
};

export default Event;
