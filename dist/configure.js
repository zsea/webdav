"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    "GITEE_ACCESSTOKEN": process.env["GITEE_ACCESSTOKEN"] || "",
    "GITEE_OWNER": process.env["GITEE_OWNER"] || "",
    "GITEE_REPO": process.env["GITEE_REPO"] || "",
    "GITEE_BRANCH": process.env["GITEE_BRANCH"] || "",
    "WEBPORT": process.env.PORT || process.env["WEBPORT"] || 3000
};
