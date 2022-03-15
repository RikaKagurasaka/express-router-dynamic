export default function (req, res, next) {
    res.json({
        test2: "/esm",
        url: req.url
    })
}
