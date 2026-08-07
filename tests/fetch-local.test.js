import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { fetch } from '../src/adaptor/network/fetch.js';

const originalWx = globalThis.wx;

afterEach(() => {
  if (originalWx === undefined) {
    delete globalThis.wx;
  } else {
    globalThis.wx = originalWx;
  }
});

/** 安装文件系统 mock：files 为 { filePath: string 内容 }，记录每次读取的路径。 */
function installFSMock(files) {
  const reads = [];
  globalThis.wx = {
    env: { USER_DATA_PATH: 'http://usr' },
    getFileSystemManager: () => ({
      readFile({ filePath, success, fail }) {
        reads.push(filePath);
        if (Object.prototype.hasOwnProperty.call(files, filePath)) {
          success({ data: files[filePath] });
        } else {
          fail({ errMsg: 'file not found' });
        }
      }
    })
  };
  return reads;
}

describe('fetch local files', () => {
  test('reads wxfile:// paths inside the sandbox', async () => {
    const reads = installFSMock({ 'wxfile://usr/a.glb': 'AB' });
    const response = await fetch('wxfile://usr/a.glb');
    assert.equal(response.status, 200);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0x41, 0x42]);
    assert.deepEqual(reads, ['wxfile://usr/a.glb']);
  });

  test('maps file:// paths into the sandbox', async () => {
    const reads = installFSMock({ 'wxfile://usr/a.glb': 'AB' });
    const response = await fetch('file://usr/a.glb');
    assert.equal(response.status, 200);
    assert.deepEqual(reads, ['wxfile://usr/a.glb']);
  });

  test('reads developer-tool http://usr paths via USER_DATA_PATH', async () => {
    const reads = installFSMock({ 'http://usr/a.glb': 'AB' });
    const response = await fetch('http://usr/a.glb');
    assert.equal(response.status, 200);
    assert.deepEqual(reads, ['http://usr/a.glb']);
  });

  test('rejects paths outside the sandbox without touching the filesystem', async () => {
    const reads = installFSMock({});
    await assert.rejects(() => fetch('wxfile://tmp/evil.txt'), /restricted/);
    await assert.rejects(() => fetch('wxfile://usr/../secret.txt'), /restricted/);
    await assert.rejects(() => fetch('file://etc/passwd'), /restricted/);
    // 百分号编码的路径遍历（宿主 fs 可能做 URL 解码；大小写不敏感）
    await assert.rejects(() => fetch('wxfile://usr/%2e%2e/secret.txt'), /restricted/);
    await assert.rejects(() => fetch('wxfile://usr/a%2e%2eb.txt'), /restricted/);
    await assert.rejects(() => fetch('wxfile://usr/a%2f..%2f..%2fsecret.txt'), /restricted/);
    await assert.rejects(() => fetch('wxfile://usr/a%5c..%5csecret.txt'), /restricted/);
    await assert.rejects(() => fetch('wxfile://usr/A%2E%2E/secret.txt'), /restricted/);
    await assert.rejects(() => fetch('wxfile://usr/a%2F..%2F..%2Fsecret.txt'), /restricted/);
    await assert.rejects(() => fetch('wxfile://usr/a%5C..%5Csecret.txt'), /restricted/);
    // Windows 风格归一化变体与双编码纵深防御
    await assert.rejects(() => fetch('wxfile://usr/..%20/secret.txt'), /restricted/);
    await assert.rejects(() => fetch('wxfile://usr/.../secret.txt'), /restricted/);
    await assert.rejects(() => fetch('wxfile://usr/%252e%252e/secret.txt'), /restricted/);
    // NUL 截断：C 字符串 fs 会在 NUL 处截断，'..%00' 会变成 '..'
    await assert.rejects(() => fetch('wxfile://usr/..%00/secret.txt'), /restricted/);
    await assert.rejects(() => fetch('wxfile://usr/a%00b.txt'), /restricted/);
    await assert.rejects(() => fetch('wxfile://usr/a\u0000b.txt'), /restricted/);
    assert.deepEqual(reads, []);
  });

  test('allows ordinary percent-encoded filenames inside the sandbox', async () => {
    const reads = installFSMock({ 'wxfile://usr/a%20b.glb': 'AB' });
    const response = await fetch('wxfile://usr/a%20b.glb');
    assert.equal(response.status, 200);
    assert.deepEqual(reads, ['wxfile://usr/a%20b.glb']);
  });

  test('does not treat URLs merely sharing the user-data prefix as local', async () => {
    const reads = installFSMock({});
    // 'http://usr.evil.com/x' 与沙箱前缀 'http://usr' 相邻但不同
    await assert.rejects(() => fetch('http://usr.evil.com/x'), /wx\.request is not available/);
    assert.deepEqual(reads, []);
  });

  test('rejects local reads when FileSystemManager is missing', async () => {
    globalThis.wx = { env: { USER_DATA_PATH: 'http://usr' } };
    await assert.rejects(() => fetch('wxfile://usr/a.glb'), /FileSystemManager is not available/);
  });
});
