exports.default = function (req, res, next) {
    res.json({
        test: "/f/c/e",
        url: req.url
    })
}
