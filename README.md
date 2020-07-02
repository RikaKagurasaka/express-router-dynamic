# express-router-dynamic
A router used for load more routers based on directory structure.

## Usage
Install as dependency
```shell script
npm i express-router-dynamic --save
```
Import
```js
import {dynamicRouter} from 'express-router-dynamic'
```
or 
```js
const {dynamicRouter} = require('express-router-dynamic')
```
Use
```js
import express from 'express'
const app = express()
const config = {
  //---default config---
  //本地路由根目录，相对于package.json，会按照顺序搜索
  realPrefix: ["./src/routers"],
  //该目录下的不会作为路由文件，但是会被检测热更新
  libPrefix: ["./src/lib"],
  //当请求目标为目录时，按照此顺序寻找对应的路由
  autoIndex: ["index", "index.html", "index.js", "README.md", "README.txt"],
  //屏蔽符合以下条件的文件（对路由文件无效），支持文件名通配、正则和自定义函数。参数为本地真实路径
  ignore: [
    '*.ts',
    /\.map$/,
    s => s.endsWith('.json'),
    '/config.*'
  ],
}
app.use(dynamicRouter(config))
```

## Behaviour
- TODO

## Acknowledgement
- [Starrah](https://github.com/Starrah/) for co-work

## License
MIT

