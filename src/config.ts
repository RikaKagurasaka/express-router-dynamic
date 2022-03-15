import {Matcher} from "anymatch"
import {WatchOptions} from "chokidar";

/**
 * DynamicRouter对象的实例级别配置，在构造new DynamicRouter对象的时候传入。
 */
export interface Config {
    /**
     * 路由根目录。
     * 凡在这一目录下的文件都会被serve出去：js文件是把其default导出的函数作为RequestHandler执行，其他文件则一律作为静态文件进行分发。
     * 必填
     */
    webroot: string

    /**
     * 允许被作为RequestHandler，执行其中代码的文件的匹配规则。
     * 只有一个文件的**相对于webroot的路径**与该规则匹配时，才会将其require进来，并将其中的default导出的函数作为RequestHandler，执行其代码。
     * **请注意：在默认情况下，只有以.route.js或.hjs结尾的文件才会被执行代码！一般的js只会被作为静态文件分发！**
     * 您可以通过将此项配置为["*.js"]来使得任意js文件都被作为RequestHandler，但这样就不会向前端分发js文件资源了。
     * 如果您同时在此服务器下部署静态文件服务和动态后端，建议您考虑使用下方的DirectoryConfig，为不同文件夹配置独立的exec配置，目录级别配置优先于这里的实例级别配置。
     * 默认值：["*.route.js", "*.hjs"]
     */
    exec?: Matcher

    /**
     * 除外规则。
     * 当一个文件的**相对于webroot的路径**与除外规则匹配时，这个文件不会被serve，无论是执行代码还是静态文件分发。
     * 接受可以含通配符的字符串、正则、函数等等，使用anymatch进行匹配，详见 https://www.npmjs.com/package/anymatch
     * 默认值：["*.ts", "*.js.map"]
     */
    exclude?: Matcher

    /**
     * 当用户访问不带后缀的URL时，允许隐式推断的文件后缀。
     * 当用户访问一个URL时，会将URL拼接上这个后缀，尝试查找文件进行serve。
     * 不支持使用*进行通配匹配，也不支持正则。
     * 注意此配置与index不同，index是在URL请求对应的目录里面查找文件，而此配置是在（去除结尾的/后的）URL末尾直接拼接上该后缀进行查找文件。
     * 例：在默认配置下，访问/a/b时，文件/a/b.route.js、/a/b.html、/a/b.hjs均是有效匹配，会按照定义的顺序查找文件，若找到再根据exec规则判断是执行代码还是分发静态文件。
     * 当index和suffix同时存在匹配的文件时，**index配置匹配到的文件的优先级总是高于suffix配置。**
     * 默认值：[".route.js", ".html", ".hjs"]
     */
    suffix?: string[]

    /**
     * 当用户请求访问的是一个目录时，按照此选项定义的顺序，在目录内查找文件进行serve。
     * 不支持使用*进行通配匹配，也不支持正则。
     * 注意此配置与suffix不同，suffix是在（去除结尾的/后的）URL末尾直接拼接上suffix后缀进行匹配文件，而此配置是在URL请求对应的目录里面查找文件。
     * 例：在默认配置下，访问/a/b时，文件/a/b/index.route.js、/a/b/index.html、/a/b/index.hjs均是有效匹配，会按照定义的顺序查找文件，若找到再根据exec规则判断是执行代码还是分发静态文件。
     * 当index和suffix同时存在匹配的文件时，**index配置匹配到的文件的优先级总是高于suffix配置。**
     * 默认值：["index.route.js", "index.html", "index.hjs"]
     */
    index?: string[]

    /**
     * 当直接使用URL本身，和根据index、suffix规则均没有查找到匹配的文件时，是否允许将去父目录查找匹配的**exec动态路由文件**。
     * 注意去父目录查找时，**只会匹配符合exec规则的动态路由文件，不会匹配静态文件**。
     * 例：当此配置为true、请求URL为/a/b/c/d时，若存在文件/a/b.route.js、且不存在能直接与/a/b/c/d匹配的静态或动态文件、且不存在能直接与/a/b/c匹配的动态文件，
     * 则允许执行/a/b.route.js中的代码，同时/a/b.route.js里面通过req.url获取到的值会是/c/d。
     * 默认值：true
     */
    exec_try_parent_dir?: boolean

    /**
     * 对于handler抛出的异常，是否使用logger进行打印和打印的级别。
     * undefined表示不打印，否则，需要从log4js的级别中选择：https://www.npmjs.com/package/log4js
     * 默认值：undefined
     */
    handler_error_log_level?: string | undefined

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

    /**
     * log4js logger的category名称
     * 默认值："DynamicRouter"
     */
    log4js_category?: string

    /**
     * log4js logger的logger.level
     * 需要从log4js的级别中选择：https://www.npmjs.com/package/log4js
     * 默认值："info"
     */
    log4js_level?: string

    // 此行以下的配置为进阶配置，如无特殊需求，一般不建议修改。

    /**
     * 对webroot和extra_watch(如有)进行watch时，传入的options。
     * 详见chokidar文档： https://www.npmjs.com/package/chokidar
     * 默认值：{}
     */
    chokidar_options?: WatchOptions

    /**
     * 忽略node_modules。
     * 默认值：true
     */
    exclude_node_modules?: boolean

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
     * 当有任何webroot中的js文件发生变动时，是否通过清空require.cache来确保它所require的其他所有文件也能被重新加载。
     * 默认值：true
     */
    clear_require_cache?: boolean

    /**
     * 每当有任何webroot中的js文件发生变动，就丢弃所有已经加载的RequestHandler对象（相当于视为所有文件都发生了变更）。通常不建议使用。
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
}

export const defaultConfig: Partial<Config> = {
    exec: ["*.route.js", "*.hjs"],
    exclude: ["*.ts", "*.js.map"],
    suffix: [".route.js", ".html", ".hjs"],
    index: ["index.route.js", "index.html", "index.hjs"],
    exec_try_parent_dir: true,
    handler_error_log_level: undefined,
    use_esm_import: false,
    log4js_category: "DynamicRouter",
    log4js_level: "info",
    chokidar_options: {},
    exclude_node_modules: true,
    debounceWait: 1000,
    load_on_demand: true,
    clear_require_cache: true,
    force_full_reload: false,
    extra_watch: [],
}

type DirectoryConfigSharedProperties = "exec" | "exclude" | "suffix" | "index" | "exec_try_parent_dir" |
    "handler_error_log_level" | "use_esm_import" | "load_on_demand" | "clear_require_cache"
export const _DirectoryConfigSharedProperties = ["exec", "exclude", "suffix", "index", "exec_try_parent_dir", "handler_error_log_level", "use_esm_import", "load_on_demand", "clear_require_cache"]

/**
 * 可以对webroot下每个目录分别进行的配置，配置方式是在这个目录下放置一个名为`__config.js__`的文件。
 * 其中，上方DirectoryConfigSharedProperties中声明的那些属性是DirectoryConfig中也可以使用的实例级别属性，其含义同上方Config所述、默认值同当前的实例级别配置。
 */
export interface DirectoryConfig extends Pick<Config, DirectoryConfigSharedProperties> {
    /**
     * 是否允许从父级目录继承配置。
     * 若为false，则不会尝试从任何父级目录继承配置，无论父级目录的propagateIntoChildren为何值。
     * 这个属性永远不会从父级继承、也永远不会传播到子级。
     * 默认值：true
     */
    inheritFromParent?: boolean

    /**
     * 是否允许子级目录从这里继承配置。
     * 若为false，则不会将配置传播到任何子级目录，无论子级目录的inheritFromParent为何值。
     * 这个属性永远不会从父级继承、也永远不会传播到子级。
     * 默认值：true
     */
    propagateIntoChildren?: boolean
}

export const defaultDirectoryConfig: Partial<DirectoryConfig> = {}

export function mergeConfig<T>(config: T, defaultConfig: Partial<T>): T {
    for (let key in defaultConfig) {
        if (config[key] === undefined) {
            config[key] = defaultConfig[key]
        }
    }
    return config
}
