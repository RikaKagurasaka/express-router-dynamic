import fsp from "fs/promises";
import {Request} from "express";
import URL from "url-parse";

export async function existsAsync(filename: string): Promise<boolean> {
    try {
        await fsp.access(filename)
        return true
    } catch (e) {
        return false
    }
}

export function reqSetPath(req: Request, path: string): void {
    const urlObj = new URL(req.url)
    urlObj.set("pathname", path)
    req.url = urlObj.toString()
}

export interface Hooks {
    onDestroy?: () => void
}

export const hookNames = ["onDestroy"]
