exports.default = function (req, res, next) {
    res.status(404)
    res.json({
        err: "Not Found",
        by_erd: true
    })
}
