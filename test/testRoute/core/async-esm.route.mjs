import {delay} from "./delay.js";

await delay(1000)

export default async function (req, res, next) {
    await delay(1000)
    res.json({
        test: "/async-esm",
        url: req.url
    })
}
