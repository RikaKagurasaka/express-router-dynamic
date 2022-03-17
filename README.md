[![NPM Package](https://badge.fury.io/js/express-router-dynamic.svg)](https://www.npmjs.com/package/express-router-dynamic)
[![Build Status](https://github.com/RikaKagurasaka/express-router-dynamic/actions/workflows/build.yml/badge.svg?branch=master)](https://github.com/RikaKagurasaka/express-router-dynamic/actions/workflows/build.yml)

# express-router-dynamic
Express Router which loads js codes dynamically as well as serves static files, and routes based on directory structure.

> Note: you are reading the doc of v2.x, which has many breaking changes from v1.x. v1.x is deprecated and will not receive maintenance (except for high severity security vulnerabilities). If you still want to use v1.x, please [checkout to branch `v1`](https://github.com/RikaKagurasaka/express-router-dynamic/tree/v1).

## Feature
- Put static files and JS dynamic request handlers in the same webroot dir, serve both in the same website
- Match file in the webroot dir by URL like any other static file server, but when matched file is ended with .route.js(which can be user-defined)

## Usage
#### Install and Import
```shell script
npm i express-router-dynamic --save
```
Import
```ts
import {DynamicRouter} from 'express-router-dynamic'
```
or 
```js
const {DynamicRouter} = require('express-router-dynamic')
```

#### Minimal Usage:
```js
// app.js
import express from 'express'
const app = express()
app.use(dynamicRouter({
    webroot: "./route" // your web root, which saves dynamic .route.js and static files altogether
}))
app.listen(8000)
```
Then, put some example `index.route.js` in directory `./route`:
```js
// route/index.route.js
exports.default = function (req, res) {
    res.send("Hello World!")
}
```
Run your app and visit `http://localhost:8000/`, you will see `Hello World!`.  

#### Route Files Organization Example
Organize your files like the following:
```
│
├───routes
│   ├───index.route.js
│   ├───sample.html
│   └───subdir
│       ├───a.route.js
│       ├───b.html
│       └───c.js
│
└───app.js
```
Then, by visiting the following URLs, you will get:
| URL          | Result            | File                |
| ------------ | ----------------- | ------------------- |
| /            | Execute JS Code   | `index.route.js`    |
| /sample      | Serve Static File | `sample.html`       |
| /sample.html | Serve Static File | `sample.html`       |
| /subdir/a    | Execute JS Code   | `subdir/a.route.js` |
| /subdir/b    | Serve Static File | `subdir/b.html`     |
| /subdir/c    | 404               |                     |
| /subdir/c.js | Serve Static File | `subdir/c.js`       |

#### Advanced Usage:
In the following example, your server will treat **all .js files as Node.js Code**, so you cannot serve browser JS files to user.  
Besides, your server will be able to import ESModule (Use with caution! See instructions in [config.ts](src/config.ts)) as well as record more logs.
```js
import express from 'express'
const app = express()
const config = {
    webroot: "./route",
    exec: ["*.js"],
    suffix: [".js", ".html"],
    index: ["index.js", "index.html"],
    handler_error_log_level: "warn",
    use_esm_import: "when_require_failed",
    log4js_level: "debug",
}
app.use(dynamicRouter(config))
app.listen(8000)
```
You will still be able to serve static JS files in subdirectories, by using `DirectoryConfig`. 
For example, create `route/frontend/__config__.js`:
```js
module.exports = {
    exec: [],
    index: ["index.html"]
}
```
By doing that, all JS files in the `frontend` dir will not be executed, instead they will be served as static files.

## Config
#### Instructions
THere are two types of config: instance-level config (`Config`) and directory-level config (`DirectoryCOnfig`).  
Instance-level config should be specified as the argument of constructor, and cannot (should not) be modified later.  
Directory-level can be specified in each directory in the `webroot`, which will also be watched and reloaded once changed.

#### Reference
Please see [config.ts](./src/config.ts), which has full instructions and detailed notes about all available config terms. 

We are sorry that there are only Chinese notes in `config.ts`. Translations are highly welcomed.

## Remind
- On some platforms (e.g. Windows), executing `npm install` under a watched directory (i.e. directory that are set 
in `realwebroot` or `libwebroot`) may fail. If your route files contain a `package.json`, please install its dependency
in the application's root directory, by executing something similar to `cd projectRoot && npm install ./route/xxx`, 
in which `./route/xxx` is the directory contains your router and its `package.json` file.

## Contribute
All types of contributions are welcomed! Please feel free to raise issues and/or submit PRs.
You may use English or Chinese in issues and PRs.

## License
MIT

