import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { installPolyfills } from '../src/index.js';

const originalWx = globalThis.wx;

afterEach(() => {
  if (originalWx === undefined) {
    delete globalThis.wx;
  } else {
    globalThis.wx = originalWx;
  }
});

function createInnerAudioHarness() {
  const contexts = [];
  globalThis.wx = {
    createInnerAudioContext() {
      const handlers = {};
      const calls = [];
      const context = {
        src: '',
        loop: false,
        autoplay: false,
        volume: 1,
        duration: 12,
        currentTime: 0,
        onCanplay(callback) { handlers.canplay = callback; },
        onPlay(callback) { handlers.play = callback; },
        onPause(callback) { handlers.pause = callback; },
        onEnded(callback) { handlers.ended = callback; },
        onError(callback) { handlers.error = callback; },
        onTimeUpdate(callback) { handlers.timeupdate = callback; },
        play() {
          calls.push(['play']);
          handlers.play?.();
        },
        pause() {
          calls.push(['pause']);
          handlers.pause?.();
        },
        seek(value) {
          calls.push(['seek', value]);
          this.currentTime = value;
        },
        destroy() {
          calls.push(['destroy']);
        }
      };
      contexts.push({ calls, context, handlers });
      return context;
    }
  };
  return contexts;
}

describe('media compatibility policy', () => {
  test('does not install a fake Web Audio API and preserves a native one', () => {
    const withoutWebAudio = {};
    installPolyfills(withoutWebAudio);
    assert.equal(withoutWebAudio.AudioContext, undefined);
    assert.equal(withoutWebAudio.window.AudioContext, undefined);

    class NativeAudioContext {}
    const withWebAudio = { AudioContext: NativeAudioContext };
    installPolyfills(withWebAudio);
    assert.equal(withWebAudio.AudioContext, NativeAudioContext);
    assert.equal(withWebAudio.window.AudioContext, NativeAudioContext);
  });

  test('bridges Audio and document.createElement audio to InnerAudioContext', async () => {
    const contexts = createInnerAudioHarness();
    const host = {};
    installPolyfills(host);

    const audio = host.document.createElement('audio');
    assert.ok(audio instanceof host.HTMLAudioElement);
    assert.equal(audio.tagName, 'AUDIO');

    audio.src = 'https://example.com/sound.mp3';
    audio.loop = true;
    audio.volume = 0.4;
    audio.autoplay = true;
    let playEvents = 0;
    audio.addEventListener('play', () => playEvents++);

    await audio.play();

    assert.equal(contexts.length, 1);
    assert.equal(contexts[0].context.src, audio.src);
    assert.equal(contexts[0].context.loop, true);
    assert.equal(contexts[0].context.volume, 0.4);
    assert.equal(contexts[0].context.autoplay, true);
    assert.equal(audio.canPlayType('audio/mpeg'), 'maybe');
    assert.equal(audio.paused, false);
    assert.equal(playEvents, 1);

    contexts[0].handlers.canplay();
    assert.equal(audio.readyState, 4);
    assert.equal(audio.duration, 12);

    audio.currentTime = 3;
    assert.deepEqual(contexts[0].calls.at(-1), ['seek', 3]);
    audio.muted = true;
    assert.equal(contexts[0].context.volume, 0);
    audio.muted = false;
    assert.equal(contexts[0].context.volume, 0.4);

    audio.pause();
    assert.equal(audio.paused, true);
    audio.destroy();
    assert.deepEqual(contexts[0].calls.at(-1), ['destroy']);
  });

  test('destroys an old InnerAudioContext before changing source or removing audio', async () => {
    const contexts = createInnerAudioHarness();
    const host = {};
    installPolyfills(host);
    const audio = new host.Audio('first.mp3');

    assert.equal(contexts.length, 1);
    audio.src = 'second.mp3';
    assert.deepEqual(contexts[0].calls.at(-1), ['destroy']);

    await audio.play();
    assert.equal(contexts.length, 2);
    assert.equal(contexts[1].context.src, 'second.mp3');

    host.document.body.appendChild(audio);
    audio.remove();
    assert.deepEqual(contexts[1].calls.at(-1), ['destroy']);
    assert.equal(audio.parentNode, null);
  });

  test('keeps video and VideoTexture explicitly unsupported without fake success events', async () => {
    const host = {};
    installPolyfills(host);
    const video = host.document.createElement('video');

    assert.ok(video instanceof host.HTMLVideoElement);
    video.src = 'https://example.com/video.mp4';
    video.load();
    assert.equal(video.readyState, video.constructor.HAVE_NOTHING);
    assert.equal(video.networkState, video.constructor.NETWORK_EMPTY);
    assert.equal(video.canPlayType('video/mp4'), '');
    await assert.rejects(video.play(), /VideoTexture.*not supported/i);
    assert.equal(video.paused, true);
  });
});
