exports.default = function (req, res, next) {
    res.json({
        test: "/e/add",
        url: req.url
    })
}
