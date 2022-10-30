import { v2 as webdav } from 'webdav-server'
import * as http from 'http';
import { GiteeStorage } from "./fs/storages/gitee"
import { ZseaFileSystem } from "./fs/ZseaFileSystem"
import log4js from "log4js"
import cfg from "./configure"
import path from 'path';
const logger = log4js.getLogger("WEBDAV");
logger.level = "TRACE";


(async function main() {
    let gitee: GiteeStorage = new GiteeStorage(cfg.GITEE_ACCESSTOKEN, cfg.GITEE_OWNER, cfg.GITEE_REPO, cfg.GITEE_BRANCH);

    let configure: {
        mountPoint: string,
        blockSize?: number
        users: {
            username: string,
            password: string,
            path?: string
            rights?: string[]
        }[]
    } | null = null;
    try {
        let txt = await gitee.read("/configure");
        configure = JSON.parse(txt.toString());
    }
    catch (e) {

    }
    if (!configure) {
        configure = {
            mountPoint: "/",
            users: []
        }
    }
    logger.info("配置文件",configure);
    let fs = new ZseaFileSystem(gitee, configure.blockSize || 1024 * 1024 * 4)
    await fs.Initialization();
    let userManager: webdav.SimpleUserManager | undefined | null = null;
    let privilegeManager: webdav.SimplePathPrivilegeManager | undefined | null;
    if (configure.users && configure.users.length) {
        userManager = new webdav.SimpleUserManager();
        privilegeManager = new webdav.SimplePathPrivilegeManager();
        configure.users.every((u) => {
            let user = userManager?.addUser(u.username, u.password, false);
            if (user) {
                let aPath = configure?.mountPoint || "/"
                if (u.path) {
                    aPath = path.join(aPath, u.path);
                }
                //let aPath=path.join(point,u.path||"/");
                privilegeManager?.setRights(user, aPath, u.rights || ['all']);
            }

        });


    }
    const server = new webdav.WebDAVServer({
        httpAuthentication: userManager ? new webdav.HTTPDigestAuthentication(userManager, 'Default realm') : undefined,
        privilegeManager: privilegeManager ? privilegeManager : undefined,
        port: Number(cfg.WEBPORT)
    });
    if(!await new Promise(function (resolve, reject) {

        server.setFileSystem(configure?.mountPoint || "/", fs, (successed) => {
            resolve(successed);
        });
    })){
        logger.error(`文件系统挂载失败 ${configure?.mountPoint}`);
        return;
    }
    let httpServer=await new Promise<http.Server|undefined>(function(resolve,reject){
        server.start((httpServer?: http.Server)=>{
            resolve(httpServer);
        })
    });
    if(!httpServer){
        logger.error(`服务启动失败 ${cfg.WEBPORT}`);
        return;
    }
    
    logger.info(`服务启动成功`,httpServer.address());
})();
