/**
 * Element 和 HTMLElement 基类适配
 * 模拟浏览器 DOM 元素的核心功能
 */

import { EventTarget } from '../events/event-target.js';

// CSSStyleDeclaration 类
class CSSStyleDeclaration {
  constructor() {
    this.cssText = '';
    this.length = 0;
    this._styles = new Map();
  }

  getPropertyValue(property) {
    return this._styles.get(property) || '';
  }

  setProperty(property, value, priority) {
    this._styles.set(property, value);
    this._updateCssText();
  }

  removeProperty(property) {
    const value = this._styles.get(property) || '';
    this._styles.delete(property);
    this._updateCssText();
    return value;
  }

  item(index) {
    return Array.from(this._styles.keys())[index] || '';
  }

  _updateCssText() {
    this.cssText = Array.from(this._styles.entries())
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
    this.length = this._styles.size;
  }

  // 常用样式属性
  get display() { return this.getPropertyValue('display'); }
  set display(value) { this.setProperty('display', value); }

  get width() { return this.getPropertyValue('width'); }
  set width(value) { this.setProperty('width', value); }

  get height() { return this.getPropertyValue('height'); }
  set height(value) { this.setProperty('height', value); }

  get position() { return this.getPropertyValue('position'); }
  set position(value) { this.setProperty('position', value); }

  get top() { return this.getPropertyValue('top'); }
  set top(value) { this.setProperty('top', value); }

  get left() { return this.getPropertyValue('left'); }
  set left(value) { this.setProperty('left', value); }

  get opacity() { return this.getPropertyValue('opacity'); }
  set opacity(value) { this.setProperty('opacity', value); }

  get visibility() { return this.getPropertyValue('visibility'); }
  set visibility(value) { this.setProperty('visibility', value); }
}

// DOMTokenList 类 (用于 classList)
class DOMTokenList extends EventTarget {
  constructor() {
    super();
    this._tokens = new Set();
    this.length = 0;
  }

  add(...tokens) {
    tokens.forEach(token => this._tokens.add(token));
    this.length = this._tokens.size;
    this.value = this.toString();
  }

  remove(...tokens) {
    tokens.forEach(token => this._tokens.delete(token));
    this.length = this._tokens.size;
    this.value = this.toString();
  }

  toggle(token, force) {
    if (force === undefined) {
      if (this._tokens.has(token)) {
        this._tokens.delete(token);
        return false;
      } else {
        this._tokens.add(token);
        return true;
      }
    } else {
      if (force) {
        this._tokens.add(token);
        return true;
      } else {
        this._tokens.delete(token);
        return false;
      }
    }
  }

  contains(token) {
    return this._tokens.has(token);
  }

  item(index) {
    return Array.from(this._tokens)[index] || null;
  }

  replace(oldToken, newToken) {
    if (this._tokens.has(oldToken)) {
      this._tokens.delete(oldToken);
      this._tokens.add(newToken);
      return true;
    }
    return false;
  }

  toString() {
    return Array.from(this._tokens).join(' ');
  }

  forEach(callback, thisArg) {
    this._tokens.forEach((token, index) => {
      callback.call(thisArg, token, index, this);
    });
  }
}

// Element 基类
class Element extends EventTarget {
  constructor(tagName) {
    super();
    this.tagName = tagName ? tagName.toUpperCase() : '';
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this._attributes = new Map();
    this._children = [];
    this._parent = null;
    this.id = '';
    this.className = '';
    this._classList = new DOMTokenList();
    this.style = new CSSStyleDeclaration();
    this.innerHTML = '';
    this.outerHTML = '';
    this.textContent = '';
  }

  get classList() {
    return this._classList;
  }

  set classList(value) {
    this._classList = value;
    this.className = value.toString();
  }

  getAttribute(name) {
    return this._attributes.get(name) || null;
  }

  setAttribute(name, value) {
    this._attributes.set(name, String(value));
    if (name === 'id') {
      this.id = value;
    } else if (name === 'class') {
      this.className = value;
      this._classList = new DOMTokenList();
      value.split(/\s+/).forEach(cls => {
        if (cls.trim()) this._classList.add(cls.trim());
      });
    }
  }

  removeAttribute(name) {
    this._attributes.delete(name);
    if (name === 'id') {
      this.id = '';
    } else if (name === 'class') {
      this.className = '';
      this._classList = new DOMTokenList();
    }
  }

  hasAttribute(name) {
    return this._attributes.has(name);
  }

  getAttributeNS(namespace, name) {
    return this.getAttribute(name);
  }

  setAttributeNS(namespace, name, value) {
    this.setAttribute(name, value);
  }

  removeAttributeNS(namespace, name) {
    this.removeAttribute(name);
  }

  get children() {
    return this._children;
  }

  get childNodes() {
    return this._children;
  }

  get parentNode() {
    return this._parent;
  }

  get parentElement() {
    return this._parent;
  }

  get firstChild() {
    return this._children[0] || null;
  }

  get lastChild() {
    return this._children[this._children.length - 1] || null;
  }

  get nextSibling() {
    if (!this._parent) return null;
    const index = this._parent._children.indexOf(this);
    return this._parent._children[index + 1] || null;
  }

  get previousSibling() {
    if (!this._parent) return null;
    const index = this._parent._children.indexOf(this);
    return this._parent._children[index - 1] || null;
  }

  appendChild(child) {
    if (child._parent) {
      child._parent.removeChild(child);
    }
    this._children.push(child);
    child._parent = this;
    return child;
  }

  removeChild(child) {
    const index = this._children.indexOf(child);
    if (index > -1) {
      this._children.splice(index, 1);
      child._parent = null;
      return child;
    }
    throw new Error('Node not found');
  }

  insertBefore(newChild, refChild) {
    if (!refChild) {
      return this.appendChild(newChild);
    }
    const index = this._children.indexOf(refChild);
    if (index > -1) {
      if (newChild._parent) {
        newChild._parent.removeChild(newChild);
      }
      this._children.splice(index, 0, newChild);
      newChild._parent = this;
    }
    return newChild;
  }

  replaceChild(newChild, oldChild) {
    const index = this._children.indexOf(oldChild);
    if (index > -1) {
      if (newChild._parent) {
        newChild._parent.removeChild(newChild);
      }
      this._children.splice(index, 1, newChild);
      oldChild._parent = null;
      newChild._parent = this;
      return oldChild;
    }
    throw new Error('Node not found');
  }

  cloneNode(deep = false) {
    const clone = new Element(this.tagName);
    clone.id = this.id;
    clone.className = this.className;
    this._attributes.forEach((value, key) => {
      clone._attributes.set(key, value);
    });
    if (deep) {
      this._children.forEach(child => {
        clone.appendChild(child.cloneNode(true));
      });
    }
    return clone;
  }

  contains(node) {
    if (node === this) return true;
    for (let child of this._children) {
      if (child.contains && child.contains(node)) return true;
    }
    return false;
  }

  querySelector(selector) {
    // 简化实现，仅支持基础选择器
    const match = (el, sel) => {
      if (sel.startsWith('#')) {
        return el.id === sel.slice(1);
      }
      if (sel.startsWith('.')) {
        return el.classList && el.classList.contains(sel.slice(1));
      }
      return el.tagName === sel.toUpperCase();
    };

    for (let child of this._children) {
      if (match(child, selector)) return child;
      if (child.querySelector) {
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    const match = (el, sel) => {
      if (sel.startsWith('#')) {
        return el.id === sel.slice(1);
      }
      if (sel.startsWith('.')) {
        return el.classList && el.classList.contains(sel.slice(1));
      }
      return el.tagName === sel.toUpperCase();
    };

    for (let child of this._children) {
      if (match(child, selector)) results.push(child);
      if (child.querySelectorAll) {
        results.push(...child.querySelectorAll(selector));
      }
    }
    return results;
  }

  getBoundingClientRect() {
    return {
      top: 0,
      left: 0,
      right: this.clientWidth || 0,
      bottom: this.clientHeight || 0,
      width: this.clientWidth || 0,
      height: this.clientHeight || 0,
      x: 0,
      y: 0
    };
  }
}

// HTMLElement 类（继承 Element）
class HTMLElement extends Element {
  constructor(tagName) {
    super(tagName);
    this._clientWidth = 0;
    this._clientHeight = 0;
    this._offsetWidth = 0;
    this._offsetHeight = 0;
    this._scrollWidth = 0;
    this._scrollHeight = 0;
    this.scrollTop = 0;
    this.scrollLeft = 0;
  }

  get clientWidth() {
    return this._clientWidth;
  }

  set clientWidth(value) {
    this._clientWidth = value;
  }

  get clientHeight() {
    return this._clientHeight;
  }

  set clientHeight(value) {
    this._clientHeight = value;
  }

  get offsetWidth() {
    return this._offsetWidth || this._clientWidth;
  }

  set offsetWidth(value) {
    this._offsetWidth = value;
  }

  get offsetHeight() {
    return this._offsetHeight || this._clientHeight;
  }

  set offsetHeight(value) {
    this._offsetHeight = value;
  }

  get scrollWidth() {
    return this._scrollWidth;
  }

  get scrollHeight() {
    return this._scrollHeight;
  }

  get offsetTop() {
    return 0;
  }

  get offsetLeft() {
    return 0;
  }

  scrollTo(x, y) {
    this.scrollLeft = x;
    this.scrollTop = y;
  }

  scrollBy(x, y) {
    this.scrollLeft += x;
    this.scrollTop += y;
  }

  focus() {
    // 小程序不支持
  }

  blur() {
    // 小程序不支持
  }

  click() {
    // 小程序不支持
  }
}

export { Element, HTMLElement, CSSStyleDeclaration, DOMTokenList };
