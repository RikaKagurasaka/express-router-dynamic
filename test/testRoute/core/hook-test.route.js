exports.default = function (req, res, next) {
    res.json({
        test: "/hook-test",
        url: req.url
    })
}

exports.onCreate = function () {
    global["onCreate_hook_called"] = "/hook-test"
}

exports.onDestroy = function () {
    global["onDestroy_hook_called"] = "/hook-test"
}
