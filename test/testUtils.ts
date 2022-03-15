import express, {Express} from "express";
import axios, {AxiosInstance} from "axios"
import {AddressInfo} from "net";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import http from "http";
import {promisify} from "util";
import {CopyOptions, PathLike, RmOptions} from "fs";
import semver from "semver"
import logger from 'morgan';
import log4js from "log4js";

let fse

export async function createApp(): Promise<{ app: Express, server: http.Server, axios: AxiosInstance, tempDir: string, port: number }> {
    const app = express()
    app.use(logger("dev"))
    const server = app.listen(0)
    await new Promise((resolve, reject) => {
        server.on("listening", resolve)
        server.on("error", reject)
    })
    const {port} = <AddressInfo>server.address()
    const axiosInstance = axios.create({baseURL: `http://localhost:${port}`, maxRedirects: 0})
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "ERD-test-"))
    return {app, server, axios: axiosInstance, tempDir, port}
}

export async function destroyApp(server: http.Server, tempDir: string) {
    await promisify(server.close).call(server)
    await fsrm(tempDir, {recursive: true})
}

export function setupLog4jsConfig() {
    log4js.configure({
        appenders: {test: {type: "./test/log4jsAppender.js"}, console: {type: "console"}},
        categories: {
            default: {appenders: ["console"], level: "info"},
            DynamicRouter: {appenders: ["console", "test"], level: "info"}
        }
    });
}

export function fscp(source: string, destination: string, opts?: CopyOptions): Promise<void> {
    if (semver.gte(process.version, "v16.7.0")) { // fsp.cp since node v16.7.0
        return fsp.cp(source, destination, opts)
    } else {
        if (!fse) fse = require("fs-extra")
        return fse.copy(source, destination, opts)
    }
}

export function fsrm(path: PathLike, options?: RmOptions): Promise<void> {
    if (semver.gte(process.version, "v14.14.0")) { // fsp.rm since node v14.14.0
        return fsp.rm(path, options)
    } else {
        if (!fse) fse = require("fs-extra")
        return fse.remove(path)
    }
}
