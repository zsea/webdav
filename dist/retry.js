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
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = exports.sleep = void 0;
function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}
exports.sleep = sleep;
function run(fn, maxTimes, interval) {
    return __awaiter(this, void 0, void 0, function* () {
        while (maxTimes == -1 || (maxTimes--) > 0) {
            try {
                return yield Promise.resolve(fn());
            }
            catch (e) {
                if (maxTimes == 0) {
                    throw e;
                }
            }
            yield sleep(interval);
        }
        return Promise.reject("unknow");
    });
}
function retry(fn, maxTimes = -1, interval = 0) {
    return run(fn, maxTimes, interval);
}
exports.retry = retry;
