exports.default = function (req, res, next) {
    res.json({
        test: "/dynamic",
        url: req.url
    })
}
