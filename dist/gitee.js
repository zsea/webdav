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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiteeStorage = void 0;
const ax = __importStar(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const query_string_1 = __importDefault(require("query-string"));
const parallelizer_1 = require("./parallelizer");
const retry_1 = require("./retry");
const axios = ax.default;
class GiteeStorage {
    constructor(access_token, owner, repo, branch) {
        this.access_token = access_token;
        this.owner = owner;
        this.repo = repo;
        this.branch = branch;
        this.cached = {};
        this.parallelizer = new parallelizer_1.Parallelizer(1);
        this.configure = {
            access_token: access_token,
            owner: owner,
            repo: repo,
            branch: branch || "master"
        };
    }
    getFile(path) {
        let self = this;
        return axios.get(`https://gitee.com/api/v5/repos/${self.configure.owner}/${self.configure.repo}/contents${path}?ref=${self.configure.branch}&access_token=${self.configure.access_token}`)
            .then(function (res) {
            //console.log(path,res);
            let body;
            if (Array.isArray(res.data)) {
                throw new Error("NotBlockFile");
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
                    encoding: item.encoding
                };
                if (self.cached[path]) {
                    clearTimeout(self.cached[path].timer);
                }
                self.cached[path] = {
                    sha: body.sha,
                    timer: setTimeout(() => { }, 5000)
                };
            }
            return body;
        });
    }
    getSha(path) {
        if (this.cached[path])
            return Promise.resolve(this.cached[path].sha);
        return this.getFile(path).then(function (body) {
            return body.sha;
        }).catch(function (e) {
            if (e.message === "NotBlockFile")
                return undefined;
            throw e;
        }).then(function (sha) {
            return sha;
        });
    }
    read(path) {
        let self = this;
        return (0, retry_1.retry)(function () {
            return self.parallelizer.execute(function () {
                return self.getFile(path).then(function (body) {
                    if (body.type !== "file")
                        throw new Error("NotBlockFile");
                    if (body.encoding !== "base64")
                        throw new Error("NotBase64");
                    return Buffer.from(body.content, "base64");
                });
            });
        }, 5, 500);
    }
    save(path, buffer) {
        let content = buffer.toString("base64");
        let url = `https://gitee.com/api/v5/repos/${this.configure.owner}/${this.configure.repo}/contents${path}`;
        let self = this;
        return (0, retry_1.retry)(function () {
            return self.parallelizer.execute(function () {
                return self.getSha(path).then(function (sha) {
                    let body = new form_data_1.default();
                    body.append("access_token", self.configure.access_token);
                    body.append("content", content);
                    body.append("message", "zfs:" + Date.now());
                    body.append("branch", self.configure.branch);
                    if (sha) {
                        body.append("sha", sha);
                        return axios.put(url, body);
                    }
                    return axios.post(url, body);
                }).finally(function () {
                    delete self.cached[path];
                });
            });
        }, 5, 500);
    }
    delete(path) {
        let self = this;
        return (0, retry_1.retry)(function () {
            return self.parallelizer.execute(function () {
                return self.getSha(path).then(function (sha) {
                    if (!sha)
                        return Promise.resolve();
                    let query = {
                        access_token: self.configure.access_token,
                        sha: sha,
                        message: "zfs:" + Date.now(),
                        branch: self.configure.branch
                    };
                    return axios.delete(`https://gitee.com/api/v5/repos/${self.configure.owner}/${self.configure.repo}/contents${path}?${query_string_1.default.stringify(query)}`, {
                        headers: {
                            'Content-Type': 'application/json;charset=UTF-8'
                        }
                    });
                }).then(function (res) {
                }).finally(function () {
                    delete self.cached[path];
                });
            });
        }, 5, 500);
    }
}
exports.GiteeStorage = GiteeStorage;
