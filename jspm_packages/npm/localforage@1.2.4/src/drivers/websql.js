/* */ 
"format cjs";
(function() {
  'use strict';
  var Promise = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined') ? require("promise") : this.Promise;
  var globalObject = this;
  var serializer = null;
  var openDatabase = this.openDatabase;
  if (!openDatabase) {
    return ;
  }
  var ModuleType = {
    DEFINE: 1,
    EXPORT: 2,
    WINDOW: 3
  };
  var moduleType = ModuleType.WINDOW;
  if (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined') {
    moduleType = ModuleType.EXPORT;
  } else if (typeof define === 'function' && define.amd) {
    moduleType = ModuleType.DEFINE;
  }
  function _initStorage(options) {
    var self = this;
    var dbInfo = {db: null};
    if (options) {
      for (var i in options) {
        dbInfo[i] = typeof(options[i]) !== 'string' ? options[i].toString() : options[i];
      }
    }
    var serializerPromise = new Promise(function(resolve) {
      if (moduleType === ModuleType.DEFINE) {
        require(['localforageSerializer'], resolve);
      } else if (moduleType === ModuleType.EXPORT) {
        resolve(require("../utils/serializer"));
      } else {
        resolve(globalObject.localforageSerializer);
      }
    });
    var dbInfoPromise = new Promise(function(resolve, reject) {
      try {
        dbInfo.db = openDatabase(dbInfo.name, String(dbInfo.version), dbInfo.description, dbInfo.size);
      } catch (e) {
        return self.setDriver(self.LOCALSTORAGE).then(function() {
          return self._initStorage(options);
        }).then(resolve).catch(reject);
      }
      dbInfo.db.transaction(function(t) {
        t.executeSql('CREATE TABLE IF NOT EXISTS ' + dbInfo.storeName + ' (id INTEGER PRIMARY KEY, key unique, value)', [], function() {
          self._dbInfo = dbInfo;
          resolve();
        }, function(t, error) {
          reject(error);
        });
      });
    });
    return serializerPromise.then(function(lib) {
      serializer = lib;
      return dbInfoPromise;
    });
  }
  function getItem(key, callback) {
    var self = this;
    if (typeof key !== 'string') {
      window.console.warn(key + ' used as a key, but it is not a string.');
      key = String(key);
    }
    var promise = new Promise(function(resolve, reject) {
      self.ready().then(function() {
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          t.executeSql('SELECT * FROM ' + dbInfo.storeName + ' WHERE key = ? LIMIT 1', [key], function(t, results) {
            var result = results.rows.length ? results.rows.item(0).value : null;
            if (result) {
              result = serializer.deserialize(result);
            }
            resolve(result);
          }, function(t, error) {
            reject(error);
          });
        });
      }).catch(reject);
    });
    executeCallback(promise, callback);
    return promise;
  }
  function iterate(iterator, callback) {
    var self = this;
    var promise = new Promise(function(resolve, reject) {
      self.ready().then(function() {
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          t.executeSql('SELECT * FROM ' + dbInfo.storeName, [], function(t, results) {
            var rows = results.rows;
            var length = rows.length;
            for (var i = 0; i < length; i++) {
              var item = rows.item(i);
              var result = item.value;
              if (result) {
                result = serializer.deserialize(result);
              }
              result = iterator(result, item.key, i + 1);
              if (result !== void(0)) {
                resolve(result);
                return ;
              }
            }
            resolve();
          }, function(t, error) {
            reject(error);
          });
        });
      }).catch(reject);
    });
    executeCallback(promise, callback);
    return promise;
  }
  function setItem(key, value, callback) {
    var self = this;
    if (typeof key !== 'string') {
      window.console.warn(key + ' used as a key, but it is not a string.');
      key = String(key);
    }
    var promise = new Promise(function(resolve, reject) {
      self.ready().then(function() {
        if (value === undefined) {
          value = null;
        }
        var originalValue = value;
        serializer.serialize(value, function(value, error) {
          if (error) {
            reject(error);
          } else {
            var dbInfo = self._dbInfo;
            dbInfo.db.transaction(function(t) {
              t.executeSql('INSERT OR REPLACE INTO ' + dbInfo.storeName + ' (key, value) VALUES (?, ?)', [key, value], function() {
                resolve(originalValue);
              }, function(t, error) {
                reject(error);
              });
            }, function(sqlError) {
              if (sqlError.code === sqlError.QUOTA_ERR) {
                reject(sqlError);
              }
            });
          }
        });
      }).catch(reject);
    });
    executeCallback(promise, callback);
    return promise;
  }
  function removeItem(key, callback) {
    var self = this;
    if (typeof key !== 'string') {
      window.console.warn(key + ' used as a key, but it is not a string.');
      key = String(key);
    }
    var promise = new Promise(function(resolve, reject) {
      self.ready().then(function() {
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          t.executeSql('DELETE FROM ' + dbInfo.storeName + ' WHERE key = ?', [key], function() {
            resolve();
          }, function(t, error) {
            reject(error);
          });
        });
      }).catch(reject);
    });
    executeCallback(promise, callback);
    return promise;
  }
  function clear(callback) {
    var self = this;
    var promise = new Promise(function(resolve, reject) {
      self.ready().then(function() {
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          t.executeSql('DELETE FROM ' + dbInfo.storeName, [], function() {
            resolve();
          }, function(t, error) {
            reject(error);
          });
        });
      }).catch(reject);
    });
    executeCallback(promise, callback);
    return promise;
  }
  function length(callback) {
    var self = this;
    var promise = new Promise(function(resolve, reject) {
      self.ready().then(function() {
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          t.executeSql('SELECT COUNT(key) as c FROM ' + dbInfo.storeName, [], function(t, results) {
            var result = results.rows.item(0).c;
            resolve(result);
          }, function(t, error) {
            reject(error);
          });
        });
      }).catch(reject);
    });
    executeCallback(promise, callback);
    return promise;
  }
  function key(n, callback) {
    var self = this;
    var promise = new Promise(function(resolve, reject) {
      self.ready().then(function() {
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          t.executeSql('SELECT key FROM ' + dbInfo.storeName + ' WHERE id = ? LIMIT 1', [n + 1], function(t, results) {
            var result = results.rows.length ? results.rows.item(0).key : null;
            resolve(result);
          }, function(t, error) {
            reject(error);
          });
        });
      }).catch(reject);
    });
    executeCallback(promise, callback);
    return promise;
  }
  function keys(callback) {
    var self = this;
    var promise = new Promise(function(resolve, reject) {
      self.ready().then(function() {
        var dbInfo = self._dbInfo;
        dbInfo.db.transaction(function(t) {
          t.executeSql('SELECT key FROM ' + dbInfo.storeName, [], function(t, results) {
            var keys = [];
            for (var i = 0; i < results.rows.length; i++) {
              keys.push(results.rows.item(i).key);
            }
            resolve(keys);
          }, function(t, error) {
            reject(error);
          });
        });
      }).catch(reject);
    });
    executeCallback(promise, callback);
    return promise;
  }
  function executeCallback(promise, callback) {
    if (callback) {
      promise.then(function(result) {
        callback(null, result);
      }, function(error) {
        callback(error);
      });
    }
  }
  var webSQLStorage = {
    _driver: 'webSQLStorage',
    _initStorage: _initStorage,
    iterate: iterate,
    getItem: getItem,
    setItem: setItem,
    removeItem: removeItem,
    clear: clear,
    length: length,
    key: key,
    keys: keys
  };
  if (moduleType === ModuleType.DEFINE) {
    define('webSQLStorage', function() {
      return webSQLStorage;
    });
  } else if (moduleType === ModuleType.EXPORT) {
    module.exports = webSQLStorage;
  } else {
    this.webSQLStorage = webSQLStorage;
  }
}).call(window);
