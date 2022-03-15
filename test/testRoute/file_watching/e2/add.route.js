exports.default = function (req, res, next) {
    res.json({
        test2: "/e/add",
        url: req.url
    })
}
