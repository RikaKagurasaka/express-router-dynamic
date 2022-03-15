import {promises as fsp} from "fs";
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

/**
 * Remove Leading Slash
 */
export function RLS(s: string): string {
    return s.startsWith("/") ? s.substring(1) : s
}

type addPrefix<TKey, TPrefix extends string> = TKey extends string
    ? `${TPrefix}${TKey}`
    : never;

type removePrefix<TPrefixedKey, TPrefix extends string> = TPrefixedKey extends addPrefix<infer TKey, TPrefix>
    ? TKey
    : '';

type prefixedValue<TObject extends object, TPrefixedKey extends string, TPrefix extends string> = TObject extends {[K in removePrefix<TPrefixedKey, TPrefix>]: infer TValue}
    ? TValue
    : never;

type addPrefixToObject<TObject extends object, TPrefix extends string> = {
    [K in addPrefix<keyof TObject, TPrefix>]: prefixedValue<TObject, K, TPrefix>
}

export type Prefix$IsAny = addPrefixToObject<any, '$'>;
