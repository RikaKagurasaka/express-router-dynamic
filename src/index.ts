import {Config, getConfigAfterMergingDefault} from "./config";
import {NextFunction, Request, RequestHandler, Response} from "express";
import {bindSelf, extendPrototype} from "@starrah/prototype-utils";
import path from "path";
import _, {debounce} from "lodash";
import log4js from "@log4js-node/log4js-api";
import chokidar, {FSWatcher} from "chokidar"
import serveStatic from "serve-static";
import anymatch from "anymatch"
import http from "http";
import {existsAsync, hookNames, Hooks, reqSetPath} from "./utils";
import AwaitLock from "await-lock";
import Dict = NodeJS.Dict;

export interface DynamicRouter extends Function, RequestHandler, Config {

}

export class DynamicRouter {
    handlers: Dict<{ handler: RequestHandler } & Hooks> = {}
    nofile_cache: Set<string> = new Set()
    watcher: FSWatcher
    extra_watchers: FSWatcher[] = []
    logger = log4js.getLogger("DynamicRouter")
    serve_static: serveStatic.RequestHandler<http.ServerResponse>

    private _destroyed = false
    private debounceQueue: Dict<boolean> = {}
    private shouldClearCache = false
    private _debouncedUpdateHandlers
    private lock = new AwaitLock()

    constructor(config: Config) {
        Object.assign(this, getConfigAfterMergingDefault(config))
        this.logger.level = this.log_level
        const that = bindSelf(this.__call__)
        if (this.use_esm_import !== false) this.logger.warn(`ExperimentalWarning: use_esm_import is an experimental feature. This feature could change at any time`)

        this.serve_static = serveStatic(this.prefix, {index: false, redirect: false})
        this._debouncedUpdateHandlers = debounce(this._updateHandlers.bind(that), this.debounceWait)

        this.watcher = chokidar.watch(this.prefix, {ignoreInitial: true, cwd: "."})
        this.watcher.on("all", (event, filename) => this._onFileChanged.call(that, event, filename, false))
        this.watcher.on("error", (e) => this.logger.error(`Chokidar: error:`, e))
        this.watcher.on("ready", () => this.logger.info(`Start watching ${this.prefix}`))

        for (const p of this.extra_watch) {
            const watcher = chokidar.watch(p, {ignoreInitial: true, cwd: "."})
            watcher.on("all", (event, filename) => this._onFileChanged.call(that, event, filename, true))
            watcher.on("error", (e) => this.logger.warn(`Chokidar: error on extra watch:`, e))
            watcher.on("ready", () => this.logger.info(`Extra watch: start watching ${p}`))
            this.extra_watchers.push(watcher)
        }

        return extendPrototype(that, this)
    }

    private async __call__(req: Request, res: Response, next: NextFunction) {
        if (this._destroyed) {
            this.logger.error(`DynamicRouter on ${this.prefix} had been destroyed, cannot process request!`)
            next(new Error("DynamicRouter had been destroyed!"))
        }

        let processed_path = req.path
        if (!processed_path.startsWith("/")) processed_path = "/" + processed_path
        processed_path = path.normalize(processed_path)
        reqSetPath(req, processed_path)

        let toTryPaths = [{path: req.path, rela: "/"}] // 最高优先级：path本身
        // 次高优先级：path作为目录，其下的index文件
        toTryPaths = toTryPaths.concat(this.index.map(v => ({
            path: path.join(req.path, v),
            rela: "/"
        })))
        // 接下来优先级：向上查找直到root，找exec_suffix和static_suffix
        const both_suffix = this.exec_suffix.concat(this.static_suffix)
        let curPath = req.path.endsWith("/") ? req.path.slice(0, -1) : req.path // 当url末尾是/时应当去掉
        while (curPath.length > 1) {
            toTryPaths = toTryPaths.concat(both_suffix.map(s => ({
                path: curPath + s,
                rela: "/" + path.relative(curPath, req.path)
            })))
            curPath = path.dirname(curPath)
        }
        // 最后一个优先级：/__default__.route.js等
        toTryPaths = toTryPaths.concat(this.exec_suffix.map(s => ({path: "/__default__" + s, rela: req.path})))

        // 去掉开头的slash
        toTryPaths = toTryPaths.map(v => {
            v.path = v.path.replace(/^\/*/, "");
            return v
        })
        // 排除exclude的文件
        toTryPaths = toTryPaths.filter(({path}) => !anymatch(this.exclude, path))

        for (const {path, rela} of toTryPaths) {
            try {
                const processed = await this._tryFile(path, rela, req, res, next)
                if (processed) return
            } catch (e) {
                next(e)
                return
            }
        }
        next() // 假如这里没有任何人能处理，就交给next
    }

    private async _tryFile(path_: string, rela: string, req: Request, res: Response, next: NextFunction): Promise<boolean> {
        if (this._canExec(path_)) {
            const filename = path.resolve(path.join(this.prefix, path_))
            if (!this.handlers[filename]) {
                // 先检查存不存在，不存在就记录下来，存在就加入缓存
                if (this.nofile_cache.has(filename)) return false
                if (!(await existsAsync(filename))) {
                    this.nofile_cache.add(filename)
                    return false
                }
                await this.lock.acquireAsync()
                try {
                    await this._loadHandler(filename)
                } finally {
                    this.lock.release()
                }
            }
            reqSetPath(req, rela)
            try {
                await this.handlers[filename].handler(req, res, next)
                return true
            } catch (e) {
                if (this.handler_error_log_level) this.logger[this.handler_error_log_level](`Error in handler ${filename}:`, e)
                next(e)
                return true
            }
        } else {
            reqSetPath(req, "/" + path_)
            // @ts-ignore
            await new Promise((resolve, reject) => this.serve_static(req, res, (err) => err ? reject(err) : resolve()))
            return false
        }
    }

    private _canExec(filename: string) {
        return !!this.exec_suffix.find(s => filename.endsWith(s))
    }

    private _onFileChanged(event: string, filename: string, extra_watch = false) {
        filename = path.resolve(filename)
        this.logger.debug(`Chokidar: ${event}: ${filename}`)
        if ((event === "add" || event === "change" || event === "unlink")) {
            this.nofile_cache.delete(filename)
            if (!extra_watch && this._canExec(filename)) {
                // 当变化的文件是有效路由文件时，将该行为记录在队列中，等待debounce结束进行处理。
                this.shouldClearCache = true
                if (event === "unlink") {
                    if (!this.debounceQueue[filename]) this.debounceQueue[filename] = false
                } else this.debounceQueue[filename] = true
                this._debouncedUpdateHandlers()
            } else if (filename.endsWith(".js")) {
                // 否则对于非路由文件的js，只删除这个文件的require缓存
                delete require.cache[filename]
                this.logger[!this.clear_require_cache ? "info" : "debug"](`${extra_watch ? "Extra watch: " : ""}Deleted require cache of ${filename}`)
            }
        }
    }

    private async _updateHandlers() {
        await this.lock.acquireAsync()
        try {
            if (!this.force_full_reload) {
                // 只移除发生改变的
                for (const k in this.debounceQueue) {
                    await this._updateHandler(k, this.debounceQueue[k])
                }
            } else {
                // 移除现在所有的
                for (const k in this.handlers) {
                    await this._updateHandler(k, this.debounceQueue[k] !== false, false)
                }
                if (!this.load_on_demand) this.logger.info(`All handlers reloaded!`)
                else this.logger.info(`All handlers removed!`)
            }
            for (const k in this.debounceQueue) {
                delete this.debounceQueue[k]
            }
        } finally {
            this.lock.release()
        }
        this.logger.debug("_updateHandlers finished")
    }

    private async _updateHandler(filename: string, shouldReload: boolean, verbose = true) {
        let verb, hooks = []
        const relaPath = path.relative(this.prefix, filename)
        if (this.handlers[filename]) {
            this._invokeHookFn(filename, "onDestroy")
            delete this.handlers[filename]
            verb = "Removed"
        }
        if (!this.load_on_demand && shouldReload) {
            try {
                ({hooks} = await this._loadHandler(filename, false));
                verb = verb === "Removed" ? "Reloaded" : "Loaded"
            } catch (e) {
                if (verb === "Removed") this.logger.info(`Removed handler ${relaPath}, but reloading had failed.`)
                verbose = false // 防止下方再次打印log
            }
        }
        if (verbose && verb) this.logger.info(`${verb} handler ${relaPath}${hooks.length ? `, loaded hooks: ${hooks.join(",")}` : ""}`)
    }

    private async _loadHandler(filename: string, verbose = true): Promise<{ hooks: string[] }> {
        if (this.clear_require_cache && this.shouldClearCache) {
            this.shouldClearCache = false
            for (const k in require.cache) {
                delete require.cache[k]
            }
            this.logger.debug("Require cache cleared.")
        } else {
            delete require.cache[filename]
        }

        const relaPath = path.relative(this.prefix, filename)
        let exports
        try {
            if (this.use_esm_import === true) exports = await import(filename)
            else exports = require(filename)
        } catch (e) {
            if (this.use_esm_import === "when_require_failed") {
                try {
                    exports = await import(filename)
                } catch (e) {
                    this.logger.error(`Failed to load ${relaPath}: require and import failed:`, e)
                    throw e
                }
            } else {
                this.logger.error(`Failed to load ${relaPath}: ${this.use_esm_import === true ? "import" : "require"} failed:`, e)
                throw e
            }
        }
        let handler = exports.default
        if (typeof handler !== "function") handler = exports
        if (typeof handler !== "function") handler = undefined
        if (!handler) {
            this.logger.error(`Failed to load ${relaPath}: module's default export is not a function`)
            throw new Error(`module's default export is not a function`)
        }

        const existedHooks = {}
        for (const hookName of hookNames) {
            let hook = handler[hookName]
            if (typeof hook !== "function") hook = exports[hookName]
            if (typeof hook !== "function") hook = undefined
            if (hook) existedHooks[hookName] = hook
        }

        this.handlers[filename] = {handler, ...existedHooks}
        const hooks = _.keys(existedHooks)
        if (verbose) {
            this.logger.info(`Loaded handler ${relaPath}${hooks.length ? `, loaded hooks: ${hooks.join(",")}` : ""}`)
        }
        return {hooks}
    }

    private _invokeHookFn(filename: string, hookName: string, ...args) {
        if (typeof this.handlers[filename]?.[hookName] === "function") {
            try {
                this.handlers[filename]?.[hookName].apply(this, args)
                this.logger.info(`${hookName} Hook invoked for ${filename}`)
            } catch (e) {
                this.logger.warn(`Error encountered while invoking ${hookName} Hook for ${filename}:`, e)
            }
        }
    }

    async onDestroy() {
        await this.watcher.close()
        for (let watcher of this.extra_watchers) {
            await watcher.close()
        }
        this._destroyed = true
        this.logger.info(`DynamicRouter on ${this.prefix} is destroyed.`)
    }
}

export default DynamicRouter
