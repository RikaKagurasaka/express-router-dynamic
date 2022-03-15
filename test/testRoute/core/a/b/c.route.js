exports.default = function (req, res, next) {
    res.json({
        test: "/a/b/c",
        url: req.url
    })
}

