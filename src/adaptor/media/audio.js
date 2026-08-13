/**
 * 基础音频元素适配。
 *
 * 这里只桥接 wx.createInnerAudioContext；不模拟 Web Audio 图、解码器或分析器。
 */

import { HTMLElement } from '../dom/element.js';

const HAVE_NOTHING = 0;
const HAVE_ENOUGH_DATA = 4;
const NETWORK_EMPTY = 0;
const NETWORK_IDLE = 1;
const NETWORK_LOADING = 2;
const NETWORK_NO_SOURCE = 3;

class HTMLAudioElement extends HTMLElement {
  constructor(url) {
    super('audio');

    this._src = '';
    this._currentSrc = '';
    this._crossOrigin = null;
    this._preload = 'auto';
    this._autoplay = false;
    this._loop = false;
    this._muted = false;
    this._defaultMuted = false;
    this._controls = false;
    this._volume = 1;
    this._duration = 0;
    this._currentTime = 0;
    this._paused = true;
    this._ended = false;
    this._readyState = HAVE_NOTHING;
    this._networkState = NETWORK_EMPTY;
    this._innerAudio = null;

    if (url) {
      this.src = url;
      this.load();
    }
  }

  get src() { return this._src; }
  set src(value) {
    const nextSource = String(value || '');
    if (nextSource === this._src) return;
    this._destroyInnerAudio();
    this._src = nextSource;
    this._currentSrc = '';
    this._paused = true;
    this._ended = false;
    this._readyState = HAVE_NOTHING;
    this._networkState = nextSource ? NETWORK_LOADING : NETWORK_EMPTY;
  }

  get currentSrc() { return this._currentSrc; }

  get crossOrigin() { return this._crossOrigin; }
  set crossOrigin(value) { this._crossOrigin = value; }

  get preload() { return this._preload; }
  set preload(value) { this._preload = String(value || ''); }

  get autoplay() { return this._autoplay; }
  set autoplay(value) {
    this._autoplay = Boolean(value);
    if (this._innerAudio) this._innerAudio.autoplay = this._autoplay;
  }

  get loop() { return this._loop; }
  set loop(value) {
    this._loop = Boolean(value);
    if (this._innerAudio) this._innerAudio.loop = this._loop;
  }

  get muted() { return this._muted; }
  set muted(value) {
    this._muted = Boolean(value);
    this._syncVolume();
  }

  get defaultMuted() { return this._defaultMuted; }
  set defaultMuted(value) { this._defaultMuted = Boolean(value); }

  get controls() { return this._controls; }
  set controls(value) { this._controls = Boolean(value); }

  get volume() { return this._volume; }
  set volume(value) {
    const numericValue = Number(value);
    this._volume = Number.isFinite(numericValue)
      ? Math.max(0, Math.min(1, numericValue))
      : 1;
    this._syncVolume();
  }

  get duration() { return this._duration; }

  get currentTime() { return this._currentTime; }
  set currentTime(value) {
    const numericValue = Number(value);
    this._currentTime = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
    this._innerAudio?.seek?.(this._currentTime);
  }

  get paused() { return this._paused; }
  get ended() { return this._ended; }
  get readyState() { return this._readyState; }
  get networkState() { return this._networkState; }

  _syncVolume() {
    if (this._innerAudio) {
      this._innerAudio.volume = this._muted ? 0 : this._volume;
    }
  }

  _emit(type, details = {}) {
    const event = { type, ...details };
    const handler = this[`on${type}`];
    if (typeof handler === 'function') handler.call(this, event);
    this.dispatchEvent(event);
  }

  _bindInnerAudio(innerAudio) {
    const isCurrent = () => this._innerAudio === innerAudio;

    innerAudio.onCanplay?.(() => {
      if (!isCurrent()) return;
      this._readyState = HAVE_ENOUGH_DATA;
      this._networkState = NETWORK_IDLE;
      this._duration = Number(innerAudio.duration) || 0;
      this._emit('canplay');
    });
    innerAudio.onPlay?.(() => {
      if (!isCurrent()) return;
      this._paused = false;
      this._ended = false;
      this._emit('play');
    });
    innerAudio.onPause?.(() => {
      if (!isCurrent()) return;
      this._paused = true;
      this._emit('pause');
    });
    innerAudio.onEnded?.(() => {
      if (!isCurrent()) return;
      this._paused = true;
      this._ended = true;
      this._emit('ended');
    });
    innerAudio.onError?.((error) => {
      if (!isCurrent()) return;
      this._paused = true;
      this._networkState = NETWORK_NO_SOURCE;
      this._emit('error', { error });
    });
    innerAudio.onTimeUpdate?.(() => {
      if (!isCurrent()) return;
      this._currentTime = Number(innerAudio.currentTime) || 0;
      this._emit('timeupdate');
    });
  }

  load() {
    this._destroyInnerAudio();
    this._readyState = HAVE_NOTHING;
    this._networkState = this._src ? NETWORK_LOADING : NETWORK_EMPTY;
    this._duration = 0;
    this._currentTime = 0;
    this._ended = false;
    this._paused = true;
    this._currentSrc = '';

    if (!this._src) return;
    if (typeof wx === 'undefined' || typeof wx.createInnerAudioContext !== 'function') {
      this._networkState = NETWORK_NO_SOURCE;
      return;
    }

    const innerAudio = wx.createInnerAudioContext();
    this._innerAudio = innerAudio;
    innerAudio.loop = this._loop;
    innerAudio.autoplay = this._autoplay;
    this._syncVolume();
    this._bindInnerAudio(innerAudio);
    innerAudio.src = this._src;
    this._currentSrc = this._src;
  }

  play() {
    if (!this._innerAudio) this.load();
    if (!this._innerAudio) {
      return Promise.reject(new Error(
        'Audio playback requires wx.createInnerAudioContext and a non-empty src'
      ));
    }

    try {
      this._innerAudio.play();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  pause() {
    this._innerAudio?.pause?.();
    if (!this._innerAudio) this._paused = true;
  }

  canPlayType(type) {
    const normalized = String(type || '').toLowerCase();
    const supported = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/aac',
      'audio/mp4'
    ];
    return supported.some(candidate => normalized.startsWith(candidate)) ? 'maybe' : '';
  }

  _destroyInnerAudio() {
    const innerAudio = this._innerAudio;
    this._innerAudio = null;
    innerAudio?.destroy?.();
  }

  destroy() {
    this._destroyInnerAudio();
    this._paused = true;
    this._readyState = HAVE_NOTHING;
    this._networkState = NETWORK_EMPTY;
    this._currentSrc = '';
  }

  remove() {
    this.destroy();
    if (this._parent) this._parent.removeChild(this);
  }
}

HTMLAudioElement.HAVE_NOTHING = HAVE_NOTHING;
HTMLAudioElement.HAVE_ENOUGH_DATA = HAVE_ENOUGH_DATA;
HTMLAudioElement.NETWORK_EMPTY = NETWORK_EMPTY;
HTMLAudioElement.NETWORK_IDLE = NETWORK_IDLE;
HTMLAudioElement.NETWORK_LOADING = NETWORK_LOADING;
HTMLAudioElement.NETWORK_NO_SOURCE = NETWORK_NO_SOURCE;

const Audio = HTMLAudioElement;

export { HTMLAudioElement, Audio };
export default HTMLAudioElement;
