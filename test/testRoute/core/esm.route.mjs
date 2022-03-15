export default function (req, res, next) {
    res.json({
        test: "/esm",
        url: req.url
    })
}
