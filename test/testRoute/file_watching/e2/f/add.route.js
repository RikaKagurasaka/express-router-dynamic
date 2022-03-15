exports.default = function (req, res, next) {
    res.json({
        test2: "/e/f/add",
        url: req.url
    })
}
