"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiteeFileSystem = void 0;
const GiteeSerializer_1 = require("./GiteeSerializer");
const BufferReadable_1 = require("../BufferReadable");
const webdav_server_1 = require("webdav-server");
const ax = __importStar(require("axios"));
const axios = ax.default;
class GiteeFileSystem extends webdav_server_1.v2.FileSystem {
    constructor(access_token, owner, repo, branch) {
        super(new GiteeSerializer_1.GiteeSerializer());
        this.access_token = access_token;
        this.owner = owner;
        this.repo = repo;
        this.branch = branch;
        this.properties = {};
        this.locks = {};
        this.cached = {};
        this.configure = {
            access_token: access_token,
            owner: owner,
            repo: repo,
            branch: branch || "master"
        };
    }
    _openReadStream(path, ctx, callback) {
        this.load(path).then(function (data) {
            //console.log(data);
            if (!data || Array.isArray(data)) {
                callback(webdav_server_1.v2.Errors.InvalidOperation);
                return;
            }
            let file = data;
            if (!file.content) {
                callback(webdav_server_1.v2.Errors.InvalidOperation);
                return;
            }
            let buf = Buffer.from(file.content, "base64");
            let stream = new BufferReadable_1.BufferReadable(buf);
            callback(undefined, stream);
        }).catch(function (e) {
            callback(e, undefined);
        });
        // this._parse(path, (e, data) => {
        //     if (e)
        //         return callback(e);
        //     if (data.constructor === Array)
        //         return callback(webdav.Errors.InvalidOperation);
        //     const stream = request({
        //         url: (data as GitHubAPIResource).download_url,
        //         method: 'GET',
        //         qs: {
        //             'client_id': this.client_id,
        //             'client_secret': this.client_secret
        //         },
        //         headers: {
        //             'user-agent': 'webdav-server'
        //         }
        //     });
        //     stream.end();
        //     callback(null, (stream as any) as Readable);
        // })
    }
    _lockManager(path, ctx, callback) {
        let p = path.toString();
        let locker = this.locks[p];
        if (locker) {
            callback(undefined, locker);
        }
        else {
            locker = new webdav_server_1.v2.LocalLockManager();
            this.locks[p] = locker;
            callback(undefined, locker);
        }
    }
    _propertyManager(path, ctx, callback) {
        if (path.isRoot()) {
            let props = this.properties[path.toString()];
            if (!props) {
                props = new webdav_server_1.v2.LocalPropertyManager();
                this.properties[path.toString()] = props;
            }
            return callback(undefined, props);
        }
        let self = this;
        this.load(path.getParent()).then(function (data) {
            let props = self.properties[path.toString()];
            if (!props) {
                props = new webdav_server_1.v2.LocalPropertyManager();
                self.properties[path.toString()] = props;
            }
            const info = data;
            for (const file of info)
                if (file.name === path.fileName()) {
                    const gitee = {};
                    const create = (name, value) => {
                        // const el = webdav.XML.createElement(name);
                        // if (value !== null && value !== undefined)
                        //     el.add(value);
                        //     gitee.push(el);
                        gitee[name] = value;
                    };
                    //create('json', JSON.stringify(file));
                    create('path', file.path);
                    create('sha', file.sha);
                    create('size', file.size);
                    create('url', file.url);
                    create("name", file.name);
                    // create('html-url', file.html_url);
                    // create('git-url', file.git_url);
                    // create('download-url', file.download_url);
                    create('type', file.type);
                    // const links = webdav.XML.createElement('links');
                    // for (const name in file._links)
                    //     links.ele(name).add(file._links[name]);
                    props.setProperty('gitee', JSON.stringify(gitee), {}, (e) => {
                        callback(e, props);
                        //console.log("已回调")
                    });
                    return;
                }
            callback(webdav_server_1.v2.Errors.ResourceNotFound, props);
        }).catch(function (e) {
            callback(e, undefined);
        });
    }
    _readDir(path, ctx, callback) {
        //console.log(path.toString());
        this.load(path).then(function (data) {
            //console.log(data);
            if (!data || !Array.isArray(data)) {
                callback(webdav_server_1.v2.Errors.InvalidOperation);
                return;
            }
            callback(undefined, data.map((r) => r.path));
        }).catch(function (e) {
            callback(e, undefined);
        });
        // this._parse(path, (e, data) => {
        //     if (e)
        //         return callback(e);
        //     if (data.constructor !== Array)
        //         return callback(webdav.Errors.InvalidOperation);
        //     callback(null, (data as GiteeAPIResource[]).map((r) => r.path));
        // })
    }
    _size(path, ctx, callback) {
        this.load(path).then(function (data) {
            //console.log(data);
            if (!data || Array.isArray(data)) {
                callback(undefined, undefined);
                return;
            }
            callback(undefined, data.size);
        }).catch(function (e) {
            callback(e, undefined);
        });
        // this._parse(path, (e, data) => {
        //     callback(e, data && data.constructor !== Array ? (data as GiteeAPIResource).size : undefined);
        // })
    }
    _type(path, ctx, callback) {
        if (path.isRoot())
            return callback(undefined, webdav_server_1.v2.ResourceType.Directory);
        this.load(path).then(function (data) {
            callback(undefined, data ? data.constructor === Array ? webdav_server_1.v2.ResourceType.Directory : webdav_server_1.v2.ResourceType.File : undefined);
        }).catch(function (e) {
            callback(e, undefined);
        });
    }
    _fastExistCheck(ctx, path, callback) {
        console.log("判断是否存在");
        callback(true);
    }
    _create(path, ctx, callback) {
        //throw new Error("未实现");
        console.log("创建文件");
        (() => __awaiter(this, void 0, void 0, function* () {
            let file = yield this.load(path);
            console.log(file);
        }))();
    }
    _openWriteStream(path, ctx, callback) {
        console.log("写入数据");
    }
    _creationDate(path, ctx, callback) {
        console.log("获取文件创建时间");
    }
    _lastModifiedDate(path, ctx, callback) {
        //this.getPropertyFromResource(path, ctx, 'lastModifiedDate', callback);
        console.log("获取文件最后修改时间");
    }
    load(path) {
        let key = path.toString();
        let cache = this.cached[key];
        if (cache && cache.date + 5000 < Date.now()) {
            if (cache.error) {
                return Promise.reject(cache.error);
            }
            return Promise.resolve(cache.body);
        }
        let self = this;
        return axios.get(`https://gitee.com/api/v5/repos/${this.configure.owner}/${this.configure.repo}/contents${path.toString()}?ref=${this.configure.branch}&access_token=${this.configure.access_token}`)
            .then(function (res) {
            let body;
            if (Array.isArray(res.data)) {
                body = res.data.map(item => ({
                    name: item.name,
                    path: item.path,
                    sha: item.sha,
                    size: item.size || 0,
                    type: item.type,
                    url: item.url,
                    content: item.content,
                    encoding: "base64"
                }));
            }
            else {
                let item = res.data;
                body = {
                    name: item.name,
                    path: item.path,
                    sha: item.sha,
                    size: item.size || 0,
                    type: item.type,
                    url: item.url,
                    content: item.content,
                    encoding: "base64"
                };
            }
            self.cached[key] = {
                body: body,
                date: Date.now()
            };
            return body;
        }).catch(function (e) {
            self.cached[key] = {
                error: e,
                date: Date.now()
            };
            return e;
        });
    }
}
exports.GiteeFileSystem = GiteeFileSystem;
