exports.default = function (req, res, next) {
    res.json({
        test: "/f/a/e",
        url: req.url
    })
}
