exports.default = function (req, res, next) {
    res.json({
        test: "/f/b/d",
        url: req.url
    })
}
