exports.default = function (req, res, next) {
    res.json({
        test: "/f/d/ee",
        url: req.url
    })
}
