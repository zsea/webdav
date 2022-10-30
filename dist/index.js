"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const webdav_server_1 = require("webdav-server");
const gitee_1 = require("./fs/storages/gitee");
const ZseaFileSystem_1 = require("./fs/ZseaFileSystem");
const log4js_1 = __importDefault(require("log4js"));
const configure_1 = __importDefault(require("./configure"));
const path_1 = __importDefault(require("path"));
const logger = log4js_1.default.getLogger("WEBDAV");
logger.level = "TRACE";
(function main() {
    return __awaiter(this, void 0, void 0, function* () {
        let gitee = new gitee_1.GiteeStorage(configure_1.default.GITEE_ACCESSTOKEN, configure_1.default.GITEE_OWNER, configure_1.default.GITEE_REPO, configure_1.default.GITEE_BRANCH);
        let configure = null;
        try {
            let txt = yield gitee.read("/configure");
            configure = JSON.parse(txt.toString());
        }
        catch (e) {
        }
        if (!configure) {
            configure = {
                mountPoint: "/",
                users: []
            };
        }
        logger.info("配置文件", configure);
        let fs = new ZseaFileSystem_1.ZseaFileSystem(gitee, configure.blockSize || 1024 * 1024 * 4);
        yield fs.Initialization();
        let userManager = null;
        let privilegeManager;
        if (configure.users && configure.users.length) {
            userManager = new webdav_server_1.v2.SimpleUserManager();
            privilegeManager = new webdav_server_1.v2.SimplePathPrivilegeManager();
            configure.users.every((u) => {
                let user = userManager === null || userManager === void 0 ? void 0 : userManager.addUser(u.username, u.password, false);
                if (user) {
                    let aPath = (configure === null || configure === void 0 ? void 0 : configure.mountPoint) || "/";
                    if (u.path) {
                        aPath = path_1.default.join(aPath, u.path);
                    }
                    //let aPath=path.join(point,u.path||"/");
                    privilegeManager === null || privilegeManager === void 0 ? void 0 : privilegeManager.setRights(user, aPath, u.rights || ['all']);
                }
            });
        }
        const server = new webdav_server_1.v2.WebDAVServer({
            httpAuthentication: userManager ? new webdav_server_1.v2.HTTPDigestAuthentication(userManager, 'Default realm') : undefined,
            privilegeManager: privilegeManager ? privilegeManager : undefined,
            port: Number(configure_1.default.WEBPORT)
        });
        if (!(yield new Promise(function (resolve, reject) {
            server.setFileSystem((configure === null || configure === void 0 ? void 0 : configure.mountPoint) || "/", fs, (successed) => {
                resolve(successed);
            });
        }))) {
            logger.error(`文件系统挂载失败 ${configure === null || configure === void 0 ? void 0 : configure.mountPoint}`);
            return;
        }
        let httpServer = yield new Promise(function (resolve, reject) {
            server.start((httpServer) => {
                resolve(httpServer);
            });
        });
        if (!httpServer) {
            logger.error(`服务启动失败 ${configure_1.default.WEBPORT}`);
            return;
        }
        logger.info(`服务启动成功`, httpServer.address());
    });
})();
