exports.default = function (req, res, next) {
    res.json({
        test: "/f/c/d",
        url: req.url
    })
}
