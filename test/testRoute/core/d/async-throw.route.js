const {delay} = require("../delay");

exports.default = async function (req, res, next) {
    await delay(1000)
    throw new Error("/d/async-throw")
}
