/**
 * 安全审计修复的回归测试（2026-08 AdapterSecurityReview 批次）
 * 覆盖：fetch Request+init 合并、data URL 参数、Request.json 异步拒绝、
 * XHR DONE 后复用、XHR 进度事件、FormData 条目列表语义、
 * URL userinfo 解析、FileReader 非法编码、canvas 上下文类型互斥、加载器缓存上限。
 */
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { HTMLCanvasElement } from '../src/adaptor/dom/canvas.js';
import { Blob, FileReader } from '../src/adaptor/network/blob.js';
import { Request, fetch } from '../src/adaptor/network/fetch.js';
import { FormData, XMLHttpRequest } from '../src/adaptor/network/xhr.js';
import { URL } from '../src/adaptor/media/url.js';
import { createCachedLoader } from '../src/plugins/loaders.js';

const originalWx = globalThis.wx;

afterEach(() => {
  if (originalWx === undefined) {
    delete globalThis.wx;
  } else {
    globalThis.wx = originalWx;
  }
});

function captureWxRequests() {
  const calls = [];
  globalThis.wx = {
    request(options) {
      calls.push(options);
      return { abort() {} };
    }
  };
  return calls;
}
describe('fetch spec compliance', () => {
  test('merges init over an existing Request instance', () => {
    const calls = captureWxRequests();
    const request = new Request('https://example.com/a', {
      method: 'GET',
      headers: { 'x-a': '1' }
    });
    // wx.request 在 fetch 的 executor 内同步调用，不 await（mock 不触发 success）
    fetch(request, { method: 'POST', headers: { 'x-b': '2' } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'POST');
    // WHATWG：init.headers 整体替换原请求头
    assert.equal(calls[0].header['x-a'], undefined);
    assert.equal(calls[0].header['x-b'], '2');
  });

  test('accepts data URLs with MIME parameters', async () => {
    const response = await fetch('data:text/plain;charset=utf-8,abc');
    assert.equal(response.status, 200);
    assert.equal(response.ok, true);
  });

  test('accepts data URLs without a MIME type', async () => {
    const response = await fetch('data:;base64,dGVzdA==');
    assert.equal(response.status, 200);
    assert.equal(response.ok, true);
  });

  test('Request.json rejects instead of throwing synchronously', async () => {
    const promise = new Request('https://example.com/', { body: 'not json' }).json();
    assert.ok(promise instanceof Promise);
    await assert.rejects(promise);
  });
});

describe('XMLHttpRequest spec compliance', () => {
  test('allows reopening from DONE and resets request state', () => {
    const calls = captureWxRequests();
    const xhr = new XMLHttpRequest();

    xhr.open('GET', 'https://example.com/a');
    xhr.setRequestHeader('X-Old', '1');
    xhr.send();
    calls[0].success({ statusCode: 200, header: {}, data: 'ok' });
    assert.equal(xhr.readyState, XMLHttpRequest.DONE);

    assert.doesNotThrow(() => xhr.open('GET', 'https://example.com/b'));
    assert.equal(xhr.readyState, XMLHttpRequest.OPENED);
    assert.equal(xhr.status, 0);
    assert.equal(xhr.responseText, '');
    // 复用后头被重置，旧头不会带进新请求
    xhr.setRequestHeader('X-New', '2');
    xhr.send();
    assert.equal(calls[1].header['X-Old'], undefined);
    assert.equal(calls[1].header['X-New'], '2');
  });

  test('forwards wx DownloadTask progress to progress events', () => {
    let progressCallback = null;
    const calls = [];
    globalThis.wx = {
      request(options) {
        calls.push(options);
        return {
          abort() {},
          onProgressUpdate(callback) {
            progressCallback = callback;
          }
        };
      }
    };

    const xhr = new XMLHttpRequest();
    const events = [];
    xhr.onprogress = (event) => events.push(event);

    xhr.open('GET', 'https://example.com/model.glb');
    xhr.send();
    assert.ok(progressCallback, 'onProgressUpdate should be wired');

    progressCallback({ totalBytesWritten: 50, totalBytesExpectedToWrite: 100 });
    assert.equal(events.length, 1);
    assert.equal(events[0].loaded, 50);
    assert.equal(events[0].total, 100);
    assert.equal(events[0].lengthComputable, true);
  });
});

describe('FormData entry-list semantics', () => {
  test('keeps multiple values per name and set replaces all', () => {
    const form = new FormData();
    form.append('a', '1');
    form.append('a', '2');
    assert.deepEqual(form.getAll('a'), ['1', '2']);
    assert.equal(form.get('a'), '1');

    form.set('a', '9');
    assert.deepEqual(form.getAll('a'), ['9']);

    form.append('b', '3');
    form.delete('a');
    assert.equal(form.has('a'), false);
    assert.deepEqual([...form.entries()], [['b', '3']]);
  });

  test('forEach visits entries in insertion order', () => {
    const form = new FormData();
    form.append('a', '1');
    form.append('b', '2');
    form.append('a', '3');
    const seen = [];
    form.forEach((value, key) => seen.push(`${key}=${value}`));
    assert.deepEqual(seen, ['a=1', 'b=2', 'a=3']);
  });
});

describe('URL parsing', () => {
  test('strips userinfo before splitting host and port', () => {
    const url = new URL('http://user:pass@host:8080/p');
    assert.equal(url.hostname, 'host');
    assert.equal(url.port, '8080');
    assert.equal(url.host, 'host:8080');
  });
});

describe('FileReader', () => {
  test('readAsText throws synchronously for an invalid encoding label', () => {
    const reader = new FileReader();
    assert.throws(() => reader.readAsText(new Blob(['x']), 'bogus-charset'), RangeError);
    // 抛出发生在 _startRead 之前，状态未被污染
    assert.equal(reader.readyState, FileReader.EMPTY);
  });
});

describe('canvas getContext type exclusivity', () => {
  test('returns null for a different context type but caches the same one', () => {
    const rawGl = { VERSION: 0x1f02, getParameter: () => 'WebGL 2.0', getExtension: () => null };
    const native = { width: 300, height: 150, getContext: (type) => (type === 'webgl2' ? rawGl : null) };
    const canvas = new HTMLCanvasElement(native);

    const gl = canvas.getContext('webgl2');
    assert.ok(gl);
    assert.equal(canvas.getContext('webgl2'), gl, 'same type should reuse the cached context');
    assert.equal(canvas.getContext('webgl'), null, 'different type should return null');
  });
});

describe('createCachedLoader', () => {
  test('caps the cache and evicts the oldest entry', () => {
    class FakeLoader {
      load(url, onLoad) {
        this._url = url;
        this._onLoad = onLoad;
      }
    }

    const CachedLoader = createCachedLoader({}, FakeLoader);
    const loader = new CachedLoader();

    for (let i = 0; i < 50; i++) {
      loader.load(`u${i}`, () => {});
      loader._onLoad(`r${i}`);
    }
    assert.equal(CachedLoader.getCacheSize(), 50);

    // 第 51 个条目淘汰最旧的 u0
    loader.load('u50', () => {});
    loader._onLoad('r50');
    assert.equal(CachedLoader.getCacheSize(), 50);

    // u0 已不在缓存：走底层 loader 重新加载
    loader.load('u0', () => {});
    assert.equal(loader._url, 'u0');

    // 命中会刷新最近使用：u1 命中后插入新条目，u2 被淘汰
    const hit = loader.load('u1', () => {});
    assert.equal(hit, 'r1');
    loader.load('u51', () => {});
    loader._onLoad('r51');
    assert.equal(CachedLoader.getCacheSize(), 50);
    loader.load('u2', () => {});
    assert.equal(loader._url, 'u2');
  });
});
