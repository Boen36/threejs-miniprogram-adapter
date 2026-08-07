import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { URL, URLSearchParams, createObjectURL, getBlobFromURL } from '../src/adaptor/media/url.js';

describe('URL parsing', () => {
  test('parses an absolute https URL into its components', () => {
    const url = new URL('https://user.example.com:8443/models/car.glb?lod=2#wheels');
    assert.equal(url.protocol, 'https:');
    assert.equal(url.host, 'user.example.com:8443');
    assert.equal(url.hostname, 'user.example.com');
    assert.equal(url.port, '8443');
    assert.equal(url.pathname, '/models/car.glb');
    assert.equal(url.search, '?lod=2');
    assert.equal(url.hash, '#wheels');
    assert.equal(url.origin, 'https://user.example.com:8443');
    assert.equal(url.toString(), 'https://user.example.com:8443/models/car.glb?lod=2#wheels');
  });

  test('resolves relative URLs against a base', () => {
    const base = 'https://cdn.example.com/assets/models/';
    assert.equal(new URL('car.glb', base).href, 'https://cdn.example.com/assets/models/car.glb');
    assert.equal(new URL('/models/car.glb', base).href, 'https://cdn.example.com/models/car.glb');
    assert.equal(new URL('#anchor', base).href, 'https://cdn.example.com/assets/models/#anchor');
    assert.equal(new URL('//other.example.com/a.glb', base).href, 'https://other.example.com/a.glb');
  });

  test('keeps absolute URLs untouched when a base is given', () => {
    assert.equal(
      new URL('http://other.example.com/a.glb', 'https://cdn.example.com/').href,
      'http://other.example.com/a.glb'
    );
  });

  test('parses blob: URLs used by createObjectURL', () => {
    const url = new URL('blob:miniapp/42');
    assert.equal(url.protocol, 'blob:');
    assert.equal(url.origin, 'null');
    assert.equal(url.href, 'blob:miniapp/42');
  });

  test('round-trips through toJSON', () => {
    const url = new URL('https://example.com/a?b=c');
    assert.equal(url.toJSON(), url.href);
  });
});

describe('URLSearchParams', () => {
  test('parses a query string with repeated keys and empty values', () => {
    const params = new URLSearchParams('?a=1&a=2&b=&c=hello%20world');
    assert.equal(params.get('a'), '1');
    assert.deepEqual(params.getAll('a'), ['1', '2']);
    assert.equal(params.get('b'), '');
    assert.equal(params.get('c'), 'hello world');
    assert.equal(params.has('a'), true);
    assert.equal(params.has('missing'), false);
  });

  test('splits on the first equals sign and decodes + as space', () => {
    const params = new URLSearchParams('a=b=c&d=x+y');
    assert.equal(params.get('a'), 'b=c');
    assert.equal(params.get('d'), 'x y');
  });

  test('keeps malformed percent sequences instead of throwing', () => {
    const params = new URLSearchParams('a=%zz&b=%');
    assert.equal(params.get('a'), '%zz');
    assert.equal(params.get('b'), '%');
  });

  test('supports append, set, delete and sort', () => {
    const params = new URLSearchParams();
    params.append('b', '2');
    params.append('a', '1');
    params.append('b', '3');
    assert.deepEqual(params.getAll('b'), ['2', '3']);
    params.set('a', '10');
    assert.equal(params.get('a'), '10');
    params.delete('b');
    assert.equal(params.has('b'), false);
    params.sort();
    assert.deepEqual([...params], [['a', '10']]);
  });

  test('set collapses duplicate keys at the first position', () => {
    const params = new URLSearchParams('a=1&a=2&b=3');
    params.set('a', '9');
    assert.deepEqual(params.getAll('a'), ['9']);
    assert.equal(params.toString(), 'a=9&b=3');
    assert.deepEqual([...params], [['a', '9'], ['b', '3']]);
  });

  test('set appends when the key does not exist yet', () => {
    const params = new URLSearchParams('a=1');
    params.set('b', '2');
    assert.equal(params.toString(), 'a=1&b=2');
  });

  test('sort orders by key while keeping per-key order stable', () => {
    const params = new URLSearchParams('b=2&a=1&b=3');
    params.sort();
    assert.deepEqual([...params], [['a', '1'], ['b', '2'], ['b', '3']]);
  });

  test('iterates entries, keys and values in insertion order', () => {
    const params = new URLSearchParams('x=1&y=2&x=3');
    assert.deepEqual([...params], [['x', '1'], ['y', '2'], ['x', '3']]);
    assert.deepEqual([...params.keys()], ['x', 'y', 'x']);
    assert.deepEqual([...params.values()], ['1', '2', '3']);
    const seen = [];
    params.forEach((value, key) => seen.push(`${key}=${value}`));
    assert.deepEqual(seen, ['x=1', 'y=2', 'x=3']);
  });

  test('serializes with WHATWG encoding (space as +)', () => {
    const params = new URLSearchParams({ q: 'a b&c', lang: 'zh' });
    assert.equal(params.toString(), 'q=a+b%26c&lang=zh');
  });

  test('copies pairs from another URLSearchParams instance', () => {
    const source = new URLSearchParams('x=1&x=2');
    const copy = new URLSearchParams(source);
    assert.deepEqual([...copy], [['x', '1'], ['x', '2']]);
    copy.append('y', '3');
    assert.equal(copy.toString(), 'x=1&x=2&y=3');
    // 原实例不受影响
    assert.equal(source.toString(), 'x=1&x=2');
  });

  test('survives being read back from a parsed URL', () => {
    const url = new URL('https://example.com/?id=5&tag=a&tag=b');
    assert.equal(url.searchParams.get('id'), '5');
    assert.deepEqual(url.searchParams.getAll('tag'), ['a', 'b']);
  });
});

describe('createObjectURL fallback', () => {
  test('throws for a missing blob', () => {
    assert.throws(() => createObjectURL(), TypeError);
  });

  test('returns a blob: id when wx is unavailable', () => {
    const url = createObjectURL({ size: 3 });
    assert.match(url, /^blob:miniapp\/\d+$/);
  });

  test('evicts the oldest object URL beyond the cap', () => {
    const first = createObjectURL({ size: 1 });
    for (let i = 0; i < 55; i++) {
      createObjectURL({ size: 1 });
    }
    // 超过 MAX_OBJECT_URLS(50) 后，最早的 URL 被 LRU 淘汰
    assert.equal(getBlobFromURL(first), null);
  });
});
