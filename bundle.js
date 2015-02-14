require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],"buffer":[function(require,module,exports){
module.exports=require('Cr8VU/');
},{}],"Cr8VU/":[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":4,"ieee754":5}],4:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var ZERO   = '0'.charCodeAt(0)
	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	module.exports.toByteArray = b64ToByteArray
	module.exports.fromByteArray = uint8ToBase64
}())

},{}],5:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],6:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.once = noop;
process.off = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],7:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require("C:\\Users\\Jacob\\AppData\\Roaming\\npm\\node_modules\\browserify\\node_modules\\insert-module-globals\\node_modules\\process\\browser.js"))
},{"C:\\Users\\Jacob\\AppData\\Roaming\\npm\\node_modules\\browserify\\node_modules\\insert-module-globals\\node_modules\\process\\browser.js":6}],"dme":[function(require,module,exports){
module.exports=require('vH5dZ3');
},{}],"vH5dZ3":[function(require,module,exports){
var Materials = require("./materials"),
    MaterialParameters = require("./materialparams").MaterialParameters,
    Jenkins = require("jenkins-hash");

var D3DXPARAMETER_TYPE = { 
    D3DXPT_VOID:              0,
    D3DXPT_BOOL:              1,
    D3DXPT_INT:               2,
    D3DXPT_FLOAT:             3,
    D3DXPT_STRING:            4,
    D3DXPT_TEXTURE:           5,
    D3DXPT_TEXTURE1D:         6,
    D3DXPT_TEXTURE2D:         7,
    D3DXPT_TEXTURE3D:         8,
    D3DXPT_TEXTURECUBE:       9,
    D3DXPT_SAMPLER:           10,
    D3DXPT_SAMPLER1D:         11,
    D3DXPT_SAMPLER2D:         12,
    D3DXPT_SAMPLER3D:         13,
    D3DXPT_SAMPLERCUBE:       14,
    D3DXPT_PIXELSHADER:       15,
    D3DXPT_VERTEXSHADER:      16,
    D3DXPT_PIXELFRAGMENT:     17,
    D3DXPT_VERTEXFRAGMENT:    18,
    D3DXPT_UNSUPPORTED:       19,
    D3DXPT_FORCE_DWORD:       0x7fffffff
};

var D3DXPARAMETER_CLASS = {
    D3DXPC_SCALAR:            0,
    D3DXPC_VECTOR:            1,
    D3DXPC_MATRIX_ROWS:       2,
    D3DXPC_MATRIX_COLUMNS:    3,
    D3DXPC_OBJECT:            4,
    D3DXPC_STRUCT:            5,
    D3DXPC_FORCE_DWORD:       0x7fffffff
};

var InputLayoutEntrySizes ={
    "Float3":       12,
    "D3dcolor":     4,
    "Float2":       8,
    "Float4":       16,
    "ubyte4n":      4,
    "Float16_2":    4,
    "float16_2":    4,
    "Short2":       4,
    "Float1":       4,
    "Short4":       8
};

function readInputLayoutEntry(type, data, offset) {
    var result;
    switch (type) {
        case "Float3":
            result = [
                data.readFloatLE(offset),
                data.readFloatLE(offset+4),
                data.readFloatLE(offset+8)
            ];
            break;
        case "D3dcolor":
            result = data.readUInt32LE(offset);
            break;
        case "Float2":
            result = [
                data.readFloatLE(offset),
                data.readFloatLE(offset+4),
            ];
            break;
        case "Float4":
            result = [
                data.readFloatLE(offset),
                data.readFloatLE(offset+4),
                data.readFloatLE(offset+8),
                data.readFloatLE(offset+12)
            ];
            break;
        case "ubyte4n":
            result = [
                (data.readUInt8(offset) / 255 * 2) - 1,
                (data.readUInt8(offset+1) / 255 * 2) - 1,
                (data.readUInt8(offset+2) / 255 * 2) - 1,
                (data.readUInt8(offset+3) / 255 * 2) - 1
            ];
            break;
        case "Float16_2":
        case "float16_2":
            result = [
                readFloat16LE(data, offset),
                readFloat16LE(data, offset+2)
            ];
            break;
        case "Short2":
            result = [
                data.readUInt16LE(offset),
                data.readUInt16LE(offset+2)
            ];
            break;
        case "Float1":
            result = data.readFloatLE(offset);
            break;
        case "Short4":
            result = [
                data.readUInt16LE(offset),
                data.readUInt16LE(offset+2),
                data.readUInt16LE(offset+4),
                data.readUInt16LE(offset+6)
            ];
            break;
    }
    return result;
}


function parseParameter(param, data) {
    var value;
    switch (param.type) {
        case D3DXPARAMETER_TYPE.D3DXPT_VOID:
            value = null;
            break;
        case D3DXPARAMETER_TYPE.D3DXPT_BOOL:
            value = data.readUInt32LE(0) != 0;
            break;
        case D3DXPARAMETER_TYPE.D3DXPT_INT:
            value = data.readUInt32LE(0);
            break;
        case D3DXPARAMETER_TYPE.D3DXPT_FLOAT:
            value = data.readFloatLE(0);
            break;
        case D3DXPARAMETER_TYPE.D3DXPT_STRING:
            value = data.toString();
            break;
        case D3DXPARAMETER_TYPE.D3DXPT_TEXTURE:
            value = data.readUInt32LE(0);
            break;
        default:
            throw "Unhandled parameter type:" + param.type;
    }
    return value;
}

function parseMaterial(material, data) {
    var offset = 0;
    
    material.definition = data.readUInt32LE(offset);
    offset += 4;

    if (Materials.MaterialDefinitions[material.definition]) {
        var matdef = Materials.MaterialDefinitions[material.definition];
        material.name = matdef.name;
    }


    var numParams = data.readUInt32LE(offset);
    offset += 4;

    material.parameters = [];

    for (var i=0;i<numParams;i++) {
        var param = {};
        
        param.hash = data.readUInt32LE(offset);
        offset += 4;

        param.name = null;
        if (MaterialParameters[param.hash]) {
            param.name = MaterialParameters[param.hash].name;
        }

        param.class = data.readUInt32LE(offset);
        offset += 4;

        param.type = data.readUInt32LE(offset);
        offset += 4;

        var paramDataLength = data.readUInt32LE(offset);
        offset += 4;
        
        var paramData = data.slice(offset, paramDataLength + offset);
        offset += paramDataLength;
        
        param.value = parseParameter(param, paramData);
        
        material.parameters.push(param);
    }
}

function readVector3(data, offset) {
    var v = {
        x: data.readFloatLE(offset),
        y: data.readFloatLE(offset + 4),
        z: data.readFloatLE(offset + 8)
    };
    return v;
}

function readFloat16LE(data, offset) {
    var v = data.readUInt16LE(offset);
    var sign = (v >> 15) ? -1 : 1;
    var expo = (v >> 10) & 0x1F;
    var mantissa = v & 0x3FF;
    var fraction = mantissa / 1024;
    return sign * Math.pow(2, expo - 15) * (1 + fraction);
}

function readDMAT(data) {
    var dmat = {},
        texLength, texData,
        material, matLength, matData,
        i, offset = 0;

    dmat.magic = data.readUInt32LE(offset);
    offset += 4;

    if (dmat.magic != 0x54414D44) {
        throw "Not a DMAT file";
    }
    
    dmat.version = data.readUInt32LE(offset);
    offset += 4;
    
    texLength = data.readUInt32LE(offset);
    offset += 4;
    
    texData = data.slice(12, texLength + 12 - 1);
    offset += texLength;

    dmat.textures = texData.toString().split("\0");
   
    dmat.numMaterials = data.readUInt32LE(offset);
    offset += 4;
    
    dmat.materials = [];

    for (i=0;i<dmat.numMaterials;i++) {
        material = {};

        material.nameHash = data.readUInt32LE(offset);
        offset += 4;

        matLength = data.readUInt32LE(offset);
        offset += 4;
        
        matData = data.slice(offset, matLength + offset);
        offset += matLength;
        
        parseMaterial(material, matData);
        
        dmat.materials.push(material);
    }

    return dmat;
}

function writeDMAT(model) {
    var magic = "DMAT",
        version = 1,
        numTextures = model.textures.length,
        textureData = model.textures.join("\0") + "\0",
        numMaterials = model.materials.length;
    
    var dataSize = 4 + 4 + textureData.length + 4;
}

function writeDME(model) {
    var dmat = writeDMAT(model);
}

function normalize(v) {
    var v0 = v[0],
        v1 = v[1],
        v2 = v[2],
        len = Math.sqrt(v0*v0 + v1*v1 + v2*v2);
    if (len > 0) {
        v0 /= len;
        v1 /= len;
        v2 /= len;
    }
    return [v0,v1,v2];
}

function readDME(data) {
    var dmod = {},
        dmatLength, dmatData,
        offset = 0;
    
    dmod.magic = data.readUInt32LE(offset);
    offset += 4;

    if (dmod.magic != 0x444F4D44) {
        throw "Not a DMOD file";
    }

    dmod.version = data.readUInt32LE(offset);
    offset += 4;

    if (dmod.version != 4) {
        throw "Unsupported DMOD version: " + dmod.version;
    }
   
    dmatLength = data.readUInt32LE(offset);
    offset += 4;

    dmatData = data.slice(offset, offset + dmatLength);
    dmod.dmat = readDMAT(dmatData);;

    offset += dmatLength;

    if (dmod.dmat.materials.length == 0) {
        throw "No materials in DME file";
    }
    
    var material = dmod.dmat.materials[0],
        matdef = Materials.MaterialDefinitions[material.definition];

    if (!matdef) {
        throw "Unknown material definition: " + material.definition;
    }
    if (matdef.drawStyles.length == 0) {
        throw "No draw styles for material definition";
    }
    var drawStyle = matdef.drawStyles[0];

    var inputLayout = Materials.InputLayouts[Jenkins.oaat(drawStyle.inputLayout)];

    if (!inputLayout) {
        throw "Input layout not found:" + drawStyle.inputLayout;
    }

    dmod.aabb = {
        min: readVector3(data, offset),
        max: readVector3(data, offset + 12)
    };

    offset += 24;

    var numMeshes = data.readUInt32LE(offset);
    offset += 4;

    dmod.meshes = [];
    var drawCallOffset, drawCallCount, 
        boneTransformCount, numVertexStreams, 
        indexSize, numIndices, numVertices;

    for (var i=0;i<numMeshes;i++) {
        var mesh = {};

        drawCallOffset = data.readUInt32LE(offset);
        drawCallCount = data.readUInt32LE(offset + 4);
        boneTransformCount = data.readUInt32LE(offset + 8);
        numVertexStreams = data.readUInt32LE(offset + 16);
        indexSize = data.readUInt32LE(offset + 20);
        numIndices = data.readUInt32LE(offset + 24);
        numVertices = data.readUInt32LE(offset + 28);

        offset += 32;

        var vertices = [],
            uvs = [[]],
            normals = [],
            binormals = [],
            tangents = [],
            vertexStreams = [],
            skinIndices = [],
            skinWeights = [];

        // Vertex streams
        for (var j=0;j<numVertexStreams;j++) {
            var stride = data.readUInt32LE(offset);
            offset += 4;
            vertexStreams[j] = {
                stride: stride,
                data: data.slice(offset, offset + numVertices * stride),
                offset: 0,
                originalOffset: offset
            };
            offset += stride * numVertices;
        }
        for (var j=0;j<numVertices;j++) {
            for (var k=0;k<numVertexStreams;k++) {
                vertexStreams[k].offset = 0;
            }
            for (var k=0;k<inputLayout.entries.length;k++) {
                var entry = inputLayout.entries[k],
                    stream = vertexStreams[entry.stream],
                    value;

                if (stream.offset >= stream.stride) {
                    continue;
                }

                value = readInputLayoutEntry(entry.type, stream.data, stream.stride * j + stream.offset);

                switch (entry.usage) {
                    case "Position":
                        vertices.push(value);
                        break;
                    case "Normal":
                        normals.push(value);
                        break;
                    case "Binormal":
                        binormals.push(value);
                        break;
                    case "Tangent":
                        tangents.push(value);
                        break;
                    case "BlendWeight":
                        skinWeights.push(value);
                        break;
                    case "BlendIndices":
                        skinIndices.push([
                            value & 0xFF,
                            (value >> 8) & 0xFF,
                            (value >> 16) & 0xFF,
                            (value >> 24) & 0xFF
                        ]);
                        break;
                    case "Texcoord":
                        if (!uvs[entry.usageIndex]) {
                            uvs[entry.usageIndex] = [];
                        }
                        uvs[entry.usageIndex].push(value);
                        break;
                }
                stream.offset += InputLayoutEntrySizes[entry.type];
            }
        }

        // calculate normals if we don't have them but do have binormals and tangent
        if (normals.length == 0 && binormals.length > 0 && tangents.length > 0) {
            for (var j=0;j<numVertices;j++) {
                var b = normalize(binormals[j]);
                var t = normalize(tangents[j]);
                var sign = -tangents[j][3];
                var n = [
                    b[1] * t[2] - b[2] * t[1],
                    b[2] * t[0] - b[0] * t[2],
                    b[0] * t[1] - b[1] * t[0]
                ];
                n = normalize(n);
                n[0] *= sign;
                n[1] *= sign;
                n[2] *= sign;
                normals.push(n);
            }
        }

        mesh.vertices = vertices;
        mesh.normals = normals;
        mesh.binormals = binormals;
        mesh.uvs = uvs;
        mesh.influencesPerVertex = 1;
        mesh.skinWeights = skinWeights;
        mesh.skinIndices = skinIndices;

        // Indices
        var indices = [];
        for (var j=0;j<numIndices;j+=3) {
            if (indexSize == 2) {
                indices.push(
                        data.readUInt16LE(offset),
                        data.readUInt16LE(offset+2),
                        data.readUInt16LE(offset+4)
                );
            } else if (indexSize == 4) {
                indices.push(
                    data.readUInt32LE(offset),
                    data.readUInt32LE(offset+4),
                    data.readUInt32LE(offset+8)
                );
            }
            offset += indexSize*3;
        }
        mesh.indices = indices;

        var drawCallCount = data.readUInt32LE(offset);
        mesh.drawCalls = [];
        offset += 4;
        for (var j=0;j<drawCallCount;j++) {
            var drawCall = {};
            drawCall.unknown0 = data.readUInt32LE(offset);
            offset += 4;
            drawCall.boneStart = data.readUInt32LE(offset);
            offset += 4;
            drawCall.boneCount = data.readUInt32LE(offset);
            offset += 4;
            drawCall.delta = data.readUInt32LE(offset);
            offset += 4;
            drawCall.unknown1 = data.readUInt32LE(offset);
            offset += 4;
            drawCall.vertexOffset = data.readUInt32LE(offset);
            offset += 4;
            drawCall.vertexCount = data.readUInt32LE(offset);
            offset += 4;
            drawCall.indexOffset = data.readUInt32LE(offset);
            offset += 4;
            drawCall.indexCount = data.readUInt32LE(offset);
            offset += 4;

            mesh.drawCalls.push(drawCall);
        }

        var boneMapEntryCount = data.readUInt32LE(offset);
        offset += 4;
        mesh.boneMapEntries = [];
        for (var j=0;j<boneMapEntryCount;j++) {
            var boneMapEntry = {};
            boneMapEntry.boneIndex = data.readUInt16LE(offset);
            offset += 2;
            boneMapEntry.globalIndex = data.readUInt16LE(offset);
            offset += 2;
            mesh.boneMapEntries.push(boneMapEntry);
        }

        var boneCount = data.readUInt32LE(offset);
        offset += 4;
        mesh.bones = [];
        for (var j=0;j<boneCount;j++) {
            var bone = {};
            bone.inverseBindPose = [
                data.readFloatLE(offset), data.readFloatLE(offset+4), data.readFloatLE(offset+8), 0,
                data.readFloatLE(offset+12), data.readFloatLE(offset+16), data.readFloatLE(offset+20), 0,
                data.readFloatLE(offset+24), data.readFloatLE(offset+28), data.readFloatLE(offset+32), 0,
                data.readFloatLE(offset+36), data.readFloatLE(offset+40), data.readFloatLE(offset+44), 1
            ];
            offset += 48;
            mesh.bones.push(bone);
        }
        for (var j=0;j<boneCount;j++) {
            var bone = mesh.bones[j];
            bone.bbox = [
                data.readFloatLE(offset), data.readFloatLE(offset+4), data.readFloatLE(offset+8),
                data.readFloatLE(offset+12), data.readFloatLE(offset+16), data.readFloatLE(offset+20)
            ];
            offset += 24;
        }
        for (var j=0;j<boneCount;j++) {
            var bone = mesh.bones[j];
            bone.nameHash = data.readUInt32LE(offset);
            offset += 4;
        }

        dmod.meshes.push(mesh);
    }

    return dmod;
}

exports.write = writeDME;
exports.read = readDME;
exports.Materials = Materials;
exports.InputLayouts = Materials.InputLayouts;
exports.MaterialDefinitions = Materials.MaterialDefinitions;
exports.MaterialParameters = MaterialParameters;


},{"./materialparams":10,"./materials":11,"jenkins-hash":"uV4iLp"}],10:[function(require,module,exports){
exports.MaterialParameters = {
    "3829201": {
        "hash": 3829201,
        "name": "Zoom"
    },
    "3863930": {
        "hash": 3863930,
        "name": "auColorShiftStrength"
    },
    "8823747": {
        "hash": 8823747,
        "name": "CloudsEnabled"
    },
    "13187447": {
        "hash": 13187447,
        "name": "PatternColor"
    },
    "25230419": {
        "hash": 25230419,
        "name": "ColorKeyLerp"
    },
    "30345756": {
        "hash": 30345756,
        "name": "InfraRedOutlineColor"
    },
    "37331684": {
        "hash": 37331684,
        "name": "HeavilyBlurredSource"
    },
    "40764561": {
        "hash": 40764561,
        "name": "HoloColor"
    },
    "52260908": {
        "hash": 52260908,
        "name": "RainbowRadialStrength"
    },
    "55420896": {
        "hash": 55420896,
        "name": "FoamScrollV"
    },
    "60282692": {
        "hash": 60282692,
        "name": "FoamNormal"
    },
    "61882798": {
        "hash": 61882798,
        "name": "FrameRatio"
    },
    "63805397": {
        "hash": 63805397,
        "name": "NoiseThickness"
    },
    "67211600": {
        "hash": 67211600,
        "name": "Spec"
    },
    "67491352": {
        "hash": 67491352,
        "name": "BackgroundBoost"
    },
    "79276348": {
        "hash": 79276348,
        "name": "DetailBumpinessB"
    },
    "79487122": {
        "hash": 79487122,
        "name": "auMetallicMin"
    },
    "80138043": {
        "hash": 80138043,
        "name": "GBuffer2"
    },
    "92584538": {
        "hash": 92584538,
        "name": "SkyLightEnvmap"
    },
    "105814258": {
        "hash": 105814258,
        "name": "PostFocus"
    },
    "108040855": {
        "hash": 108040855,
        "name": "HoloHottness"
    },
    "112740062": {
        "hash": 112740062,
        "name": "WorldScale"
    },
    "115659782": {
        "hash": 115659782,
        "name": "ColorScrollU"
    },
    "118126650": {
        "hash": 118126650,
        "name": "PostClear"
    },
    "122431981": {
        "hash": 122431981,
        "name": "InfraRedOutlineWidth"
    },
    "123374570": {
        "hash": 123374570,
        "name": "Ambience"
    },
    "126481472": {
        "hash": 126481472,
        "name": "SwayScale"
    },
    "127961457": {
        "hash": 127961457,
        "name": "SparkOpacity"
    },
    "132615883": {
        "hash": 132615883,
        "name": "SunGlowMax"
    },
    "143846010": {
        "hash": 143846010,
        "name": "Reflection"
    },
    "146124756": {
        "hash": 146124756,
        "name": "SwaySmoothing"
    },
    "151485240": {
        "hash": 151485240,
        "name": "SpecMin"
    },
    "153978108": {
        "hash": 153978108,
        "name": "TilingTintMask"
    },
    "158481833": {
        "hash": 158481833,
        "name": "PostBloomSpread"
    },
    "164514058": {
        "hash": 164514058,
        "name": "FullScreenEffectDOF"
    },
    "176596187": {
        "hash": 176596187,
        "name": "UseUV1ForOverlayMask"
    },
    "177908343": {
        "hash": 177908343,
        "name": "FoamUVScale"
    },
    "178441982": {
        "hash": 178441982,
        "name": "_NearClip"
    },
    "206101470": {
        "hash": 206101470,
        "name": "MetersPerSecond"
    },
    "206985778": {
        "hash": 206985778,
        "name": "Visibility"
    },
    "226560599": {
        "hash": 226560599,
        "name": "SwayStrength"
    },
    "229637700": {
        "hash": 229637700,
        "name": "InfraRedViewRange"
    },
    "229698747": {
        "hash": 229698747,
        "name": "_Bones"
    },
    "234774581": {
        "hash": 234774581,
        "name": "TexScrollZ1"
    },
    "243039206": {
        "hash": 243039206,
        "name": "GradingShadowTint"
    },
    "245490417": {
        "hash": 245490417,
        "name": "GBuffer3"
    },
    "254469454": {
        "hash": 254469454,
        "name": "BloomBlurStageCount"
    },
    "257985534": {
        "hash": 257985534,
        "name": "_InvProjection"
    },
    "285754197": {
        "hash": 285754197,
        "name": "FoamScrollU"
    },
    "291215288": {
        "hash": 291215288,
        "name": "SpotShadowSampleMode"
    },
    "294164585": {
        "hash": 294164585,
        "name": "Scroll1_V"
    },
    "297056163": {
        "hash": 297056163,
        "name": "ShadowAlphaClipBias"
    },
    "298961613": {
        "hash": 298961613,
        "name": "DirectionalLightShadowInvViewProj"
    },
    "299157318": {
        "hash": 299157318,
        "name": "_WhitePoint"
    },
    "304210853": {
        "hash": 304210853,
        "name": "TextureType"
    },
    "311997911": {
        "hash": 311997911,
        "name": "BackgroundColor"
    },
    "317732273": {
        "hash": 317732273,
        "name": "SpecialEffect"
    },
    "326493344": {
        "hash": 326493344,
        "name": "Brightness"
    },
    "329705710": {
        "hash": 329705710,
        "name": "SkyLightProbeLocation1"
    },
    "330444510": {
        "hash": 330444510,
        "name": "AScroll1_V"
    },
    "339833724": {
        "hash": 339833724,
        "name": "TilingOverlay"
    },
    "343855878": {
        "hash": 343855878,
        "name": "ClarityOfSky"
    },
    "356389944": {
        "hash": 356389944,
        "name": "EmpireTintMask"
    },
    "356880671": {
        "hash": 356880671,
        "name": "CloakDarkLightColor"
    },
    "358117613": {
        "hash": 358117613,
        "name": "ColorScrollV"
    },
    "363692316": {
        "hash": 363692316,
        "name": "FullScreenEffectNone"
    },
    "364555382": {
        "hash": 364555382,
        "name": "ForegroundZScale"
    },
    "365568297": {
        "hash": 365568297,
        "name": "ParticleTextureMap"
    },
    "373115320": {
        "hash": 373115320,
        "name": "ShadowMapCoeffs"
    },
    "381128087": {
        "hash": 381128087,
        "name": "EvComp"
    },
    "392516915": {
        "hash": 392516915,
        "name": "Caustics"
    },
    "413059274": {
        "hash": 413059274,
        "name": "DirShadowMapCoeffs"
    },
    "417584024": {
        "hash": 417584024,
        "name": "ColorAlpha"
    },
    "420784001": {
        "hash": 420784001,
        "name": "Scroll1_U"
    },
    "424377348": {
        "hash": 424377348,
        "name": "auNoiseDriftSpeed"
    },
    "430178608": {
        "hash": 430178608,
        "name": "auMetallicMax"
    },
    "433374174": {
        "hash": 433374174,
        "name": "ForceFieldOpacity"
    },
    "443655795": {
        "hash": 443655795,
        "name": "FogBlurPass"
    },
    "445028485": {
        "hash": 445028485,
        "name": "AScroll2_V"
    },
    "445376453": {
        "hash": 445376453,
        "name": "_DirectionalLightViewSpaceDir"
    },
    "449327029": {
        "hash": 449327029,
        "name": "DizzyIntensity"
    },
    "458586035": {
        "hash": 458586035,
        "name": "FogNear"
    },
    "465982410": {
        "hash": 465982410,
        "name": "TilingTintHighlight"
    },
    "469239617": {
        "hash": 469239617,
        "name": "ScaleX"
    },
    "471991429": {
        "hash": 471991429,
        "name": "_Time"
    },
    "476129010": {
        "hash": 476129010,
        "name": "_TargetSize"
    },
    "491667889": {
        "hash": 491667889,
        "name": "ShadowSampleMode"
    },
    "492651060": {
        "hash": 492651060,
        "name": "AScroll1_U"
    },
    "496311818": {
        "hash": 496311818,
        "name": "auDielectricMin"
    },
    "504498101": {
        "hash": 504498101,
        "name": "Fade"
    },
    "516910600": {
        "hash": 516910600,
        "name": "SkyLightProbeColor1"
    },
    "523229553": {
        "hash": 523229553,
        "name": "Metalic"
    },
    "523264865": {
        "hash": 523264865,
        "name": "auEmissiveSlope"
    },
    "523425990": {
        "hash": 523425990,
        "name": "FoamFallOff"
    },
    "534335691": {
        "hash": 534335691,
        "name": "Color2"
    },
    "542118665": {
        "hash": 542118665,
        "name": "ResPattern"
    },
    "544224573": {
        "hash": 544224573,
        "name": "VisualizeLightCoverage"
    },
    "545627888": {
        "hash": 545627888,
        "name": "HoloNoiseTiling"
    },
    "545670461": {
        "hash": 545670461,
        "name": "SpecMax"
    },
    "546800135": {
        "hash": 546800135,
        "name": "SkinTintShadow"
    },
    "550354755": {
        "hash": 550354755,
        "name": "World"
    },
    "552363486": {
        "hash": 552363486,
        "name": "TexScale2"
    },
    "556643803": {
        "hash": 556643803,
        "name": "FrameWidth"
    },
    "571138767": {
        "hash": 571138767,
        "name": "SourceMip"
    },
    "572612140": {
        "hash": 572612140,
        "name": "Depth"
    },
    "579641533": {
        "hash": 579641533,
        "name": "Boost1"
    },
    "583828381": {
        "hash": 583828381,
        "name": "Timer"
    },
    "587670818": {
        "hash": 587670818,
        "name": "RedDotIntensity"
    },
    "591426909": {
        "hash": 591426909,
        "name": "SourceTexture"
    },
    "599959210": {
        "hash": 599959210,
        "name": "ENoise3D"
    },
    "602229479": {
        "hash": 602229479,
        "name": "ScaleStart"
    },
    "607198187": {
        "hash": 607198187,
        "name": "GradingHighlightTint"
    },
    "607383897": {
        "hash": 607383897,
        "name": "DamageCube"
    },
    "608981765": {
        "hash": 608981765,
        "name": "GlazeMax"
    },
    "624320542": {
        "hash": 624320542,
        "name": "HoloOpacity"
    },
    "625751260": {
        "hash": 625751260,
        "name": "BRDFLookup"
    },
    "627936395": {
        "hash": 627936395,
        "name": "SkyLightProbeLocation0"
    },
    "630217741": {
        "hash": 630217741,
        "name": "HotLavaTiling"
    },
    "646995462": {
        "hash": 646995462,
        "name": "TransitionSharpness"
    },
    "651020187": {
        "hash": 651020187,
        "name": "SunGlowMin"
    },
    "664981185": {
        "hash": 664981185,
        "name": "TexScrollV2"
    },
    "668925675": {
        "hash": 668925675,
        "name": "HoloTexture"
    },
    "673868074": {
        "hash": 673868074,
        "name": "FogColor"
    },
    "675266591": {
        "hash": 675266591,
        "name": "SkyLightCoeff8"
    },
    "678189709": {
        "hash": 678189709,
        "name": "BumpMap"
    },
    "681478253": {
        "hash": 681478253,
        "name": "TilingTintOpacity"
    },
    "710973406": {
        "hash": 710973406,
        "name": "PatternOpacity"
    },
    "716157339": {
        "hash": 716157339,
        "name": "TurbulenceDensityRange"
    },
    "722670166": {
        "hash": 722670166,
        "name": "OverlayA"
    },
    "722787958": {
        "hash": 722787958,
        "name": "UVsPerMeter2"
    },
    "728468415": {
        "hash": 728468415,
        "name": "ColorKeyB"
    },
    "731618615": {
        "hash": 731618615,
        "name": "BackGroundOpacity"
    },
    "732377366": {
        "hash": 732377366,
        "name": "LodScale"
    },
    "741098792": {
        "hash": 741098792,
        "name": "ForwardSpeed"
    },
    "743729426": {
        "hash": 743729426,
        "name": "Background"
    },
    "746044960": {
        "hash": 746044960,
        "name": "Source1"
    },
    "746601592": {
        "hash": 746601592,
        "name": "AScroll2_U"
    },
    "756222607": {
        "hash": 756222607,
        "name": "SkyLightProbeColor0"
    },
    "768036767": {
        "hash": 768036767,
        "name": "ShadowOpacity"
    },
    "768451860": {
        "hash": 768451860,
        "name": "TransitionOffset"
    },
    "777519584": {
        "hash": 777519584,
        "name": "DecalTintTranslation"
    },
    "784679747": {
        "hash": 784679747,
        "name": "PointLightRange"
    },
    "789998085": {
        "hash": 789998085,
        "name": "Bump"
    },
    "792630966": {
        "hash": 792630966,
        "name": "StealthTime"
    },
    "799502443": {
        "hash": 799502443,
        "name": "ForceFieldBGOpacity"
    },
    "816953472": {
        "hash": 816953472,
        "name": "BgAlpha"
    },
    "824378915": {
        "hash": 824378915,
        "name": "TilingOverlayB"
    },
    "831022117": {
        "hash": 831022117,
        "name": "FrameFade"
    },
    "831064098": {
        "hash": 831064098,
        "name": "UseUV0ForDetailBump"
    },
    "835183371": {
        "hash": 835183371,
        "name": "TexScrollV3"
    },
    "840604889": {
        "hash": 840604889,
        "name": "ThermalViewFade"
    },
    "843511206": {
        "hash": 843511206,
        "name": "Color3"
    },
    "843758617": {
        "hash": 843758617,
        "name": "ScalePower"
    },
    "844041166": {
        "hash": 844041166,
        "name": "Blur1"
    },
    "853069161": {
        "hash": 853069161,
        "name": "Focus"
    },
    "881782918": {
        "hash": 881782918,
        "name": "SiltColor"
    },
    "893694006": {
        "hash": 893694006,
        "name": "GBuffer0"
    },
    "900038855": {
        "hash": 900038855,
        "name": "Bumpiness3"
    },
    "906728643": {
        "hash": 906728643,
        "name": "SpotLightConeInner"
    },
    "910638047": {
        "hash": 910638047,
        "name": "ScaleY"
    },
    "921353881": {
        "hash": 921353881,
        "name": "BiasNormals"
    },
    "928941110": {
        "hash": 928941110,
        "name": "GlowContrast"
    },
    "947381123": {
        "hash": 947381123,
        "name": "RippleSpeed"
    },
    "954377901": {
        "hash": 954377901,
        "name": "ColorKeyA"
    },
    "957883732": {
        "hash": 957883732,
        "name": "FogDensity"
    },
    "959216293": {
        "hash": 959216293,
        "name": "UVsPerMeter3"
    },
    "966252751": {
        "hash": 966252751,
        "name": "Color"
    },
    "973401990": {
        "hash": 973401990,
        "name": "Refraction"
    },
    "986603797": {
        "hash": 986603797,
        "name": "LensDirtBloomSunSkyStrAlpha"
    },
    "991638603": {
        "hash": 991638603,
        "name": "GlowThickness"
    },
    "999236051": {
        "hash": 999236051,
        "name": "Boost"
    },
    "1011134229": {
        "hash": 1011134229,
        "name": "StealthBlend"
    },
    "1012108059": {
        "hash": 1012108059,
        "name": "SkinTintMidtone"
    },
    "1039054553": {
        "hash": 1039054553,
        "name": "SSAO"
    },
    "1040038212": {
        "hash": 1040038212,
        "name": "CubeFaceRight"
    },
    "1040364622": {
        "hash": 1040364622,
        "name": "BacksideBlur"
    },
    "1042620314": {
        "hash": 1042620314,
        "name": "HoloScanIntensity"
    },
    "1052296225": {
        "hash": 1052296225,
        "name": "_AmbientLightColor"
    },
    "1066582613": {
        "hash": 1066582613,
        "name": "NormalDistortion"
    },
    "1067869053": {
        "hash": 1067869053,
        "name": "_World"
    },
    "1070705699": {
        "hash": 1070705699,
        "name": "FogGradient"
    },
    "1070788421": {
        "hash": 1070788421,
        "name": "SkyLightCoeff7"
    },
    "1073655006": {
        "hash": 1073655006,
        "name": "GodRayStartFade"
    },
    "1078746172": {
        "hash": 1078746172,
        "name": "Boost3"
    },
    "1078760958": {
        "hash": 1078760958,
        "name": "DirectionalLightDirection"
    },
    "1081191752": {
        "hash": 1081191752,
        "name": "TilingTintShadow"
    },
    "1082251412": {
        "hash": 1082251412,
        "name": "RippleFreq"
    },
    "1086334096": {
        "hash": 1086334096,
        "name": "ShieldDistortion"
    },
    "1092061151": {
        "hash": 1092061151,
        "name": "BumpMap1"
    },
    "1107169193": {
        "hash": 1107169193,
        "name": "EmissiveScrollY"
    },
    "1108184160": {
        "hash": 1108184160,
        "name": "DistortionTexture"
    },
    "1127393126": {
        "hash": 1127393126,
        "name": "SpotLightGelTexture"
    },
    "1128077162": {
        "hash": 1128077162,
        "name": "RippleX"
    },
    "1128172462": {
        "hash": 1128172462,
        "name": "WaveScrollV"
    },
    "1133841079": {
        "hash": 1133841079,
        "name": "EmpireTintA"
    },
    "1146688371": {
        "hash": 1146688371,
        "name": "Culling"
    },
    "1148821380": {
        "hash": 1148821380,
        "name": "ParticleOptions"
    },
    "1151454843": {
        "hash": 1151454843,
        "name": "SplatShadowDepth"
    },
    "1159151102": {
        "hash": 1159151102,
        "name": "ExtraTintScale"
    },
    "1166057229": {
        "hash": 1166057229,
        "name": "WarpMode"
    },
    "1170300070": {
        "hash": 1170300070,
        "name": "VertexAlignment"
    },
    "1171151001": {
        "hash": 1171151001,
        "name": "FullScreenEffectVR"
    },
    "1172739366": {
        "hash": 1172739366,
        "name": "Density"
    },
    "1174761787": {
        "hash": 1174761787,
        "name": "Source3"
    },
    "1178280435": {
        "hash": 1178280435,
        "name": "_InvTargetSize"
    },
    "1190658596": {
        "hash": 1190658596,
        "name": "_TimeStep"
    },
    "1194846367": {
        "hash": 1194846367,
        "name": "RSMNormal"
    },
    "1195808802": {
        "hash": 1195808802,
        "name": "DirectionalLightShadowViewProj"
    },
    "1199349678": {
        "hash": 1199349678,
        "name": "ForegroundZBias"
    },
    "1199676664": {
        "hash": 1199676664,
        "name": "FogFloor"
    },
    "1199906518": {
        "hash": 1199906518,
        "name": "ShadowProjectorDepthScale"
    },
    "1210735960": {
        "hash": 1210735960,
        "name": "Rotation"
    },
    "1213875236": {
        "hash": 1213875236,
        "name": "Transparency"
    },
    "1223440260": {
        "hash": 1223440260,
        "name": "ParticleWorld"
    },
    "1230181611": {
        "hash": 1230181611,
        "name": "CausticsNM"
    },
    "1231552575": {
        "hash": 1231552575,
        "name": "CloudAnimationOffsetV"
    },
    "1232798322": {
        "hash": 1232798322,
        "name": "TintAlpha"
    },
    "1236191597": {
        "hash": 1236191597,
        "name": "CameraShadow"
    },
    "1237848648": {
        "hash": 1237848648,
        "name": "SkinTintHighlight"
    },
    "1251189167": {
        "hash": 1251189167,
        "name": "SwaySpeed"
    },
    "1254266990": {
        "hash": 1254266990,
        "name": "DecalUVSet"
    },
    "1257189798": {
        "hash": 1257189798,
        "name": "ShadowViewProj"
    },
    "1258683780": {
        "hash": 1258683780,
        "name": "NoiseTex"
    },
    "1259507217": {
        "hash": 1259507217,
        "name": "CumulusCloudContrast"
    },
    "1263508167": {
        "hash": 1263508167,
        "name": "BloomEnabled"
    },
    "1271749719": {
        "hash": 1271749719,
        "name": "StarsColor"
    },
    "1284585867": {
        "hash": 1284585867,
        "name": "CloudAnimationShift"
    },
    "1289402578": {
        "hash": 1289402578,
        "name": "NoiseSpeed"
    },
    "1301842640": {
        "hash": 1301842640,
        "name": "SkyLightCoeff6"
    },
    "1307508890": {
        "hash": 1307508890,
        "name": "FilterMode"
    },
    "1312972829": {
        "hash": 1312972829,
        "name": "PostVignette"
    },
    "1313893236": {
        "hash": 1313893236,
        "name": "DesaturationIntensity"
    },
    "1320135603": {
        "hash": 1320135603,
        "name": "LensHoodFalloffAngle"
    },
    "1343938377": {
        "hash": 1343938377,
        "name": "auEmissiveScale"
    },
    "1352337006": {
        "hash": 1352337006,
        "name": "Source0"
    },
    "1364734829": {
        "hash": 1364734829,
        "name": "ExtraTintColorB"
    },
    "1364744812": {
        "hash": 1364744812,
        "name": "CloudLayerWeightings"
    },
    "1364828122": {
        "hash": 1364828122,
        "name": "FadeOutEnd"
    },
    "1370575583": {
        "hash": 1370575583,
        "name": "_View"
    },
    "1376449557": {
        "hash": 1376449557,
        "name": "DecalTintHighlight"
    },
    "1378333147": {
        "hash": 1378333147,
        "name": "OverlayNM"
    },
    "1401609382": {
        "hash": 1401609382,
        "name": "RollTiling"
    },
    "1415426300": {
        "hash": 1415426300,
        "name": "LensHazeSunSkyStr"
    },
    "1415740256": {
        "hash": 1415740256,
        "name": "Step"
    },
    "1419064535": {
        "hash": 1419064535,
        "name": "EmissiveScrollX"
    },
    "1419551865": {
        "hash": 1419551865,
        "name": "ForceFieldAdditive"
    },
    "1420559152": {
        "hash": 1420559152,
        "name": "FogSkyFar"
    },
    "1422441133": {
        "hash": 1422441133,
        "name": "Color1"
    },
    "1427378747": {
        "hash": 1427378747,
        "name": "ColdRoll"
    },
    "1429777933": {
        "hash": 1429777933,
        "name": "LPVGreenCoeff"
    },
    "1444938388": {
        "hash": 1444938388,
        "name": "MainSceneCameraPos"
    },
    "1446133117": {
        "hash": 1446133117,
        "name": "LensEffects"
    },
    "1454676965": {
        "hash": 1454676965,
        "name": "CullMode"
    },
    "1459527072": {
        "hash": 1459527072,
        "name": "SkyLightCoeff4"
    },
    "1464021683": {
        "hash": 1464021683,
        "name": "ScaleWavefrontSize"
    },
    "1465821108": {
        "hash": 1465821108,
        "name": "ParticleTextureParams"
    },
    "1470022878": {
        "hash": 1470022878,
        "name": "DecalMainUV"
    },
    "1481621783": {
        "hash": 1481621783,
        "name": "RandomSeed"
    },
    "1487910380": {
        "hash": 1487910380,
        "name": "PatternTiling"
    },
    "1491511224": {
        "hash": 1491511224,
        "name": "PickColor"
    },
    "1508721027": {
        "hash": 1508721027,
        "name": "SingleSided"
    },
    "1511507731": {
        "hash": 1511507731,
        "name": "AllowMotionBlur"
    },
    "1517197409": {
        "hash": 1517197409,
        "name": "CornerFrame"
    },
    "1519641328": {
        "hash": 1519641328,
        "name": "SpotLightShadowViewProj"
    },
    "1526083076": {
        "hash": 1526083076,
        "name": "TurbulenceDirection"
    },
    "1537748556": {
        "hash": 1537748556,
        "name": "SwayDir"
    },
    "1540519840": {
        "hash": 1540519840,
        "name": "DetailBumpiness"
    },
    "1540765459": {
        "hash": 1540765459,
        "name": "TexScrollU1"
    },
    "1543019100": {
        "hash": 1543019100,
        "name": "ObjectID"
    },
    "1545334336": {
        "hash": 1545334336,
        "name": "_VirtualView"
    },
    "1552580905": {
        "hash": 1552580905,
        "name": "DecalTintShadow"
    },
    "1555484666": {
        "hash": 1555484666,
        "name": "ScaleEnd"
    },
    "1558194059": {
        "hash": 1558194059,
        "name": "StreakElasticity"
    },
    "1562404697": {
        "hash": 1562404697,
        "name": "LensDirtLayerDensities"
    },
    "1563569088": {
        "hash": 1563569088,
        "name": "DetailFrequencyB"
    },
    "1569877796": {
        "hash": 1569877796,
        "name": "DoubleSided"
    },
    "1571817543": {
        "hash": 1571817543,
        "name": "Glaze"
    },
    "1590407023": {
        "hash": 1590407023,
        "name": "Scroll3_U"
    },
    "1594576427": {
        "hash": 1594576427,
        "name": "InfraRedWhitePoint"
    },
    "1598910222": {
        "hash": 1598910222,
        "name": "TilingTintTranslation"
    },
    "1607614247": {
        "hash": 1607614247,
        "name": "TexScrollV1"
    },
    "1612104589": {
        "hash": 1612104589,
        "name": "LPVRedCoeff"
    },
    "1617206093": {
        "hash": 1617206093,
        "name": "Foam"
    },
    "1645435298": {
        "hash": 1645435298,
        "name": "Bumpiness1"
    },
    "1652460352": {
        "hash": 1652460352,
        "name": "TexScrollX3"
    },
    "1652574888": {
        "hash": 1652574888,
        "name": "BumpMap3"
    },
    "1659194243": {
        "hash": 1659194243,
        "name": "DecalTintRotation"
    },
    "1662965498": {
        "hash": 1662965498,
        "name": "ExtraTintColorA"
    },
    "1667675756": {
        "hash": 1667675756,
        "name": "SkyLightCoeff5"
    },
    "1679122878": {
        "hash": 1679122878,
        "name": "ScrollY"
    },
    "1679943667": {
        "hash": 1679943667,
        "name": "_EyePosition"
    },
    "1683278741": {
        "hash": 1683278741,
        "name": "Transmittance"
    },
    "1688837887": {
        "hash": 1688837887,
        "name": "SwayBoilSpeed"
    },
    "1690271866": {
        "hash": 1690271866,
        "name": "BlurIntensity"
    },
    "1691892051": {
        "hash": 1691892051,
        "name": "SkyLightCoeff3"
    },
    "1693427706": {
        "hash": 1693427706,
        "name": "Scroll"
    },
    "1694664876": {
        "hash": 1694664876,
        "name": "InfraRedScanLines"
    },
    "1703288507": {
        "hash": 1703288507,
        "name": "ReduceBloom"
    },
    "1703756102": {
        "hash": 1703756102,
        "name": "AOEnable"
    },
    "1703968225": {
        "hash": 1703968225,
        "name": "ResColor"
    },
    "1709814382": {
        "hash": 1709814382,
        "name": "GradingMidtoneSaturation"
    },
    "1716414136": {
        "hash": 1716414136,
        "name": "DetailMask"
    },
    "1723402422": {
        "hash": 1723402422,
        "name": "TurbulenceEnable"
    },
    "1734104548": {
        "hash": 1734104548,
        "name": "TurbulenceSpeed"
    },
    "1735042216": {
        "hash": 1735042216,
        "name": "baseDiffuse"
    },
    "1752346981": {
        "hash": 1752346981,
        "name": "GridPattern"
    },
    "1753966226": {
        "hash": 1753966226,
        "name": "Bumpiness2"
    },
    "1756487063": {
        "hash": 1756487063,
        "name": "CumulusCloudScrollU"
    },
    "1757275279": {
        "hash": 1757275279,
        "name": "Distortion"
    },
    "1757615833": {
        "hash": 1757615833,
        "name": "IsShadowGenPass"
    },
    "1765717308": {
        "hash": 1765717308,
        "name": "SatelliteUVOffsetNScale"
    },
    "1781145171": {
        "hash": 1781145171,
        "name": "PatternScaler"
    },
    "1786215855": {
        "hash": 1786215855,
        "name": "ExtraTintOpacity"
    },
    "1820622916": {
        "hash": 1820622916,
        "name": "StratusCloudScrollV"
    },
    "1830006335": {
        "hash": 1830006335,
        "name": "ScreenDirtLookupTex"
    },
    "1832233395": {
        "hash": 1832233395,
        "name": "Scaler"
    },
    "1847538729": {
        "hash": 1847538729,
        "name": "Smoothness"
    },
    "1850817166": {
        "hash": 1850817166,
        "name": "Scale"
    },
    "1875279216": {
        "hash": 1875279216,
        "name": "IronSight"
    },
    "1878463877": {
        "hash": 1878463877,
        "name": "HoloContrast"
    },
    "1880305610": {
        "hash": 1880305610,
        "name": "PeakAlphaFromTexture"
    },
    "1880616487": {
        "hash": 1880616487,
        "name": "DontCorrectCamera"
    },
    "1888282186": {
        "hash": 1888282186,
        "name": "WaveScrollU"
    },
    "1890053487": {
        "hash": 1890053487,
        "name": "ShowDecalTint"
    },
    "1891305734": {
        "hash": 1891305734,
        "name": "PostNightVision"
    },
    "1894139688": {
        "hash": 1894139688,
        "name": "auSmoothnessMin"
    },
    "1895583708": {
        "hash": 1895583708,
        "name": "ColorMapScrollY"
    },
    "1942847682": {
        "hash": 1942847682,
        "name": "FullScreenEffectID_2"
    },
    "1948295648": {
        "hash": 1948295648,
        "name": "EmitsHeat"
    },
    "1949429259": {
        "hash": 1949429259,
        "name": "BumpMap2"
    },
    "1957883122": {
        "hash": 1957883122,
        "name": "EmpireTintB"
    },
    "1974590214": {
        "hash": 1974590214,
        "name": "SkyLightCoeff2"
    },
    "1975138187": {
        "hash": 1975138187,
        "name": "CloakColor"
    },
    "1975573753": {
        "hash": 1975573753,
        "name": "EmissiveOverlay"
    },
    "1985312335": {
        "hash": 1985312335,
        "name": "AutoTileFreq"
    },
    "1997514539": {
        "hash": 1997514539,
        "name": "_ViewProj"
    },
    "2006023194": {
        "hash": 2006023194,
        "name": "GradingShadowSaturation"
    },
    "2013530260": {
        "hash": 2013530260,
        "name": "CameraShakeDir"
    },
    "2014451236": {
        "hash": 2014451236,
        "name": "GlowBrightness"
    },
    "2015411581": {
        "hash": 2015411581,
        "name": "WireFrame"
    },
    "2016590828": {
        "hash": 2016590828,
        "name": "Tint1"
    },
    "2029677084": {
        "hash": 2029677084,
        "name": "SatelliteWorldMatrix"
    },
    "2036615607": {
        "hash": 2036615607,
        "name": "OverlaySpec"
    },
    "2038282059": {
        "hash": 2038282059,
        "name": "ScaleMax"
    },
    "2052177330": {
        "hash": 2052177330,
        "name": "DirectionalLightShadowMap"
    },
    "2058228996": {
        "hash": 2058228996,
        "name": "SkyLightProbeLerp"
    },
    "2059762042": {
        "hash": 2059762042,
        "name": "FoamStart"
    },
    "2062940364": {
        "hash": 2062940364,
        "name": "GodRayEndFade"
    },
    "2068323268": {
        "hash": 2068323268,
        "name": "Sigma"
    },
    "2073379210": {
        "hash": 2073379210,
        "name": "ShieldDistance"
    },
    "2078852781": {
        "hash": 2078852781,
        "name": "ClearColor"
    },
    "2085608919": {
        "hash": 2085608919,
        "name": "Source2"
    },
    "2092208449": {
        "hash": 2092208449,
        "name": "TurbulenceBoilSpeed"
    },
    "2093861130": {
        "hash": 2093861130,
        "name": "BeamWidth"
    },
    "2095253993": {
        "hash": 2095253993,
        "name": "_PrevEyePosition"
    },
    "2098260848": {
        "hash": 2098260848,
        "name": "ColorScale"
    },
    "2103910921": {
        "hash": 2103910921,
        "name": "StratusCloudScrollU"
    },
    "2105029476": {
        "hash": 2105029476,
        "name": "PatternGlow"
    },
    "2110910314": {
        "hash": 2110910314,
        "name": "LeftFrame"
    },
    "2125917009": {
        "hash": 2125917009,
        "name": "ColorMapScrollX"
    },
    "2143320180": {
        "hash": 2143320180,
        "name": "ShadowResolveOrtho"
    },
    "2156208778": {
        "hash": 2156208778,
        "name": "Size"
    },
    "2157436542": {
        "hash": 2157436542,
        "name": "ShadowMap"
    },
    "2166570397": {
        "hash": 2166570397,
        "name": "HoloPow"
    },
    "2168882344": {
        "hash": 2168882344,
        "name": "SiltDepth"
    },
    "2172885210": {
        "hash": 2172885210,
        "name": "_Camera"
    },
    "2179212403": {
        "hash": 2179212403,
        "name": "FogEnable"
    },
    "2180269699": {
        "hash": 2180269699,
        "name": "FadeModelMaterial"
    },
    "2181847035": {
        "hash": 2181847035,
        "name": "CloudShadowAlphaPower"
    },
    "2191089725": {
        "hash": 2191089725,
        "name": "TilingTintScale"
    },
    "2196262636": {
        "hash": 2196262636,
        "name": "ExtraTint"
    },
    "2197143919": {
        "hash": 2197143919,
        "name": "SkyLightProbeNormal1"
    },
    "2197869836": {
        "hash": 2197869836,
        "name": "Rough"
    },
    "2198555586": {
        "hash": 2198555586,
        "name": "GBuffer1"
    },
    "2201566846": {
        "hash": 2201566846,
        "name": "overlayEdge"
    },
    "2220160868": {
        "hash": 2220160868,
        "name": "auDielectricMax"
    },
    "2229905238": {
        "hash": 2229905238,
        "name": "FullScreenEffectThermal"
    },
    "2237765959": {
        "hash": 2237765959,
        "name": "FogSkyNear"
    },
    "2263759043": {
        "hash": 2263759043,
        "name": "SpotLightShadowMap"
    },
    "2273557438": {
        "hash": 2273557438,
        "name": "Noise2D"
    },
    "2277245775": {
        "hash": 2277245775,
        "name": "InForeground"
    },
    "2294365637": {
        "hash": 2294365637,
        "name": "RainbowRadialPower"
    },
    "2299629057": {
        "hash": 2299629057,
        "name": "Opacity"
    },
    "2327400845": {
        "hash": 2327400845,
        "name": "ColorBlend"
    },
    "2328515476": {
        "hash": 2328515476,
        "name": "_Random"
    },
    "2328805684": {
        "hash": 2328805684,
        "name": "Noise3D"
    },
    "2331772310": {
        "hash": 2331772310,
        "name": "SkyLightCoeff1"
    },
    "2335796538": {
        "hash": 2335796538,
        "name": "TransitionDirection"
    },
    "2340703708": {
        "hash": 2340703708,
        "name": "PerlinNoise3D"
    },
    "2351274034": {
        "hash": 2351274034,
        "name": "StratusCloudHeight"
    },
    "2351964300": {
        "hash": 2351964300,
        "name": "NoDepth"
    },
    "2352193395": {
        "hash": 2352193395,
        "name": "EmissiveIsTransB"
    },
    "2361473717": {
        "hash": 2361473717,
        "name": "ShieldFresnel"
    },
    "2372087210": {
        "hash": 2372087210,
        "name": "PolarizerStrength"
    },
    "2372293008": {
        "hash": 2372293008,
        "name": "ThermalAdjustToLighting"
    },
    "2373469192": {
        "hash": 2373469192,
        "name": "SatelliteDepth"
    },
    "2380647739": {
        "hash": 2380647739,
        "name": "EnableColorGrading"
    },
    "2381474472": {
        "hash": 2381474472,
        "name": "Tiling"
    },
    "2386947694": {
        "hash": 2386947694,
        "name": "PatternAlpha"
    },
    "2397366784": {
        "hash": 2397366784,
        "name": "PointLightPosition"
    },
    "2403297649": {
        "hash": 2403297649,
        "name": "_PrevViewProj"
    },
    "2412733121": {
        "hash": 2412733121,
        "name": "DetailScale"
    },
    "2414013317": {
        "hash": 2414013317,
        "name": "TilingTint"
    },
    "2418387767": {
        "hash": 2418387767,
        "name": "FlashIntensity"
    },
    "2427617520": {
        "hash": 2427617520,
        "name": "EnableSway"
    },
    "2438181367": {
        "hash": 2438181367,
        "name": "DetailBump"
    },
    "2442469208": {
        "hash": 2442469208,
        "name": "CumulusCloudTiling"
    },
    "2443456228": {
        "hash": 2443456228,
        "name": "_DirectionalLightColor"
    },
    "2457905760": {
        "hash": 2457905760,
        "name": "SunLightDeferredShadow"
    },
    "2458826741": {
        "hash": 2458826741,
        "name": "BeamColor"
    },
    "2464614428": {
        "hash": 2464614428,
        "name": "CloudAnimationTiling"
    },
    "2465430226": {
        "hash": 2465430226,
        "name": "GlowUVScale"
    },
    "2471833041": {
        "hash": 2471833041,
        "name": "ShieldColor"
    },
    "2476446038": {
        "hash": 2476446038,
        "name": "_PrevWorld"
    },
    "2482752130": {
        "hash": 2482752130,
        "name": "FrameColor"
    },
    "2498113615": {
        "hash": 2498113615,
        "name": "LensDirtLayer2SizeStrRanges"
    },
    "2499603309": {
        "hash": 2499603309,
        "name": "ColdLava"
    },
    "2501081678": {
        "hash": 2501081678,
        "name": "ScaleB"
    },
    "2535876272": {
        "hash": 2535876272,
        "name": "FogFar"
    },
    "2537314519": {
        "hash": 2537314519,
        "name": "SkyLightEnvmapTint"
    },
    "2540424466": {
        "hash": 2540424466,
        "name": "ParticleTintColor"
    },
    "2541324825": {
        "hash": 2541324825,
        "name": "AntiBloom"
    },
    "2549863098": {
        "hash": 2549863098,
        "name": "ThermalWhitePoint"
    },
    "2554324595": {
        "hash": 2554324595,
        "name": "auColorShiftRate"
    },
    "2558434264": {
        "hash": 2558434264,
        "name": "CubeFaceDown"
    },
    "2561141971": {
        "hash": 2561141971,
        "name": "SkyLightProbeNormal0"
    },
    "2561142134": {
        "hash": 2561142134,
        "name": "OverlayB"
    },
    "2566592169": {
        "hash": 2566592169,
        "name": "SparkMask"
    },
    "2573861599": {
        "hash": 2573861599,
        "name": "Tint"
    },
    "2574080545": {
        "hash": 2574080545,
        "name": "Bloom"
    },
    "2592140036": {
        "hash": 2592140036,
        "name": "SiltNFoam"
    },
    "2602481047": {
        "hash": 2602481047,
        "name": "ForegroundWScale"
    },
    "2605949149": {
        "hash": 2605949149,
        "name": "ColdLavaTiling"
    },
    "2612909563": {
        "hash": 2612909563,
        "name": "TilingTintRotation"
    },
    "2624186403": {
        "hash": 2624186403,
        "name": "_StreakTimeStep"
    },
    "2632014573": {
        "hash": 2632014573,
        "name": "BlendMask"
    },
    "2636374935": {
        "hash": 2636374935,
        "name": "SparkFlowZ"
    },
    "2638832453": {
        "hash": 2638832453,
        "name": "PostBloomCutoff"
    },
    "2644518207": {
        "hash": 2644518207,
        "name": "HoloScanSpacing"
    },
    "2657496170": {
        "hash": 2657496170,
        "name": "SkyLightCoeff0"
    },
    "2658993220": {
        "hash": 2658993220,
        "name": "HorizonFadeHeight"
    },
    "2666537735": {
        "hash": 2666537735,
        "name": "lightingRadius"
    },
    "2698019335": {
        "hash": 2698019335,
        "name": "DownsampleDepthMode"
    },
    "2698480937": {
        "hash": 2698480937,
        "name": "Tint3"
    },
    "2726136865": {
        "hash": 2726136865,
        "name": "OverlayTiling"
    },
    "2740068419": {
        "hash": 2740068419,
        "name": "WorldMatrix"
    },
    "2744817747": {
        "hash": 2744817747,
        "name": "InfraRedOutlineAlpha"
    },
    "2746430072": {
        "hash": 2746430072,
        "name": "NoiseAlpha"
    },
    "2747100841": {
        "hash": 2747100841,
        "name": "Blur2"
    },
    "2752875657": {
        "hash": 2752875657,
        "name": "BacksideSpec"
    },
    "2759433534": {
        "hash": 2759433534,
        "name": "EnableExtraTint"
    },
    "2761341700": {
        "hash": 2761341700,
        "name": "Scroll3_V"
    },
    "2766689043": {
        "hash": 2766689043,
        "name": "Forward"
    },
    "2781549637": {
        "hash": 2781549637,
        "name": "BgColor"
    },
    "2798959540": {
        "hash": 2798959540,
        "name": "VisibleSkyIntensity"
    },
    "2811640427": {
        "hash": 2811640427,
        "name": "VisualizerForeground"
    },
    "2812797878": {
        "hash": 2812797878,
        "name": "FoamBrightness"
    },
    "2821565358": {
        "hash": 2821565358,
        "name": "AurLookup"
    },
    "2828284175": {
        "hash": 2828284175,
        "name": "SpotLightConeOuter"
    },
    "2860884101": {
        "hash": 2860884101,
        "name": "Tint2"
    },
    "2875741183": {
        "hash": 2875741183,
        "name": "FrameOn"
    },
    "2901535418": {
        "hash": 2901535418,
        "name": "RippleY"
    },
    "2907896508": {
        "hash": 2907896508,
        "name": "DepthOfFieldTransition"
    },
    "2914581933": {
        "hash": 2914581933,
        "name": "NoiseTiling"
    },
    "2922652710": {
        "hash": 2922652710,
        "name": "TargetColorTexture"
    },
    "2942327622": {
        "hash": 2942327622,
        "name": "CameraDirectionDelta"
    },
    "2957797488": {
        "hash": 2957797488,
        "name": "_VirtualViewOffset"
    },
    "2968443068": {
        "hash": 2968443068,
        "name": "BloomIn"
    },
    "2986635323": {
        "hash": 2986635323,
        "name": "CumulusCloudScrollV"
    },
    "2987331221": {
        "hash": 2987331221,
        "name": "LensDirtLayer1SizeStrRanges"
    },
    "2999197982": {
        "hash": 2999197982,
        "name": "BaseDiffuse"
    },
    "2999357148": {
        "hash": 2999357148,
        "name": "SparkFlowX"
    },
    "3007871864": {
        "hash": 3007871864,
        "name": "Length"
    },
    "3017596156": {
        "hash": 3017596156,
        "name": "Width"
    },
    "3028066784": {
        "hash": 3028066784,
        "name": "ShadowSlopeScaledDepthBias"
    },
    "3030791378": {
        "hash": 3030791378,
        "name": "WaterTiling"
    },
    "3033118253": {
        "hash": 3033118253,
        "name": "Overlay"
    },
    "3037098516": {
        "hash": 3037098516,
        "name": "LensCenterFalloffCutoff"
    },
    "3044613897": {
        "hash": 3044613897,
        "name": "CloudSilverLiningThickness"
    },
    "3057423179": {
        "hash": 3057423179,
        "name": "BlurHalfSource"
    },
    "3075807476": {
        "hash": 3075807476,
        "name": "HighQualityLighting"
    },
    "3077783009": {
        "hash": 3077783009,
        "name": "TilingTintMidtone"
    },
    "3097098055": {
        "hash": 3097098055,
        "name": "DecalTintMidtone"
    },
    "3133539934": {
        "hash": 3133539934,
        "name": "RippleZ"
    },
    "3136362712": {
        "hash": 3136362712,
        "name": "SourceDepth"
    },
    "3145928884": {
        "hash": 3145928884,
        "name": "ScrollU"
    },
    "3147295330": {
        "hash": 3147295330,
        "name": "WriteDepth"
    },
    "3151950711": {
        "hash": 3151950711,
        "name": "SpotLightShadowMapCoeffs"
    },
    "3168744505": {
        "hash": 3168744505,
        "name": "RSMFlux"
    },
    "3175105478": {
        "hash": 3175105478,
        "name": "_VirtualCameraOffset"
    },
    "3177835126": {
        "hash": 3177835126,
        "name": "GlazeMin"
    },
    "3180162333": {
        "hash": 3180162333,
        "name": "CubeFaceDir"
    },
    "3192104870": {
        "hash": 3192104870,
        "name": "TransitionWidth"
    },
    "3197904550": {
        "hash": 3197904550,
        "name": "PreLit"
    },
    "3202356318": {
        "hash": 3202356318,
        "name": "DecalOpacity"
    },
    "3220667161": {
        "hash": 3220667161,
        "name": "NormalMap"
    },
    "3230200367": {
        "hash": 3230200367,
        "name": "Power"
    },
    "3237876615": {
        "hash": 3237876615,
        "name": "FoamScale"
    },
    "3255162001": {
        "hash": 3255162001,
        "name": "WaterDepthBuffer"
    },
    "3271824314": {
        "hash": 3271824314,
        "name": "FadeOutStart"
    },
    "3274769863": {
        "hash": 3274769863,
        "name": "TexScrollU3"
    },
    "3277694582": {
        "hash": 3277694582,
        "name": "BlurQuarterUpscaleSource"
    },
    "3285820901": {
        "hash": 3285820901,
        "name": "TopFrame"
    },
    "3296772691": {
        "hash": 3296772691,
        "name": "CumulusCloudHeight"
    },
    "3303535550": {
        "hash": 3303535550,
        "name": "ShadowProjectorDepthOffset"
    },
    "3304005937": {
        "hash": 3304005937,
        "name": "LPVOcclusion"
    },
    "3316400538": {
        "hash": 3316400538,
        "name": "BloomStrength"
    },
    "3328123372": {
        "hash": 3328123372,
        "name": "PostObscure"
    },
    "3330852111": {
        "hash": 3330852111,
        "name": "FadeOverride"
    },
    "3341407066": {
        "hash": 3341407066,
        "name": "FontTexture"
    },
    "3353900466": {
        "hash": 3353900466,
        "name": "AlphaContrast"
    },
    "3361035837": {
        "hash": 3361035837,
        "name": "Source"
    },
    "3364138087": {
        "hash": 3364138087,
        "name": "ShadowEnableFastZ"
    },
    "3364859625": {
        "hash": 3364859625,
        "name": "DiffuseB"
    },
    "3373848684": {
        "hash": 3373848684,
        "name": "ParticleMaskTextureMap"
    },
    "3380569764": {
        "hash": 3380569764,
        "name": "Offset"
    },
    "3403214035": {
        "hash": 3403214035,
        "name": "LightScattering"
    },
    "3411966862": {
        "hash": 3411966862,
        "name": "auBumpClean"
    },
    "3414268513": {
        "hash": 3414268513,
        "name": "TintSemantic"
    },
    "3431840573": {
        "hash": 3431840573,
        "name": "OverlayScale"
    },
    "3439967770": {
        "hash": 3439967770,
        "name": "TexScale1"
    },
    "3448653618": {
        "hash": 3448653618,
        "name": "_ClipSpaceMotion"
    },
    "3448862708": {
        "hash": 3448862708,
        "name": "HotLava"
    },
    "3448985948": {
        "hash": 3448985948,
        "name": "FoamDepthBias"
    },
    "3462546994": {
        "hash": 3462546994,
        "name": "HotRoll"
    },
    "3465979259": {
        "hash": 3465979259,
        "name": "UVsPerMeter0"
    },
    "3470651842": {
        "hash": 3470651842,
        "name": "auBumpStrength"
    },
    "3485345011": {
        "hash": 3485345011,
        "name": "GradingShadowDomain"
    },
    "3488896135": {
        "hash": 3488896135,
        "name": "ParticleOptions2"
    },
    "3505959039": {
        "hash": 3505959039,
        "name": "ShadowDepthBias"
    },
    "3506094927": {
        "hash": 3506094927,
        "name": "Dielectric"
    },
    "3508855631": {
        "hash": 3508855631,
        "name": "HoloNoiseSpeed"
    },
    "3519956614": {
        "hash": 3519956614,
        "name": "FoamEnd"
    },
    "3521712495": {
        "hash": 3521712495,
        "name": "SpecGlow"
    },
    "3527777912": {
        "hash": 3527777912,
        "name": "FullscreenEffectID"
    },
    "3541173418": {
        "hash": 3541173418,
        "name": "DisplayTint"
    },
    "3548030554": {
        "hash": 3548030554,
        "name": "TexScrollU2"
    },
    "3560254360": {
        "hash": 3560254360,
        "name": "HoloEdge"
    },
    "3562514005": {
        "hash": 3562514005,
        "name": "FoamColor"
    },
    "3579437073": {
        "hash": 3579437073,
        "name": "OutsideSpecular"
    },
    "3586595067": {
        "hash": 3586595067,
        "name": "CloudAnimationOffsetU"
    },
    "3587560606": {
        "hash": 3587560606,
        "name": "SpotLightFalloffPower"
    },
    "3597561950": {
        "hash": 3597561950,
        "name": "DirectionalLightViewSpaceDirection"
    },
    "3601534683": {
        "hash": 3601534683,
        "name": "LowEnd"
    },
    "3602518425": {
        "hash": 3602518425,
        "name": "Emissive"
    },
    "3609974549": {
        "hash": 3609974549,
        "name": "LensDirtNoiseScaleStr"
    },
    "3629741812": {
        "hash": 3629741812,
        "name": "TexScrollX2"
    },
    "3649488835": {
        "hash": 3649488835,
        "name": "Glow"
    },
    "3670538597": {
        "hash": 3670538597,
        "name": "DetailSelectB"
    },
    "3682661672": {
        "hash": 3682661672,
        "name": "ZBuffer"
    },
    "3689916969": {
        "hash": 3689916969,
        "name": "StratusCloudTiling"
    },
    "3690698216": {
        "hash": 3690698216,
        "name": "Scroll2_U"
    },
    "3697604236": {
        "hash": 3697604236,
        "name": "SunGlare"
    },
    "3701654512": {
        "hash": 3701654512,
        "name": "SpotLightTransform"
    },
    "3705094652": {
        "hash": 3705094652,
        "name": "UVsPerMeter1"
    },
    "3717488815": {
        "hash": 3717488815,
        "name": "Metallic"
    },
    "3724540413": {
        "hash": 3724540413,
        "name": "LensEffectsEnabled"
    },
    "3732755125": {
        "hash": 3732755125,
        "name": "AOStrength"
    },
    "3734673659": {
        "hash": 3734673659,
        "name": "DetailFrequency"
    },
    "3741760691": {
        "hash": 3741760691,
        "name": "LPVBlueCoeff"
    },
    "3747341398": {
        "hash": 3747341398,
        "name": "Center"
    },
    "3747452981": {
        "hash": 3747452981,
        "name": "DirectionalLightColor"
    },
    "3753358084": {
        "hash": 3753358084,
        "name": "ParticleNormalTexture"
    },
    "3753722660": {
        "hash": 3753722660,
        "name": "PixelShaderIndex"
    },
    "3757180001": {
        "hash": 3757180001,
        "name": "CloudSilverLiningBrightness"
    },
    "3762586818": {
        "hash": 3762586818,
        "name": "TexScrollZ2"
    },
    "3779105323": {
        "hash": 3779105323,
        "name": "TimeStep"
    },
    "3782350014": {
        "hash": 3782350014,
        "name": "HoloNoise"
    },
    "3782900054": {
        "hash": 3782900054,
        "name": "ParticleCameraEye"
    },
    "3801659787": {
        "hash": 3801659787,
        "name": "DamageB"
    },
    "3804260851": {
        "hash": 3804260851,
        "name": "GradingHighlightSaturation"
    },
    "3826843216": {
        "hash": 3826843216,
        "name": "Accumulate"
    },
    "3831575631": {
        "hash": 3831575631,
        "name": "DecalTintScale"
    },
    "3837499429": {
        "hash": 3837499429,
        "name": "GradingHighlightDomain"
    },
    "3844378250": {
        "hash": 3844378250,
        "name": "TexScrollZ3"
    },
    "3855831464": {
        "hash": 3855831464,
        "name": "SkyRenderMode"
    },
    "3863846253": {
        "hash": 3863846253,
        "name": "Stage"
    },
    "3891897073": {
        "hash": 3891897073,
        "name": "SourceMipLevel"
    },
    "3893147154": {
        "hash": 3893147154,
        "name": "SurfaceScale"
    },
    "3920245061": {
        "hash": 3920245061,
        "name": "Scroll2_V"
    },
    "3920460045": {
        "hash": 3920460045,
        "name": "auNoiseBoilSpeed"
    },
    "3927377464": {
        "hash": 3927377464,
        "name": "FogShadowsEnable"
    },
    "3932593778": {
        "hash": 3932593778,
        "name": "_FarClip"
    },
    "3934862692": {
        "hash": 3934862692,
        "name": "PhotoMode"
    },
    "3936184964": {
        "hash": 3936184964,
        "name": "GlowMin"
    },
    "3936513778": {
        "hash": 3936513778,
        "name": "ScrollV"
    },
    "3939972092": {
        "hash": 3939972092,
        "name": "Albedo"
    },
    "3946418532": {
        "hash": 3946418532,
        "name": "TurbulenceScale"
    },
    "3953235236": {
        "hash": 3953235236,
        "name": "DistortionColor"
    },
    "3955012390": {
        "hash": 3955012390,
        "name": "Boost2"
    },
    "3956558225": {
        "hash": 3956558225,
        "name": "BackFaceFadeDis"
    },
    "3958620885": {
        "hash": 3958620885,
        "name": "_RenderLevel"
    },
    "3963343045": {
        "hash": 3963343045,
        "name": "ShieldBGColor"
    },
    "3972784385": {
        "hash": 3972784385,
        "name": "ShadowDepthScales"
    },
    "3989194025": {
        "hash": 3989194025,
        "name": "DecalTint"
    },
    "3989833438": {
        "hash": 3989833438,
        "name": "TextureDistortion"
    },
    "3991981851": {
        "hash": 3991981851,
        "name": "AScroll3_V"
    },
    "4012988087": {
        "hash": 4012988087,
        "name": "ThermalViewRange"
    },
    "4020136403": {
        "hash": 4020136403,
        "name": "ThermalColor"
    },
    "4020273094": {
        "hash": 4020273094,
        "name": "ShadowDepthOffsets"
    },
    "4024030221": {
        "hash": 4024030221,
        "name": "DamageA"
    },
    "4038036976": {
        "hash": 4038036976,
        "name": "auNoiseScale"
    },
    "4038660216": {
        "hash": 4038660216,
        "name": "_Projection"
    },
    "4043897772": {
        "hash": 4043897772,
        "name": "auBlackShiftStrength"
    },
    "4046103935": {
        "hash": 4046103935,
        "name": "ParticleWorldViewInverse"
    },
    "4054762574": {
        "hash": 4054762574,
        "name": "GradingBrightness"
    },
    "4063408707": {
        "hash": 4063408707,
        "name": "ScreenDirtTex"
    },
    "4070181178": {
        "hash": 4070181178,
        "name": "TexScale3"
    },
    "4072977514": {
        "hash": 4072977514,
        "name": "BackgroundAlpha"
    },
    "4076514358": {
        "hash": 4076514358,
        "name": "TexScrollX1"
    },
    "4094034361": {
        "hash": 4094034361,
        "name": "ScrollX"
    },
    "4094805005": {
        "hash": 4094805005,
        "name": "auSmoothnessMax"
    },
    "4100226455": {
        "hash": 4100226455,
        "name": "Horizontal"
    },
    "4123744776": {
        "hash": 4123744776,
        "name": "Noise"
    },
    "4125759813": {
        "hash": 4125759813,
        "name": "InfraRedColor"
    },
    "4143535303": {
        "hash": 4143535303,
        "name": "ClearScreen"
    },
    "4153721702": {
        "hash": 4153721702,
        "name": "MotionBlurEnable"
    },
    "4159847582": {
        "hash": 4159847582,
        "name": "wave"
    },
    "4167245976": {
        "hash": 4167245976,
        "name": "Hottness"
    },
    "4169328203": {
        "hash": 4169328203,
        "name": "detailBump"
    },
    "4177877784": {
        "hash": 4177877784,
        "name": "SpecB"
    },
    "4188199334": {
        "hash": 4188199334,
        "name": "ShieldPattern"
    },
    "4195744937": {
        "hash": 4195744937,
        "name": "FinalTierShadowMap"
    },
    "4198915509": {
        "hash": 4198915509,
        "name": "Scattering"
    },
    "4203282623": {
        "hash": 4203282623,
        "name": "HoloScanSpeed"
    },
    "4217613941": {
        "hash": 4217613941,
        "name": "OverlaySmoothing"
    },
    "4230376326": {
        "hash": 4230376326,
        "name": "AScroll3_U"
    },
    "4231432150": {
        "hash": 4231432150,
        "name": "RSMDepth"
    },
    "4234668096": {
        "hash": 4234668096,
        "name": "ShowTilingTint"
    },
    "4238601221": {
        "hash": 4238601221,
        "name": "TilingScaleB"
    },
    "4248356835": {
        "hash": 4248356835,
        "name": "RedDot"
    },
    "4249685819": {
        "hash": 4249685819,
        "name": "BacksideDesat"
    },
    "4265284763": {
        "hash": 4265284763,
        "name": "ScaleMin"
    },
    "4274278633": {
        "hash": 4274278633,
        "name": "ColorMapTiling"
    },
    "4294455213": {
        "hash": 4294455213,
        "name": "GlowMax"
    }
};
},{}],11:[function(require,module,exports){
var data = {
    "inputLayouts": {
        "90817248": {
            "name": "ForceField",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "173506283": {
            "name": "StructureTint",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "243000745": {
            "name": "StructureDecal",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                }
            ]
        },
        "245772489": {
            "name": "StructureWsOverlay",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                }
            ]
        },
        "254172489": {
            "name": "SimpleSpriteParticleEmitter",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "334609369": {
            "name": "DebugCharacter",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "BlendWeight",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "BlendIndices",
                    "usageIndex": 0
                }
            ]
        },
        "423840463": {
            "name": "TerrainLod0",
            "entries": [
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "531845011": {
            "name": "Terrain",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                }
            ]
        },
        "531868208": {
            "name": "TrunkInstanced",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 5
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 6
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 7
                }
            ]
        },
        "767389887": {
            "name": "SimpleEmissive",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "769129528": {
            "name": "BumpRigidInstanced",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 7
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 8
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 9
                }
            ]
        },
        "802296468": {
            "name": "ProjDecal",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 2
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 3
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 4
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 5
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 6
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "834727078": {
            "name": "Trunk",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "966252751": {
            "name": "Color",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "1126687488": {
            "name": "TrunkSmallInstanced",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 5
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 6
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 7
                }
            ]
        },
        "1137153491": {
            "name": "TrailParticleEmitter",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "1146570003": {
            "name": "Foliage",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "1152478178": {
            "name": "NULL",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                }
            ]
        },
        "1177289183": {
            "name": "ApexStreakParticle",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "1210427131": {
            "name": "POS_TEX",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "1376127051": {
            "name": "BumpUVRigid",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "1378921026": {
            "name": "DebugObject",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                }
            ]
        },
        "1404200969": {
            "name": "Object",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Position",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "1411770951": {
            "name": "ApexDistortParticle",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "1481035626": {
            "name": "FloraModel",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "1572937949": {
            "name": "POS_TEX2",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                }
            ]
        },
        "1796081103": {
            "name": "TwoSided",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                }
            ]
        },
        "1812334699": {
            "name": "BumpRigid",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "1862833192": {
            "name": "NewSatellite",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "1886287349": {
            "name": "Vehicle_PS",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 0,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "1964036909": {
            "name": "Billboard",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "2025203475": {
            "name": "TankTread",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "BlendWeight",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "BlendIndices",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "2201291178": {
            "name": "Character",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "BlendWeight",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "BlendIndices",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "2247694445": {
            "name": "FloraModelInstanced",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Texcoord",
                    "usageIndex": 3
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Texcoord",
                    "usageIndex": 4
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "2262124626": {
            "name": "FoliageInstanced",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 5
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 6
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 7
                }
            ]
        },
        "2270832967": {
            "name": "DebugText",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                }
            ]
        },
        "2323836525": {
            "name": "TexProj",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 2
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 3
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "2340912194": {
            "name": "Vehicle",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "2345275899": {
            "name": "BeamParticle",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 0,
                    "type": "Float1",
                    "usage": "Texcoord",
                    "usageIndex": 2
                },
                {
                    "stream": 0,
                    "type": "Float1",
                    "usage": "Texcoord",
                    "usageIndex": 3
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "2349434977": {
            "name": "ObjectInstanced",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Position",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 7
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 8
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 9
                }
            ]
        },
        "2429726609": {
            "name": "Position",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                }
            ]
        },
        "2599425051": {
            "name": "Flora",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float1",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 1
                }
            ]
        },
        "2604346521": {
            "name": "Post",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float4",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "2755820384": {
            "name": "CharacterRigid_PS",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 0,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "2770739567": {
            "name": "TwoSidedInstanced",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 7
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 8
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 9
                }
            ]
        },
        "2834771953": {
            "name": "BumpUVSkin",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "BlendWeight",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "BlendIndices",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "2842446026": {
            "name": "TerrainLod",
            "entries": [
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Texcoord",
                    "usageIndex": 1
                }
            ]
        },
        "2967190797": {
            "name": "Designer",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 0
                }
            ]
        },
        "3017051536": {
            "name": "DebugVehicle",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                }
            ]
        },
        "3089542856": {
            "name": "CharacterRigid",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "3107888304": {
            "name": "StructureDecalInstanced",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 7
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 8
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 9
                }
            ]
        },
        "3190426463": {
            "name": "ToolPrimitive3D",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "3307287772": {
            "name": "StructureInstanced",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 7
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 8
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 9
                }
            ]
        },
        "3332082136": {
            "name": "FontPrimitive",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short4",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short4",
                    "usage": "Texcoord",
                    "usageIndex": 1
                }
            ]
        },
        "3379601684": {
            "name": "TrunkSmall",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "3411489880": {
            "name": "DesignerInstanced",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 7
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 8
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 9
                }
            ]
        },
        "3482317509": {
            "name": "Character_PS",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "BlendWeight",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "BlendIndices",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 0,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "3649488835": {
            "name": "Glow",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "3731096925": {
            "name": "Structure",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 1,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        },
        "3736651547": {
            "name": "Object_PS",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                }
            ]
        },
        "3818339827": {
            "name": "BumpUVInstanced",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 2,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 2,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                },
                {
                    "stream": 2,
                    "type": "D3dcolor",
                    "usage": "Texcoord",
                    "usageIndex": 3
                },
                {
                    "stream": 2,
                    "type": "D3dcolor",
                    "usage": "Texcoord",
                    "usageIndex": 4
                },
                {
                    "stream": 2,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "3830752803": {
            "name": "StreakParticle",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                },
                {
                    "stream": 0,
                    "type": "Float1",
                    "usage": "Texcoord",
                    "usageIndex": 3
                },
                {
                    "stream": 0,
                    "type": "Float1",
                    "usage": "Texcoord",
                    "usageIndex": 4
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Texcoord",
                    "usageIndex": 5
                }
            ]
        },
        "3838484911": {
            "name": "SpriteParticle",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 2
                },
                {
                    "stream": 0,
                    "type": "Float1",
                    "usage": "Texcoord",
                    "usageIndex": 3
                },
                {
                    "stream": 0,
                    "type": "Float1",
                    "usage": "Texcoord",
                    "usageIndex": 4
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                }
            ]
        },
        "3968947403": {
            "name": "ColorUV",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "4034975963": {
            "name": "ApexSpriteParticle",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Short2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "4117341949": {
            "name": "POS_TEX2_SKINWEIGHTS",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "BlendWeight",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "BlendIndices",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                }
            ]
        },
        "4168049464": {
            "name": "POS_TEX2_SKINBONE",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 1
                }
            ]
        },
        "4245025320": {
            "name": "BumpRigid_PS",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Tangent",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Binormal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "ubyte4n",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "float16_2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "4267143044": {
            "name": "ClrNrmUV",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float3",
                    "usage": "Normal",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 1,
                    "type": "Float2",
                    "usage": "Texcoord",
                    "usageIndex": 0
                }
            ]
        },
        "4285919832": {
            "name": "SpriteParticleEmitter",
            "entries": [
                {
                    "stream": 0,
                    "type": "Float3",
                    "usage": "Position",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "D3dcolor",
                    "usage": "Color",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 0
                },
                {
                    "stream": 0,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 1
                },
                {
                    "stream": 0,
                    "type": "Float4",
                    "usage": "Texcoord",
                    "usageIndex": 2
                }
            ]
        }
    },
    "materialDefinitions": {
        "18883829": {
            "name": "BumpRigidHologram2SidedBlend",
            "hash": 18883829,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "BumpRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "BumpRigid"
                }
            ]
        },
        "59309762": {
            "name": "VehicleRigid_PS",
            "hash": 59309762,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "89017642": {
            "name": "ForceField_planar_volatile",
            "hash": 89017642,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "ForceField"
                }
            ]
        },
        "89888680": {
            "name": "ObjectGlass",
            "hash": 89888680,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Object"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Object"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Object"
                }
            ]
        },
        "90817248": {
            "name": "ForceField",
            "hash": 90817248,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "ForceField"
                }
            ]
        },
        "111503435": {
            "name": "SimpleSpriteParticleEmitterDistortion",
            "hash": 111503435,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "SimpleSpriteParticleEmitter"
                }
            ]
        },
        "173506283": {
            "name": "StructureTint",
            "hash": 173506283,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "StructureTint"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "StructureTint"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "StructureTint"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "StructureTint"
                }
            ]
        },
        "204902162": {
            "name": "ShadowResolve",
            "hash": 204902162,
            "drawStyles": [
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Post"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Post"
                }
            ]
        },
        "213484339": {
            "name": "Water",
            "hash": 213484339,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "PreLight",
                    "hash": 779518622,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "VolumeDepth",
                    "hash": 2780244784,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "MiniMap",
                    "hash": 2008845393,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "ClrNrmUV"
                }
            ]
        },
        "221567923": {
            "name": "VehicleRigid",
            "hash": 221567923,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "242538771": {
            "name": "DownsampleDepth",
            "hash": 242538771,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "243000745": {
            "name": "StructureDecal",
            "hash": 243000745,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "StructureDecal"
                }
            ]
        },
        "245772489": {
            "name": "StructureWsOverlay",
            "hash": 245772489,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "StructureWsOverlay"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "StructureWsOverlay"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "StructureWsOverlay"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "StructureWsOverlay"
                }
            ]
        },
        "249329406": {
            "name": "Terrain3Layer",
            "hash": 249329406,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Terrain"
                }
            ]
        },
        "254172489": {
            "name": "SimpleSpriteParticleEmitter",
            "hash": 254172489,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SimpleSpriteParticleEmitter"
                }
            ]
        },
        "345501329": {
            "name": "SpotLight",
            "hash": 345501329,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Position"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Position"
                }
            ]
        },
        "366230682": {
            "name": "SimpleSpriteParticleEmitterFullRes",
            "hash": 366230682,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SimpleSpriteParticleEmitter"
                }
            ]
        },
        "383452058": {
            "name": "DepthToAlpha",
            "hash": 383452058,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "473264099": {
            "name": "AuraxiumSkinned",
            "hash": 473264099,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Character"
                }
            ]
        },
        "481751439": {
            "name": "Terrain2LayerLod",
            "hash": 481751439,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "Audit",
                    "hash": 913674268,
                    "inputLayout": "TerrainLod0"
                }
            ]
        },
        "514249047": {
            "name": "EnvFilter",
            "hash": 514249047,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "531868208": {
            "name": "TrunkInstanced",
            "hash": 531868208,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TrunkInstanced"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TrunkInstanced"
                }
            ]
        },
        "542470067": {
            "name": "DebugVehicleTranslucent",
            "hash": 542470067,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "DebugVehicle"
                }
            ]
        },
        "568603865": {
            "name": "BloomBlur",
            "hash": 568603865,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "576155039": {
            "name": "PointLight",
            "hash": 576155039,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        },
        "598034436": {
            "name": "PrimitivePseudo3DTexture",
            "hash": 598034436,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Billboard"
                }
            ]
        },
        "613500470": {
            "name": "CharacterHologram",
            "hash": 613500470,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Character"
                }
            ]
        },
        "631102208": {
            "name": "SimpleSpriteParticleEmitterFillVisualization",
            "hash": 631102208,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SimpleSpriteParticleEmitter"
                }
            ]
        },
        "633869401": {
            "name": "AuraxiumVehicleRigidDeRes",
            "hash": 633869401,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "660246097": {
            "name": "Terrain2Layer",
            "hash": 660246097,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Terrain"
                }
            ]
        },
        "717111872": {
            "name": "AuraxiumRigid",
            "hash": 717111872,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "CharacterRigid"
                }
            ]
        },
        "748543065": {
            "name": "RainbowRadial",
            "hash": 748543065,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "767389887": {
            "name": "SimpleEmissive",
            "hash": 767389887,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SimpleEmissive"
                }
            ]
        },
        "769129528": {
            "name": "BumpRigidInstanced",
            "hash": 769129528,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "BumpRigidInstanced"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "BumpRigidInstanced"
                }
            ]
        },
        "791354219": {
            "name": "SpriteParticleEmitterDistortion",
            "hash": 791354219,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "SpriteParticleEmitter"
                }
            ]
        },
        "795248974": {
            "name": "CloudBlend",
            "hash": 795248974,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ColorUV"
                }
            ]
        },
        "798127786": {
            "name": "CompositeParticles",
            "hash": 798127786,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "802296468": {
            "name": "ProjDecal",
            "hash": 802296468,
            "drawStyles": [
                {
                    "name": "Color",
                    "hash": 966252751,
                    "inputLayout": "ProjDecal"
                },
                {
                    "name": "Copy",
                    "hash": 443306034,
                    "inputLayout": "ProjDecal"
                },
                {
                    "name": "Clear",
                    "hash": 2476114399,
                    "inputLayout": "ProjDecal"
                },
                {
                    "name": "Lighting",
                    "hash": 3311936139,
                    "inputLayout": "ProjDecal"
                }
            ]
        },
        "822435615": {
            "name": "GroundFog",
            "hash": 822435615,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Object"
                }
            ]
        },
        "834727078": {
            "name": "Trunk",
            "hash": 834727078,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Trunk"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Trunk"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Trunk"
                }
            ]
        },
        "856431645": {
            "name": "SpriteParticleEmitterFillVisualizationFullRes",
            "hash": 856431645,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SpriteParticleEmitter"
                }
            ]
        },
        "915556636": {
            "name": "DistortParticle",
            "hash": 915556636,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "SpriteParticle"
                }
            ]
        },
        "920662136": {
            "name": "SkyMesh",
            "hash": 920662136,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ColorUV"
                }
            ]
        },
        "929593841": {
            "name": "BumpRigidHologram2Sided",
            "hash": 929593841,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "BumpRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "BumpRigid"
                }
            ]
        },
        "992931545": {
            "name": "ApplyDistortion",
            "hash": 992931545,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "1005861253": {
            "name": "Primitive2DLinearRGB",
            "hash": 1005861253,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ColorUV"
                }
            ]
        },
        "1019750740": {
            "name": "VehicleGlassDeRes",
            "hash": 1019750740,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "1050969618": {
            "name": "AuraxiumCharacterDeRes",
            "hash": 1050969618,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Character"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Character"
                }
            ]
        },
        "1060696129": {
            "name": "ObjectStealth",
            "hash": 1060696129,
            "drawStyles": [
                {
                    "name": "Opaque",
                    "hash": 285068596,
                    "inputLayout": "Object"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Object"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Object"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "Object"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Object"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Object"
                }
            ]
        },
        "1100359941": {
            "name": "Terrain4LayerLod",
            "hash": 1100359941,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "Audit",
                    "hash": 913674268,
                    "inputLayout": "TerrainLod0"
                }
            ]
        },
        "1126687488": {
            "name": "TrunkSmallInstanced",
            "hash": 1126687488,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TrunkSmallInstanced"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TrunkSmallInstanced"
                }
            ]
        },
        "1137153491": {
            "name": "TrailParticleEmitter",
            "hash": 1137153491,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TrailParticleEmitter"
                }
            ]
        },
        "1146570003": {
            "name": "Foliage",
            "hash": 1146570003,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Foliage"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Foliage"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Foliage"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Foliage"
                }
            ]
        },
        "1177289183": {
            "name": "ApexStreakParticle",
            "hash": 1177289183,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ApexStreakParticle"
                }
            ]
        },
        "1203951042": {
            "name": "TrailParticleEmitterDistortion",
            "hash": 1203951042,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "TrailParticleEmitter"
                }
            ]
        },
        "1209473230": {
            "name": "Primitive2D",
            "hash": 1209473230,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Color"
                }
            ]
        },
        "1221965395": {
            "name": "FogLowEnd",
            "hash": 1221965395,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        },
        "1245836432": {
            "name": "DarkSpotLight",
            "hash": 1245836432,
            "drawStyles": [
                {
                    "name": "DistortionLight",
                    "hash": 2855118449,
                    "inputLayout": "Position"
                }
            ]
        },
        "1286717095": {
            "name": "SunSatellite",
            "hash": 1286717095,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "NewSatellite"
                }
            ]
        },
        "1307830056": {
            "name": "SpriteParticleEmitterFillVisualization",
            "hash": 1307830056,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SpriteParticleEmitter"
                }
            ]
        },
        "1315802934": {
            "name": "Threshold",
            "hash": 1315802934,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "1329642553": {
            "name": "Skin",
            "hash": 1329642553,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Character"
                }
            ]
        },
        "1335386793": {
            "name": "ShadowProjector",
            "hash": 1335386793,
            "drawStyles": [
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Position"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Position"
                }
            ]
        },
        "1354477071": {
            "name": "BumpRigidHologram",
            "hash": 1354477071,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "BumpRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "BumpRigid"
                }
            ]
        },
        "1358245446": {
            "name": "ParticlePCFShadows",
            "hash": 1358245446,
            "drawStyles": [
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Post"
                }
            ]
        },
        "1362107991": {
            "name": "CompositeEnv",
            "hash": 1362107991,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "1404200969": {
            "name": "Object",
            "hash": 1404200969,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Object"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Object"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Object"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Object"
                }
            ]
        },
        "1406210118": {
            "name": "CharacterDeRes",
            "hash": 1406210118,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Character"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Character"
                }
            ]
        },
        "1427420282": {
            "name": "SkyHorizon",
            "hash": 1427420282,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ColorUV"
                }
            ]
        },
        "1443614995": {
            "name": "ScreenFrameUI",
            "hash": 1443614995,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "1444361906": {
            "name": "StructureBlend",
            "hash": 1444361906,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Structure"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Structure"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Structure"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Structure"
                }
            ]
        },
        "1446133117": {
            "name": "LensEffects",
            "hash": 1446133117,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "1481023092": {
            "name": "TileQuad",
            "hash": 1481023092,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "1481035626": {
            "name": "FloraModel",
            "hash": 1481035626,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "FloraModel"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "FloraModel"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "FloraModel"
                }
            ]
        },
        "1482128443": {
            "name": "AuraxiumCharacterRigidStealth",
            "hash": 1482128443,
            "drawStyles": [
                {
                    "name": "Opaque",
                    "hash": 285068596,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "DistortionLight",
                    "hash": 2855118449,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "CharacterRigid"
                }
            ]
        },
        "1508194750": {
            "name": "SkyBox",
            "hash": 1508194750,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ColorUV"
                }
            ]
        },
        "1520785578": {
            "name": "AuraxiumCharacterRigid",
            "hash": 1520785578,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "CharacterRigid"
                }
            ]
        },
        "1569447668": {
            "name": "RiverWater",
            "hash": 1569447668,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "PreLight",
                    "hash": 779518622,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "VolumeDepth",
                    "hash": 2780244784,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "MiniMap",
                    "hash": 2008845393,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "ClrNrmUV"
                }
            ]
        },
        "1574422996": {
            "name": "ToolPrimitive3DWithSky",
            "hash": 1574422996,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ToolPrimitive3D"
                }
            ]
        },
        "1576736357": {
            "name": "XRayGrid",
            "hash": 1576736357,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Post"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Post"
                }
            ]
        },
        "1592526775": {
            "name": "CylindricalWarp",
            "hash": 1592526775,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "1601597413": {
            "name": "VehicleGlass",
            "hash": 1601597413,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "1609724772": {
            "name": "Cloud",
            "hash": 1609724772,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ColorUV"
                }
            ]
        },
        "1614727238": {
            "name": "Blur",
            "hash": 1614727238,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "1692412075": {
            "name": "CompositeSky",
            "hash": 1692412075,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        },
        "1739471311": {
            "name": "FontPrimitiveScreenSpace",
            "hash": 1739471311,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "FontPrimitive"
                }
            ]
        },
        "1796081103": {
            "name": "TwoSided",
            "hash": 1796081103,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TwoSided"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TwoSided"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "TwoSided"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "TwoSided"
                }
            ]
        },
        "1797086351": {
            "name": "StructureSkinned",
            "hash": 1797086351,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Structure"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Structure"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Structure"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Structure"
                }
            ]
        },
        "1812334699": {
            "name": "BumpRigid",
            "hash": 1812334699,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "BumpRigid"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "BumpRigid"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "BumpRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "BumpRigid"
                }
            ]
        },
        "1818418870": {
            "name": "VehicleRigidDeRes",
            "hash": 1818418870,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "1841058888": {
            "name": "Primitive3DNoZ",
            "hash": 1841058888,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Color"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Color"
                }
            ]
        },
        "1862833192": {
            "name": "NewSatellite",
            "hash": 1862833192,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "NewSatellite"
                }
            ]
        },
        "1886287349": {
            "name": "Vehicle_PS",
            "hash": 1886287349,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle_PS"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "1904070111": {
            "name": "BumpSkinStealth",
            "hash": 1904070111,
            "drawStyles": [
                {
                    "name": "Opaque",
                    "hash": 285068596,
                    "inputLayout": "BumpUVSkin"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "BumpUVSkin"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "BumpUVSkin"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "BumpUVSkin"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "BumpUVSkin"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "BumpUVSkin"
                }
            ]
        },
        "1914858105": {
            "name": "BumpSkinDeRes",
            "hash": 1914858105,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "BumpUVSkin"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "BumpUVSkin"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "BumpUVSkin"
                }
            ]
        },
        "1927697331": {
            "name": "VehicleHologram",
            "hash": 1927697331,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "1966231512": {
            "name": "HalfResStreakParticle",
            "hash": 1966231512,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "StreakParticle"
                }
            ]
        },
        "1979751012": {
            "name": "GlowBlend2TextureTintSkin",
            "hash": 1979751012,
            "drawStyles": [
                {
                    "name": "PreParticleGlow",
                    "hash": 1852032819,
                    "inputLayout": "POS_TEX2_SKINWEIGHTS"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "POS_TEX2_SKINWEIGHTS"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "POS_TEX2_SKINWEIGHTS"
                }
            ]
        },
        "1989508334": {
            "name": "ForceFieldSolid",
            "hash": 1989508334,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "ForceField"
                }
            ]
        },
        "1991718926": {
            "name": "FoliageGlowScrollInstanced",
            "hash": 1991718926,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "FoliageInstanced"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "FoliageInstanced"
                }
            ]
        },
        "1996275104": {
            "name": "TrailParticleEmitterFillVisualization",
            "hash": 1996275104,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TrailParticleEmitter"
                }
            ]
        },
        "2012178701": {
            "name": "SwampWater",
            "hash": 2012178701,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "PreLight",
                    "hash": 779518622,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "VolumeDepth",
                    "hash": 2780244784,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "MiniMap",
                    "hash": 2008845393,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "ClrNrmUV"
                }
            ]
        },
        "2016737833": {
            "name": "Primitive3D",
            "hash": 2016737833,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Color"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Color"
                }
            ]
        },
        "2017562226": {
            "name": "AuraxiumVehicleDeRes",
            "hash": 2017562226,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "2025203475": {
            "name": "TankTread",
            "hash": 2025203475,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TankTread"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TankTread"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "TankTread"
                }
            ]
        },
        "2027486070": {
            "name": "Terrain4Layer",
            "hash": 2027486070,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Terrain"
                }
            ]
        },
        "2030951930": {
            "name": "StructureSnow",
            "hash": 2030951930,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Structure"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Structure"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Structure"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Structure"
                }
            ]
        },
        "2073217188": {
            "name": "RedDotEmissiveCenterScreen",
            "hash": 2073217188,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Post"
                }
            ]
        },
        "2083872866": {
            "name": "SimpleSpriteParticleEmitterFillVisualizationFullRes",
            "hash": 2083872866,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SimpleSpriteParticleEmitter"
                }
            ]
        },
        "2087128709": {
            "name": "Primitive2DTexture",
            "hash": 2087128709,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ColorUV"
                }
            ]
        },
        "2088204915": {
            "name": "OcclusionModel",
            "hash": 2088204915,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        },
        "2102996721": {
            "name": "SkyMask",
            "hash": 2102996721,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "2125989967": {
            "name": "DistortionFixup",
            "hash": 2125989967,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "2162138799": {
            "name": "AuraxiumCharacterStealth",
            "hash": 2162138799,
            "drawStyles": [
                {
                    "name": "Opaque",
                    "hash": 285068596,
                    "inputLayout": "Character"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Character"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Character"
                },
                {
                    "name": "DistortionLight",
                    "hash": 2855118449,
                    "inputLayout": "Character"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Character"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Character"
                }
            ]
        },
        "2183981593": {
            "name": "Terrain5Layer",
            "hash": 2183981593,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Terrain"
                }
            ]
        },
        "2201291178": {
            "name": "Character",
            "hash": 2201291178,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Character"
                }
            ]
        },
        "2205861757": {
            "name": "AuraxiumVehicleRigidStealth",
            "hash": 2205861757,
            "drawStyles": [
                {
                    "name": "Opaque",
                    "hash": 285068596,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "LameGlow",
                    "hash": 2366808256,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "DistortionLight",
                    "hash": 2855118449,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "2224693156": {
            "name": "LPVInjection_Debug",
            "hash": 2224693156,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        },
        "2246450987": {
            "name": "AdditiveGlow",
            "hash": 2246450987,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Glow"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Glow"
                }
            ]
        },
        "2247694445": {
            "name": "FloraModelInstanced",
            "hash": 2247694445,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "FloraModelInstanced"
                }
            ]
        },
        "2252849346": {
            "name": "SmartBlur",
            "hash": 2252849346,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "2262124626": {
            "name": "FoliageInstanced",
            "hash": 2262124626,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "FoliageInstanced"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "FoliageInstanced"
                }
            ]
        },
        "2266494919": {
            "name": "Primitive2DTexture2",
            "hash": 2266494919,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ColorUV"
                }
            ]
        },
        "2270832967": {
            "name": "DebugText",
            "hash": 2270832967,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "DebugText"
                }
            ]
        },
        "2296127135": {
            "name": "VehicleShield",
            "hash": 2296127135,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "2322489728": {
            "name": "AmbientOcclusionUpsample",
            "hash": 2322489728,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "2340912194": {
            "name": "Vehicle",
            "hash": 2340912194,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "2345275899": {
            "name": "BeamParticle",
            "hash": 2345275899,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "BeamParticle"
                }
            ]
        },
        "2348897854": {
            "name": "ToolPrimitive3DNoZTest",
            "hash": 2348897854,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ToolPrimitive3D"
                }
            ]
        },
        "2349434977": {
            "name": "ObjectInstanced",
            "hash": 2349434977,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ObjectInstanced"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "ObjectInstanced"
                }
            ]
        },
        "2362527505": {
            "name": "TankTreadStealth",
            "hash": 2362527505,
            "drawStyles": [
                {
                    "name": "Opaque",
                    "hash": 285068596,
                    "inputLayout": "TankTread"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TankTread"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "TankTread"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "TankTread"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TankTread"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "TankTread"
                }
            ]
        },
        "2387972533": {
            "name": "PostProcessLowEnd",
            "hash": 2387972533,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                },
                {
                    "name": "Resolve",
                    "hash": 1812932878,
                    "inputLayout": "Position"
                }
            ]
        },
        "2408701019": {
            "name": "TrailParticleEmitterFullRes",
            "hash": 2408701019,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TrailParticleEmitter"
                }
            ]
        },
        "2456105737": {
            "name": "AuraxiumVehicle",
            "hash": 2456105737,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "2481186467": {
            "name": "StreamWater",
            "hash": 2481186467,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Object"
                },
                {
                    "name": "PreLight",
                    "hash": 779518622,
                    "inputLayout": "Object"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "Object"
                },
                {
                    "name": "VolumeDepth",
                    "hash": 2780244784,
                    "inputLayout": "Object"
                },
                {
                    "name": "MiniMap",
                    "hash": 2008845393,
                    "inputLayout": "Object"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Object"
                }
            ]
        },
        "2491627686": {
            "name": "BumpRigidHologram2SidedBlendInstanced",
            "hash": 2491627686,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "BumpRigidInstanced"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "BumpRigidInstanced"
                }
            ]
        },
        "2497757564": {
            "name": "SkinnedLODs",
            "hash": 2497757564,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "DebugCharacter"
                }
            ]
        },
        "2499637446": {
            "name": "BumpSkinShield",
            "hash": 2499637446,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "BumpUVSkin"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "BumpUVSkin"
                }
            ]
        },
        "2512920526": {
            "name": "ModelInstanced",
            "hash": 2512920526,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "BumpUVInstanced"
                }
            ]
        },
        "2536750071": {
            "name": "DebugObjectTranslucent",
            "hash": 2536750071,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "DebugObject"
                }
            ]
        },
        "2563506627": {
            "name": "Lava",
            "hash": 2563506627,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Structure"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Structure"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Structure"
                }
            ]
        },
        "2574080545": {
            "name": "Bloom",
            "hash": 2574080545,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "2594400110": {
            "name": "BumpRigidHologram2S",
            "hash": 2594400110,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "BumpRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "BumpRigid"
                }
            ]
        },
        "2599425051": {
            "name": "Flora",
            "hash": 2599425051,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Flora"
                }
            ]
        },
        "2599495528": {
            "name": "LPVInjection_RSM_Color",
            "hash": 2599495528,
            "drawStyles": [
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Position"
                }
            ]
        },
        "2607188219": {
            "name": "AuraxiumCharacter",
            "hash": 2607188219,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Character"
                }
            ]
        },
        "2626981140": {
            "name": "Tracer",
            "hash": 2626981140,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SimpleEmissive"
                }
            ]
        },
        "2637940519": {
            "name": "SkinDeRes",
            "hash": 2637940519,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Character"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Character"
                }
            ]
        },
        "2647850544": {
            "name": "AuraxiumVehicleStealth",
            "hash": 2647850544,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Opaque",
                    "hash": 285068596,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "LameGlow",
                    "hash": 2366808256,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "DistortionLight",
                    "hash": 2855118449,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "2698712273": {
            "name": "LPVInjection_RSM_Geo",
            "hash": 2698712273,
            "drawStyles": [
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Position"
                }
            ]
        },
        "2721741996": {
            "name": "FullResSpriteParticle",
            "hash": 2721741996,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SpriteParticle"
                }
            ]
        },
        "2755820384": {
            "name": "CharacterRigid_PS",
            "hash": 2755820384,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "CharacterRigid_PS"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "CharacterRigid"
                }
            ]
        },
        "2766639026": {
            "name": "SpriteParticleEmitterFullRes",
            "hash": 2766639026,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SpriteParticleEmitter"
                }
            ]
        },
        "2770739567": {
            "name": "TwoSidedInstanced",
            "hash": 2770739567,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TwoSidedInstanced"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TwoSidedInstanced"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "TwoSidedInstanced"
                }
            ]
        },
        "2831708068": {
            "name": "Terrain5LayerLod",
            "hash": 2831708068,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "Audit",
                    "hash": 913674268,
                    "inputLayout": "TerrainLod0"
                }
            ]
        },
        "2853575090": {
            "name": "GlowBlend2TextureTint",
            "hash": 2853575090,
            "drawStyles": [
                {
                    "name": "PreParticleGlow",
                    "hash": 1852032819,
                    "inputLayout": "POS_TEX2"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "POS_TEX2"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "POS_TEX2"
                }
            ]
        },
        "2858678411": {
            "name": "ObjectGrid",
            "hash": 2858678411,
            "drawStyles": [
                {
                    "name": "PreParticleHalfResGlow",
                    "hash": 752610260,
                    "inputLayout": "Structure"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Structure"
                }
            ]
        },
        "2916778447": {
            "name": "SkyMeshBlend",
            "hash": 2916778447,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ColorUV"
                }
            ]
        },
        "2942279698": {
            "name": "Terrain1LayerLod",
            "hash": 2942279698,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "Audit",
                    "hash": 913674268,
                    "inputLayout": "TerrainLod0"
                }
            ]
        },
        "2946208401": {
            "name": "PostProcess",
            "hash": 2946208401,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                },
                {
                    "name": "Resolve",
                    "hash": 1812932878,
                    "inputLayout": "Position"
                }
            ]
        },
        "2967190797": {
            "name": "Designer",
            "hash": 2967190797,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Designer"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Designer"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Designer"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Designer"
                }
            ]
        },
        "2993828927": {
            "name": "SkyDome",
            "hash": 2993828927,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ColorUV"
                }
            ]
        },
        "3002079066": {
            "name": "ForceFieldSolid_planar",
            "hash": 3002079066,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "ForceField"
                }
            ]
        },
        "3003512119": {
            "name": "FoliageGlowScroll",
            "hash": 3003512119,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Foliage"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Foliage"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Foliage"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Foliage"
                }
            ]
        },
        "3026601159": {
            "name": "VehicleStealth",
            "hash": 3026601159,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Opaque",
                    "hash": 285068596,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "LameGlow",
                    "hash": 2366808256,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "DistortionLight",
                    "hash": 2855118449,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "3026992715": {
            "name": "CharacterRigidStealth",
            "hash": 3026992715,
            "drawStyles": [
                {
                    "name": "Opaque",
                    "hash": 285068596,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "DistortionLight",
                    "hash": 2855118449,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "CharacterRigid"
                }
            ]
        },
        "3061112292": {
            "name": "StructureBlendInstanced",
            "hash": 3061112292,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "StructureInstanced"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "StructureInstanced"
                }
            ]
        },
        "3064096091": {
            "name": "RedDotSight",
            "hash": 3064096091,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "3089542856": {
            "name": "CharacterRigid",
            "hash": 3089542856,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "CharacterRigid"
                }
            ]
        },
        "3107888304": {
            "name": "StructureDecalInstanced",
            "hash": 3107888304,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "StructureDecalInstanced"
                }
            ]
        },
        "3143673252": {
            "name": "LPVInjection_Main_Geo",
            "hash": 3143673252,
            "drawStyles": [
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Position"
                }
            ]
        },
        "3190426463": {
            "name": "ToolPrimitive3D",
            "hash": 3190426463,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ToolPrimitive3D"
                }
            ]
        },
        "3205907626": {
            "name": "ConvertDepth",
            "hash": 3205907626,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "3212857794": {
            "name": "CharacterRigidShield",
            "hash": 3212857794,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "CharacterRigid"
                }
            ]
        },
        "3217491828": {
            "name": "SimpleGlowRigid",
            "hash": 3217491828,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Post"
                }
            ]
        },
        "3238722948": {
            "name": "VehicleDeRes",
            "hash": 3238722948,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "3256402651": {
            "name": "TerrainLodTile",
            "hash": 3256402651,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TerrainLod"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TerrainLod"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "TerrainLod"
                }
            ]
        },
        "3280078053": {
            "name": "StructureSnowInstanced",
            "hash": 3280078053,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "StructureInstanced"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "StructureInstanced"
                }
            ]
        },
        "3303945314": {
            "name": "FoliageSingleSided",
            "hash": 3303945314,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Foliage"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Foliage"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Foliage"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Foliage"
                }
            ]
        },
        "3307287772": {
            "name": "StructureInstanced",
            "hash": 3307287772,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "StructureInstanced"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "StructureInstanced"
                }
            ]
        },
        "3309736175": {
            "name": "Terrain1Layer",
            "hash": 3309736175,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Terrain"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Terrain"
                }
            ]
        },
        "3332082136": {
            "name": "FontPrimitive",
            "hash": 3332082136,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "FontPrimitive"
                }
            ]
        },
        "3379601684": {
            "name": "TrunkSmall",
            "hash": 3379601684,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TrunkSmall"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TrunkSmall"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "TrunkSmall"
                }
            ]
        },
        "3400293839": {
            "name": "SevenTapGaussian",
            "hash": 3400293839,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "3405390470": {
            "name": "TankTreadDeRes",
            "hash": 3405390470,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TankTread"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "TankTread"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TankTread"
                }
            ]
        },
        "3411489880": {
            "name": "DesignerInstanced",
            "hash": 3411489880,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "DesignerInstanced"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "DesignerInstanced"
                }
            ]
        },
        "3412615063": {
            "name": "RigidLODs",
            "hash": 3412615063,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Position"
                }
            ]
        },
        "3425683877": {
            "name": "ForceField_planar",
            "hash": 3425683877,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "ForceField"
                }
            ]
        },
        "3448670635": {
            "name": "CloudShadows",
            "hash": 3448670635,
            "drawStyles": [
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Post"
                }
            ]
        },
        "3482317509": {
            "name": "Character_PS",
            "hash": 3482317509,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Character_PS"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Character"
                }
            ]
        },
        "3541971018": {
            "name": "VehicleRigidStealth",
            "hash": 3541971018,
            "drawStyles": [
                {
                    "name": "Opaque",
                    "hash": 285068596,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "LameGlow",
                    "hash": 2366808256,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "DistortionLight",
                    "hash": 2855118449,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "3569892898": {
            "name": "AmbientOcclusion",
            "hash": 3569892898,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "3631830797": {
            "name": "BumpRigidDeRes",
            "hash": 3631830797,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "BumpRigid"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "BumpRigid"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "BumpRigid"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "BumpRigid"
                }
            ]
        },
        "3649488835": {
            "name": "Glow",
            "hash": 3649488835,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Glow"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Glow"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Glow"
                }
            ]
        },
        "3672679126": {
            "name": "EdgeAA",
            "hash": 3672679126,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "3685662304": {
            "name": "GlobalLightLowEnd",
            "hash": 3685662304,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        },
        "3722176198": {
            "name": "Flare",
            "hash": 3722176198,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        },
        "3727247704": {
            "name": "DebugCharacterTranslucent",
            "hash": 3727247704,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "DebugCharacter"
                }
            ]
        },
        "3731096925": {
            "name": "Structure",
            "hash": 3731096925,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Structure"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Structure"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Structure"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Structure"
                }
            ]
        },
        "3736651547": {
            "name": "Object_PS",
            "hash": 3736651547,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Object_PS"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Object"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Object"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Object"
                }
            ]
        },
        "3749117448": {
            "name": "AuraxiumCharacterRigidDeRes",
            "hash": 3749117448,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "CharacterRigid"
                }
            ]
        },
        "3775407237": {
            "name": "CharacterStealth",
            "hash": 3775407237,
            "drawStyles": [
                {
                    "name": "Opaque",
                    "hash": 285068596,
                    "inputLayout": "Character"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Character"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Character"
                },
                {
                    "name": "DistortionLight",
                    "hash": 2855118449,
                    "inputLayout": "Character"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "Character"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Character"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Character"
                }
            ]
        },
        "3800155486": {
            "name": "FullResBeamParticle",
            "hash": 3800155486,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "BeamParticle"
                }
            ]
        },
        "3826599360": {
            "name": "GlowBlend2TextureTintRigidSkin",
            "hash": 3826599360,
            "drawStyles": [
                {
                    "name": "PreParticleGlow",
                    "hash": 1852032819,
                    "inputLayout": "POS_TEX2_SKINBONE"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "POS_TEX2_SKINBONE"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "POS_TEX2_SKINBONE"
                }
            ]
        },
        "3830752803": {
            "name": "StreakParticle",
            "hash": 3830752803,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "StreakParticle"
                }
            ]
        },
        "3838484911": {
            "name": "SpriteParticle",
            "hash": 3838484911,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SpriteParticle"
                }
            ]
        },
        "3847799415": {
            "name": "FullResDistortParticle",
            "hash": 3847799415,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "SpriteParticle"
                }
            ]
        },
        "3877669015": {
            "name": "ShadowFilter",
            "hash": 3877669015,
            "drawStyles": [
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Post"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Post"
                }
            ]
        },
        "3902993139": {
            "name": "RigidSkinnedLODs",
            "hash": 3902993139,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "DebugVehicle"
                }
            ]
        },
        "3952890153": {
            "name": "MotionFixup",
            "hash": 3952890153,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        },
        "3963186085": {
            "name": "BumpSkin",
            "hash": 3963186085,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "BumpUVSkin"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "BumpUVSkin"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "BumpUVSkin"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "BumpRigid"
                }
            ]
        },
        "3983495456": {
            "name": "TrailParticleEmitterFillVisualizationFullRes",
            "hash": 3983495456,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TrailParticleEmitter"
                }
            ]
        },
        "3984171369": {
            "name": "TwoSidedRigidLODs",
            "hash": 3984171369,
            "drawStyles": [
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Position"
                }
            ]
        },
        "3995356225": {
            "name": "Terrain3LayerLod",
            "hash": 3995356225,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "TerrainLod0"
                },
                {
                    "name": "Audit",
                    "hash": 913674268,
                    "inputLayout": "TerrainLod0"
                }
            ]
        },
        "3998068181": {
            "name": "GlowBlend1TextureTint",
            "hash": 3998068181,
            "drawStyles": [
                {
                    "name": "PreParticleGlow",
                    "hash": 1852032819,
                    "inputLayout": "POS_TEX"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "POS_TEX"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "POS_TEX"
                }
            ]
        },
        "4002726810": {
            "name": "AuraxiumVehicleRigid",
            "hash": 4002726810,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "4011037672": {
            "name": "CharacterRigidDeRes",
            "hash": 4011037672,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "CharacterRigid"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "CharacterRigid"
                }
            ]
        },
        "4034975963": {
            "name": "ApexSpriteParticle",
            "hash": 4034975963,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ApexSpriteParticle"
                }
            ]
        },
        "4043881402": {
            "name": "FogBlur",
            "hash": 4043881402,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "4080702839": {
            "name": "ResolveTransparency",
            "hash": 4080702839,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        },
        "4082354333": {
            "name": "ScreenSpaceLaserDot",
            "hash": 4082354333,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "4083179757": {
            "name": "Fog",
            "hash": 4083179757,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        },
        "4087467316": {
            "name": "ForceFieldSolid_planar_volatile",
            "hash": 4087467316,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "ForceField"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "ForceField"
                }
            ]
        },
        "4104330308": {
            "name": "OceanWater",
            "hash": 4104330308,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "PreLight",
                    "hash": 779518622,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "VolumeDepth",
                    "hash": 2780244784,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "MiniMap",
                    "hash": 2008845393,
                    "inputLayout": "ClrNrmUV"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "ClrNrmUV"
                }
            ]
        },
        "4140453178": {
            "name": "VehicleRigidShield",
            "hash": 4140453178,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Vehicle"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Vehicle"
                }
            ]
        },
        "4143535303": {
            "name": "ClearScreen",
            "hash": 4143535303,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "4163233004": {
            "name": "CharacterShield",
            "hash": 4163233004,
            "drawStyles": [
                {
                    "name": "Distortion",
                    "hash": 1757275279,
                    "inputLayout": "Character"
                },
                {
                    "name": "Glow",
                    "hash": 3649488835,
                    "inputLayout": "Character"
                }
            ]
        },
        "4204224323": {
            "name": "FullResStreakParticle",
            "hash": 4204224323,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "StreakParticle"
                }
            ]
        },
        "4236956695": {
            "name": "SimpleGlowSkinned",
            "hash": 4236956695,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "Post"
                }
            ]
        },
        "4237825641": {
            "name": "GlobalLight",
            "hash": 4237825641,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        },
        "4245025320": {
            "name": "BumpRigid_PS",
            "hash": 4245025320,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "BumpRigid_PS"
                },
                {
                    "name": "CastShadow",
                    "hash": 2966471072,
                    "inputLayout": "BumpRigid_PS"
                },
                {
                    "name": "CastRSM",
                    "hash": 4069870863,
                    "inputLayout": "BumpRigid_PS"
                },
                {
                    "name": "Pick",
                    "hash": 1780832582,
                    "inputLayout": "BumpRigid_PS"
                }
            ]
        },
        "4283212414": {
            "name": "FullscreenEffectsPass1",
            "hash": 4283212414,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Post"
                }
            ]
        },
        "4285919832": {
            "name": "SpriteParticleEmitter",
            "hash": 4285919832,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "SpriteParticleEmitter"
                }
            ]
        },
        "4289278755": {
            "name": "MotionBlur",
            "hash": 4289278755,
            "drawStyles": [
                {
                    "name": "Normal",
                    "hash": 3054162916,
                    "inputLayout": "Position"
                }
            ]
        }
    }
};
exports.InputLayouts = data.inputLayouts;
exports.MaterialDefinitions = data.materialDefinitions;
},{}],"jenkins-hash":[function(require,module,exports){
module.exports=require('uV4iLp');
},{}],"uV4iLp":[function(require,module,exports){
/*
32-bit Hash function based on lookup2 by Bob Jenkins:
http://burtleburtle.net/bob/c/lookup2.c
lookup2.c, by Bob Jenkins, December 1996, Public Domain.

JavaScript version by Jacob Seidelin

*/

var JenkinsLookup2 = (function() {

    function mix(a, b, c) {
        /*
        --------------------------------------------------------------------
        mix -- mix 3 32-bit values reversibly.
        For every delta with one or two bit set, and the deltas of all three
          high bits or all three low bits, whether the original value of a,b,c
          is almost all zero or is uniformly distributed,
        * If mix() is run forward or backward, at least 32 bits in a,b,c
          have at least 1/4 probability of changing.
        * If mix() is run forward, every bit of c will change between 1/3 and
          2/3 of the time.  (Well, 22/100 and 78/100 for some 2-bit deltas.)
        mix() was built out of 36 single-cycle latency instructions in a 
          structure that could supported 2x parallelism, like so:
              a -= b; 
              a -= c; x = (c>>13);
              b -= c; a ^= x;
              b -= a; x = (a<<8);
              c -= a; b ^= x;
              c -= b; x = (b>>13);
              ...
          Unfortunately, superscalar Pentiums and Sparcs can't take advantage 
          of that parallelism.  They've also turned some of those single-cycle
          latency instructions into multi-cycle latency instructions.  Still,
          this is the fastest good hash I could find.  There were about 2^^68
          to choose from.  I only looked at a billion or so.
        --------------------------------------------------------------------
        */
        a >>>= 0;
        b >>>= 0;
        c >>>= 0;
        
        a -= b; a -= c; a ^= (c>>>13); a >>>= 0;
        b -= c; b -= a; b ^= (a<<8); b >>>= 0;
        c -= a; c -= b; c ^= (b>>>13); c >>>= 0;
        
        a -= b; a -= c; a ^= (c>>>12); a >>>= 0;
        b -= c; b -= a; b ^= (a<<16); b >>>= 0;
        c -= a; c -= b; c ^= (b>>>5); c >>>= 0;
        
        a -= b; a -= c; a ^= (c>>>3); a >>>= 0;
        b -= c; b -= a; b ^= (a<<10); b >>>= 0;
        c -= a; c -= b; c ^= (b>>>15); c >>>= 0;

        return [a, b, c];
    }

    function hash(data, initval) {
        /*
        --------------------------------------------------------------------
        hash() -- hash a variable-length key into a 32-bit value
          k     : the key (the unaligned variable-length array of bytes)
          len   : the length of the key, counting by bytes
          level : can be any 4-byte value
        Returns a 32-bit value.  Every bit of the key affects every bit of
        the return value.  Every 1-bit and 2-bit delta achieves avalanche.
        About 36+6len instructions.

        The best hash table sizes are powers of 2.  There is no need to do
        mod a prime (mod is sooo slow!).  If you need less than 32 bits,
        use a bitmask.  For example, if you need only 10 bits, do
          h = (h & hashmask(10));
        In which case, the hash table should have hashsize(10) elements.

        If you are hashing n strings (ub1 **)k, do it like this:
          for (i=0, h=0; i<n; ++i) h = hash( k[i], len[i], h);

        By Bob Jenkins, 1996.  bob_jenkins@burtleburtle.net.  You may use this
        code any way you wish, private, educational, or commercial.  It's free.

        See http://burtleburtle.net/bob/hash/evahash.html
        Use for hash table lookup, or anything where one collision in 2^32 is
        acceptable.  Do NOT use for cryptographic purposes.
        --------------------------------------------------------------------
        */
        initval = initval || 0;
        length = lenpos = data.length;
        
        var a, b, c, p, q;

        function ord(chr) {
            return chr.charCodeAt(0);
        }
        
        if (length == 0) {
            return 0
        }

        // Set up the internal state
        a = b = 0x9e3779b9; // the golden ratio; an arbitrary value
        c = initval;        // the previous hash value
        p = 0;

        // ---------------------------------------- handle most of the key
        while (lenpos >= 12) {
            a += (ord(data[p+0]) + (ord(data[p+1])<<8) + (ord(data[p+2])<<16) + (ord(data[p+3])<<24));
            b += (ord(data[p+4]) + (ord(data[p+5])<<8) + (ord(data[p+6])<<16) + (ord(data[p+7])<<24));
            c += (ord(data[p+8]) + (ord(data[p+9])<<8) + (ord(data[p+10])<<16) + (ord(data[p+11])<<24));
            q = mix(a, b, c);
            a = q[0], b = q[1], c = q[2];
            p += 12;
            lenpos -= 12;
        }
        
        // ------------------------- handle the last 11 bytes
        c += length;
        if (lenpos >= 11) c += ord(data[p+10])<<24;
        if (lenpos >= 10) c += ord(data[p+9])<<16;
        if (lenpos >= 9)  c += ord(data[p+8])<<8;
        // the first byte of c is reserved for the length
        if (lenpos >= 8)  b += ord(data[p+7])<<24;
        if (lenpos >= 7)  b += ord(data[p+6])<<16;
        if (lenpos >= 6)  b += ord(data[p+5])<<8;
        if (lenpos >= 5)  b += ord(data[p+4]);
        if (lenpos >= 4)  a += ord(data[p+3])<<24;
        if (lenpos >= 3)  a += ord(data[p+2])<<16;
        if (lenpos >= 2)  a += ord(data[p+1])<<8;
        if (lenpos >= 1)  a += ord(data[p+0]);
        q = mix(a, b, c);
        a = q[0], b = q[1], c = q[2];

        // ------------------------- report the result
        return c >>> 0;
    }

    return hash;

})();


/* Jenkins one-at-a-time hash */

function JenkinsOAAT(key) {
    var hash = 0;
    for (var i=0; i<key.length; ++i) {
        hash += key.charCodeAt(i);
        hash += (hash << 10);
        hash ^= (hash >> 6);
    }
    hash += (hash << 3);
    hash ^= (hash >> 11);
    hash += (hash << 15);
    return (hash >>> 0);
}


exports.lookup2 = JenkinsLookup2;
exports.oaat = JenkinsOAAT;
},{}],14:[function(require,module,exports){
var Buffer = require('buffer').Buffer;

var CRC_TABLE = [
  0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419,
  0x706af48f, 0xe963a535, 0x9e6495a3, 0x0edb8832, 0x79dcb8a4,
  0xe0d5e91e, 0x97d2d988, 0x09b64c2b, 0x7eb17cbd, 0xe7b82d07,
  0x90bf1d91, 0x1db71064, 0x6ab020f2, 0xf3b97148, 0x84be41de,
  0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7, 0x136c9856,
  0x646ba8c0, 0xfd62f97a, 0x8a65c9ec, 0x14015c4f, 0x63066cd9,
  0xfa0f3d63, 0x8d080df5, 0x3b6e20c8, 0x4c69105e, 0xd56041e4,
  0xa2677172, 0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b,
  0x35b5a8fa, 0x42b2986c, 0xdbbbc9d6, 0xacbcf940, 0x32d86ce3,
  0x45df5c75, 0xdcd60dcf, 0xabd13d59, 0x26d930ac, 0x51de003a,
  0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423, 0xcfba9599,
  0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924,
  0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d, 0x76dc4190,
  0x01db7106, 0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f,
  0x9fbfe4a5, 0xe8b8d433, 0x7807c9a2, 0x0f00f934, 0x9609a88e,
  0xe10e9818, 0x7f6a0dbb, 0x086d3d2d, 0x91646c97, 0xe6635c01,
  0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e, 0x6c0695ed,
  0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950,
  0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3,
  0xfbd44c65, 0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2,
  0x4adfa541, 0x3dd895d7, 0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a,
  0x346ed9fc, 0xad678846, 0xda60b8d0, 0x44042d73, 0x33031de5,
  0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa, 0xbe0b1010,
  0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f,
  0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17,
  0x2eb40d81, 0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6,
  0x03b6e20c, 0x74b1d29a, 0xead54739, 0x9dd277af, 0x04db2615,
  0x73dc1683, 0xe3630b12, 0x94643b84, 0x0d6d6a3e, 0x7a6a5aa8,
  0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1, 0xf00f9344,
  0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb,
  0x196c3671, 0x6e6b06e7, 0xfed41b76, 0x89d32be0, 0x10da7a5a,
  0x67dd4acc, 0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5,
  0xd6d6a3e8, 0xa1d1937e, 0x38d8c2c4, 0x4fdff252, 0xd1bb67f1,
  0xa6bc5767, 0x3fb506dd, 0x48b2364b, 0xd80d2bda, 0xaf0a1b4c,
  0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55, 0x316e8eef,
  0x4669be79, 0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236,
  0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 0xc5ba3bbe,
  0xb2bd0b28, 0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31,
  0x2cd99e8b, 0x5bdeae1d, 0x9b64c2b0, 0xec63f226, 0x756aa39c,
  0x026d930a, 0x9c0906a9, 0xeb0e363f, 0x72076785, 0x05005713,
  0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38, 0x92d28e9b,
  0xe5d5be0d, 0x7cdcefb7, 0x0bdbdf21, 0x86d3d2d4, 0xf1d4e242,
  0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1,
  0x18b74777, 0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c,
  0x8f659eff, 0xf862ae69, 0x616bffd3, 0x166ccf45, 0xa00ae278,
  0xd70dd2ee, 0x4e048354, 0x3903b3c2, 0xa7672661, 0xd06016f7,
  0x4969474d, 0x3e6e77db, 0xaed16a4a, 0xd9d65adc, 0x40df0b66,
  0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9,
  0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605,
  0xcdd70693, 0x54de5729, 0x23d967bf, 0xb3667a2e, 0xc4614ab8,
  0x5d681b02, 0x2a6f2b94, 0xb40bbe37, 0xc30c8ea1, 0x5a05df1b,
  0x2d02ef8d
];

function bufferizeInt(num) {
  var tmp = Buffer(4);
  tmp.writeInt32BE(num, 0);
  return tmp;
}

function _crc32(buf, previous) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer(buf);
  }
  if (Buffer.isBuffer(previous)) {
    previous = previous.readUInt32BE(0);
  }
  var crc = ~~previous ^ -1;
  for (var n = 0; n < buf.length; n++) {
    crc = CRC_TABLE[(crc ^ buf[n]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1);
}

function crc32() {
  return bufferizeInt(_crc32.apply(null, arguments));
}
crc32.signed = function () {
  return _crc32.apply(null, arguments);
};
crc32.unsigned = function () {
  return _crc32.apply(null, arguments) >>> 0;
};

module.exports = crc32;

},{"buffer":"Cr8VU/"}],"soe-pack":[function(require,module,exports){
module.exports=require('GzwABG');
},{}],"GzwABG":[function(require,module,exports){
(function (process,Buffer){
var fs = require("fs"),
    path = require("path"),
    crc32 = require("buffer-crc32");

var MAXOPENFILES = 1000;

function writeUInt32BE(stream, number) {
    stream.write(new Buffer([
        number >> 24 & 0xff,
        number >> 16 & 0xff,
        number >> 8 & 0xff,
        number & 0xff
    ]));
}

function writeString(stream, string) {
    stream.write(string);
}

function readUInt32BE(fd, offset) {
    var buf = new Buffer(4);
    fs.readSync(fd, buf, 0, 4, offset);
    return buf.readUInt32BE(0);
}

function readString(fd, offset) {
    var len = readUInt32BE(fd, offset);
    var buf = new Buffer(len);
    fs.readSync(fd, buf, 0, len, offset+4);
    return buf.toString();
}

function listPackFiles(inPath, excludeFiles) {
    if (!fs.existsSync(inPath)) {
        throw "listPackFiles(): inPath does not exist";
    }
    var files = fs.readdirSync(inPath),
        packFiles = [];
    for (var i=0;i<files.length;i++) {
        if (/\.pack$/.test(files[i])) {
            if (!excludeFiles || excludeFiles.indexOf(files[i]) == -1) {
                packFiles.push(files[i]);
            }
        }
    }
    return packFiles;
}

function readPackFile(filePath, file, callback) {
    var assets = [], asset,
        fd, i, offset = 0,
        numAssets, nextOffset;

    filePath = path.join(filePath, file);
    fs.open(filePath, "r", function(err, fd) {
        do {
            nextOffset = readUInt32BE(fd, offset);
            offset += 4;
            numAssets = readUInt32BE(fd, offset);
            offset += 4;
            for (i=0;i<numAssets;i++) {
                asset = {};
                asset.file = file;
                asset.name = readString(fd, offset);
                asset.name_lower = asset.name.toLowerCase();
                offset += asset.name.length + 4;
                asset.offset = readUInt32BE(fd, offset);
                offset += 4;
                asset.length = readUInt32BE(fd, offset);
                offset += 4;
                asset.crc32 = readUInt32BE(fd, offset);
                offset += 4;
                assets.push(asset);
            }
            offset = nextOffset;
        } while (nextOffset);
        fs.close(fd, function(err) {
            callback(err, assets);
        });
    });
}


function readPackFileFromBuffer(data, callback) {
    var assets = [], asset,
        fd, i, offset = 0,
        numAssets, nextOffset;
    do {
        nextOffset = data.readUInt32BE(offset);
        offset += 4;
        numAssets = data.readUInt32BE(offset);
        offset += 4;
        for (i=0;i<numAssets;i++) {
            asset = {};
            var namelength = data.readUInt32BE(offset);
            offset += 4;
            asset.name = data.toString("utf8", offset, offset + namelength);
            asset.name_lower = asset.name.toLowerCase();
            offset += namelength;
            asset.offset = data.readUInt32BE(offset);
            offset += 4;
            asset.length = data.readUInt32BE(offset);
            offset += 4;
            asset.crc32 = data.readUInt32BE(offset);
            offset += 4;
            asset.data = data.slice(asset.offset, asset.offset + asset.length);
            assets.push(asset);

        }
        offset = nextOffset;
    } while (nextOffset);
    callback(null, assets);
}

function append(inFile1, inFile2, outFile) {
    if (!fs.existsSync(inFile1)) {
        throw "append(): inFile1 does not exist";
    }
    if (!fs.existsSync(inFile2)) {
        throw "append(): inFile2 does not exist";
    }

    var data1 = fs.readFileSync(inFile1),
        data2 = fs.readFileSync(inFile2),
        outData = new Buffer(data1.length + data2.length),
        offset = 0, appendOffset = 0,
        numAssets,
        nextOffset = 0, nextAppendOffset;

    console.log("Appending " + data2.length + " bytes to " + inFile1);
    
    data1.copy(outData, 0, 0, data1.length);
    data2.copy(outData, data1.length, 0, data2.length);
    
    do {
        offset = nextOffset;
        nextOffset = data1.readUInt32BE(offset);
    } while (nextOffset);
    
    appendOffset = data1.length;
    outData.writeUInt32BE(appendOffset, offset);
    
    console.log("Rewriting offsets");
    offset = 0;
    do {
        nextOffset = data2.readUInt32BE(offset);
        outData.writeUInt32BE(nextOffset ? appendOffset + nextOffset : 0, appendOffset + offset);
        offset += 4;
        
        numAssets = data2.readUInt32BE(offset);
        offset += 4;
        
        for (i=0;i<numAssets;i++) {
            offset += data2.readUInt32BE(offset) + 4;
            outData.writeUInt32BE(appendOffset + data2.readUInt32BE(offset), appendOffset + offset);
            offset += 12;
        }
        offset = nextOffset;
    } while (nextOffset);

    fs.writeFileSync(outFile, outData);
}

function manifest(inPath, outFile, excludeFiles) {
    var files, file, ext, str,
        i, j, packAssets, 
        assets = [], 
        asset;

    files = listPackFiles(inPath, excludeFiles);
    console.log("Reading assets from " + files.length + " packs");
    function readNextFile() {
        if (files.length) {
            var file = files.shift();
            process.stdout.write(".");
            readPackFile(inPath, file, function(err, packAssets) {
                assets = assets.concat(packAssets);
                readNextFile();
            });
        } else {
            process.stdout.write("\r\n");
            console.log("Writing manifest to " + outFile);
            assets = assets.sort(function(a, b) {
                return a.name_lower < b.name_lower ? -1 : 1;
            });
            str = [["CRC32", "NAME", "PACK", "OFFSET", "LENGTH"].join("\t")];
            for (j=0;j<assets.length;j++) {
                asset = assets[j];
                str[j+1] = [asset.crc32, asset.name, asset.file, asset.offset, asset.length].join("\t");
            }
            fs.writeFile(outFile, str.join("\r\n"), function(err) {
                if (err) {
                    throw err;
                }
                console.log("Done!");
            });
        }
    }
    readNextFile();
}

function readManifest(file) {
    if (!fs.existsSync(file)) {
        throw "readManifest(): file does not exist";
    }

    var data = fs.readFileSync(file).toString(),
        lines = data.split("\r\n"),
        values, 
        assets = {};
    for (var i=1;i<lines.length;i++) {
        values = lines[i].split("\t");
        assets[values[1]] = {
            name: values[1],
            crc32: parseInt(values[0], 10),
            pack: values[2],
            offset: parseInt(values[3], 10),
            length: parseInt(values[4], 10)
        };
    }
    return assets;
}

function diff(oldManifestPath, newManifestPath, outFile) {
    var oldManifest, newManifest, a,
        changes = {
            added: [],
            deleted: [],
            modified: [],
            packChanged: 0,
            offsetChanged: 0
        };

    oldManifest = readManifest(oldManifestPath);
    newManifest = readManifest(newManifestPath);

    for (a in newManifest) {
        if (newManifest.hasOwnProperty(a)) {
            if (oldManifest[a]) {
                if (newManifest[a].crc32 != oldManifest[a].crc32) {
                    changes.modified.push(newManifest[a]);
                } else if (newManifest[a].pack != oldManifest[a].pack) {
                    changes.packChanged++;
                    //changes.packChanged.push(newManifest[a]);
                } else if (newManifest[a].offset != oldManifest[a].offset) {
                    changes.offsetChanged++;
                    //changes.offsetChanged.push(newManifest[a]);
                }
            } else {
                changes.added.push(newManifest[a]);
            }
        }
    }
    for (a in oldManifest) {
        if (oldManifest.hasOwnProperty(a)) {
            if (!newManifest[a]) {
                changes.deleted.push(oldManifest[a]);
            }
        }
    }
    
    console.log("Writing manifest changes to " + outFile);
    fs.writeFileSync(outFile, JSON.stringify(changes, null, 4));
}

function pack(inPath, outPath) {
    var packBuffer = new Buffer(0),
        folderHeaderBuffer,
        fileDataBuffer,
        fileHeaderBuffer,
        i, j, nextOffset, files, stat,
        fileOffset, dataOffset, data,
        fileHeaderLength, dataLength,
        folders, collections = [], collectionFolder;
    
    if (!fs.existsSync(inPath)) {
        throw "pack(): inPath does not exist [" + inPath + "]";
    }

    if (fs.existsSync(outPath)) {
        stat = fs.statSync(outPath);
        if (stat.isDirectory()) {
            throw "pack(): outPath is a directory [" + outPath + "]";
        }
    }
    
    folders = fs.readdirSync(inPath);
    for (i=0;i<folders.length;i++) {
        collectionFolder = path.join(inPath, folders[i]);
        stat = fs.statSync(collectionFolder);
        if (stat.isDirectory()) {
            files = fs.readdirSync(collectionFolder);
            collections.push({
                folder: collectionFolder,
                files: files
            });
        }
    }

    for (i=0;i<collections.length;i++) {
        files = collections[i].files;
        collectionFolder = collections[i].folder;
        fileHeaderLength = 0;
        dataLength = 0;
        for (j=0;j<files.length;j++) {
            fileHeaderLength += 16 + files[j].length;
            stat = fs.statSync(path.join(collectionFolder, files[j]));
            dataLength += stat.size;
        }
            
        folderHeaderBuffer = new Buffer(8);
        fileDataBuffer = new Buffer(dataLength);
        fileHeaderBuffer = new Buffer(fileHeaderLength);

        fileOffset = 0;
        dataOffset = 0;
            
        for (j=0;j<files.length;j++) {
            data = fs.readFileSync(path.join(collectionFolder, files[j]));

            fileHeaderBuffer.writeUInt32BE(files[j].length, fileOffset);
            fileHeaderBuffer.write(files[j], fileOffset + 4, files[j].length);
            fileHeaderBuffer.writeUInt32BE(packBuffer.length + folderHeaderBuffer.length + fileHeaderBuffer.length + dataOffset, fileOffset + files[j].length + 4);
            fileHeaderBuffer.writeUInt32BE(data.length, fileOffset + files[j].length + 8);
            fileHeaderBuffer.writeUInt32BE(crc32.unsigned(data), fileOffset + files[j].length + 12);

            fileOffset += 16 + files[j].length;

            data.copy(fileDataBuffer, dataOffset, 0);
            dataOffset += data.length;
        }
            
        if (i < collections.length-1) {
            nextOffset = packBuffer.length + folderHeaderBuffer.length + fileHeaderBuffer.length + fileDataBuffer.length;
        } else {
            nextOffset = 0;
        }
        
        folderHeaderBuffer.writeUInt32BE(nextOffset, 0);
        folderHeaderBuffer.writeUInt32BE(files.length, 4);

        packBuffer = Buffer.concat([packBuffer, folderHeaderBuffer, fileHeaderBuffer, fileDataBuffer]);
    }
    fs.writeFileSync(outPath, packBuffer);
    return true;
}

function packFromBuffers(files) {
    var packBuffer = new Buffer(0),
        folderHeaderBuffer,
        fileDataBuffer,
        fileHeaderBuffer,
        i, j, nextOffset, stat,
        fileOffset, dataOffset, data,
        fileHeaderLength, dataLength, nameLength;
    
    fileHeaderLength = 0;
    dataLength = 0;

    for (j=0;j<files.length;j++) {
        fileHeaderLength += 16 + files[j].name.length;
        dataLength += files[j].data.length;
    }
        
    folderHeaderBuffer = new Buffer(8);
    fileDataBuffer = new Buffer(dataLength);
    fileHeaderBuffer = new Buffer(fileHeaderLength);

    fileOffset = 0;
    dataOffset = 0;
        
    for (j=0;j<files.length;j++) {
        data = files[j].data;
        nameLength = files[j].name.length;
        fileHeaderBuffer.writeUInt32BE(nameLength, fileOffset);
        fileHeaderBuffer.write(files[j].name, fileOffset + 4, nameLength);
        fileHeaderBuffer.writeUInt32BE(packBuffer.length + folderHeaderBuffer.length + fileHeaderBuffer.length + dataOffset, fileOffset + nameLength + 4);
        fileHeaderBuffer.writeUInt32BE(data.length, fileOffset + nameLength + 8);
        fileHeaderBuffer.writeUInt32BE(crc32.unsigned(data), fileOffset + nameLength + 12);

        fileOffset += 16 + nameLength;

        data.copy(fileDataBuffer, dataOffset, 0);
        dataOffset += data.length;
    }
    nextOffset = 0;
    
    folderHeaderBuffer.writeUInt32BE(nextOffset, 0);
    folderHeaderBuffer.writeUInt32BE(files.length, 4);

    var finalData = new Buffer(packBuffer.length + folderHeaderBuffer.length + fileHeaderBuffer.length + fileDataBuffer.length);
    packBuffer.copy(finalData, 0, 0);
    folderHeaderBuffer.copy(finalData, packBuffer.length, 0);
    fileHeaderBuffer.copy(finalData, packBuffer.length + folderHeaderBuffer.length, 0);
    fileDataBuffer.copy(finalData, packBuffer.length + folderHeaderBuffer.length + fileHeaderBuffer.length, 0);
    return finalData;
}

function extractDiff(diffPath, packPath, outPath, excludeFiles) {
    if (!fs.existsSync(packPath)) {
        throw "extractDiff(): packPath does not exist: " + packPath;
    }
    if (!fs.existsSync(outPath)) {
        throw "extractDiff(): outPath does not exist";
    }
    if (!fs.existsSync(diffPath)) {
        throw "extractDiff(): diffPath does not exist";
    }
    
    var packs = {},
        packStack = [];
    
    function openPack(file, callback) {
        if (packs[file]) {
            callback(null, packs[file]);
            return;
        }
        fs.open(file, "r", function(err, fd) {
            packs[file] = fd;
            packStack.push(file);
            if (packStack.length > MAXOPENFILES) {
                var firstPack = packStack.shift(),
                    firstFd = packs[firstPack];
                    delete packs[firstPack];
                if (firstFd) {
                    fs.close(firstFd, function(err) {
                        callback(err, fd);
                    });
                } else {
                    callback(err, fd);
                }
            } else {
                callback(err, fd);
            }
        });
    }
    
    function extractAssets(assets, outPath, callback) {
        fs.mkdir(outPath, function(err) {
            function nextAsset() {
                if (assets.length === 0) {
                    callback();
                    return;
                }
                var asset = assets.shift(),
                    packName = asset.pack.replace(".pack", "");
                console.log("Extracting " + asset.name + " from " + asset.pack);
                fs.mkdir(outPath, function(err) {
                    openPack(path.join(packPath, asset.pack), function(err, fd) {
                        var buffer = new Buffer(asset.length);
                        fs.read(fd, buffer, 0, asset.length, asset.offset, function(err) {
                            fs.writeFile(path.join(outPath, asset.name), buffer, function(err) {
                                nextAsset();
                            });
                        });
                    });
                });
            }
            nextAsset();
        });
    }

    
    function closePacks(callback) {
        if (packStack.length) {
            var pack = packStack.shift(),
                packFd = packs[pack];
            delete packs[pack];
            if (packFd) {
                console.log("Closing " + pack);
                fs.close(packFd, function() {
                    closePacks(callback);
                });
            } else {
                closePacks(callback);
            }
        } else {
            callback();
        }
    }
    
    console.log("Reading diff: " + diffPath);
    fs.readFile(diffPath, function(err, data) {
        if (err) {
            throw err;
        }
        var diff = JSON.parse(data);
        extractAssets(diff.added.slice(), path.join(outPath, "added"), function() {
            extractAssets(diff.modified.slice(), path.join(outPath, "modified"), function() {
                closePacks(function() {
                    console.log("All done!");
                });
            });
        });
    });
}

function extractAll(inPath, outPath, excludeFiles) {
    var startTime = Date.now(),
        totalAssets = 0;
        packs = listPackFiles(inPath, excludeFiles);

    if (!fs.existsSync(outPath)) {
        throw "extractAll(): outPath does not exist";
    }
    
    console.log("Reading pack files in " + inPath);
    
    function nextPack() {
        if (!packs.length) {
            console.log("Extracted " + totalAssets + " assets in " + ((Date.now() - startTime) / 1000).toFixed(2) + " seconds.");
            return;
        }

        var pack = packs.shift(),
            packPath = path.join(outPath, pack.replace(".pack", ""));

        if (!fs.existsSync(packPath)) {
            fs.mkdirSync(packPath);
        }

        readPackFile(inPath, pack, function(err, assets) {
            console.log("Extracting " + assets.length + " assets from " + pack);
            var asset, n = assets.length;
            fs.readFile(path.join(inPath, pack), function(err, data) {
                for (var i=0;i<assets.length;i++) {
                    asset = assets[i];
                    fs.writeFile(path.join(packPath, asset.name), data.slice(asset.offset, asset.offset+asset.length), 
                        function() {
                            totalAssets++;
                            if (--n === 0) {
                                nextPack();
                            }
                        }
                    );
                }
            });
        });
    }
    nextPack();
}

function extractPack(inPath, outPath) {
    var startTime = Date.now();

    if (!fs.existsSync(outPath)) {
        throw "extractPack(): outPath does not exist";
    }
    
    //console.log("Reading pack file: " + inPath);
    
    readPackFile("", inPath, function(err, assets) {
        //console.log("Extracting " + assets.length + " assets from pack file");
        var asset, n = assets.length;
        fs.readFile(inPath, function(err, data) {
            for (var i=0;i<assets.length;i++) {
                asset = assets[i];
                fs.writeFile(path.join(outPath, asset.name), data.slice(asset.offset, asset.offset+asset.length),
                    function() {}
                );
            }
        });
    });
}


function extractToBuffers(data, callback) {
    readPackFileFromBuffer(data, function(err, assets) {
        callback(err, assets);
    });
}


function extractFile(inPath, file, outPath, excludeFiles, useRegExp, callback) {
    var packs = listPackFiles(inPath, excludeFiles),
        assets, buffer, fd, re, numFound,
        i, j;
    if (!outPath) {
        outPath = ".";
    }
    console.log("Reading pack files in " + inPath);
    if (useRegExp) {
        re = new RegExp(file);
    }
    numFound = 0;
    function nextPack() {
        if (packs.length) {
            var pack = packs.shift(),
                assets;
            readPackFile(inPath, pack, function(err, assets) {
                for (var j=0;j<assets.length;j++) {
                    var isMatch = false;
                    if (useRegExp) {
                        isMatch = re.test(assets[j].name);
                    } else if (assets[j].name == file) {
                        isMatch = true;
                    }
                    if (isMatch) {
                        numFound++;
                        console.log("Extracting file " + assets[j].name + " from " + pack);
                        fd = fs.openSync(path.join(inPath, pack), "r");
                        buffer = new Buffer(assets[j].length);
                        fs.readSync(fd, buffer, 0, assets[j].length, assets[j].offset);
                        fs.closeSync(fd);
                        fs.writeFileSync(path.join(outPath, assets[j].name), buffer);
                    }
                }
                nextPack();
            });
        } else {
            if (numFound) {
                console.log("Extracted " + numFound + " matching asset" + (numFound > 1 ? "s" : ""));
            } else {
                console.log("No matching assets found");
            }
            if (callback) {
                callback();
            }
        }
    }
    nextPack();
}

exports.pack = pack;
exports.packFromBuffers = packFromBuffers;
exports.extractAll = extractAll;
exports.extractPack = extractPack;
exports.extractToBuffers = extractToBuffers;
exports.extractDiff = extractDiff;
exports.extractFile = extractFile;
exports.diff = diff;
exports.append = append;
exports.manifest = manifest;
}).call(this,require("C:\\Users\\Jacob\\AppData\\Roaming\\npm\\node_modules\\browserify\\node_modules\\insert-module-globals\\node_modules\\process\\browser.js"),require("buffer").Buffer)
},{"C:\\Users\\Jacob\\AppData\\Roaming\\npm\\node_modules\\browserify\\node_modules\\insert-module-globals\\node_modules\\process\\browser.js":6,"buffer":"Cr8VU/","buffer-crc32":14,"fs":1,"path":7}]},{},[])