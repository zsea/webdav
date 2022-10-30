"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BufferReadable = void 0;
const stream_1 = require("stream");
class BufferReadable extends stream_1.Readable {
    constructor(buffer, options) {
        // Calls the stream.Readable(options) constructor
        super(options);
        this.index = 0;
        this.buffer = buffer;
    }
    _read(size) {
        const end = this.index + size;
        const buf = this.buffer.subarray(this.index, end);
        //console.log(this.b64Count,buf.length,size,'_read')
        if (buf.length !== 0) {
            this.push(buf);
        }
        else {
            this.push(null);
        }
        this.index = end;
    }
}
exports.BufferReadable = BufferReadable;
