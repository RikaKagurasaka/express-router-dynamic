exports.default = function (req, res, next) {
    res.json({
        test: "/f/a/d",
        url: req.url
    })
}
