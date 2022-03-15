module.exports.delay = function (time) {
    return new Promise(resolve => setTimeout(resolve, time))
}
