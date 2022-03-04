import {Matcher} from "anymatch"

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
     * 默认值：[".route.js", ".hjs"]
     */
    exec_suffix?: string[]

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
     * 仅在no_require_cache为false时才生效。
     * 默认值：[]
     */
    extra_watch?: string[]
}

const defaultConfig: Partial<Config> = {
    exec_suffix: [".route.js", ".hjs"],
    exclude: ["*.ts", "*.js.map"],
    index: ["index.route.js", "index.html", "index.js"],
    log_level: "info",
    handler_error_log_level: undefined,
    debounceWait: 1000,
    load_on_demand: true,
    clear_require_cache: true,
    force_full_reload: false,
    extra_watch: []
}

export function getConfigAfterMergingDefault(config: Config): Config {
    for (let key in defaultConfig) {
        if (config[key] === undefined) {
            config[key] = defaultConfig[key]
        }
    }
    return config
}
