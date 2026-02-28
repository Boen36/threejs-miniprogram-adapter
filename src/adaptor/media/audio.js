/**
 * Web Audio API 适配（有限支持）
 * 小程序使用 InnerAudioContext 实现基础音频播放
 */

import { EventTarget } from '../events/event-target.js';

/**
 * AudioContext 模拟
 * 小程序不支持完整的 Web Audio API，仅提供基础播放功能
 */
class AudioContext extends EventTarget {
  constructor() {
    super();

    this.state = 'suspended';
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.destination = null;
    this.listener = null;

    this._startTime = Date.now();
  }

  resume() {
    return new Promise((resolve, reject) => {
      this.state = 'running';
      this._startTime = Date.now();
      if (this.onstatechange) {
        this.onstatechange();
      }
      resolve();
    });
  }

  suspend() {
    return new Promise((resolve, reject) => {
      this.state = 'suspended';
      if (this.onstatechange) {
        this.onstatechange();
      }
      resolve();
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.state = 'closed';
      if (this.onstatechange) {
        this.onstatechange();
      }
      resolve();
    });
  }

  createBufferSource() {
    return new AudioBufferSourceNode(this);
  }

  createBuffer(numberOfChannels, length, sampleRate) {
    return new AudioBuffer({
      numberOfChannels,
      length,
      sampleRate
    });
  }

  createGain() {
    return new GainNode(this);
  }

  createPanner() {
    return new PannerNode(this);
  }

  createAnalyser() {
    return new AnalyserNode(this);
  }

  decodeAudioData(arrayBuffer, successCallback, errorCallback) {
    return new Promise((resolve, reject) => {
      // 小程序无法直接解码音频数据
      const error = new Error('Audio decoding is not supported in mini program');
      if (errorCallback) {
        errorCallback(error);
      }
      reject(error);
    });
  }

  // 获取当前时间（秒）
  getCurrentTime() {
    return (Date.now() - this._startTime) / 1000;
  }
}

/**
 * AudioBuffer 类
 */
class AudioBuffer {
  constructor(options = {}) {
    this.numberOfChannels = options.numberOfChannels || 1;
    this.length = options.length || 0;
    this.sampleRate = options.sampleRate || 44100;
    this.duration = this.length / this.sampleRate;

    // 创建通道数据
    this._channels = [];
    for (let i = 0; i < this.numberOfChannels; i++) {
      this._channels.push(new Float32Array(this.length));
    }
  }

  getChannelData(channel) {
    if (channel < 0 || channel >= this.numberOfChannels) {
      throw new Error('Invalid channel index');
    }
    return this._channels[channel];
  }

  copyFromChannel(destination, channelNumber, startInChannel = 0) {
    const channel = this.getChannelData(channelNumber);
    destination.set(channel.subarray(startInChannel, startInChannel + destination.length));
  }

  copyToChannel(source, channelNumber, startInChannel = 0) {
    const channel = this.getChannelData(channelNumber);
    channel.set(source, startInChannel);
  }
}

/**
 * AudioNode 基类
 */
class AudioNode extends EventTarget {
  constructor(context) {
    super();
    this.context = context;
    this.numberOfInputs = 1;
    this.numberOfOutputs = 1;
    this.channelCount = 2;
    this.channelCountMode = 'max';
    this.channelInterpretation = 'speakers';

    this._connectedNodes = [];
  }

  connect(destination, outputIndex = 0, inputIndex = 0) {
    this._connectedNodes.push({
      node: destination,
      outputIndex,
      inputIndex
    });
    return destination;
  }

  disconnect(destination) {
    if (destination) {
      const index = this._connectedNodes.findIndex(n => n.node === destination);
      if (index > -1) {
        this._connectedNodes.splice(index, 1);
      }
    } else {
      this._connectedNodes = [];
    }
  }
}

/**
 * AudioBufferSourceNode 类
 */
class AudioBufferSourceNode extends AudioNode {
  constructor(context) {
    super(context);
    this.buffer = null;
    this.detune = { value: 0 };
    this.loop = false;
    this.loopEnd = 0;
    this.loopStart = 0;
    this.playbackRate = { value: 1 };

    this._innerAudio = null;
  }

  start(when = 0, offset = 0, duration) {
    // 使用小程序 InnerAudioContext 播放
    if (typeof wx !== 'undefined' && wx.createInnerAudioContext) {
      this._innerAudio = wx.createInnerAudioContext();

      // 如果有 buffer，需要使用 data URL 或临时文件
      // 这里简化处理

      if (this.onended) {
        this._innerAudio.onEnded(() => {
          this.onended();
        });
      }

      this._innerAudio.play();
    }
  }

  stop(when = 0) {
    if (this._innerAudio) {
      this._innerAudio.stop();
    }
  }
}

/**
 * GainNode 类
 */
class GainNode extends AudioNode {
  constructor(context) {
    super(context);
    this.gain = { value: 1 };
  }
}

/**
 * PannerNode 类
 */
class PannerNode extends AudioNode {
  constructor(context) {
    super(context);
    this.panningModel = 'equalpower';
    this.distanceModel = 'inverse';
    this.refDistance = 1;
    this.maxDistance = 10000;
    this.rolloffFactor = 1;
    this.coneInnerAngle = 360;
    this.coneOuterAngle = 360;
    this.coneOuterGain = 0;

    this.positionX = { value: 0 };
    this.positionY = { value: 0 };
    this.positionZ = { value: 0 };
    this.orientationX = { value: 0 };
    this.orientationY = { value: 0 };
    this.orientationZ = { value: 0 };
  }

  setPosition(x, y, z) {
    this.positionX.value = x;
    this.positionY.value = y;
    this.positionZ.value = z;
  }

  setOrientation(x, y, z) {
    this.orientationX.value = x;
    this.orientationY.value = y;
    this.orientationZ.value = z;
  }
}

/**
 * AnalyserNode 类
 */
class AnalyserNode extends AudioNode {
  constructor(context) {
    super(context);
    this.fftSize = 2048;
    this.frequencyBinCount = 1024;
    this.minDecibels = -100;
    this.maxDecibels = -30;
    this.smoothingTimeConstant = 0.8;
  }

  getFloatFrequencyData(array) {
    // 模拟数据
    for (let i = 0; i < array.length; i++) {
      array[i] = this.minDecibels;
    }
  }

  getByteFrequencyData(array) {
    // 模拟数据
    for (let i = 0; i < array.length; i++) {
      array[i] = 0;
    }
  }

  getFloatTimeDomainData(array) {
    // 模拟数据
    for (let i = 0; i < array.length; i++) {
      array[i] = 0;
    }
  }

  getByteTimeDomainData(array) {
    // 模拟数据
    for (let i = 0; i < array.length; i++) {
      array[i] = 128;
    }
  }
}

/**
 * HTMLAudioElement 类
 * 模拟浏览器音频元素
 */
class HTMLAudioElement extends EventTarget {
  constructor(url) {
    super();

    this.src = url || '';
    this.currentSrc = '';
    this.crossOrigin = null;
    this.preload = 'auto';
    this.autoplay = false;
    this.loop = false;
    this.muted = false;
    this.defaultMuted = false;
    this.controls = false;
    this.volume = 1;

    this._duration = 0;
    this._currentTime = 0;
    this._paused = true;
    this._ended = false;
    this._readyState = 0;
    this._networkState = 0;

    this._innerAudio = null;

    if (url) {
      this.load();
    }
  }

  get duration() {
    return this._duration;
  }

  get currentTime() {
    return this._currentTime;
  }

  set currentTime(value) {
    this._currentTime = value;
    if (this._innerAudio) {
      this._innerAudio.seek(value);
    }
  }

  get paused() {
    return this._paused;
  }

  get ended() {
    return this._ended;
  }

  get readyState() {
    return this._readyState;
  }

  load() {
    if (!this.src) return;

    if (typeof wx !== 'undefined' && wx.createInnerAudioContext) {
      this._innerAudio = wx.createInnerAudioContext();
      this._innerAudio.src = this.src;
      this._innerAudio.loop = this.loop;
      this._innerAudio.volume = this.volume;

      this._innerAudio.onCanplay(() => {
        this._readyState = 4;
        this._duration = this._innerAudio.duration;
        if (this.oncanplay) this.oncanplay();
        this.dispatchEvent({ type: 'canplay' });
      });

      this._innerAudio.onPlay(() => {
        this._paused = false;
        if (this.onplay) this.onplay();
        this.dispatchEvent({ type: 'play' });
      });

      this._innerAudio.onPause(() => {
        this._paused = true;
        if (this.onpause) this.onpause();
        this.dispatchEvent({ type: 'pause' });
      });

      this._innerAudio.onEnded(() => {
        this._paused = true;
        this._ended = true;
        if (this.onended) this.onended();
        this.dispatchEvent({ type: 'ended' });
      });

      this._innerAudio.onError((err) => {
        if (this.onerror) this.onerror(err);
        this.dispatchEvent({ type: 'error', error: err });
      });

      this._innerAudio.onTimeUpdate(() => {
        this._currentTime = this._innerAudio.currentTime;
      });
    }
  }

  play() {
    return new Promise((resolve, reject) => {
      if (!this._innerAudio) {
        this.load();
      }

      if (this._innerAudio) {
        this._innerAudio.play();
        resolve();
      } else {
        reject(new Error('Audio context not available'));
      }
    });
  }

  pause() {
    if (this._innerAudio) {
      this._innerAudio.pause();
    }
  }

  canPlayType(type) {
    const supported = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/aac', 'audio/mp4'];
    if (supported.some(t => type.includes(t))) {
      return 'probably';
    }
    return '';
  }

  // 快捷事件处理器
  get onloadeddata() {
    return this._onloadeddata;
  }
  set onloadeddata(fn) {
    this._onloadeddata = fn;
  }

  get oncanplay() {
    return this._oncanplay;
  }
  set oncanplay(fn) {
    this._oncanplay = fn;
  }

  get onplay() {
    return this._onplay;
  }
  set onplay(fn) {
    this._onplay = fn;
  }

  get onpause() {
    return this._onpause;
  }
  set onpause(fn) {
    this._onpause = fn;
  }

  get onended() {
    return this._onended;
  }
  set onended(fn) {
    this._onended = fn;
  }
}

// 别名
const Audio = HTMLAudioElement;

export {
  AudioContext,
  AudioBuffer,
  AudioNode,
  AudioBufferSourceNode,
  GainNode,
  PannerNode,
  AnalyserNode,
  HTMLAudioElement,
  Audio
};

export default AudioContext;
