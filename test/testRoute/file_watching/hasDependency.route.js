const {default: f} = require("../../lib")

exports.default = function (req, res, next) {
    res.json({
        test: "/e/hasDependency",
        val: f(),
        url: req.url
    })
}
