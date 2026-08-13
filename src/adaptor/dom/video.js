/**
 * 明确不支持播放与像素帧的 video 兼容元素。
 *
 * 微信 <video> 组件不提供可直接上传 WebGL 的 HTMLVideoElement 表面，因此不能作为
 * THREE.VideoTexture 的输入。该元素只保留形状兼容，并拒绝伪造加载成功状态。
 */

import { HTMLElement } from './element.js';

const UNSUPPORTED_MESSAGE =
  'VideoTexture and HTMLVideoElement playback are not supported in mini program';
let hasWarned = false;

function warnUnsupported() {
  if (hasWarned) return;
  hasWarned = true;
  console.warn(`[threejs-miniprogram-adapter] ${UNSUPPORTED_MESSAGE}. Use a WXML <video> component for UI playback.`);
}

class HTMLVideoElement extends HTMLElement {
  constructor() {
    super('video');
    this._src = '';
    this._crossOrigin = null;
    this._width = 300;
    this._height = 150;
    this._currentTime = 0;
    this._volume = 1;
    this._muted = false;
    this._playbackRate = 1;
    this._loop = false;
    this._autoplay = false;
    this._preload = 'none';
    this._poster = '';
  }

  get videoWidth() { return 0; }
  get videoHeight() { return 0; }
  get duration() { return Number.NaN; }
  get readyState() { return HTMLVideoElement.HAVE_NOTHING; }
  get networkState() { return HTMLVideoElement.NETWORK_EMPTY; }
  get paused() { return true; }
  get ended() { return false; }
  get seeking() { return false; }

  get src() { return this._src; }
  set src(value) { this._src = String(value || ''); }

  get currentSrc() { return ''; }

  get crossOrigin() { return this._crossOrigin; }
  set crossOrigin(value) { this._crossOrigin = value; }

  get currentTime() { return this._currentTime; }
  set currentTime(value) {
    const numericValue = Number(value);
    this._currentTime = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
  }

  get volume() { return this._volume; }
  set volume(value) {
    const numericValue = Number(value);
    this._volume = Number.isFinite(numericValue)
      ? Math.max(0, Math.min(1, numericValue))
      : 1;
  }

  get muted() { return this._muted; }
  set muted(value) { this._muted = Boolean(value); }

  get playbackRate() { return this._playbackRate; }
  set playbackRate(value) {
    const numericValue = Number(value);
    this._playbackRate = Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 1;
  }

  get loop() { return this._loop; }
  set loop(value) { this._loop = Boolean(value); }

  get autoplay() { return this._autoplay; }
  set autoplay(value) { this._autoplay = Boolean(value); }

  get preload() { return this._preload; }
  set preload(value) { this._preload = String(value || ''); }

  get poster() { return this._poster; }
  set poster(value) { this._poster = String(value || ''); }

  load() {
    warnUnsupported();
  }

  play() {
    warnUnsupported();
    return Promise.reject(new Error(UNSUPPORTED_MESSAGE));
  }

  pause() {}

  canPlayType() {
    return '';
  }

  fastSeek(time) {
    this.currentTime = time;
  }

  getVideoPlaybackQuality() {
    return {
      creationTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      totalVideoFrames: 0,
      droppedVideoFrames: 0,
      corruptedVideoFrames: 0
    };
  }

  captureStream() {
    warnUnsupported();
    return null;
  }

  requestPictureInPicture() {
    warnUnsupported();
    return Promise.reject(new Error(UNSUPPORTED_MESSAGE));
  }

  /** @deprecated 微信 VideoContext 不能为 THREE.VideoTexture 提供像素帧。 */
  setVideoContext() {
    warnUnsupported();
  }
}

HTMLVideoElement.HAVE_NOTHING = 0;
HTMLVideoElement.HAVE_METADATA = 1;
HTMLVideoElement.HAVE_CURRENT_DATA = 2;
HTMLVideoElement.HAVE_FUTURE_DATA = 3;
HTMLVideoElement.HAVE_ENOUGH_DATA = 4;
HTMLVideoElement.NETWORK_EMPTY = 0;
HTMLVideoElement.NETWORK_IDLE = 1;
HTMLVideoElement.NETWORK_LOADING = 2;
HTMLVideoElement.NETWORK_NO_SOURCE = 3;

export { HTMLVideoElement };
export default HTMLVideoElement;
