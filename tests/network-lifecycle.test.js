import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { HTMLImageElement } from '../src/adaptor/dom/image.js';
import { createObjectURL, getBlobFromURL, revokeObjectURL } from '../src/adaptor/media/url.js';
import { Blob, FileReader } from '../src/adaptor/network/blob.js';
import { fetch } from '../src/adaptor/network/fetch.js';
import { XMLHttpRequest } from '../src/adaptor/network/xhr.js';

const originalWx = globalThis.wx;

afterEach(() => {
  if (originalWx === undefined) {
    delete globalThis.wx;
  } else {
    globalThis.wx = originalWx;
  }
});

class TrackingAbortSignal {
  constructor() {
    this.aborted = false;
    this.listener = null;
    this.addCount = 0;
    this.removeCount = 0;
  }

  addEventListener(type, listener) {
    if (type !== 'abort') return;
    this.listener = listener;
    this.addCount++;
  }

  removeEventListener(type, listener) {
    if (type !== 'abort' || this.listener !== listener) return;
    this.listener = null;
    this.removeCount++;
  }

  abort() {
    this.aborted = true;
    this.listener?.();
  }
}

describe('fetch lifecycle', () => {
  test('removes the abort listener after a remote request settles', async () => {
    let requestOptions = null;
    let abortCount = 0;
    globalThis.wx = {
      request(options) {
        requestOptions = options;
        return { abort: () => { abortCount++; } };
      }
    };
    const signal = new TrackingAbortSignal();

    const promise = fetch('https://example.com/model.glb', { signal });
    requestOptions.success({ statusCode: 200, header: {}, data: new ArrayBuffer(0) });
    await promise;

    assert.equal(signal.addCount, 1);
    assert.equal(signal.removeCount, 1);
    signal.abort();
    assert.equal(abortCount, 0, 'settled requests must not be aborted later');
  });

  test('rejects an in-flight local file read when its signal aborts', async () => {
    let readOptions = null;
    globalThis.wx = {
      env: { USER_DATA_PATH: 'wxfile://usr' },
      getFileSystemManager: () => ({
        readFile(options) {
          readOptions = options;
        }
      })
    };
    const controller = new AbortController();
    const promise = fetch('wxfile://usr/model.glb', { signal: controller.signal });
    const rejected = assert.rejects(promise, error => error.name === 'AbortError');

    controller.abort();
    // 宿主读文件不可取消，晚到的回调仍必须失效。
    readOptions.success({ data: new Uint8Array([1, 2, 3]).buffer });
    await rejected;
  });
});

describe('XMLHttpRequest lifecycle', () => {
  test('enters DONE and emits a complete error lifecycle when wx.request is unavailable', () => {
    delete globalThis.wx;
    const xhr = new XMLHttpRequest();
    const events = [];
    xhr.onreadystatechange = () => events.push(`readystatechange:${xhr.readyState}`);
    xhr.onloadstart = () => events.push('loadstart');
    xhr.onerror = () => events.push('error');
    xhr.onloadend = () => events.push('loadend');

    xhr.open('GET', 'https://example.com/model.glb');
    events.length = 0;
    xhr.send();

    assert.equal(xhr.readyState, XMLHttpRequest.DONE);
    assert.equal(xhr.status, 0);
    assert.deepEqual(events, ['loadstart', 'readystatechange:4', 'error', 'loadend']);
  });

  test('aborts an active request once and ignores late progress', () => {
    let progressCallback = null;
    let abortCount = 0;
    globalThis.wx = {
      request() {
        return {
          abort() { abortCount++; },
          onProgressUpdate(callback) { progressCallback = callback; }
        };
      }
    };
    const xhr = new XMLHttpRequest();
    const events = [];
    xhr.onabort = () => events.push('abort');
    xhr.onloadend = () => events.push('loadend');
    xhr.onprogress = () => events.push('progress');

    xhr.open('GET', 'https://example.com/model.glb');
    xhr.send();
    xhr.abort();
    xhr.abort();
    progressCallback({ totalBytesWritten: 1, totalBytesExpectedToWrite: 2 });

    assert.equal(abortCount, 1);
    assert.equal(xhr.readyState, XMLHttpRequest.UNSENT);
    assert.deepEqual(events, ['abort', 'loadend']);
  });

  test('does not let an aborted request complete a reused instance', () => {
    const calls = [];
    globalThis.wx = {
      request(options) {
        calls.push(options);
        return { abort() {} };
      }
    };
    const xhr = new XMLHttpRequest();

    xhr.open('GET', 'https://example.com/old');
    xhr.send();
    xhr.abort();
    xhr.open('GET', 'https://example.com/new');
    xhr.send();

    calls[0].success({ statusCode: 200, header: {}, data: 'old' });
    assert.equal(xhr.readyState, XMLHttpRequest.OPENED);
    assert.equal(xhr.status, 0);
    assert.equal(xhr.responseText, '');

    calls[1].success({ statusCode: 200, header: {}, data: 'new' });
    assert.equal(xhr.readyState, XMLHttpRequest.DONE);
    assert.equal(xhr.responseText, 'new');
  });

  test('turns a synchronous wx.request exception into an error event', () => {
    globalThis.wx = {
      request() {
        throw new Error('host request failed');
      }
    };
    const xhr = new XMLHttpRequest();
    const events = [];
    xhr.onerror = error => events.push(error.message);
    xhr.onloadend = () => events.push('loadend');

    xhr.open('GET', 'https://example.com/model.glb');
    assert.doesNotThrow(() => xhr.send());
    assert.equal(xhr.readyState, XMLHttpRequest.DONE);
    assert.deepEqual(events, ['host request failed', 'loadend']);
  });

  test('rejects a second send and header mutations while a request is active', () => {
    globalThis.wx = { request: () => ({ abort() {} }) };
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://example.com/model.glb');
    xhr.send('');

    assert.throws(() => xhr.send(), /Invalid state/);
    assert.throws(() => xhr.setRequestHeader('X-Late', '1'), /Invalid state/);
  });
});

describe('Blob and FileReader lifecycle', () => {
  test('snapshots ArrayBuffer views and supports negative slice offsets', async () => {
    const source = new Uint8Array([0, 1, 2, 3]);
    const blob = new Blob([new Uint8Array(source.buffer, 1, 2)]);
    source[1] = 9;

    assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [1, 2]);
    assert.deepEqual([...new Uint8Array(await blob.slice(-1).arrayBuffer())], [2]);
  });

  test('keeps an aborted read from overwriting a newer read', async () => {
    let resolveOld;
    let resolveNew;
    const oldBlob = { arrayBuffer: () => new Promise(resolve => { resolveOld = resolve; }) };
    const newBlob = { arrayBuffer: () => new Promise(resolve => { resolveNew = resolve; }) };
    const reader = new FileReader();
    const events = [];
    for (const type of ['loadstart', 'abort', 'load', 'loadend']) {
      reader.addEventListener(type, () => events.push(type));
    }

    reader.readAsArrayBuffer(oldBlob);
    reader.abort();
    reader.readAsArrayBuffer(newBlob);
    resolveOld(new Uint8Array([1]).buffer);
    await Promise.resolve();
    assert.equal(reader.readyState, FileReader.LOADING);
    assert.equal(reader.result, null);

    resolveNew(new Uint8Array([2]).buffer);
    await Promise.resolve();
    assert.equal(reader.readyState, FileReader.DONE);
    assert.deepEqual([...new Uint8Array(reader.result)], [2]);
    assert.deepEqual(events, ['loadstart', 'abort', 'loadend', 'loadstart', 'load', 'loadend']);
  });

  test('does not emit abort events while idle and validates input before changing state', () => {
    const reader = new FileReader();
    const events = [];
    reader.onabort = () => events.push('abort');
    reader.onloadend = () => events.push('loadend');

    reader.abort();
    assert.deepEqual(events, []);
    assert.equal(reader.readyState, FileReader.EMPTY);
    assert.throws(() => reader.readAsArrayBuffer({}), TypeError);
    assert.equal(reader.readyState, FileReader.EMPTY);
  });

  test('propagates read failures through error and loadend after loadstart', async () => {
    const failure = new Error('read failed');
    const reader = new FileReader();
    const events = [];
    for (const type of ['loadstart', 'error', 'loadend']) {
      reader.addEventListener(type, () => events.push(type));
    }

    reader.readAsArrayBuffer({ arrayBuffer: () => Promise.reject(failure) });
    await Promise.resolve();

    assert.equal(reader.readyState, FileReader.DONE);
    assert.equal(reader.error, failure);
    assert.deepEqual(events, ['loadstart', 'error', 'loadend']);
  });
});

describe('URL and Image lifecycle', () => {
  test('keeps the newest oversized object URL revocable instead of orphaning its temp file', () => {
    const unlinked = [];
    globalThis.wx = {
      env: { USER_DATA_PATH: 'wxfile://usr' },
      getFileSystemManager: () => ({
        writeFileSync() {},
        unlinkSync(path) { unlinked.push(path); }
      })
    };
    const blob = {
      size: 50 * 1024 * 1024 + 1,
      _toUint8ArraySync: () => new Uint8Array([7])
    };

    const url = createObjectURL(blob);
    assert.equal(getBlobFromURL(url), blob);
    revokeObjectURL(url);
    assert.deepEqual(unlinked, [url]);
  });

  test('leaves Image in a terminal error state when no native image can be created', async () => {
    delete globalThis.wx;
    const image = new HTMLImageElement();
    const errors = [];
    image.onerror = error => errors.push(error);

    image.src = 'missing.png';

    assert.equal(image.loading, false);
    assert.equal(image.complete, false);
    assert.equal(errors.length, 1);
    await assert.rejects(image.decode(), /not loaded/i);
  });
});
