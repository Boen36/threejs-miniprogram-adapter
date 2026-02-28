/**
 * HTMLVideoElement 适配（有限支持）
 * 小程序视频组件限制较多，主要功能用视频组件截图实现
 */

import { HTMLElement } from './element.js';

class HTMLVideoElement extends HTMLElement {
  constructor() {
    super('video');
    this._src = '';
    this._crossOrigin = null;
    this._width = 300;
    this._height = 150;
    this._videoWidth = 0;
    this._videoHeight = 0;
    this._duration = 0;
    this._currentTime = 0;
    this._volume = 1;
    this._muted = false;
    this._paused = true;
    this._ended = false;
    this._readyState = 0; // HAVE_NOTHING
    this._networkState = 0; // NETWORK_EMPTY
    this._playbackRate = 1;
    this._loop = false;
    this._autoplay = false;
    this._preload = 'auto';
    this._poster = '';

    // 小程序视频上下文
    this._videoContext = null;
  }

  // 只读属性
  get videoWidth() {
    return this._videoWidth;
  }

  get videoHeight() {
    return this._videoHeight;
  }

  get duration() {
    return this._duration;
  }

  get readyState() {
    return this._readyState;
  }

  get networkState() {
    return this._networkState;
  }

  get paused() {
    return this._paused;
  }

  get ended() {
    return this._ended;
  }

  get seeking() {
    return false;
  }

  // 可读写属性
  get src() {
    return this._src;
  }

  set src(value) {
    this._src = value;
    this._networkState = 0;
    this._readyState = 0;
    this.load();
  }

  get crossOrigin() {
    return this._crossOrigin;
  }

  set crossOrigin(value) {
    this._crossOrigin = value;
  }

  get currentTime() {
    return this._currentTime;
  }

  set currentTime(value) {
    this._currentTime = value;
    if (this._videoContext) {
      this._videoContext.seek(value);
    }
  }

  get volume() {
    return this._volume;
  }

  set volume(value) {
    this._volume = Math.max(0, Math.min(1, value));
  }

  get muted() {
    return this._muted;
  }

  set muted(value) {
    this._muted = Boolean(value);
  }

  get playbackRate() {
    return this._playbackRate;
  }

  set playbackRate(value) {
    this._playbackRate = value;
    if (this._videoContext) {
      this._videoContext.playbackRate(value);
    }
  }

  get loop() {
    return this._loop;
  }

  set loop(value) {
    this._loop = Boolean(value);
  }

  get autoplay() {
    return this._autoplay;
  }

  set autoplay(value) {
    this._autoplay = Boolean(value);
  }

  get preload() {
    return this._preload;
  }

  set preload(value) {
    this._preload = value;
  }

  get poster() {
    return this._poster;
  }

  set poster(value) {
    this._poster = value;
  }

  // 方法
  load() {
    this._networkState = 1; // NETWORK_IDLE
    this._readyState = 1; // HAVE_METADATA

    // 小程序无法直接加载视频元数据，需要用户实际播放
    setTimeout(() => {
      this._readyState = 2; // HAVE_CURRENT_DATA
      if (this.onloadedmetadata) {
        this.onloadedmetadata();
      }
      this.dispatchEvent({ type: 'loadedmetadata' });
    }, 100);
  }

  play() {
    return new Promise((resolve, reject) => {
      this._paused = false;

      if (this._videoContext) {
        this._videoContext.play();
      }

      if (this.onplay) {
        this.onplay();
      }
      this.dispatchEvent({ type: 'play' });

      // 模拟加载完成
      setTimeout(() => {
        this._readyState = 4; // HAVE_ENOUGH_DATA
        this._networkState = 2; // NETWORK_LOADING

        if (this.oncanplay) {
          this.oncanplay();
        }
        this.dispatchEvent({ type: 'canplay' });

        if (this.oncanplaythrough) {
          this.oncanplaythrough();
        }
        this.dispatchEvent({ type: 'canplaythrough' });

        resolve();
      }, 50);
    });
  }

  pause() {
    this._paused = true;
    if (this._videoContext) {
      this._videoContext.pause();
    }
    if (this.onpause) {
      this.onpause();
    }
    this.dispatchEvent({ type: 'pause' });
  }

  canPlayType(type) {
    // 小程序支持的视频格式
    const supportedTypes = [
      'video/mp4',
      'video/x-m4v',
      'video/quicktime',
      'video/webm'
    ];

    if (supportedTypes.some(t => type.startsWith(t))) {
      return 'probably';
    }
    return '';
  }

  // 不支持的方法
  fastSeek(time) {
    this.currentTime = time;
  }

  getVideoPlaybackQuality() {
    return {
      creationTime: performance.now(),
      totalVideoFrames: 0,
      droppedVideoFrames: 0,
      corruptedVideoFrames: 0
    };
  }

  // 捕获视频帧（有限支持）
  // 小程序无法直接捕获视频帧，需要使用视频组件截图
  captureStream() {
    console.warn('captureStream is not supported in mini program');
    return null;
  }

  // 请求画中画（不支持）
  requestPictureInPicture() {
    console.warn('requestPictureInPicture is not supported in mini program');
    return Promise.reject(new Error('Not supported'));
  }

  // 设置视频上下文（小程序特有）
  setVideoContext(videoContext) {
    this._videoContext = videoContext;
  }
}

// 视频状态常量
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
