exports.default = function (req, res, next) {
    res.status(400)
    res.json({
        test: "/d/400"
    })
}
