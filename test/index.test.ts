import {describe, it} from "mocha"
import {createApp, destroyApp, fscp, fsrm, setupLog4jsConfig} from "./testUtils";
import {DynamicRouter} from "../src";
import {promises as fsp} from "fs";
import path from "path";
import {expect} from "chai";
import {expectEvent} from "./log4jsAppender";
import _ from "lodash";
import delay from "delay";

setupLog4jsConfig()

describe('Core', function () {
    let app, server, axios, tempDir, port, router

    function urlTopath(url: string): string {
        url = url.startsWith("/") ? url.substring(1) : url
        return path.join(tempDir, "route", url)
    }

    before(async () => {
        ({app, server, axios, tempDir, port} = await createApp())
        await fscp("./test/testRoute/core", path.join(tempDir, "route"), {recursive: true})
        router = new DynamicRouter({webroot: path.join(tempDir, "route")})
        app.use(router)
    })

    after(async () => {
        await router.onDestroy()
        await destroyApp(server, tempDir)
    })

    it('should serve static file', async function () {
        const {data} = await axios.get("/static.json", {responseType: "arraybuffer"})
        expect(data).deep.equal(await fsp.readFile(urlTopath("/static.json")))
    });

    it('should serve normal js as static file', async function () {
        const {data} = await axios.get("/browser.js", {responseType: "arraybuffer"})
        expect(data).deep.equal(await fsp.readFile(urlTopath("/browser.js")))
    });

    it('should process dynamic route with exec_suffix', async function () {
        const {data} = await axios.get("/dynamic.route.js")
        expect(data).property("test").equal("/dynamic")
    });

    it('should process dynamic route without exec_suffix', async function () {
        const {data} = await axios.get("/dynamic")
        expect(data).property("test").equal("/dynamic")
    });

    it('should process async dynamic route', async function () {
        const {data} = await axios.get("/async-dynamic")
        expect(data).property("test").equal("/async-dynamic")
    });

    it('should serve index.html', async function () {
        const {data} = await axios.get("/", {responseType: "arraybuffer"})
        expect(data).deep.equal(await fsp.readFile(urlTopath("/index.html")))
    });

    it('should properly process the sequence of index when multiple index file exists', async function () {
        const {data} = await axios.get("/a")
        expect(data).property("test").equal("/a")
    });

    it('should process index for non-root url', async function () {
        const {data} = await axios.get("/a/b", {responseType: "arraybuffer"})
        expect(data).deep.equal(await fsp.readFile(urlTopath("/a/b/index.html")))
    });

    it('should use __default__.route.js when 404', async function () {
        let {data, status} = await axios.get("/something-not-exist", {validateStatus: () => true})
        expect(status).equal(404)
        expect(data).property("by_erd").equal(true);
        ({data, status} = await axios.get("/something-not-exist/", {validateStatus: () => true}));
        expect(status).equal(404)
        expect(data).property("by_erd").equal(true)
    });

    it('should process route that response with non 200', async function () {
        const {data, status} = await axios.get("/d/400", {validateStatus: () => true})
        expect(status).equal(400)
        expect(data).property("test").equal("/d/400")
    });

    it('should process when handler throw exception', async function () {
        const {status} = await axios.get("/a/throw", {validateStatus: () => true})
        expect(status).equal(500)
    });

    it('should process when handler async throws', async function () {
        const {status} = await axios.get("/d/async-throw", {validateStatus: () => true})
        expect(status).equal(500)
    });

    it('should properly handle URL when url exact match', async function () {
        const {data} = await axios.get("/a/b/dynamic")
        expect(data).property("test").equal("/a/b/dynamic")
        expect(data).property("url").equal("/")
    });

    it('should properly handle URL when url not exact match', async function () {
        const {data} = await axios.get("/a/b/c/dynamic/qwq/yyy")
        expect(data).property("test").equal("/a/b/c/dynamic")
        expect(data).property("url").equal("/qwq/yyy")
    });

    it('should properly handle URL when url has query', async function () {
        const {data} = await axios.get("/a/b/dynamic/qwq?abc=123")
        expect(data).property("test").equal("/a/b/dynamic")
        expect(data).property("url").equal("/qwq?abc=123")
    });

    it('should provide index file when url exact match, if file and directory both exists', async function () {
        const {data} = await axios.get("/a/b/c", {responseType: "arraybuffer"})
        expect(data).deep.equal(await fsp.readFile(urlTopath("/a/b/c/index.html")))
    });

    it('should provide JS file when url not exact match, if file and directory both exists', async function () {
        const {data} = await axios.get("/a/b/c/qwq")
        expect(data).property("test").equal("/a/b/c")
        expect(data).property("url").equal("/qwq")
    });

    it('should provide static file c.js when exists file c.js, c.route.js and c/index.html', async function () {
        const {data} = await axios.get("/a/b/c.js", {responseType: "arraybuffer"})
        expect(data).deep.equal(await fsp.readFile(urlTopath("/a/b/c.js")))
    });

    it('should not provide index.route.js when url not exact match', async function () {
        const {status} = await axios.get("/a/yyy", {validateStatus: () => true})
        expect(status).equal(404)
    });

    it('should have same behaviour with or without trailing slash for directory for dynamic route without extension or using index', async function () {
        let res1, res2

        res1 = await axios.get("/a", {validateStatus: () => true})
        res2 = await axios.get("/a/", {validateStatus: () => true})
        expect(res1.status).equal(res2.status);
        expect(res1.data).deep.equal(res2.data);

        res1 = await axios.get("/a/b", {validateStatus: () => true})
        res2 = await axios.get("/a/b/", {validateStatus: () => true})
        expect(res1.status).equal(res2.status);
        expect(res1.data).deep.equal(res2.data);

        res1 = await axios.get("/a/b/dynamic", {validateStatus: () => true})
        res2 = await axios.get("/a/b/dynamic/", {validateStatus: () => true})
        expect(res1.status).equal(res2.status);
        expect(res1.data).deep.equal(res2.data);

        res1 = await axios.get("/a/b/dynamic/qwq", {validateStatus: () => true})
        res2 = await axios.get("/a/b/dynamic/qwq/", {validateStatus: () => true})
        expect(res1.status).equal(res2.status);
        expect(res1.data).deep.equal(res2.data);
    });

    it('should 404 when url has trailing slash for static file or dynamic route with extension', async function () {
        let {status} = await axios.get("/static.json/", {validateStatus: () => true})
        expect(status).equal(404);
        ({status} = await axios.get("/dynamic.route.js/", {validateStatus: () => true}));
        expect(status).equal(404)
    });
});

describe('Directory Config', function () {
    let app, server, axios, tempDir, port, router

    function urlTopath(url: string): string {
        url = url.startsWith("/") ? url.substring(1) : url
        return path.join(tempDir, "route", url)
    }

    before(async () => {
        ({app, server, axios, tempDir, port} = await createApp())
        await fscp("./test/testRoute/core", path.join(tempDir, "route"), {recursive: true})
        router = new DynamicRouter({webroot: path.join(tempDir, "route")})
        app.use(router)
    })

    after(async () => {
        await router.onDestroy()
        await destroyApp(server, tempDir)
    })

    it('should load ESModule config', async function () {
        let {data} = await axios.get("/f/a/d", {responseType: "arraybuffer"})
        expect(data).deep.equal(await fsp.readFile(urlTopath("/f/a/d.route.js")));
        ({data} = await axios.get("/f/a/e"));
        expect(data).property("test").equal("/f/a/e")
    });

    it('should load CommonJS config', async function () {
        const {status} = await axios.get("/f/c/d", {validateStatus: () => true})
        expect(status).equal(404);
        const {data} = await axios.get("/f/c/e")
        expect(data).property("test").equal("/f/c/e")
    });

    it('should load JSON config', async function () {
        let {data} = await axios.get("/f/b/f")
        expect(data).property("test").equal("/f/b/d")
        const {status} = await axios.get("/f/b/dqwq", {validateStatus: () => true})
        expect(status).equal(404);
        ({data} = await axios.get("/f/b/static", {responseType: "arraybuffer"}));
        expect(data).deep.equal(await fsp.readFile(urlTopath("/f/b/static.json")))
    });

    it('should inherit config', async function () {
        const {status} = await axios.get("/f/b/d/dqwq", {validateStatus: () => true})
        expect(status).equal(404)
    });

    it('should not propagate config when propagateIntoChildren=false', async function () {
        const {data} = await axios.get("/f/b/d", {responseType: "arraybuffer"})
        expect(data).deep.equal(await fsp.readFile(urlTopath("/f/b/d/in.html")))
        const {status} = await axios.get("/f/b/d/e", {validateStatus: () => true})
        expect(status).equal(404)
    });

    it('should not inherit config when inheritFromParent=false', async function () {
        let {data} = await axios.get("/f/b/d/e/g/dqwq")
        expect(data).property("test").equal("/f/b/d/e/g/dqwq")
    });
});

describe('File Watching', function () {
    this.timeout(5000)
    let app, server, axios, tempDir, port, router

    function urlTopath(url: string): string {
        url = url.startsWith("/") ? url.substring(1) : url
        return path.join(tempDir, "route", url)
    }

    before(async () => {
        ({app, server, axios, tempDir, port} = await createApp())
        await fscp("./test/testRoute/core", path.join(tempDir, "route"), {recursive: true})
        router = new DynamicRouter({webroot: path.join(tempDir, "route"), log4js_level: "debug"})
        app.use(router)
    })

    after(async () => {
        await router.onDestroy()
        await destroyApp(server, tempDir)
    })

    it('should 404 before adding file', async function () {
        let {status} = await axios.get("/e/add", {validateStatus: () => true})
        expect(status).equal(404);
    });

    it('should watch file event in webroot', async function () {
        await Promise.all([
            fscp("./test/testRoute/file_watching/test-watch-file.txt", path.join(tempDir, "route", "test-watch-file.txt")),
            expectEvent({level: "debug", data: /^Chokidar: add: .*test-watch-file\.txt$/})
        ])
        await Promise.all([
            fsp.appendFile(path.join(tempDir, "route", "test-watch-file.txt"), _.range(100).toString()),
            expectEvent({level: "debug", data: /^Chokidar: change: .*test-watch-file\.txt$/}, 1500)
        ])
    });

    it('should watch dir and file event in webroot', async function () {
        await Promise.all([
            fscp("./test/testRoute/file_watching/e", path.join(tempDir, "route", "e"), {recursive: true}),
            expectEvent({level: "debug", data: /^Chokidar: addDir: .*e$/}),
            expectEvent({level: "debug", data: /^Chokidar: addDir: .*f$/}),
            expectEvent({level: "debug", data: /^Chokidar: add: .*f\/add\.route\.js$/}),
            expectEvent({level: "debug", data: /^Chokidar: add: .*e\/add\.route\.js$/}),
            expectEvent({level: "debug", data: /^Chokidar: add: .*e\/add2\.html$/}),
        ])
        await expectEvent({level: "debug", data: /^_updateHandlers finished$/}, 1500)
    });

    it('should serve JS after add files', async function () {
        let {data} = await axios.get("/e/add")
        expect(data).property("test").equal("/e/add");
        ({data} = await axios.get("/e/f/add"));
        expect(data).property("test").equal("/e/f/add")
    });

    it('should serve HTML after add files', async function () {
        const {data} = await axios.get("/e/add2.html", {responseType: "arraybuffer"})
        expect(data).deep.equal(await fsp.readFile(urlTopath("/e/add2.html")))
    });

    it('should change content after rewriting files', async function () {
        await Promise.all([
            fsp.writeFile(path.join(tempDir, "route", "e/add.route.js"), await fsp.readFile("./test/testRoute/file_watching/e2/add.route.js")),
            expectEvent({level: "info", data: /^Removed handler .*e\/add\.route\.js$/}, 2000)
        ])
        const {data} = await axios.get("/e/add")
        expect(data).property("test2").equal("/e/add")
    });

    it('should change content after replacing files', async function () {
        await Promise.all([
            fscp("./test/testRoute/file_watching/e2/f/add.route.js", path.join(tempDir, "route", "e/f/add.route.js")),
            expectEvent({level: "info", data: /^Removed handler .*e\/f\/add\.route\.js$/}, 2000)
        ])
        const {data} = await axios.get("/e/f/add")
        expect(data).property("test2").equal("/e/f/add")
    });

    it('should 404 after removing files', async function () {
        await Promise.all([
            fsrm(path.join(tempDir, "route", "e/add.route.js")),
            expectEvent({level: "info", data: /^Removed handler .*e\/add\.route\.js$/}, 2000)
        ])
        let {status} = await axios.get("/e/add", {validateStatus: () => true})
        expect(status).equal(404);
    });

    describe("load_on_demand=false", function () {
        let app, server, axios, tempDir, port, router

        before(async () => {
            ({app, server, axios, tempDir, port} = await createApp())
            await fscp("./test/testRoute/core", path.join(tempDir, "route"), {recursive: true})
            router = new DynamicRouter({
                webroot: path.join(tempDir, "route"),
                log4js_level: "debug",
                load_on_demand: false
            })
            app.use(router)
        })

        after(async () => {
            await router.onDestroy()
            await destroyApp(server, tempDir)
        })

        it('should 404 before adding file', async function () {
            let {status} = await axios.get("/e/add", {validateStatus: () => true})
            expect(status).equal(404);
        });

        it('should serve JS after add files', async function () {
            await fscp("./test/testRoute/file_watching/e", path.join(tempDir, "route", "e"), {recursive: true})
            await expectEvent({level: "debug", data: /^_updateHandlers finished$/}, 1500)
            let {data} = await axios.get("/e/add")
            expect(data).property("test").equal("/e/add");
            ({data} = await axios.get("/e/f/add"));
            expect(data).property("test").equal("/e/f/add")
        });

        it('should change content after rewriting files', async function () {
            await Promise.all([
                fsp.writeFile(path.join(tempDir, "route", "e/add.route.js"), await fsp.readFile("./test/testRoute/file_watching/e2/add.route.js")),
                expectEvent({level: "info", data: /^Reloaded handler .*e\/add\.route\.js$/}, 2000)
            ])
            const {data} = await axios.get("/e/add")
            expect(data).property("test2").equal("/e/add")
        });

        it('should change content after replacing files', async function () {
            await Promise.all([
                fscp("./test/testRoute/file_watching/e2/f/add.route.js", path.join(tempDir, "route", "e/f/add.route.js")),
                expectEvent({level: "info", data: /^Reloaded handler .*e\/f\/add\.route\.js$/}, 2000)
            ])
            const {data} = await axios.get("/e/f/add")
            expect(data).property("test2").equal("/e/f/add")
        });

        it('should change content after removing files', async function () {
            await Promise.all([
                fsrm(path.join(tempDir, "route", "e/add.route.js")),
                expectEvent({level: "info", data: /^Removed handler .*e\/add\.route\.js$/}, 2000)
            ])
            let {status} = await axios.get("/e/add", {validateStatus: () => true})
            expect(status).equal(404);
        });
    })

    it('should debounce', async function () {
        let {data} = await axios.get("/e/keep")
        expect(data).property("test").equal("/e/keep")
        const p = fscp("./test/testRoute/file_watching/e2/keep.route.js", path.join(tempDir, "route", "e/keep.route.js"));
        ({data} = await axios.get("/e/keep"));
        expect(data).property("test").equal("/e/keep")
        expect(data).not.property("test2")
        await Promise.all([
            p,
            expectEvent({level: "info", data: /^Removed handler .*e\/keep\.route\.js$/}, 2000)
        ]);
        ({data} = await axios.get("/e/keep"));
        expect(data).property("test2").equal("/e/keep")
    });

    it('should reload dependency', async function () {
        await Promise.all([
            fscp("./test/testRoute/file_watching/hasDependency.route.js", path.join(tempDir, "route", "e/hasDependency.route.js")),
            fscp("./test/testRoute/lib.js", path.join(tempDir, "lib.js")),
            delay(1500)
        ])
        let {data} = await axios.get("/e/hasDependency")
        expect(data).property("test").equal("/e/hasDependency")
        expect(data).property("val").equal(1)
        await Promise.all([
            fscp("./test/testRoute/file_watching/hasDependency.route.js", path.join(tempDir, "route", "e/hasDependency.route.js")),
            fscp("./test/testRoute/lib2.js", path.join(tempDir, "lib.js")),
            expectEvent({level: "info", data: /^Removed handler .*e\/hasDependency\.route\.js$/}, 2000)
        ]);
        ({data} = await axios.get("/e/hasDependency"));
        expect(data).property("test").equal("/e/hasDependency")
        expect(data).property("val").equal(2)
    });

    describe("Watch Directory Config", function () {
        let app, server, axios, tempDir, port, router

        before(async () => {
            ({app, server, axios, tempDir, port} = await createApp())
            await fscp("./test/testRoute/core", path.join(tempDir, "route"), {recursive: true})
            router = new DynamicRouter({
                webroot: path.join(tempDir, "route"),
                log4js_level: "debug"
            })
            app.use(router)
        })

        after(async () => {
            await router.onDestroy()
            await destroyApp(server, tempDir)
        })

        it('should static file without config', async function () {
            const {data} = await axios.get("/ee.qwq.js", {responseType: "arraybuffer"})
            expect(data).deep.equal(await fsp.readFile(urlTopath("/ee.qwq.js")))
        });

        it('should serve JS after copying config to root', async function () {
            await Promise.all([
                fscp("./test/testRoute/file_watching/__config__.js", path.join(tempDir, "route", "__config__.js")),
                expectEvent({level: "info", data: /^Loaded Directory Config: .*route\/__config__\.js$/}, 1500),
                expectEvent({level: "debug", data: /^_updateHandlers finished$/}, 1500),
            ])
            let {data} = await axios.get("/ee.qwq.js")
            expect(data).property("test").equal("/ee");
            ({data} = await axios.get("/ee"));
            expect(data).property("test").equal("/ee")
        });

        it('should serve JS after copying config to inner dir', async function () {
            let {data} = await axios.get("/f/d/ee.qwq.js", {responseType: "arraybuffer"})
            expect(data).deep.equal(await fsp.readFile(urlTopath("/f/d/ee.qwq.js")))
            await fscp("./test/testRoute/file_watching/__config__.js", path.join(tempDir, "route", "f/d", "__config__.js"))
            await expectEvent({level: "debug", data: /^_updateHandlers finished$/}, 1500);
            ({data} = await axios.get("/f/d/ee.qwq.js"));
            expect(data).property("test").equal("/f/d/ee");
            ({data} = await axios.get("/f/d/ee"));
            expect(data).property("test").equal("/f/d/ee")
        });

        it('should reload config after changing config', async function () {
            let {data} = await axios.get("/f/b/d/e/g/dqwq")
            expect(data).property("test").equal("/f/b/d/e/g/dqwq")
            await fscp("./test/testRoute/file_watching/__config__.2.js", path.join(tempDir, "route", "f/b/d/e/g", "__config__.js"))
            await expectEvent({level: "debug", data: /^_updateHandlers finished$/}, 1500)
            const {status} = await axios.get("/f/b/d/e/g/dqwq", {validateStatus: () => true})
            expect(status).equal(404);
        });
    })

    describe('use_esm_import=true', function () {
        let app, server, axios, tempDir, port, router

        before(async () => {
            ({app, server, axios, tempDir, port} = await createApp())
            await fscp("./test/testRoute/core", path.join(tempDir, "route"), {recursive: true})
            router = new DynamicRouter({
                webroot: path.join(tempDir, "route"),
                log4js_level: "debug",
                use_esm_import: true,
                exec: ["*.route.js", "*.route.mjs"],
                suffix: [".route.js", ".route.mjs"]
            })
            app.use(router)
        })

        after(async () => {
            await router.onDestroy()
            await destroyApp(server, tempDir)
        })

        it('should serve esm', async function () {
            const {data} = await axios.get("/esm")
            expect(data).property("test").equal("/esm")
        });

        it('should change content after rewriting files', async function () {
            await Promise.all([
                fsp.writeFile(path.join(tempDir, "route", "esm.route.mjs"), await fsp.readFile("./test/testRoute/file_watching/esm.route.mjs")),
                expectEvent({level: "info", data: /^Removed handler .*esm\.route\.mjs$/}, 2000)
            ])
            const {data} = await axios.get("/esm")
            expect(data).property("test2").equal("/esm")
        });
    })
})

describe('Security', function () {
    let app, server, axios, tempDir, port, router

    before(async () => {
        ({app, server, axios, tempDir, port} = await createApp())
        await fscp("./test/testRoute/core", path.join(tempDir, "route"), {recursive: true})
        await fscp("./test/testRoute/core/dynamic.route.js", path.join(tempDir, "dynamicB.route.js"))
        await fscp("./test/testRoute/core/suffix.html", path.join(tempDir, "suffixB.html"))
        router = new DynamicRouter({webroot: path.join(tempDir, "route"), exclude: ["*.hjs", "*.json"]})
        app.use(router)
    })

    after(async () => {
        await router.onDestroy()
        await destroyApp(server, tempDir)
    })

    it('should not serve excluded static file', async function () {
        const {status} = await axios.get("/h/static.json", {validateStatus: () => true})
        expect(status).equal(404)
    });

    it('should not serve excluded JS', async function () {
        const {status} = await axios.get("/h/async-dynamic", {validateStatus: () => true})
        expect(status).equal(404)
    });

    it('should not serve node_modules', async function () {
        const {status} = await axios.get("/n/node_modules/dynamic.route.js", {validateStatus: () => true})
        expect(status).equal(404)
    });

    it('should not get out of webroot', async function () {
        let {status} = await axios.get("/../suffixB.html", {validateStatus: () => true})
        expect(status).equal(404);
        ({status} = await axios.get("/../dynamicB", {validateStatus: () => true}));
        expect(status).equal(404);
        ({status} = await axios.get("../suffixB.html", {validateStatus: () => true}));
        expect(status).equal(404);
        ({status} = await axios.get("../dynamicB", {validateStatus: () => true}));
        expect(status).equal(404)
    });
})

describe('ESModule Support', function () {
    this.timeout(5000)

    describe('use_esm_import=true', function () {
        let app, server, axios, tempDir, port, router

        before(async () => {
            ({app, server, axios, tempDir, port} = await createApp())
            await fscp("./test/testRoute/core", path.join(tempDir, "route"), {recursive: true})
            router = new DynamicRouter({
                webroot: path.join(tempDir, "route"),
                use_esm_import: true,
                exec: ["*.route.js", "*.route.mjs"],
                suffix: [".route.js", ".route.mjs"]
            })
            app.use(router)
        })

        after(async () => {
            await router.onDestroy()
            await destroyApp(server, tempDir)
        })

        it('should serve esm', async function () {
            const {data} = await axios.get("/esm")
            expect(data).property("test").equal("/esm")
        });

        it('should serve async esm', async function () {
            if (Number(process.versions.node.split(".")[0]) < 14) this.skip() // Since Node v14 async ESModule is supported
            const {data} = await axios.get("/async-esm")
            expect(data).property("test").equal("/async-esm")
        });
    })

    describe('use_esm_import="when_require_failed"', function () {
        let app, server, axios, tempDir, port, router

        before(async () => {
            ({app, server, axios, tempDir, port} = await createApp())
            await fscp("./test/testRoute/core", path.join(tempDir, "route"), {recursive: true})
            router = new DynamicRouter({
                webroot: path.join(tempDir, "route"),
                use_esm_import: "when_require_failed",
                exec: ["*.route.js", "*.route.mjs"],
                suffix: [".route.js", ".route.mjs"]
            })
            app.use(router)
        })

        after(async () => {
            await router.onDestroy()
            await destroyApp(server, tempDir)
        })

        it('should serve esm', async function () {
            const {data} = await axios.get("/esm")
            expect(data).property("test").equal("/esm")
        });

        it('should serve async esm', async function () {
            if (Number(process.versions.node.split(".")[0]) < 14) this.skip()
            const {data} = await axios.get("/async-esm")
            expect(data).property("test").equal("/async-esm")
        });
    })
})
