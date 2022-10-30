"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiteeSerializer = void 0;
const GiteeFileSystem_1 = require("./GiteeFileSystem");
const webdav_server_1 = require("webdav-server");
class GiteeSerializer {
    uid() {
        return 'GiteeSerializer-1.0.0';
    }
    serialize(fs, callback) {
        callback(undefined, {
            properties: fs.properties,
            configure: fs.configure
        });
    }
    unserialize(serializedData, callback) {
        const fs = new GiteeFileSystem_1.GiteeFileSystem(serializedData.configure.access_token, serializedData.configure.owner, serializedData.configure.repo, serializedData.configure.branch);
        for (const path in serializedData.properties)
            fs.properties[path] = new webdav_server_1.v2.LocalPropertyManager(serializedData.properties[path]);
        callback(undefined, fs);
    }
}
exports.GiteeSerializer = GiteeSerializer;
