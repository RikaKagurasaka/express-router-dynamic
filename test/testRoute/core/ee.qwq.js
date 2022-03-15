exports.default = function (req, res, next) {
    res.json({
        test: "/ee",
        url: req.url
    })
}
