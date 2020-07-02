"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.dynamicRouter = dynamicRouter;

require("core-js/stable");

require("regenerator-runtime/runtime");

var Fs = _interopRequireWildcard(require("fs"));

var _util = require("util");

var Path = _interopRequireWildcard(require("path"));

var express = _interopRequireWildcard(require("express"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _asyncIterator(iterable) { var method; if (typeof Symbol !== "undefined") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

var defaultConfig = {
  //本地路由根目录，相对于package.json，会按照顺序搜索
  realPrefix: ["./src/routers"],
  //该目录下的不会作为路由文件，但是会被检测热更新
  libPrefix: ["./src/lib"],
  //当请求目标为目录时，按照此顺序寻找对应的路由
  autoIndex: ["index", "index.html", "index.js", "README.md", "README.txt"],
  //屏蔽符合以下条件的文件（对路由文件无效），支持文件名通配、正则和自定义函数。参数为本地真实路径
  ignore: ['*.ts', /\.map$/, function (s) {
    return s.endsWith('.json');
  }, '/config.*']
};

function watchRecursively(_x, _x2) {
  return _watchRecursively.apply(this, arguments);
}

function _watchRecursively() {
  _watchRecursively = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(path, extraCallback) {
    var watchers, callback, watch;
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            watch = function _watch() {
              var dirname = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : path;

              _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
                var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _value, dir;

                return regeneratorRuntime.wrap(function _callee2$(_context2) {
                  while (1) {
                    switch (_context2.prev = _context2.next) {
                      case 0:
                        watchers[dirname] = Fs.watch(dirname, function (event, filename) {
                          return callback(event, Path.join(dirname, filename));
                        }).addListener('error', function (err) {
                          console.warn(err.message, dirname);
                        });
                        _iteratorNormalCompletion = true;
                        _didIteratorError = false;
                        _context2.prev = 3;
                        _context2.t0 = _asyncIterator;
                        _context2.next = 7;
                        return (0, _util.promisify)(Fs.opendir)(dirname);

                      case 7:
                        _context2.t1 = _context2.sent;
                        _iterator = (0, _context2.t0)(_context2.t1);

                      case 9:
                        _context2.next = 11;
                        return _iterator.next();

                      case 11:
                        _step = _context2.sent;
                        _iteratorNormalCompletion = _step.done;
                        _context2.next = 15;
                        return _step.value;

                      case 15:
                        _value = _context2.sent;

                        if (_iteratorNormalCompletion) {
                          _context2.next = 22;
                          break;
                        }

                        dir = _value;
                        if (dir.isDirectory()) watch(Path.join(dirname, dir.name));

                      case 19:
                        _iteratorNormalCompletion = true;
                        _context2.next = 9;
                        break;

                      case 22:
                        _context2.next = 28;
                        break;

                      case 24:
                        _context2.prev = 24;
                        _context2.t2 = _context2["catch"](3);
                        _didIteratorError = true;
                        _iteratorError = _context2.t2;

                      case 28:
                        _context2.prev = 28;
                        _context2.prev = 29;

                        if (!(!_iteratorNormalCompletion && _iterator["return"] != null)) {
                          _context2.next = 33;
                          break;
                        }

                        _context2.next = 33;
                        return _iterator["return"]();

                      case 33:
                        _context2.prev = 33;

                        if (!_didIteratorError) {
                          _context2.next = 36;
                          break;
                        }

                        throw _iteratorError;

                      case 36:
                        return _context2.finish(33);

                      case 37:
                        return _context2.finish(28);

                      case 38:
                      case "end":
                        return _context2.stop();
                    }
                  }
                }, _callee2, null, [[3, 24, 28, 38], [29,, 33, 37]]);
              }))()["catch"](function (reason) {
                console.warn(reason.message);
              });
            };

            watchers = {};

            callback = /*#__PURE__*/function () {
              var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(event, filename) {
                var _watchers$filename;

                return regeneratorRuntime.wrap(function _callee$(_context) {
                  while (1) {
                    switch (_context.prev = _context.next) {
                      case 0:
                        extraCallback(event, filename);

                        if (!(event == "rename" && !Fs.existsSync(filename))) {
                          _context.next = 6;
                          break;
                        }

                        (_watchers$filename = watchers[filename]) === null || _watchers$filename === void 0 ? void 0 : _watchers$filename.close();
                        delete watchers[filename];
                        _context.next = 13;
                        break;

                      case 6:
                        _context.t0 = event == "rename" && Fs.existsSync(filename);

                        if (!_context.t0) {
                          _context.next = 11;
                          break;
                        }

                        _context.next = 10;
                        return (0, _util.promisify)(Fs.stat)(filename);

                      case 10:
                        _context.t0 = _context.sent.isDirectory();

                      case 11:
                        if (!_context.t0) {
                          _context.next = 13;
                          break;
                        }

                        watch(filename);

                      case 13:
                      case "end":
                        return _context.stop();
                    }
                  }
                }, _callee);
              }));

              return function callback(_x3, _x4) {
                return _ref3.apply(this, arguments);
              };
            }();

            watch();

          case 4:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3);
  }));
  return _watchRecursively.apply(this, arguments);
}

function wrapIgnorance(re) {
  if (typeof re === "string") {
    return wrapIgnorance(new RegExp(re.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\*', '[^.*?/\\:]+').replace('\\?', '[^.*?/\\:]') + '$', 'is'));
  } else if (_typeof(re) === "object") {
    return wrapIgnorance(function (s) {
      return !!s.match(re);
    });
  } else {
    return function (s) {
      return re(s.replace(new RegExp('\\' + Path.sep, 'g'), '/'));
    };
  }
}

function sendFileRouter(file) {
  return function (req, res) {
    res.sendFile(file);
  };
}

var DynamicRouter = /*#__PURE__*/function () {
  function DynamicRouter(config) {
    _classCallCheck(this, DynamicRouter);

    _defineProperty(this, "config", void 0);

    this.config = config;
  }

  _createClass(DynamicRouter, [{
    key: "findListener",
    value: function findListener(url) {
      url = url.replace(/\/+$/, '');

      var _iterator2 = _createForOfIteratorHelper(this.config.realPrefix),
          _step2;

      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var realPrefix = _step2.value;
          var targetFile = Path.join(realPrefix, url || '/'); //如果目标是js文件（有后缀）

          if (Fs.existsSync(targetFile) && targetFile.endsWith('.js')) {
            var _module;

            //且不被屏蔽
            var _iterator3 = _createForOfIteratorHelper(this.config.ignore),
                _step3;

            try {
              for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
                var ignoreElement = _step3.value;
                if (ignoreElement(targetFile)) return null;
              }
            } catch (err) {
              _iterator3.e(err);
            } finally {
              _iterator3.f();
            }

            var module = require('./' + Path.relative(__dirname, targetFile).replace(/\\/g, '/'));

            module = ((_module = module) === null || _module === void 0 ? void 0 : _module["default"]) || module; //如果是路由文件就返回路由

            if (module && module.__proto__ == express.Router) return module; //否则继续处理
          } //如果存在对应js文件


          if (Fs.existsSync(targetFile + '.js')) return this.findListener(url + '.js'); // 如果目标原始路径存在

          if (Fs.existsSync(targetFile)) {
            //且不被屏蔽
            var _iterator4 = _createForOfIteratorHelper(this.config.ignore),
                _step4;

            try {
              for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
                var _ignoreElement = _step4.value;
                if (_ignoreElement(targetFile)) return null;
              }
            } catch (err) {
              _iterator4.e(err);
            } finally {
              _iterator4.f();
            }

            var fileStatus = Fs.statSync(targetFile);
            if (fileStatus.isFile()) //如果是文件直接返回
              return sendFileRouter(targetFile);else if (fileStatus.isDirectory()) {
              //如果是目录或无后缀的js
              //按autoIndex顺序依次检查目录下的文件
              var router = null;

              var _iterator5 = _createForOfIteratorHelper(this.config.autoIndex),
                  _step5;

              try {
                for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
                  var _filename = _step5.value;
                  //查找到了就返回
                  if (router = this.findListener(url + '/' + _filename)) return router;
                }
              } catch (err) {
                _iterator5.e(err);
              } finally {
                _iterator5.f();
              }
            }
          }
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }

      return null;
    }
  }]);

  return DynamicRouter;
}();

function dynamicRouter(userConfig) {
  var config = Object.fromEntries(Object.entries(defaultConfig).map(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2),
        k = _ref2[0],
        v = _ref2[1];

    return [k, (userConfig === null || userConfig === void 0 ? void 0 : userConfig[k]) || v];
  }));
  config.ignore = config.ignore.map(function (value) {
    return wrapIgnorance(value);
  });

  for (var _i2 = 0, _arr2 = [].concat(_toConsumableArray(config.realPrefix), _toConsumableArray(config.libPrefix)); _i2 < _arr2.length; _i2++) {
    var path = _arr2[_i2];
    watchRecursively(Path.join(process.cwd(), path), function (event, filename) {
      var _require$cache;

      console.log(event, filename);
      (_require$cache = require.cache) === null || _require$cache === void 0 ? true : delete _require$cache[filename];
    });
  }

  var manager = new DynamicRouter(config);
  return function (req, res, next) {
    var listener;
    var currentFindUrl = req.url || '/'; // 对于获得的形如/aaa/bbb/ccc形式的url，应当依次查找/aaa/bbb/ccc、/aaa/bbb、/aaa、/ 四种listener，
    // 并在调用listener之前从req.url中删除已经匹配到的部分。
    // 例如，现在存在文件aaa/bbb.js，则应当以req.url="/ccc"来调用bbb.js中定义的Router。
    // 这是为了保证如果bbb.js中有router.get("/ccc", ()=>{})这样的语句时能够正确处理。

    while (true) {
      listener = manager.findListener(currentFindUrl);
      if (listener || currentFindUrl === "/") break; // 找到了，或者已经找完根路径了，就立即停止查找

      currentFindUrl = Path.dirname(currentFindUrl); // 否则，在父路径查找
    }

    if (listener) {
      req.url = '/' + Path.relative(currentFindUrl, req.url || '/');
      listener(req, res, next);
    } else next();
  };
}

//# sourceMappingURL=index.js.map