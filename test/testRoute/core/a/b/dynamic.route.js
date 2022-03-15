exports.default = function (req, res, next) {
    res.json({
        test: "/a/b/dynamic",
        url: req.url
    })
}
