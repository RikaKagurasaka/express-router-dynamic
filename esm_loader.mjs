import {URL} from "url";

export async function resolve(specifier, context, defaultResolve) {
    const res = defaultResolve(specifier, context, defaultResolve);
    const url = new URL(res.url)
    url.searchParams.append("ERD", Date.now())
    res.url = url.href
    return res
}
