/* */ 
"format cjs";
(function(process) {
  function require(name) {
    var module = require.modules[name];
    if (!module)
      throw new Error('failed to require "' + name + '"');
    if (!('exports' in module) && typeof module.definition === 'function') {
      module.client = module.component = true;
      module.definition.call(this, module.exports = {}, module);
      delete module.definition;
    }
    return module.exports;
  }
  require.modules = {};
  require.register = function(name, definition) {
    require.modules[name] = {definition: definition};
  };
  require.define = function(name, exports) {
    require.modules[name] = {exports: exports};
  };
  require.register("johntron~asap@master", function(exports, module) {
    "use strict";
    var head = {
      task: void 0,
      next: null
    };
    var tail = head;
    var flushing = false;
    var requestFlush = void 0;
    var hasSetImmediate = typeof setImmediate === "function";
    var domain;
    if (typeof global != 'undefined') {
      var process = global.process;
    }
    var isNodeJS = !!process && ({}).toString.call(process) === "[object process]";
    function flush() {
      while (head.next) {
        head = head.next;
        var task = head.task;
        head.task = void 0;
        try {
          task();
        } catch (e) {
          if (isNodeJS) {
            requestFlush();
            throw e;
          } else {
            setTimeout(function() {
              throw e;
            }, 0);
          }
        }
      }
      flushing = false;
    }
    if (isNodeJS) {
      requestFlush = function() {
        var currentDomain = process.domain;
        if (currentDomain) {
          domain = domain || (1, require)("domain");
          domain.active = process.domain = null;
        }
        if (flushing && hasSetImmediate) {
          setImmediate(flush);
        } else {
          process.nextTick(flush);
        }
        if (currentDomain) {
          domain.active = process.domain = currentDomain;
        }
      };
    } else if (hasSetImmediate) {
      requestFlush = function() {
        setImmediate(flush);
      };
    } else if (typeof MessageChannel !== "undefined") {
      var channel = new MessageChannel();
      channel.port1.onmessage = function() {
        requestFlush = requestPortFlush;
        channel.port1.onmessage = flush;
        flush();
      };
      var requestPortFlush = function() {
        channel.port2.postMessage(0);
      };
      requestFlush = function() {
        setTimeout(flush, 0);
        requestPortFlush();
      };
    } else {
      requestFlush = function() {
        setTimeout(flush, 0);
      };
    }
    function asap(task) {
      if (isNodeJS && process.domain) {
        task = process.domain.bind(task);
      }
      tail = tail.next = {
        task: task,
        next: null
      };
      if (!flushing) {
        requestFlush();
        flushing = true;
      }
    }
    ;
    module.exports = asap;
  });
  require.register("then~promise@4.0.0", function(exports, module) {
    'use strict';
    var Promise = require("then~promise@4.0.0/core");
    var asap = require("johntron~asap@master");
    module.exports = Promise;
    function ValuePromise(value) {
      this.then = function(onFulfilled) {
        if (typeof onFulfilled !== 'function')
          return this;
        return new Promise(function(resolve, reject) {
          asap(function() {
            try {
              resolve(onFulfilled(value));
            } catch (ex) {
              reject(ex);
            }
          });
        });
      };
    }
    ValuePromise.prototype = Object.create(Promise.prototype);
    var TRUE = new ValuePromise(true);
    var FALSE = new ValuePromise(false);
    var NULL = new ValuePromise(null);
    var UNDEFINED = new ValuePromise(undefined);
    var ZERO = new ValuePromise(0);
    var EMPTYSTRING = new ValuePromise('');
    Promise.from = Promise.cast = function(value) {
      if (value instanceof Promise)
        return value;
      if (value === null)
        return NULL;
      if (value === undefined)
        return UNDEFINED;
      if (value === true)
        return TRUE;
      if (value === false)
        return FALSE;
      if (value === 0)
        return ZERO;
      if (value === '')
        return EMPTYSTRING;
      if (typeof value === 'object' || typeof value === 'function') {
        try {
          var then = value.then;
          if (typeof then === 'function') {
            return new Promise(then.bind(value));
          }
        } catch (ex) {
          return new Promise(function(resolve, reject) {
            reject(ex);
          });
        }
      }
      return new ValuePromise(value);
    };
    Promise.denodeify = function(fn, argumentCount) {
      argumentCount = argumentCount || Infinity;
      return function() {
        var self = this;
        var args = Array.prototype.slice.call(arguments);
        return new Promise(function(resolve, reject) {
          while (args.length && args.length > argumentCount) {
            args.pop();
          }
          args.push(function(err, res) {
            if (err)
              reject(err);
            else
              resolve(res);
          });
          fn.apply(self, args);
        });
      };
    };
    Promise.nodeify = function(fn) {
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
        try {
          return fn.apply(this, arguments).nodeify(callback);
        } catch (ex) {
          if (callback === null || typeof callback == 'undefined') {
            return new Promise(function(resolve, reject) {
              reject(ex);
            });
          } else {
            asap(function() {
              callback(ex);
            });
          }
        }
      };
    };
    Promise.all = function() {
      var args = Array.prototype.slice.call(arguments.length === 1 && Array.isArray(arguments[0]) ? arguments[0] : arguments);
      return new Promise(function(resolve, reject) {
        if (args.length === 0)
          return resolve([]);
        var remaining = args.length;
        function res(i, val) {
          try {
            if (val && (typeof val === 'object' || typeof val === 'function')) {
              var then = val.then;
              if (typeof then === 'function') {
                then.call(val, function(val) {
                  res(i, val);
                }, reject);
                return ;
              }
            }
            args[i] = val;
            if (--remaining === 0) {
              resolve(args);
            }
          } catch (ex) {
            reject(ex);
          }
        }
        for (var i = 0; i < args.length; i++) {
          res(i, args[i]);
        }
      });
    };
    Promise.prototype.done = function(onFulfilled, onRejected) {
      var self = arguments.length ? this.then.apply(this, arguments) : this;
      self.then(null, function(err) {
        asap(function() {
          throw err;
        });
      });
    };
    Promise.prototype.nodeify = function(callback) {
      if (callback === null || typeof callback == 'undefined')
        return this;
      this.then(function(value) {
        asap(function() {
          callback(null, value);
        });
      }, function(err) {
        asap(function() {
          callback(err);
        });
      });
    };
    Promise.prototype.catch = function(onRejected) {
      return this.then(null, onRejected);
    };
    Promise.resolve = function(value) {
      return new Promise(function(resolve) {
        resolve(value);
      });
    };
    Promise.reject = function(value) {
      return new Promise(function(resolve, reject) {
        reject(value);
      });
    };
    Promise.race = function(values) {
      return new Promise(function(resolve, reject) {
        values.map(function(value) {
          Promise.cast(value).then(resolve, reject);
        });
      });
    };
  });
  require.register("then~promise@4.0.0/core.js", function(exports, module) {
    'use strict';
    var asap = require("johntron~asap@master");
    module.exports = Promise;
    function Promise(fn) {
      if (typeof this !== 'object')
        throw new TypeError('Promises must be constructed via new');
      if (typeof fn !== 'function')
        throw new TypeError('not a function');
      var state = null;
      var value = null;
      var deferreds = [];
      var self = this;
      this.then = function(onFulfilled, onRejected) {
        return new Promise(function(resolve, reject) {
          handle(new Handler(onFulfilled, onRejected, resolve, reject));
        });
      };
      function handle(deferred) {
        if (state === null) {
          deferreds.push(deferred);
          return ;
        }
        asap(function() {
          var cb = state ? deferred.onFulfilled : deferred.onRejected;
          if (cb === null) {
            (state ? deferred.resolve : deferred.reject)(value);
            return ;
          }
          var ret;
          try {
            ret = cb(value);
          } catch (e) {
            deferred.reject(e);
            return ;
          }
          deferred.resolve(ret);
        });
      }
      function resolve(newValue) {
        try {
          if (newValue === self)
            throw new TypeError('A promise cannot be resolved with itself.');
          if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
            var then = newValue.then;
            if (typeof then === 'function') {
              doResolve(then.bind(newValue), resolve, reject);
              return ;
            }
          }
          state = true;
          value = newValue;
          finale();
        } catch (e) {
          reject(e);
        }
      }
      function reject(newValue) {
        state = false;
        value = newValue;
        finale();
      }
      function finale() {
        for (var i = 0,
            len = deferreds.length; i < len; i++)
          handle(deferreds[i]);
        deferreds = null;
      }
      doResolve(fn, resolve, reject);
    }
    function Handler(onFulfilled, onRejected, resolve, reject) {
      this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
      this.onRejected = typeof onRejected === 'function' ? onRejected : null;
      this.resolve = resolve;
      this.reject = reject;
    }
    function doResolve(fn, onFulfilled, onRejected) {
      var done = false;
      try {
        fn(function(value) {
          if (done)
            return ;
          done = true;
          onFulfilled(value);
        }, function(reason) {
          if (done)
            return ;
          done = true;
          onRejected(reason);
        });
      } catch (ex) {
        if (done)
          return ;
        done = true;
        onRejected(ex);
      }
    }
  });
  require.register("localforage", function(exports, module) {
    (function() {
      'use strict';
      var Promise = (typeof module !== 'undefined' && module.exports) ? require("then~promise@4.0.0") : this.Promise;
      var MODULE_TYPE_DEFINE = 1;
      var MODULE_TYPE_EXPORT = 2;
      var MODULE_TYPE_WINDOW = 3;
      var moduleType = MODULE_TYPE_WINDOW;
      if (typeof define === 'function' && define.amd) {
        moduleType = MODULE_TYPE_DEFINE;
      } else if (typeof module !== 'undefined' && module.exports) {
        moduleType = MODULE_TYPE_EXPORT;
      }
      var indexedDB = indexedDB || this.indexedDB || this.webkitIndexedDB || this.mozIndexedDB || this.OIndexedDB || this.msIndexedDB;
      var openDatabase = this.openDatabase;
      var _this = this;
      var localForage = {
        INDEXEDDB: 'asyncStorage',
        LOCALSTORAGE: 'localStorageWrapper',
        WEBSQL: 'webSQLStorage',
        _config: {
          description: '',
          name: 'localforage',
          size: 4980736,
          storeName: 'keyvaluepairs',
          version: 1.0
        },
        config: function(options) {
          if (typeof(options) === 'object') {
            if (this._ready) {
              return new Error("Can't call config() after localforage " + "has been used.");
            }
            for (var i in options) {
              this._config[i] = options[i];
            }
            return true;
          } else if (typeof(options) === 'string') {
            return this._config[options];
          } else {
            return this._config;
          }
        },
        driver: function() {
          return this._driver || null;
        },
        _ready: Promise.reject(new Error("setDriver() wasn't called")),
        setDriver: function(driverName, callback) {
          var driverSet = new Promise(function(resolve, reject) {
            if ((!indexedDB && driverName === localForage.INDEXEDDB) || (!openDatabase && driverName === localForage.WEBSQL)) {
              reject(localForage);
              return ;
            }
            localForage._ready = null;
            if (moduleType === MODULE_TYPE_DEFINE) {
              require([driverName], function(lib) {
                localForage._extend(lib);
                resolve(localForage);
              });
              return ;
            } else if (moduleType === MODULE_TYPE_EXPORT) {
              var driver;
              switch (driverName) {
                case localForage.INDEXEDDB:
                  driver = require("../src/drivers/indexeddb");
                  break;
                case localForage.LOCALSTORAGE:
                  driver = require("../src/drivers/localstorage");
                  break;
                case localForage.WEBSQL:
                  driver = require("../src/drivers/websql");
              }
              localForage._extend(driver);
            } else {
              localForage._extend(_this[driverName]);
            }
            resolve(localForage);
          });
          driverSet.then(callback, callback);
          return driverSet;
        },
        ready: function(callback) {
          if (this._ready === null) {
            this._ready = this._initStorage(this._config);
          }
          this._ready.then(callback, callback);
          return this._ready;
        },
        _extend: function(libraryMethodsAndProperties) {
          for (var i in libraryMethodsAndProperties) {
            if (libraryMethodsAndProperties.hasOwnProperty(i)) {
              this[i] = libraryMethodsAndProperties[i];
            }
          }
        }
      };
      var storageLibrary;
      if (indexedDB && indexedDB.open('_localforage_spec_test', 1).onupgradeneeded === null) {
        storageLibrary = localForage.INDEXEDDB;
      } else if (openDatabase) {
        storageLibrary = localForage.WEBSQL;
      } else {
        storageLibrary = localForage.LOCALSTORAGE;
      }
      if (this.localForageConfig) {
        localForage.config = this.localForageConfig;
      }
      localForage.setDriver(storageLibrary);
      if (moduleType === MODULE_TYPE_DEFINE) {
        define(function() {
          return localForage;
        });
      } else if (moduleType === MODULE_TYPE_EXPORT) {
        module.exports = localForage;
      } else {
        this.localforage = localForage;
      }
    }).call(this);
  });
  require.register("localforage/src/drivers/indexeddb.js", function(exports, module) {
    (function() {
      'use strict';
      var Promise = (typeof module !== 'undefined' && module.exports) ? require("then~promise@4.0.0") : this.Promise;
      var db = null;
      var dbInfo = {};
      var indexedDB = indexedDB || this.indexedDB || this.webkitIndexedDB || this.mozIndexedDB || this.OIndexedDB || this.msIndexedDB;
      if (!indexedDB) {
        return ;
      }
      function _initStorage(options) {
        if (options) {
          for (var i in options) {
            dbInfo[i] = options[i];
          }
        }
        return new Promise(function(resolve, reject) {
          var openreq = indexedDB.open(dbInfo.name, dbInfo.version);
          openreq.onerror = function withStoreOnError() {
            reject(openreq.error);
          };
          openreq.onupgradeneeded = function withStoreOnUpgradeNeeded() {
            openreq.result.createObjectStore(dbInfo.storeName);
          };
          openreq.onsuccess = function withStoreOnSuccess() {
            db = openreq.result;
            resolve();
          };
        });
      }
      function getItem(key, callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            var store = db.transaction(dbInfo.storeName, 'readonly').objectStore(dbInfo.storeName);
            var req = store.get(key);
            req.onsuccess = function() {
              var value = req.result;
              if (value === undefined) {
                value = null;
              }
              if (callback) {
                callback(value);
              }
              resolve(value);
            };
            req.onerror = function() {
              if (callback) {
                callback(null, req.error);
              }
              reject(req.error);
            };
          });
        });
      }
      function setItem(key, value, callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            var store = db.transaction(dbInfo.storeName, 'readwrite').objectStore(dbInfo.storeName);
            if (value === undefined) {
              value = null;
            }
            var req = store.put(value, key);
            req.onsuccess = function() {
              if (callback) {
                callback(value);
              }
              resolve(value);
            };
            req.onerror = function() {
              if (callback) {
                callback(null, req.error);
              }
              reject(req.error);
            };
          });
        });
      }
      function removeItem(key, callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            var store = db.transaction(dbInfo.storeName, 'readwrite').objectStore(dbInfo.storeName);
            var req = store['delete'](key);
            req.onsuccess = function() {
              if (callback) {
                callback();
              }
              resolve();
            };
            req.onerror = function() {
              if (callback) {
                callback(req.error);
              }
              reject(req.error);
            };
            req.onabort = function(event) {
              var error = event.target.error;
              if (error === 'QuotaExceededError') {
                if (callback) {
                  callback(error);
                }
                reject(error);
              }
            };
          });
        });
      }
      function clear(callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            var store = db.transaction(dbInfo.storeName, 'readwrite').objectStore(dbInfo.storeName);
            var req = store.clear();
            req.onsuccess = function() {
              if (callback) {
                callback();
              }
              resolve();
            };
            req.onerror = function() {
              if (callback) {
                callback(null, req.error);
              }
              reject(req.error);
            };
          });
        });
      }
      function length(callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            var store = db.transaction(dbInfo.storeName, 'readonly').objectStore(dbInfo.storeName);
            var req = store.count();
            req.onsuccess = function() {
              if (callback) {
                callback(req.result);
              }
              resolve(req.result);
            };
            req.onerror = function() {
              if (callback) {
                callback(null, req.error);
              }
              reject(req.error);
            };
          });
        });
      }
      function key(n, callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          if (n < 0) {
            if (callback) {
              callback(null);
            }
            resolve(null);
            return ;
          }
          _this.ready().then(function() {
            var store = db.transaction(dbInfo.storeName, 'readonly').objectStore(dbInfo.storeName);
            var advanced = false;
            var req = store.openCursor();
            req.onsuccess = function() {
              var cursor = req.result;
              if (!cursor) {
                if (callback) {
                  callback(null);
                }
                resolve(null);
                return ;
              }
              if (n === 0) {
                if (callback) {
                  callback(cursor.key);
                }
                resolve(cursor.key);
              } else {
                if (!advanced) {
                  advanced = true;
                  cursor.advance(n);
                } else {
                  if (callback) {
                    callback(cursor.key);
                  }
                  resolve(cursor.key);
                }
              }
            };
            req.onerror = function() {
              if (callback) {
                callback(null, req.error);
              }
              reject(req.error);
            };
          });
        });
      }
      var asyncStorage = {
        _driver: 'asyncStorage',
        _initStorage: _initStorage,
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key
      };
      if (typeof define === 'function' && define.amd) {
        define('asyncStorage', function() {
          return asyncStorage;
        });
      } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = asyncStorage;
      } else {
        this.asyncStorage = asyncStorage;
      }
    }).call(this);
  });
  require.register("localforage/src/drivers/localstorage.js", function(exports, module) {
    (function() {
      'use strict';
      var keyPrefix = '';
      var dbInfo = {};
      var Promise = (typeof module !== 'undefined' && module.exports) ? require("then~promise@4.0.0") : this.Promise;
      var localStorage = null;
      try {
        localStorage = this.localStorage;
      } catch (e) {
        return ;
      }
      function _initStorage(options) {
        if (options) {
          for (var i in options) {
            dbInfo[i] = options[i];
          }
        }
        keyPrefix = dbInfo.name + '/';
        return Promise.resolve();
      }
      var SERIALIZED_MARKER = '__lfsc__:';
      var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;
      var TYPE_ARRAYBUFFER = 'arbf';
      var TYPE_BLOB = 'blob';
      var TYPE_INT8ARRAY = 'si08';
      var TYPE_UINT8ARRAY = 'ui08';
      var TYPE_UINT8CLAMPEDARRAY = 'uic8';
      var TYPE_INT16ARRAY = 'si16';
      var TYPE_INT32ARRAY = 'si32';
      var TYPE_UINT16ARRAY = 'ur16';
      var TYPE_UINT32ARRAY = 'ui32';
      var TYPE_FLOAT32ARRAY = 'fl32';
      var TYPE_FLOAT64ARRAY = 'fl64';
      var TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH + TYPE_ARRAYBUFFER.length;
      function clear(callback) {
        var _this = this;
        return new Promise(function(resolve) {
          _this.ready().then(function() {
            localStorage.clear();
            if (callback) {
              callback();
            }
            resolve();
          });
        });
      }
      function getItem(key, callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            try {
              var result = localStorage.getItem(keyPrefix + key);
              if (result) {
                result = _deserialize(result);
              }
              if (callback) {
                callback(result, null);
              }
              resolve(result);
            } catch (e) {
              if (callback) {
                callback(null, e);
              }
              reject(e);
            }
          });
        });
      }
      function key(n, callback) {
        var _this = this;
        return new Promise(function(resolve) {
          _this.ready().then(function() {
            var result = localStorage.key(n);
            if (result) {
              result = result.substring(keyPrefix.length);
            }
            if (callback) {
              callback(result);
            }
            resolve(result);
          });
        });
      }
      function length(callback) {
        var _this = this;
        return new Promise(function(resolve) {
          _this.ready().then(function() {
            var result = localStorage.length;
            if (callback) {
              callback(result);
            }
            resolve(result);
          });
        });
      }
      function removeItem(key, callback) {
        var _this = this;
        return new Promise(function(resolve) {
          _this.ready().then(function() {
            localStorage.removeItem(keyPrefix + key);
            if (callback) {
              callback();
            }
            resolve();
          });
        });
      }
      function _deserialize(value) {
        if (value.substring(0, SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
          return JSON.parse(value);
        }
        var serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
        var type = value.substring(SERIALIZED_MARKER_LENGTH, TYPE_SERIALIZED_MARKER_LENGTH);
        var buffer = new ArrayBuffer(serializedString.length * 2);
        var bufferView = new Uint16Array(buffer);
        for (var i = serializedString.length - 1; i >= 0; i--) {
          bufferView[i] = serializedString.charCodeAt(i);
        }
        switch (type) {
          case TYPE_ARRAYBUFFER:
            return buffer;
          case TYPE_BLOB:
            return new Blob([buffer]);
          case TYPE_INT8ARRAY:
            return new Int8Array(buffer);
          case TYPE_UINT8ARRAY:
            return new Uint8Array(buffer);
          case TYPE_UINT8CLAMPEDARRAY:
            return new Uint8ClampedArray(buffer);
          case TYPE_INT16ARRAY:
            return new Int16Array(buffer);
          case TYPE_UINT16ARRAY:
            return new Uint16Array(buffer);
          case TYPE_INT32ARRAY:
            return new Int32Array(buffer);
          case TYPE_UINT32ARRAY:
            return new Uint32Array(buffer);
          case TYPE_FLOAT32ARRAY:
            return new Float32Array(buffer);
          case TYPE_FLOAT64ARRAY:
            return new Float64Array(buffer);
          default:
            throw new Error('Unkown type: ' + type);
        }
      }
      function _bufferToString(buffer) {
        var str = '';
        var uint16Array = new Uint16Array(buffer);
        try {
          str = String.fromCharCode.apply(null, uint16Array);
        } catch (e) {
          for (var i = 0; i < uint16Array.length; i++) {
            str += String.fromCharCode(uint16Array[i]);
          }
        }
        return str;
      }
      function _serialize(value, callback) {
        var valueString = '';
        if (value) {
          valueString = value.toString();
        }
        if (value && (value.toString() === '[object ArrayBuffer]' || value.buffer && value.buffer.toString() === '[object ArrayBuffer]')) {
          var buffer;
          var marker = SERIALIZED_MARKER;
          if (value instanceof ArrayBuffer) {
            buffer = value;
            marker += TYPE_ARRAYBUFFER;
          } else {
            buffer = value.buffer;
            if (valueString === '[object Int8Array]') {
              marker += TYPE_INT8ARRAY;
            } else if (valueString === '[object Uint8Array]') {
              marker += TYPE_UINT8ARRAY;
            } else if (valueString === '[object Uint8ClampedArray]') {
              marker += TYPE_UINT8CLAMPEDARRAY;
            } else if (valueString === '[object Int16Array]') {
              marker += TYPE_INT16ARRAY;
            } else if (valueString === '[object Uint16Array]') {
              marker += TYPE_UINT16ARRAY;
            } else if (valueString === '[object Int32Array]') {
              marker += TYPE_INT32ARRAY;
            } else if (valueString === '[object Uint32Array]') {
              marker += TYPE_UINT32ARRAY;
            } else if (valueString === '[object Float32Array]') {
              marker += TYPE_FLOAT32ARRAY;
            } else if (valueString === '[object Float64Array]') {
              marker += TYPE_FLOAT64ARRAY;
            } else {
              callback(new Error("Failed to get type for BinaryArray"));
            }
          }
          callback(marker + _bufferToString(buffer));
        } else if (valueString === "[object Blob]") {
          var fileReader = new FileReader();
          fileReader.onload = function() {
            var str = _bufferToString(this.result);
            callback(SERIALIZED_MARKER + TYPE_BLOB + str);
          };
          fileReader.readAsArrayBuffer(value);
        } else {
          try {
            callback(JSON.stringify(value));
          } catch (e) {
            if (this.console && this.console.error) {
              this.console.error("Couldn't convert value into a JSON string: ", value);
            }
            callback(null, e);
          }
        }
      }
      function setItem(key, value, callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            if (value === undefined) {
              value = null;
            }
            var originalValue = value;
            _serialize(value, function(value, error) {
              if (error) {
                if (callback) {
                  callback(null, error);
                }
                reject(error);
              } else {
                try {
                  localStorage.setItem(keyPrefix + key, value);
                } catch (e) {
                  if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    if (callback) {
                      callback(null, e);
                    }
                    reject(e);
                  }
                }
                if (callback) {
                  callback(originalValue);
                }
                resolve(originalValue);
              }
            });
          });
        });
      }
      var localStorageWrapper = {
        _driver: 'localStorageWrapper',
        _initStorage: _initStorage,
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key
      };
      if (typeof define === 'function' && define.amd) {
        define('localStorageWrapper', function() {
          return localStorageWrapper;
        });
      } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = localStorageWrapper;
      } else {
        this.localStorageWrapper = localStorageWrapper;
      }
    }).call(this);
  });
  require.register("localforage/src/drivers/websql.js", function(exports, module) {
    (function() {
      'use strict';
      var BASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      var Promise = (typeof module !== 'undefined' && module.exports) ? require("then~promise@4.0.0") : this.Promise;
      var openDatabase = this.openDatabase;
      var db = null;
      var dbInfo = {};
      var SERIALIZED_MARKER = '__lfsc__:';
      var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;
      var TYPE_ARRAYBUFFER = 'arbf';
      var TYPE_BLOB = 'blob';
      var TYPE_INT8ARRAY = 'si08';
      var TYPE_UINT8ARRAY = 'ui08';
      var TYPE_UINT8CLAMPEDARRAY = 'uic8';
      var TYPE_INT16ARRAY = 'si16';
      var TYPE_INT32ARRAY = 'si32';
      var TYPE_UINT16ARRAY = 'ur16';
      var TYPE_UINT32ARRAY = 'ui32';
      var TYPE_FLOAT32ARRAY = 'fl32';
      var TYPE_FLOAT64ARRAY = 'fl64';
      var TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH + TYPE_ARRAYBUFFER.length;
      if (!openDatabase) {
        return ;
      }
      function _initStorage(options) {
        var _this = this;
        if (options) {
          for (var i in dbInfo) {
            dbInfo[i] = typeof(options[i]) !== 'string' ? options[i].toString() : options[i];
          }
        }
        return new Promise(function(resolve) {
          try {
            db = openDatabase(dbInfo.name, dbInfo.version, dbInfo.description, dbInfo.size);
          } catch (e) {
            return _this.setDriver('localStorageWrapper').then(resolve);
          }
          db.transaction(function(t) {
            t.executeSql('CREATE TABLE IF NOT EXISTS ' + dbInfo.storeName + ' (id INTEGER PRIMARY KEY, key unique, value)', [], function() {
              resolve();
            }, null);
          });
        });
      }
      function getItem(key, callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            db.transaction(function(t) {
              t.executeSql('SELECT * FROM ' + dbInfo.storeName + ' WHERE key = ? LIMIT 1', [key], function(t, results) {
                var result = results.rows.length ? results.rows.item(0).value : null;
                if (result) {
                  result = _deserialize(result);
                }
                if (callback) {
                  callback(result);
                }
                resolve(result);
              }, function(t, error) {
                if (callback) {
                  callback(null, error);
                }
                reject(error);
              });
            });
          });
        });
      }
      function setItem(key, value, callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            if (value === undefined) {
              value = null;
            }
            var originalValue = value;
            _serialize(value, function(value, error) {
              if (error) {
                reject(error);
              } else {
                db.transaction(function(t) {
                  t.executeSql('INSERT OR REPLACE INTO ' + dbInfo.storeName + ' (key, value) VALUES (?, ?)', [key, value], function() {
                    if (callback) {
                      callback(originalValue);
                    }
                    resolve(originalValue);
                  }, function(t, error) {
                    if (callback) {
                      callback(null, error);
                    }
                    reject(error);
                  });
                }, function(sqlError) {
                  if (sqlError.code === sqlError.QUOTA_ERR) {
                    if (callback) {
                      callback(null, sqlError);
                    }
                    reject(sqlError);
                  }
                });
              }
            });
          });
        });
      }
      function removeItem(key, callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            db.transaction(function(t) {
              t.executeSql('DELETE FROM ' + dbInfo.storeName + ' WHERE key = ?', [key], function() {
                if (callback) {
                  callback();
                }
                resolve();
              }, function(t, error) {
                if (callback) {
                  callback(error);
                }
                reject(error);
              });
            });
          });
        });
      }
      function clear(callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            db.transaction(function(t) {
              t.executeSql('DELETE FROM ' + dbInfo.storeName, [], function() {
                if (callback) {
                  callback();
                }
                resolve();
              }, function(t, error) {
                if (callback) {
                  callback(error);
                }
                reject(error);
              });
            });
          });
        });
      }
      function length(callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            db.transaction(function(t) {
              t.executeSql('SELECT COUNT(key) as c FROM ' + dbInfo.storeName, [], function(t, results) {
                var result = results.rows.item(0).c;
                if (callback) {
                  callback(result);
                }
                resolve(result);
              }, function(t, error) {
                if (callback) {
                  callback(null, error);
                }
                reject(error);
              });
            });
          });
        });
      }
      function key(n, callback) {
        var _this = this;
        return new Promise(function(resolve, reject) {
          _this.ready().then(function() {
            db.transaction(function(t) {
              t.executeSql('SELECT key FROM ' + dbInfo.storeName + ' WHERE id = ? LIMIT 1', [n + 1], function(t, results) {
                var result = results.rows.length ? results.rows.item(0).key : null;
                if (callback) {
                  callback(result);
                }
                resolve(result);
              }, function(t, error) {
                if (callback) {
                  callback(null, error);
                }
                reject(error);
              });
            });
          });
        });
      }
      function _bufferToString(buffer) {
        var bytes = new Uint8Array(buffer);
        var i;
        var base64String = '';
        for (i = 0; i < bytes.length; i += 3) {
          base64String += BASE_CHARS[bytes[i] >> 2];
          base64String += BASE_CHARS[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
          base64String += BASE_CHARS[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
          base64String += BASE_CHARS[bytes[i + 2] & 63];
        }
        if ((bytes.length % 3) === 2) {
          base64String = base64String.substring(0, base64String.length - 1) + "=";
        } else if (bytes.length % 3 === 1) {
          base64String = base64String.substring(0, base64String.length - 2) + "==";
        }
        return base64String;
      }
      function _deserialize(value) {
        if (value.substring(0, SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
          return JSON.parse(value);
        }
        var serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
        var type = value.substring(SERIALIZED_MARKER_LENGTH, TYPE_SERIALIZED_MARKER_LENGTH);
        var bufferLength = serializedString.length * 0.75;
        var len = serializedString.length;
        var i;
        var p = 0;
        var encoded1,
            encoded2,
            encoded3,
            encoded4;
        if (serializedString[serializedString.length - 1] === "=") {
          bufferLength--;
          if (serializedString[serializedString.length - 2] === "=") {
            bufferLength--;
          }
        }
        var buffer = new ArrayBuffer(bufferLength);
        var bytes = new Uint8Array(buffer);
        for (i = 0; i < len; i += 4) {
          encoded1 = BASE_CHARS.indexOf(serializedString[i]);
          encoded2 = BASE_CHARS.indexOf(serializedString[i + 1]);
          encoded3 = BASE_CHARS.indexOf(serializedString[i + 2]);
          encoded4 = BASE_CHARS.indexOf(serializedString[i + 3]);
          bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
          bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
          bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }
        switch (type) {
          case TYPE_ARRAYBUFFER:
            return buffer;
          case TYPE_BLOB:
            return new Blob([buffer]);
          case TYPE_INT8ARRAY:
            return new Int8Array(buffer);
          case TYPE_UINT8ARRAY:
            return new Uint8Array(buffer);
          case TYPE_UINT8CLAMPEDARRAY:
            return new Uint8ClampedArray(buffer);
          case TYPE_INT16ARRAY:
            return new Int16Array(buffer);
          case TYPE_UINT16ARRAY:
            return new Uint16Array(buffer);
          case TYPE_INT32ARRAY:
            return new Int32Array(buffer);
          case TYPE_UINT32ARRAY:
            return new Uint32Array(buffer);
          case TYPE_FLOAT32ARRAY:
            return new Float32Array(buffer);
          case TYPE_FLOAT64ARRAY:
            return new Float64Array(buffer);
          default:
            throw new Error('Unkown type: ' + type);
        }
      }
      function _serialize(value, callback) {
        var valueString = '';
        if (value) {
          valueString = value.toString();
        }
        if (value && (value.toString() === '[object ArrayBuffer]' || value.buffer && value.buffer.toString() === '[object ArrayBuffer]')) {
          var buffer;
          var marker = SERIALIZED_MARKER;
          if (value instanceof ArrayBuffer) {
            buffer = value;
            marker += TYPE_ARRAYBUFFER;
          } else {
            buffer = value.buffer;
            if (valueString === '[object Int8Array]') {
              marker += TYPE_INT8ARRAY;
            } else if (valueString === '[object Uint8Array]') {
              marker += TYPE_UINT8ARRAY;
            } else if (valueString === '[object Uint8ClampedArray]') {
              marker += TYPE_UINT8CLAMPEDARRAY;
            } else if (valueString === '[object Int16Array]') {
              marker += TYPE_INT16ARRAY;
            } else if (valueString === '[object Uint16Array]') {
              marker += TYPE_UINT16ARRAY;
            } else if (valueString === '[object Int32Array]') {
              marker += TYPE_INT32ARRAY;
            } else if (valueString === '[object Uint32Array]') {
              marker += TYPE_UINT32ARRAY;
            } else if (valueString === '[object Float32Array]') {
              marker += TYPE_FLOAT32ARRAY;
            } else if (valueString === '[object Float64Array]') {
              marker += TYPE_FLOAT64ARRAY;
            } else {
              callback(new Error("Failed to get type for BinaryArray"));
            }
          }
          callback(marker + _bufferToString(buffer));
        } else if (valueString === "[object Blob]") {
          var fileReader = new FileReader();
          fileReader.onload = function() {
            var str = _bufferToString(this.result);
            callback(SERIALIZED_MARKER + TYPE_BLOB + str);
          };
          fileReader.readAsArrayBuffer(value);
        } else {
          try {
            callback(JSON.stringify(value));
          } catch (e) {
            if (this.console && this.console.error) {
              this.console.error("Couldn't convert value into a JSON string: ", value);
            }
            callback(null, e);
          }
        }
      }
      var webSQLStorage = {
        _driver: 'webSQLStorage',
        _initStorage: _initStorage,
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key
      };
      if (typeof define === 'function' && define.amd) {
        define('webSQLStorage', function() {
          return webSQLStorage;
        });
      } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = webSQLStorage;
      } else {
        this.webSQLStorage = webSQLStorage;
      }
    }).call(this);
  });
  require("../dist/localforage");
})(require("process"));
