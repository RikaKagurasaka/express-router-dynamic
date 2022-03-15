exports.default = function (req, res, next) {
    res.json({
        test: "/a/b/c/dynamic",
        url: req.url
    })
}
