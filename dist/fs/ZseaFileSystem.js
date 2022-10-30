"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZseaFileSystem = exports.ZseaSerializer = exports.ZseaFileWritable = exports.ZseaFileReadable = exports.ZseaFileSystemResource = void 0;
/// <reference path="./snowflake.d.ts" />
const export_1 = require("webdav-server/lib/manager/v2/fileSystem/export");
const stream_1 = require("stream");
const JSCompatibility_1 = require("webdav-server/lib/helper/JSCompatibility");
const Errors_1 = require("webdav-server/lib/Errors");
const Path_1 = require("webdav-server/lib/manager/v2/Path");
const Bluebird = require("bluebird");
//import Snowflake from "@zsea/snowflake"
const Snowflake = require("@zsea/snowflake");
const snowflake = new Snowflake();
class ZseaFileSystemResource {
    constructor(data, blockSize = 4096) {
        let rs;
        if (data && data.isFile !== undefined && data.isDirectory !== undefined) {
            rs = {
                type: data,
                id: snowflake.nextId().toString(),
                blockSize: blockSize
            };
        }
        else {
            rs = data;
        }
        this.lastModifiedDate = rs.lastModifiedDate ? rs.lastModifiedDate : Date.now();
        this.creationDate = rs.creationDate ? rs.creationDate : Date.now();
        //this.content = rs.content ? rs.content.map((o) => Buffer.from(o)) : [];
        this.props = new export_1.LocalPropertyManager(rs.props);
        this.locks = new export_1.LocalLockManager();
        this.size = rs.size ? rs.size : 0;
        this.type = rs.type ? rs.type : export_1.ResourceType.File;
        this.id = rs.id;
        this.blockSize = rs.blockSize;
    }
    static updateLastModified(r) {
        r.lastModifiedDate = Date.now();
    }
}
exports.ZseaFileSystemResource = ZseaFileSystemResource;
class ZseaFileReadable extends stream_1.Readable {
    constructor(contents) {
        super();
        this.contents = contents;
        this.blockIndex = -1;
    }
    _read(size) {
        while (true) {
            ++this.blockIndex;
            if (this.blockIndex >= this.contents.length) {
                this.push(null);
                break;
            }
            if (!this.push(this.contents[this.blockIndex]))
                break;
        }
    }
}
exports.ZseaFileReadable = ZseaFileReadable;
class ZseaFileWritable extends stream_1.Writable {
    constructor(storage, id, blockSize = 4096) {
        super(undefined);
        this.storage = storage;
        this.id = id;
        this.blockSize = blockSize;
        this.index = 0;
        this.buffer = Buffer.alloc(0);
        this.totalSize = 0;
    }
    //public tasks:Promise<void>[]=[];
    save(callback) {
        let tasks = [];
        while (this.buffer.length >= this.blockSize) {
            let block = this.buffer.subarray(0, this.blockSize);
            tasks.push(this.storage.save(`/block.${this.id}.${this.index++}.bin`, block));
            this.buffer = this.buffer.subarray(this.blockSize);
        }
        return Promise.all(tasks).then(function () {
            callback(Errors_1.Errors.None);
        }).catch(function () {
            callback(Errors_1.Errors.InsufficientStorage);
        });
    }
    saveAll() {
        return this.storage.save(`/block.${this.id}.${this.index++}.bin`, this.buffer);
    }
    get size() {
        return this.totalSize;
    }
    _write(chunk, encoding, callback) {
        this.totalSize = this.totalSize + chunk.length;
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.save(callback);
    }
}
exports.ZseaFileWritable = ZseaFileWritable;
class ZseaSerializer {
    constructor(storage, blockSize = 4096) {
        this.storage = storage;
        this.blockSize = blockSize;
    }
    uid() {
        return 'ZseaFSSerializer-1.0.0';
    }
    serialize(fs, callback) {
        callback(undefined, {
            resources: fs.resources
        });
    }
    unserialize(serializedData, callback) {
        // tslint:disable-next-line:no-use-before-declare
        const fs = new ZseaFileSystem(this.storage, this.blockSize);
        if (serializedData.resources) {
            for (const path in serializedData.resources)
                fs.resources[path] = new ZseaFileSystemResource(serializedData.resources[path]);
        }
        else {
            for (const path in serializedData)
                fs.resources[path] = new ZseaFileSystemResource(serializedData[path]);
        }
        callback(undefined, fs);
    }
}
exports.ZseaSerializer = ZseaSerializer;
// export const ZseaSerializerVersions = {
//     versions: {
//         '1.0.0': ZseaSerializer
//     },
//     instances: [
//         new ZseaSerializer()
//     ] as FileSystemSerializer[]
// }
class ZseaFileSystem extends export_1.FileSystem {
    constructor(storage, blockSize = 4096, serializer) {
        super(serializer ? serializer : new ZseaSerializer(storage, blockSize));
        this.storage = storage;
        this.blockSize = blockSize;
        this.resources = {
            '/': new ZseaFileSystemResource(export_1.ResourceType.Directory)
        };
    }
    getINode() {
        let files = [];
        for (let path in this.resources) {
            files.push({
                size: this.resources[path].size,
                type: this.resources[path].type.isFile ? "file" : "dir",
                path: path,
                lastModifiedDate: this.resources[path].lastModifiedDate,
                creationDate: this.resources[path].creationDate,
                id: this.resources[path].id,
                blockSize: this.resources[path].blockSize
            });
        }
        return JSON.stringify(files);
    }
    Initialization() {
        let self = this;
        return this.storage.read('/inode').then(function (buffer) {
            let content = buffer.toString("utf8");
            let files = JSON.parse(content);
            for (let i = 0; i < files.length; i++) {
                let item = files[i];
                self.resources[item.path] = new ZseaFileSystemResource({
                    size: item.size,
                    lastModifiedDate: item.lastModifiedDate,
                    creationDate: item.creationDate,
                    id: item.id,
                    type: item.type === "file" ? export_1.ResourceType.File : export_1.ResourceType.Directory,
                    blockSize: item.blockSize || self.blockSize
                });
            }
        });
    }
    saveINode() {
        let inode = this.getINode();
        return this.storage.save("/inode", Buffer.from(inode));
    }
    _fastExistCheck(ctx, path, callback) {
        callback(this.resources[path.toString()] !== undefined);
    }
    _create(path, ctx, callback) {
        this.resources[path.toString()] = new ZseaFileSystemResource(ctx.type, this.blockSize);
        if (ctx.type === export_1.ResourceType.Directory) {
            this.saveINode().then(function () {
                callback();
            }).catch(function () {
                callback(Errors_1.Errors.InsufficientStorage);
            });
            return;
        }
        callback();
    }
    _delete(path, ctx, callback) {
        const sPath = path.toString(true);
        for (const path in this.resources) {
            if ((0, JSCompatibility_1.startsWith)(path, sPath))
                delete this.resources[path];
        }
        let file = this.resources[path.toString()];
        delete this.resources[path.toString()];
        this.saveINode().then(() => {
            let count = Math.ceil(file.size / file.blockSize);
            for (let i = 0; i < count; i++) {
                this.storage.delete(`/block.${file.id}.${i}.bin`).catch(function (e) {
                    //console.log(e);
                });
            }
            callback();
        }).catch(function () {
            callback(Errors_1.Errors.InsufficientStorage);
        });
        //let blocks: Promise<void>[] = [];
    }
    _openWriteStream(path, ctx, callback) {
        const resource = this.resources[path.toString()];
        if (resource === undefined)
            return callback(Errors_1.Errors.ResourceNotFound);
        const content = [];
        const stream = new ZseaFileWritable(this.storage, resource.id, this.blockSize);
        //stream.on("")
        stream.on('finish', () => {
            stream.saveAll().then(() => {
                resource.size = stream.size;
                ZseaFileSystemResource.updateLastModified(resource);
                return this.saveINode();
            }).catch((e) => {
                let count = Math.ceil(resource.size / resource.blockSize);
                for (let i = 0; i < count; i++) {
                    this.storage.delete(`/block.${resource.id}.${i}.bin`);
                }
            });
        });
        callback(undefined, stream);
    }
    _openReadStream(path, ctx, callback) {
        const resource = this.resources[path.toString()];
        if (resource === undefined)
            return callback(Errors_1.Errors.ResourceNotFound);
        let blocks = [];
        let count = Math.ceil(resource.size / resource.blockSize);
        for (let i = 0; i < count; i++) {
            blocks.push(this.storage.read(`/block.${resource.id}.${i}.bin`));
        }
        Promise.all(blocks).then(function (buffers) {
            callback(undefined, new ZseaFileReadable(buffers));
        }).catch(function (e) {
            return callback(Errors_1.Errors.ResourceNotFound);
        });
    }
    _size(path, ctx, callback) {
        this.getPropertyFromResource(path, ctx, 'size', callback);
    }
    _lockManager(path, ctx, callback) {
        this.getPropertyFromResource(path, ctx, 'locks', callback);
    }
    _propertyManager(path, ctx, callback) {
        this.getPropertyFromResource(path, ctx, 'props', callback);
    }
    _readDir(path, ctx, callback) {
        const base = path.toString(true);
        const children = [];
        for (const subPath in this.resources) {
            if ((0, JSCompatibility_1.startsWith)(subPath, base)) {
                const pSubPath = new Path_1.Path(subPath);
                if (pSubPath.paths.length === path.paths.length + 1)
                    children.push(pSubPath);
            }
        }
        callback(undefined, children);
    }
    /**
     * Get a property of an existing resource (object property, not WebDAV property). If the resource doesn't exist, it is created.
     *
     * @param path Path of the resource
     * @param ctx Context of the method
     * @param propertyName Name of the property to get from the resource
     * @param callback Callback returning the property object of the resource
     */
    getPropertyFromResource(path, ctx, propertyName, callback) {
        const resource = this.resources[path.toString()];
        if (!resource)
            return callback(Errors_1.Errors.ResourceNotFound);
        callback(undefined, resource[propertyName]);
    }
    _creationDate(path, ctx, callback) {
        this.getPropertyFromResource(path, ctx, 'creationDate', callback);
    }
    _lastModifiedDate(path, ctx, callback) {
        this.getPropertyFromResource(path, ctx, 'lastModifiedDate', callback);
    }
    _type(path, ctx, callback) {
        this.getPropertyFromResource(path, ctx, 'type', callback);
    }
}
exports.ZseaFileSystem = ZseaFileSystem;
