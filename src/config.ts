import {Matcher} from "anymatch"
import {WatchOptions} from "chokidar";

export interface Config {
    /**
     * 路由根目录。
     * 凡在这一目录下的文件都会被serve出去：js文件是把其default导出的函数作为RequestHandler执行，其他文件则一律作为静态文件进行分发。
     * 必填
     */
    prefix: string

    /**
     * 允许被作为路由处理器，执行代码的文件的匹配规则。
     * 只有一个文件的后缀与此处定义的规则匹配时，才会将其require进来，并将其中的default导出的函数作为RequestHandler，执行其代码。
     * **请注意：在默认情况下，只有以.route.js或.hjs文件才会被执行代码！一般的js只会被作为静态文件分发！**
     * 同时，与这里定义的后缀匹配的文件是不需要与请求URL完全匹配就可以被serve的，例如假设存在a.route.js文件，则URL为/a、/a.route.js时都可以访问到。
     * 默认值：[".route.js", ".hjs"]
     */
    exec_suffix?: string[]

    /**
     * 作为静态文件分发时，允许隐式推断的文件后缀。
     * 与这里定义的后缀匹配的文件是不需要与请求URL完全匹配就可以被serve的，例如若定义infer_suffix为[".html"]，假设存在b.html文件，则URL为/b、/b.html时都可以访问到该文件。
     * static_suffix的优先级总是低于exec_suffix。
     * 默认值：[]
     */
    static_suffix?: string[]

    /**
     * 除外规则。
     * 当一个文件的**相对于prefix的路径**与除外规则匹配时，这个文件不会被serve，无论是执行代码还是静态文件分发。
     * 接受可以含通配符的字符串、正则、函数等等，使用anymatch进行匹配，详见 https://www.npmjs.com/package/anymatch
     * 默认值：["*.ts", "*.js.map"]
     */
    exclude?: Matcher

    /**
     * 当用户请求访问的是一个目录时，按照此选项定义的顺序，查找文件进行serve。
     * 不支持使用*进行通配匹配，也不支持正则。
     * 默认值：["index.route.js", "index.html", "index.js"]
     */
    index?: string[]

    /**
     * logger的最低级别。
     * 需要从log4js的级别中选择：https://www.npmjs.com/package/log4js
     * 默认值："info"
     */
    log_level?: string

    /**
     * 对于handler抛出的异常，是否使用logger进行打印和打印的级别。
     * undefined表示不打印，否则，需要从log4js的级别中选择：https://www.npmjs.com/package/log4js
     * 默认值：undefined
     */
    handler_error_log_level?: string | undefined

    // 此行以下的配置为进阶配置，如无特殊需求，一般不建议修改。

    /**
     * 动态加载的debounceTail算法的等待时间。单位ms。
     * 默认值：1000。
     */
    debounceWait?: number

    /**
     * 文件修改后不立即加载，而是当被首次请求时才加载。
     * 默认值：true
     */
    load_on_demand?: boolean

    /**
     * 当有任何prefix中的js文件发生变动时，是否通过清空require.cache来确保它所require的其他所有文件也能被重新加载。
     * 默认值：true
     */
    clear_require_cache?: boolean

    /**
     * 每当有任何prefix中的js文件发生变动，就丢弃所有已经加载的RequestHandler对象（相当于视为所有文件都发生了变更）。通常不建议使用。
     * 注：如果load_on_demand为true，则只是所有的已加载的RequestHandler都会立即销毁、不会再调用，但并不会立即重新加载。
     * 默认值：false
     */
    force_full_reload?: boolean

    /**
     * 不serve内容、但是监视其中的js文件修改，每当修改时清空该文件的cache。
     * 仅在clear_require_cache为false时才有必要，因为clear_require_cache为true时，任何路由文件的变化会清空全部的require缓存。。
     * 默认值：[]
     */
    extra_watch?: string[]

    /**
     * 对prefix和extra_watch(如有)进行watch时，传入的options。
     * 详见chokidar文档： https://www.npmjs.com/package/chokidar
     * 默认值：{}
     */
    chokidar_options?: WatchOptions

    /**
     * 实验性特性警告：此配置所对应的特性是实验性的，可能随时更改！
     *
     * 加载handler时，使用import而不是require（见 http://nodejs.cn/api/esm.html#import-statements）。
     * 可选值：false（总是使用require）、true（总是使用import）、"when_require_failed"（仅当require失败时才尝试使用import）。
     * 这样做使得动态加载es module成为可能，但是，也会引入两个巨大的弊端：
     * 1. 内存泄露。由于目前没有有效的清除Node的ESM加载器的缓存的机制（参见 https://github.com/nodejs/help/issues/2806 , https://github.com/nodejs/help/issues/1399），在发生更新时即使加载了新的文件，旧的对象也无法被释放内存。
     * 2. 路由文件中凡是通过import导入的其他模块（无论是ESM还是CJS）不会被重新加载。通过require导入的不受影响。
     *    具体而言：
     *      i. require时确保依赖重新加载的机制是将整个require.cache清空（配置项clear_require_cache正是控制这一行为的）。
     *      ii. import时，确保路由文件本身能够重新加载的机制是在文件名后加上形如`?ERD=${Date.now()}`的字符串，通过每次传给import的参数不同，确保import不会直接命中缓存。然而对于路由文件内部import的其他文件，我们无法操作其解析出来的文件名。
     *      iii. 可以通过自定义加载器钩子（http://nodejs.cn/api/esm.html#loaders）来规避这一弊端。用法：在启动node时加上参数"--experimental-loader node_modules/express-router-dynamic/esm_loader.mjs"。这一ESM加载器实现了对所有的import都附加随机参数。当然，内存泄漏可能也会变得更严重。
     * 默认值：false
     */
    use_esm_import?: boolean | "when_require_failed"
}

export const defaultConfig: Partial<Config> = {
    exec_suffix: [".route.js", ".hjs"],
    static_suffix: [],
    exclude: ["*.ts", "*.js.map"],
    index: ["index.route.js", "index.html", "index.js"],
    log_level: "info",
    handler_error_log_level: undefined,
    debounceWait: 1000,
    load_on_demand: true,
    clear_require_cache: true,
    force_full_reload: false,
    extra_watch: [],
    chokidar_options: {},
    use_esm_import: false
}

export function mergeConfig<T>(config: T, defaultConfig: Partial<T>): T {
    for (let key in defaultConfig) {
        if (config[key] === undefined) {
            config[key] = defaultConfig[key]
        }
    }
    return config
}
