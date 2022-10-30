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
exports.Parallelizer = void 0;
class Parallelizer {
    constructor(maxTasks = 1) {
        this.queue = [];
        this.waitor = [];
        this.isRuning = true;
        for (let i = 0; i < maxTasks; i++) {
            this.taskHandler(i);
        }
    }
    onPush() {
        let waitor = this.waitor.shift();
        if (waitor) {
            waitor(undefined);
        }
    }
    taskHandler(index) {
        return __awaiter(this, void 0, void 0, function* () {
            while (this.isRuning) {
                let task = this.queue.shift();
                if (task) {
                    yield Promise.resolve(task && task.task(index)).then(function (result) {
                        task === null || task === void 0 ? void 0 : task.completed(undefined, result);
                    }).catch(function (e) {
                        task === null || task === void 0 ? void 0 : task.completed(e, undefined);
                    });
                }
                else {
                    yield new Promise((resolve) => {
                        this.waitor.push(resolve);
                    });
                }
                //await waiting;
            }
        });
    }
    execute(f) {
        let self = this;
        return new Promise(function (resolve, reject) {
            self.queue.push({
                task: f,
                completed: function (e, result) {
                    if (e) {
                        reject(e);
                    }
                    else {
                        resolve(result);
                    }
                }
            });
            self.onPush();
        });
    }
    stop() {
        this.isRuning = false;
    }
}
exports.Parallelizer = Parallelizer;
