"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebFileSystem = void 0;
const webdav_server_1 = require("webdav-server");
// Serializer
class WebFileSystemSerializer {
    uid() {
        return 'WebFileSystemSerializer_1.0.0';
    }
    serialize(fs, callback) {
        callback(undefined, {
            url: fs.url,
            props: fs.props
        });
    }
    unserialize(serializedData, callback) {
        const fs = new WebFileSystem(serializedData.url);
        fs.props = new webdav_server_1.v2.LocalPropertyManager(serializedData.props);
        callback(undefined, fs);
    }
}
// File system
class WebFileSystem extends webdav_server_1.v2.FileSystem {
    constructor(url) {
        super(new WebFileSystemSerializer());
        this.url = url;
        this.props = new webdav_server_1.v2.LocalPropertyManager();
        this.locks = new webdav_server_1.v2.LocalLockManager();
    }
    _fastExistCheck(ctx, path, callback) {
        callback(path.isRoot());
    }
    _openReadStream(path, info, callback) {
        // const stream = request.get(this.url);
        // stream.end();
        // callback(undefined, (stream as any) as Readable);
    }
    _propertyManager(path, info, callback) {
        callback(undefined, this.props);
    }
    _lockManager(path, info, callback) {
        callback(undefined, this.locks);
    }
    _type(path, info, callback) {
        callback(undefined, webdav_server_1.v2.ResourceType.File);
    }
}
exports.WebFileSystem = WebFileSystem;
