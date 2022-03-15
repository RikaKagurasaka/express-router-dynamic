exports.default = function (req, res, next) {
    res.json({
        test: "/a",
        url: req.url
    })
}
