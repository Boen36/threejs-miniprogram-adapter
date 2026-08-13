/**
 * Blob 和 File API 适配
 * 实现标准的 Blob、File 和 FileReader 接口
 */

import { EventTarget } from '../events/event-target.js';

// Blob 类
class Blob {
  constructor(blobParts = [], options = {}) {
    this._parts = [];
    this._size = 0;
    this.type = options.type || '';
    this._encoding = options.endings || 'transparent';

    // 处理 blobParts
    blobParts.forEach(part => {
      if (part instanceof Blob) {
        this._parts.push(part);
        this._size += part.size;
      } else if (part instanceof ArrayBuffer) {
        // Blob 创建时必须快照输入，不能继续引用业务方可变缓冲区。
        this._parts.push(new Uint8Array(part).slice());
        this._size += part.byteLength;
      } else if (ArrayBuffer.isView(part)) {
        const bytes = new Uint8Array(part.buffer, part.byteOffset, part.byteLength).slice();
        this._parts.push(bytes);
        this._size += bytes.byteLength;
      } else if (Array.isArray(part)) {
        this._parts.push(new Uint8Array(part));
        this._size += part.length;
      } else {
        const str = String(part);
        const encoder = new TextEncoder();
        const encoded = encoder.encode(str);
        this._parts.push(encoded);
        this._size += encoded.length;
      }
    });
  }

  get size() {
    return this._size;
  }

  // 切片
  slice(start = 0, end = this._size, contentType = '') {
    const size = this._size;
    const relativeStart = Number(start);
    const relativeEnd = end === undefined ? size : Number(end);
    start = Number.isNaN(relativeStart)
      ? 0
      : relativeStart < 0 ? Math.max(size + relativeStart, 0) : Math.min(relativeStart, size);
    end = Number.isNaN(relativeEnd)
      ? 0
      : relativeEnd < 0 ? Math.max(size + relativeEnd, 0) : Math.min(relativeEnd, size);
    end = Math.max(start, end);

    const slicedParts = [];
    let currentOffset = 0;

    for (const part of this._parts) {
      // Uint8Array 用 length、Blob 用 size；空 part（length=0）不得产生 NaN
      const partSize = part.length !== undefined ? part.length : part.size;

      if (currentOffset + partSize <= start) {
        currentOffset += partSize;
        continue;
      }

      if (currentOffset >= end) {
        break;
      }

      const partStart = Math.max(0, start - currentOffset);
      const partEnd = Math.min(partSize, end - currentOffset);

      if (part instanceof Uint8Array || part instanceof Int8Array) {
        slicedParts.push(part.slice(partStart, partEnd));
      } else if (part instanceof Blob) {
        slicedParts.push(part.slice(partStart, partEnd));
      }

      currentOffset += partSize;
    }

    return new Blob(slicedParts, { type: contentType });
  }

  // 转换为 ArrayBuffer
  async arrayBuffer() {
    return this._toUint8ArraySync().buffer;
  }

  _toUint8ArraySync() {
    const buffer = new Uint8Array(this._size);
    let offset = 0;

    for (const part of this._parts) {
      if (part instanceof Uint8Array || part instanceof Int8Array) {
        buffer.set(part, offset);
        offset += part.length;
      } else if (part instanceof Blob) {
        const partBytes = part._toUint8ArraySync();
        buffer.set(partBytes, offset);
        offset += partBytes.byteLength;
      }
    }

    return buffer;
  }

  // 转换为文本
  async text() {
    const buffer = await this.arrayBuffer();
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
  }

  // 转换为 JSON
  async json() {
    const text = await this.text();
    return JSON.parse(text);
  }
}

// File 类
class File extends Blob {
  constructor(fileBits, fileName, options = {}) {
    super(fileBits, options);
    this.name = fileName;
    this.lastModified = options.lastModified || Date.now();
    this.lastModifiedDate = new Date(this.lastModified);
  }
}

// FileReader 类
class FileReader extends EventTarget {
  static EMPTY = 0;
  static LOADING = 1;
  static DONE = 2;

  constructor() {
    super();
    this.readyState = FileReader.EMPTY;
    this.result = null;
    this.error = null;
    this._readId = 0;
  }

  // 读取为 ArrayBuffer
  readAsArrayBuffer(blob) {
    this._read(blob, buffer => buffer);
  }

  // 读取为文本
  readAsText(blob, encoding = 'UTF-8') {
    // 规范：非法编码标签在调用时同步抛 RangeError，而不是让读取挂起/静默失败
    const decoder = new TextDecoder(encoding);
    this._read(blob, buffer => decoder.decode(buffer));
  }

  // 读取为 Data URL
  readAsDataURL(blob) {
    this._read(blob, buffer => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const type = blob.type || 'application/octet-stream';
      return `data:${type};base64,${base64}`;
    });
  }

  // 读取为二进制字符串（已废弃，但为兼容性保留）
  readAsBinaryString(blob) {
    this._read(blob, buffer => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return binary;
    });
  }

  // 中止读取
  abort() {
    if (this.readyState !== FileReader.LOADING) {
      this.result = null;
      return;
    }

    this._readId++;
    this.readyState = FileReader.DONE;
    this.result = null;
    this.error = null;
    if (this.onabort) {
      this.onabort();
    }
    this.dispatchEvent({ type: 'abort' });
    this._callOnLoadEnd();
  }

  // 私有方法
  _startRead(blob) {
    if (this.readyState === FileReader.LOADING) {
      throw new Error('Already reading');
    }
    if (!blob || typeof blob.arrayBuffer !== 'function') {
      throw new TypeError('Argument 1 is not a Blob');
    }
    this.readyState = FileReader.LOADING;
    this.result = null;
    this.error = null;
    const readId = ++this._readId;
    if (this.onloadstart) {
      this.onloadstart();
    }
    this.dispatchEvent({ type: 'loadstart' });
    return readId;
  }

  _read(blob, transform) {
    const readId = this._startRead(blob);
    let readPromise;
    try {
      readPromise = blob.arrayBuffer();
    } catch (error) {
      this._finishReadError(readId, error);
      return;
    }

    Promise.resolve(readPromise).then(
      buffer => {
        if (!this._isActiveRead(readId)) return;
        try {
          this.result = transform(buffer);
        } catch (error) {
          this._finishReadError(readId, error);
          return;
        }
        this.readyState = FileReader.DONE;
        this._callOnLoad();
      },
      error => this._finishReadError(readId, error)
    );
  }

  _isActiveRead(readId) {
    return readId === this._readId && this.readyState === FileReader.LOADING;
  }

  _finishReadError(readId, error) {
    if (!this._isActiveRead(readId)) return;
    this.error = error;
    this.readyState = FileReader.DONE;
    this._callOnError();
  }

  _callOnLoad() {
    if (this.onload) {
      this.onload();
    }
    this.dispatchEvent({ type: 'load' });
    this._callOnLoadEnd();
  }

  _callOnError() {
    if (this.onerror) {
      this.onerror();
    }
    this.dispatchEvent({ type: 'error' });
    this._callOnLoadEnd();
  }

  _callOnLoadEnd() {
    if (this.onloadend) {
      this.onloadend();
    }
    this.dispatchEvent({ type: 'loadend' });
  }

  _callOnProgress(loaded, total) {
    if (this.onprogress) {
      this.onprogress({ loaded, total });
    }
    this.dispatchEvent({ type: 'progress', loaded, total });
  }
}

// btoa 实现
function btoa(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;

  while (i < str.length) {
    const chr1 = str.charCodeAt(i++);
    const chr2 = i < str.length ? str.charCodeAt(i++) : NaN;
    const chr3 = i < str.length ? str.charCodeAt(i++) : NaN;

    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    const enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    const enc4 = chr3 & 63;

    if (isNaN(chr2)) {
      output += chars.charAt(enc1) + chars.charAt(enc2) + '==';
    } else if (isNaN(chr3)) {
      output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + '=';
    } else {
      output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
    }
  }

  return output;
}

export { Blob, File, FileReader, btoa };
export default Blob;
