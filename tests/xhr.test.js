import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { FormData, XMLHttpRequest } from '../src/adaptor/network/xhr.js';
import { Blob } from '../src/adaptor/network/blob.js';

const originalWx = globalThis.wx;

afterEach(() => {
  if (originalWx === undefined) {
    delete globalThis.wx;
  } else {
    globalThis.wx = originalWx;
  }
});

/** 用可控的 wx.request mock 捕获请求选项，测试驱动 success/fail。 */
function installRequestMock() {
  const captured = [];
  globalThis.wx = {
    request(options) {
      captured.push(options);
      return { abort: () => {} };
    }
  };
  return captured;
}

describe('XMLHttpRequest', () => {
  test('moves to OPENED on open and rejects state violations', () => {
    const xhr = new XMLHttpRequest();
    assert.equal(xhr.readyState, XMLHttpRequest.UNSENT);

    xhr.open('GET', 'https://example.com/a.glb');
    assert.equal(xhr.readyState, XMLHttpRequest.OPENED);
    // OPENED 状态下允许设置请求头
    xhr.setRequestHeader('X-Test', '1');

    // 重复 open 或未 open 就操作会抛错
    assert.throws(() => xhr.open('GET', 'https://example.com/b.glb'), /Invalid state/);
    const fresh = new XMLHttpRequest();
    assert.throws(() => fresh.setRequestHeader('X-Test', '1'), /Invalid state/);
    assert.throws(() => fresh.send(null), /Invalid state/);

    xhr.send(null); // OPENED 下合法（此处无 wx mock，会走 error 回调，见下方测试）
  });

  test('completes a text request through the wx success callback', () => {
    const captured = installRequestMock();
    const xhr = new XMLHttpRequest();
    const events = [];
    xhr.onreadystatechange = () => events.push(`readyState:${xhr.readyState}`);
    xhr.onload = () => events.push('load');
    xhr.onloadend = () => events.push('loadend');

    xhr.open('GET', 'https://example.com/data.txt');
    xhr.setRequestHeader('X-Custom', 'yes');
    xhr.send();

    const options = captured[0];
    assert.equal(options.method, 'GET');
    assert.equal(options.url, 'https://example.com/data.txt');
    assert.deepEqual(options.header, { 'X-Custom': 'yes' });
    assert.equal(options.responseType, 'text');

    options.success({ statusCode: 200, header: { 'content-type': 'text/plain' }, data: 'hello' });

    assert.equal(xhr.status, 200);
    assert.equal(xhr.statusText, 'OK');
    assert.equal(xhr.response, 'hello');
    assert.equal(xhr.responseText, 'hello');
    assert.equal(xhr.readyState, XMLHttpRequest.DONE);
    assert.deepEqual(events, ['readyState:1', 'readyState:4', 'load', 'loadend']);
  });

  test('returns an ArrayBuffer for arraybuffer responseType', () => {
    const captured = installRequestMock();
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.open('GET', 'https://example.com/model.glb');
    xhr.send();
    assert.equal(captured[0].responseType, 'arraybuffer');

    const buffer = new Uint8Array([0, 1, 2, 255]).buffer;
    captured[0].success({ statusCode: 200, header: {}, data: buffer });
    assert.equal(xhr.response, buffer);
  });

  test('parses json responseType for strings and passes through objects', () => {
    const captured = installRequestMock();
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'json';
    xhr.open('GET', 'https://example.com/data.json');
    xhr.send();
    captured[0].success({ statusCode: 200, header: {}, data: '{"a":1}' });
    assert.deepEqual(xhr.response, { a: 1 });

    const xhr2 = new XMLHttpRequest();
    xhr2.responseType = 'json';
    xhr2.open('GET', 'https://example.com/data.json');
    xhr2.send();
    captured[1].success({ statusCode: 200, header: {}, data: { b: 2 } });
    assert.deepEqual(xhr2.response, { b: 2 });
  });

  test('wraps data in a Blob for blob responseType', () => {
    const captured = installRequestMock();
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open('GET', 'https://example.com/data.bin');
    xhr.send();
    captured[0].success({ statusCode: 200, header: {}, data: 'abc' });
    assert.ok(xhr.response instanceof Blob);
  });

  test('reads response headers case-insensitively after completion', () => {
    const captured = installRequestMock();
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://example.com/');
    xhr.send();

    // HEADERS_RECEIVED 之前没有响应头
    assert.equal(xhr.getResponseHeader('content-type'), null);
    assert.equal(xhr.getAllResponseHeaders(), '');

    captured[0].success({
      statusCode: 200,
      header: { 'Content-Type': 'application/json', 'X-Custom': 'v' },
      data: '{}'
    });

    assert.equal(xhr.getResponseHeader('content-type'), 'application/json');
    assert.equal(xhr.getResponseHeader('CONTENT-TYPE'), 'application/json');
    assert.equal(xhr.getResponseHeader('x-custom'), 'v');
    assert.equal(xhr.getResponseHeader('missing'), null);
    assert.match(xhr.getAllResponseHeaders(), /content-type: application\/json/i);
  });

  test('fires onerror with status zero on request failure', () => {
    const captured = installRequestMock();
    const xhr = new XMLHttpRequest();
    const events = [];
    xhr.onerror = (err) => events.push(`error:${err?.errMsg}`);
    xhr.onloadend = () => events.push('loadend');

    xhr.open('GET', 'https://example.com/');
    xhr.send();
    captured[0].fail({ errMsg: 'request:fail' });

    assert.equal(xhr.status, 0);
    assert.equal(xhr.readyState, XMLHttpRequest.DONE);
    assert.deepEqual(events, ['error:request:fail', 'loadend']);
  });

  test('fires ontimeout when the failure message mentions timeout', () => {
    const captured = installRequestMock();
    const xhr = new XMLHttpRequest();
    const events = [];
    xhr.ontimeout = () => events.push('timeout');

    xhr.open('GET', 'https://example.com/');
    xhr.send();
    captured[0].fail({ errMsg: 'request:fail timeout' });

    assert.deepEqual(events, ['timeout']);
  });

  test('abort resets to UNSENT and fires onabort', () => {
    const captured = installRequestMock();
    const xhr = new XMLHttpRequest();
    const events = [];
    xhr.onabort = () => events.push('abort');

    xhr.open('GET', 'https://example.com/');
    xhr.send();
    xhr.abort();

    assert.equal(xhr.readyState, XMLHttpRequest.UNSENT);
    assert.equal(xhr.status, 0);
    assert.deepEqual(events, ['abort']);
  });

  test('reports onerror when wx.request is unavailable', () => {
    const xhr = new XMLHttpRequest();
    const events = [];
    xhr.onerror = (err) => events.push(err.message);

    xhr.open('GET', 'https://example.com/');
    xhr.send();
    assert.deepEqual(events, ['wx.request is not available']);
  });
});

describe('FormData', () => {
  test('appends, reads and deletes fields', () => {
    const form = new FormData();
    form.append('name', 'value');
    form.append('file', new Blob(['x']), 'a.txt');
    assert.equal(form.get('name'), 'value');
    assert.equal(form.get('file').filename, 'a.txt');
    assert.ok(form.get('file').value instanceof Blob);
    assert.equal(form.has('name'), true);
    assert.equal(form.getAll('name').length, 1);
    form.delete('name');
    assert.equal(form.has('name'), false);
  });
});
