/**
 * Blob 和 File API 适配
 * 实现标准的 Blob、File 和 FileReader 接口
 */

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
        this._parts.push(new Uint8Array(part));
        this._size += part.byteLength;
      } else if (part instanceof Uint8Array || part instanceof Int8Array) {
        this._parts.push(part);
        this._size += part.length;
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
    start = Math.max(0, Math.min(start, size));
    end = Math.max(start, Math.min(end, size));

    const slicedParts = [];
    let currentOffset = 0;

    for (const part of this._parts) {
      const partSize = part.length || part.size;

      if (currentOffset + partSize <= start) {
        currentOffset += partSize;
        continue;
      }

      if (currentOffset >= end) {
        break;
      }

      const partStart = Math.max(0, start - currentOffset);
      const partEnd = Math.min(partSize, end - currentOffset);

      if (part instanceof Uint8Array) {
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
    const buffer = new Uint8Array(this._size);
    let offset = 0;

    for (const part of this._parts) {
      if (part instanceof Uint8Array || part instanceof Int8Array) {
        buffer.set(part, offset);
        offset += part.length;
      } else if (part instanceof Blob) {
        const partBuffer = await part.arrayBuffer();
        buffer.set(new Uint8Array(partBuffer), offset);
        offset += partBuffer.byteLength;
      }
    }

    return buffer.buffer;
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

  // 转换为 Stream（简化实现）
  stream() {
    const parts = this._parts;
    let partIndex = 0;
    let byteIndex = 0;

    return new ReadableStream({
      pull(controller) {
        if (partIndex >= parts.length) {
          controller.close();
          return;
        }

        const part = parts[partIndex];
        if (part instanceof Uint8Array) {
          controller.enqueue(part.slice(byteIndex));
          partIndex++;
          byteIndex = 0;
        } else if (part instanceof Blob) {
          // 简化处理
          part.arrayBuffer().then(buffer => {
            controller.enqueue(new Uint8Array(buffer));
            partIndex++;
            byteIndex = 0;
          });
        }
      }
    });
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
    this._aborted = false;
  }

  // 读取为 ArrayBuffer
  readAsArrayBuffer(blob) {
    this._startRead(blob);
    blob.arrayBuffer().then(
      buffer => {
        if (this._aborted) return;
        this.result = buffer;
        this.readyState = FileReader.DONE;
        this._callOnLoad();
      },
      error => {
        if (this._aborted) return;
        this.error = error;
        this.readyState = FileReader.DONE;
        this._callOnError();
      }
    );
  }

  // 读取为文本
  readAsText(blob, encoding = 'UTF-8') {
    this._startRead(blob);
    blob.arrayBuffer().then(
      buffer => {
        if (this._aborted) return;
        const decoder = new TextDecoder(encoding);
        this.result = decoder.decode(buffer);
        this.readyState = FileReader.DONE;
        this._callOnLoad();
      },
      error => {
        if (this._aborted) return;
        this.error = error;
        this.readyState = FileReader.DONE;
        this._callOnError();
      }
    );
  }

  // 读取为 Data URL
  readAsDataURL(blob) {
    this._startRead(blob);
    blob.arrayBuffer().then(
      buffer => {
        if (this._aborted) return;
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const type = blob.type || 'application/octet-stream';
        this.result = `data:${type};base64,${base64}`;
        this.readyState = FileReader.DONE;
        this._callOnLoad();
      },
      error => {
        if (this._aborted) return;
        this.error = error;
        this.readyState = FileReader.DONE;
        this._callOnError();
      }
    );
  }

  // 读取为二进制字符串（已废弃，但为兼容性保留）
  readAsBinaryString(blob) {
    this._startRead(blob);
    blob.arrayBuffer().then(
      buffer => {
        if (this._aborted) return;
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        this.result = binary;
        this.readyState = FileReader.DONE;
        this._callOnLoad();
      },
      error => {
        if (this._aborted) return;
        this.error = error;
        this.readyState = FileReader.DONE;
        this._callOnError();
      }
    );
  }

  // 中止读取
  abort() {
    this._aborted = true;
    this.readyState = FileReader.DONE;
    this.result = null;
    if (this.onabort) {
      this.onabort();
    }
    this.dispatchEvent({ type: 'abort' });
  }

  // 私有方法
  _startRead(blob) {
    if (this.readyState === FileReader.LOADING) {
      throw new Error('Already reading');
    }
    this.readyState = FileReader.LOADING;
    this.result = null;
    this.error = null;
    this._aborted = false;
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
