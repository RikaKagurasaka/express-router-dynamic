exports.default = function (req, res, next) {
    res.json({
        test: "/e/f/add",
        url: req.url
    })
}
