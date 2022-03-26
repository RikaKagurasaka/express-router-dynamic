import {
    _DirectoryConfigSharedProperties,
    Config,
    defaultConfig,
    defaultDirectoryConfig,
    DirectoryConfig,
    hookNames,
    Hooks,
    mergeConfig
} from "./config";
import {NextFunction, Request, RequestHandler, Response} from "express";
import {bindSelf, extendPrototype} from "@starrah/prototype-utils";
import path from "path";
import _, {debounce} from "lodash";
import log4js, {Logger} from "@log4js-node/log4js-api";
import chokidar, {FSWatcher} from "chokidar"
import serveStatic from "serve-static";
import http from "http";
import {existsAsync, matchPattern, Prefix$IsAny, reqSetPath, RLS} from "./utils";
import AwaitLock from "await-lock";
import Dict = NodeJS.Dict;

export interface DynamicRouter extends Function, RequestHandler, Prefix$IsAny {

}

type HandlerObj = { handler: RequestHandler } & Hooks

export class DynamicRouter {
    config: Config
    dirConfigs: Dict<DirectoryConfig> = {}
    handlers: Dict<HandlerObj> = {}
    nofile_cache: Set<string> = new Set()
    watcher: FSWatcher
    extra_watchers: FSWatcher[] = []
    logger: Logger
    serve_static: serveStatic.RequestHandler<http.ServerResponse>

    get initialized() {
        return this._initialized
    }

    get destroyed() {
        return this._destroyed
    }

    /**
     * 获得一个Promise，该Promise直到本DynamicRouter初始化完成后才会resolve。
     */
    tillInitialized(): Promise<void> {
        return this._initializedPromise
    }

    async destroy() {
        await this.watcher.close()
        for (let watcher of this.extra_watchers) {
            await watcher.close()
        }
        this._destroyed = true
        this.logger.info(`DynamicRouter @ ${this.config.webroot} is destroyed.`)
    }

    onDestroy = this.destroy

    /**
     * 把相对于webroot的路径转为绝对路径。
     * @param relativePath 相对于webroot的路径（开头若有/也没关系，会被忽略）
     */
    getAbsFilename(relativePath: string): string {
        return path.resolve(path.join(this.config.webroot, RLS(relativePath)))
    }

    /**
     * 根据路径获得handler对象。
     * @param relativePath 相对于webroot的路径（开头若有/也没关系，会被忽略）
     * @param shouldLoad 如果该路径对应的文件存在但是还没有被加载，则是否应该立刻予以加载再返回。
     * @return undefined | any 若存在，返回当前在该路径上的handler对象；否则，返回undefined
     */
    async getHandler(relativePath: string, shouldLoad = true): Promise<undefined | any> {
        const filename = this.getAbsFilename(relativePath)
        let result = this.handlers[filename]?.handler
        if (result || !shouldLoad) return result
        const config = this._getDirConfig(filename)
        return await this._tryLoadHandler(filename, config)
    }

    /**
     * getHandler的别名
     */
    $ = this.getHandler

    /**
     * 同步的根据路径获得handler对象。
     * 因为是同步的，该函数无法在路径对应的文件存在但是还没有被加载的情况下直接进行加载，而是会返回undefined。
     * @param relativePath 相对于webroot的路径（开头若有/也没关系，会被忽略）
     * @return undefined | any 若存在，返回当前在该路径上的handler对象；否则，返回undefined
     */
    getHandlerSync(relativePath: string): undefined | any {
        return this.handlers[this.getAbsFilename(relativePath)]?.handler
    }

    private _initialized = false
    private _destroyed = false
    private _initializedPromiseResolver: () => void
    private _initializedPromise: Promise<void> = new Promise(resolve => this._initializedPromiseResolver = resolve)
    private debounceQueue: Dict<boolean> = {}
    private shouldClearCache = false
    private _debouncedUpdateHandlers
    private lock = new AwaitLock()

    constructor(config: Config) {
        this.config = mergeConfig(config, defaultConfig)
        this.logger = log4js.getLogger(this.config.log4js_category)
        this.logger.level = this.config.log4js_level
        if (this.config.use_esm_import !== false) this.logger.warn(`ExperimentalWarning: use_esm_import is an experimental feature. This feature could change at any time`)
        const that = bindSelf(this.__call__)

        this.serve_static = serveStatic(this.config.webroot, {index: false, redirect: false})
        this._debouncedUpdateHandlers = debounce(this._updateHandlers.bind(that), this.config.debounceWait)

        this.watcher = chokidar.watch(this.config.webroot, mergeConfig(this.config.chokidar_options, {cwd: "."}))
        this.watcher.on("all", (event, filename) => this._onFileChanged.call(that, event, filename, false))
        this.watcher.on("error", (e) => this.logger.error(`Chokidar: error:`, e))
        this.watcher.on("ready", () => this.logger.info(`Start watching ${this.config.webroot}`))

        for (const p of this.config.extra_watch) {
            const watcher = chokidar.watch(p, mergeConfig(this.config.chokidar_options, {
                ignoreInitial: true,
                cwd: "."
            }))
            watcher.on("all", (event, filename) => this._onFileChanged.call(that, event, filename, true))
            watcher.on("error", (e) => this.logger.warn(`Chokidar: error on extra watch:`, e))
            watcher.on("ready", () => this.logger.info(`Extra watch: start watching ${p}`))
            this.extra_watchers.push(watcher)
        }

        if (this.config.reload_on_SIGUSR2) process.on("SIGUSR2", async () => {
            if (this.config.reload_on_SIGUSR2) {
                this.logger.warn("Received SIGUSR2")
                await this.lock.acquireAsync()
                try {
                    await this._fullReload();
                } finally {
                    this.lock.release()
                }
            }
        })

        return extendPrototype(that, this)
    }

    private async __call__(req: Request, res: Response, next: NextFunction) {
        if (this._destroyed) {
            this.logger.error(`DynamicRouter on ${this.config.webroot} had been destroyed, cannot process request!`)
            next(new Error("DynamicRouter had been destroyed!"))
        }
        if (!this._initialized) {
            this.logger.debug(`Dynamic Router is still initializing. Request process is delayed.`)
            await this.tillInitialized()
        }

        let processed_path = req.path
        if (!processed_path.startsWith("/")) processed_path = "/" + processed_path
        processed_path = path.normalize(processed_path)
        reqSetPath(req, processed_path)

        // 对每个URL，尝试匹配若干个文件
        const dirConfig = this._getDirConfig(this.getAbsFilename(req.path))
        let toTryPaths = [{path: req.path, rela: "/", config: dirConfig}] // 最高优先级：path本身
        // 次高优先级：path作为目录，其下的index文件
        const indexDirConfig = this._getDirConfig(path.join(this.getAbsFilename(req.path), "index"))
        toTryPaths = toTryPaths.concat(indexDirConfig.index.map(v => ({
            path: path.join(req.path, v),
            rela: "/",
            config: indexDirConfig
        })))
        // 接下来优先级：向上查找直到root，找suffix
        let curPath = req.path.endsWith("/") ? req.path.slice(0, -1) : req.path // 当url末尾是/时应当去掉
        while (curPath.length > 1) {
            const config = this._getDirConfig(this.getAbsFilename(curPath))
            toTryPaths = toTryPaths.concat(config.suffix.map(s => ({
                path: curPath + s,
                rela: "/" + path.relative(curPath, req.path),
                config
            })))
            if (!config.exec_try_parent_dir) break
            curPath = path.dirname(curPath)
        }
        // 最后一个优先级：/__default__${suffix}
        const rootConfig = this._getDirConfig(path.join(this.config.webroot, "__default__"))
        toTryPaths = toTryPaths.concat(rootConfig.suffix.map(s => ({
            path: "/__default__" + s,
            rela: req.path,
            config: rootConfig
        })))

        // 排除exclude的文件
        toTryPaths = toTryPaths.filter(({path, config}) => !matchPattern(config.exclude, RLS(path), {matchBase: true})
            && !(this.config.exclude_node_modules && path.includes("/node_modules/")))

        for (const {path, rela, config} of toTryPaths) {
            try {
                const processed = await this._tryFile(path, config, rela, req, res, next)
                if (processed) return
            } catch (e) {
                next(e)
                return
            }
        }
        next() // 假如这里没有任何人能处理，就交给next
    }

    private async _tryFile(path_: string, config: DirectoryConfig, rela: string, req: Request, res: Response, next: NextFunction): Promise<boolean> {
        const filename = this.getAbsFilename(path_)
        if (this._canExec(filename, config)) {
            if (path_.endsWith("/")) return false
            const handler = await this._tryLoadHandler(filename, config)
            if (!handler) return false
            reqSetPath(req, rela)
            // @ts-ignore
            req.$router = this;
            // @ts-ignore
            res.$router = this;
            try {
                await handler.call(this, req, res, next)
                return true
            } catch (e) {
                if (config.handler_error_log_level) this.logger[config.handler_error_log_level](`Error in handler ${filename}:`, e)
                next(e)
                return true
            }
        } else {
            reqSetPath(req, path_)
            // @ts-ignore
            await new Promise((resolve, reject) => this.serve_static(req, res, (err) => err ? reject(err) : resolve()))
            return false
        }
    }

    private async _tryLoadHandler(filename: string, config: DirectoryConfig): Promise<RequestHandler | undefined> {
        if (!this.handlers[filename]) {
            // 先检查文件存不存在，不存在就记录下来，存在就加入缓存
            if (this.nofile_cache.has(filename)) return
            if (!(await existsAsync(filename))) {
                this.nofile_cache.add(filename)
                return
            }
            await this.lock.acquireAsync()
            try {
                if (!this.handlers[filename]) await this._loadHandler(filename, config)
                return this.handlers[filename]?.handler
            } finally {
                this.lock.release()
            }
        }
        return this.handlers[filename]?.handler
    }

    private _canExec(filename: string, config: DirectoryConfig): boolean {
        return matchPattern(config.exec, path.relative(this.config.webroot, filename), {matchBase: true})
    }

    private static _isConfigFile(filename: string): boolean {
        return filename.endsWith("__config__.js") || filename.endsWith("__config__.json") || filename.endsWith("__config__.mjs") || filename.endsWith("__config__.cjs")
    }

    private async _onFileChanged(event: string, filename: string, extra_watch = false) {
        filename = path.resolve(filename)
        if (this.config.exclude_node_modules && filename.includes(path.sep + "node_modules" + path.sep)) {
            // 如果是node_modules，则删一下缓存直接返回，不打log
            delete require.cache[filename]
            return
        }
        this.logger.debug(`Chokidar: ${event}: ${filename}`)
        if ((event === "add" || event === "change" || event === "unlink")) {
            this.nofile_cache.delete(filename)
            if (!extra_watch) {
                this.debounceQueue[filename] = this.debounceQueue[filename] || event !== "unlink"
                this._debouncedUpdateHandlers()
            } else { // 对于extra_watch中的文件，直接立即删除这个文件的require缓存
                if (require.cache[filename]) {
                    delete require.cache[filename]
                    this.logger.info(`Extra watch: Deleted require cache of ${filename}`)
                }
            }
        }
    }

    private async _updateHandlers() {
        await this.lock.acquireAsync()
        try {
            let queue: [string, boolean][] = _.toPairs(this.debounceQueue) // 两个元素顺序：文件名、是否需要load
            for (const k in this.debounceQueue) {
                delete this.debounceQueue[k]
            }
            // 分为配置文件和其他文件两大类
            const configQueue = _.remove(queue, ([k]) => DynamicRouter._isConfigFile(k)).map(([k]) => k)
            let canExec = queue.map(([k]) => this._canExec(k, this._getDirConfig(k))) // 先根据更新前的配置计算每个文件的可执行性
            // 接下来刷新配置
            for (const k of configQueue) {
                await this._updateConfig(k)
            }
            // 再根据更新后的配置计算每个文件的可执行性，两者取or，然后只保留可执行性为true的
            canExec = _.zip(canExec, queue).map(([c, [k]]) => c || this._canExec(k, this._getDirConfig(k)))
            queue = queue.filter((_, i) => canExec[i])
            if (queue.length > 0) {
                if (!this.config.force_full_reload) { // 只更新队列中的
                    this.shouldClearCache = true
                    const promises = []
                    for (const [k, b] of queue) {
                        promises.push(this._updateHandler(k, b))
                    }
                    await Promise.all(promises)
                } else { // 移除现在所有的
                    await this._fullReload(_.fromPairs(queue))
                }
            }
        } finally {
            this.lock.release()
        }
        if (!this._initialized) {
            this._initialized = true
            this._initializedPromiseResolver()
            this.logger.info(`DynamicRouter @ ${this.config.webroot} initialization finished!`)
        }
        this.logger.debug("_updateHandlers finished")
    }

    private async _updateHandler(filename: string, shouldReload: boolean, verbose = true) {
        let verb, hooks = []
        const config = this._getDirConfig(filename)
        const relaPath = path.relative(this.config.webroot, filename)
        if (this.handlers[filename]) {
            const handler = this.handlers[filename]
            delete this.handlers[filename]
            await this._invokeHookFn(handler, filename, "onDestroy", this) // onDestroy调用不管其中是否抛出异常，都要往下执行，因此无视返回值
            verb = "Removed"
        }
        if (!config.load_on_demand && shouldReload) {
            try {
                ({hooks} = await this._loadHandler(filename, config, false));
                verb = verb === "Removed" ? "Reloaded" : "Loaded"
            } catch (e) {
                if (verb === "Removed") this.logger.info(`Removed handler ${relaPath}, but reloading had failed.`)
                verbose = false // 防止下方再次打印log
            }
        }
        if (verbose && verb) this.logger.info(`${verb} handler ${relaPath}${hooks.length ? `, loaded hooks: ${hooks.join(",")}` : ""}`)
    }

    private async _updateConfig(filename: string) {
        let config
        try {
            if (filename.endsWith("__config__.json")) {
                delete require.cache[filename]
                config = require(filename)
            } else {
                config = await import(`${filename}?ERD=${Date.now()}`)
                config = config.default || config
            }
            this.dirConfigs[path.dirname(filename)] = config
            this.logger.info(`Loaded Directory Config: ${filename}`)
        } catch (e) {
            this.logger.error(`Failed to Load Directory Config: ${filename}`, e)
        }
    }

    private async _fullReload(extraQueue: Dict<boolean> = {}) {
        this.shouldClearCache = true
        const toUpdates = new Set(_.keys(extraQueue).concat(_.keys(this.handlers)))
        const promises = []
        for (const k of toUpdates) {
            promises.push(this._updateHandler(k, extraQueue[k] !== false, false))
        }
        await Promise.all(promises)
        this.logger.info(`All Handlers Removed or Reloaded!`)
    }

    private async _loadHandler(filename: string, config: DirectoryConfig, verbose = true): Promise<{ hooks: string[] }> {
        if (config.clear_require_cache && this.shouldClearCache) {
            this.shouldClearCache = false
            for (const k in require.cache) {
                delete require.cache[k]
            }
            this.logger.debug("Require cache cleared.")
        } else {
            delete require.cache[filename]
        }

        const relaPath = path.relative(this.config.webroot, filename)
        let exports
        try {
            if (config.use_esm_import === true) exports = await import(`${filename}?ERD=${Date.now()}`)
            else {
                delete require.cache[filename]
                exports = require(filename)
            }
        } catch (e) {
            if (config.use_esm_import === "when_require_failed") {
                try {
                    exports = await import(`${filename}?ERD=${Date.now()}`)
                } catch (e) {
                    this.logger.error(`Failed to load ${relaPath}: require and import failed:`, e)
                    throw e
                }
            } else {
                this.logger.error(`Failed to load ${relaPath}: ${config.use_esm_import === true ? "import" : "require"} failed:`, e)
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

        const handlerObj = {handler, ...existedHooks}
        const e = await this._invokeHookFn(handlerObj, filename, "onCreate", this)
        if (e) {
            this.logger.error(`Failed to load ${relaPath}: hook onCreate failed:`, e)
            throw e
        }

        this.handlers[filename] = handlerObj
        const hooks = _.keys(existedHooks)
        if (verbose) {
            this.logger.info(`Loaded handler ${relaPath}${hooks.length ? `, loaded hooks: ${hooks.join(",")}` : ""}`)
        }
        return {hooks}
    }

    private async _invokeHookFn(handler: HandlerObj, filename: string, hookName: string, ...args): Promise<Error> {
        if (typeof handler?.[hookName] === "function") {
            try {
                await handler[hookName].apply(handler.handler, args)
                this.logger.info(`${hookName} Hook invoked for ${filename}`)
            } catch (e) {
                this.logger.warn(`Error encountered while invoking ${hookName} Hook for ${filename}:`, e)
                return e
            }
        }
    }

    private _getDirConfig(filename: string): DirectoryConfig {
        filename = path.dirname(path.resolve(filename))
        const rela = path.relative(this.config.webroot, filename)
        if (!rela || rela.startsWith("..")) filename = this.config.webroot // 防止配置查找越出webroot
        const initialConfig: DirectoryConfig = this.dirConfigs[filename] || {}
        const result = _.clone(initialConfig)
        if (initialConfig.inheritFromParent !== false) {
            while (path.relative(this.config.webroot, filename)) {
                filename = path.dirname(filename)
                const config = this.dirConfigs[filename]
                if (config && config.propagateIntoChildren !== false) mergeConfig(result, config)
            }
        }
        mergeConfig(result, defaultDirectoryConfig)
        mergeConfig(result, _.pick(this.config, _DirectoryConfigSharedProperties))
        return result
    }
}

export default DynamicRouter
