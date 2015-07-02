/* */ 
"format cjs";
(function() {
  'use strict';
  var Promise = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined') ? require("promise") : this.Promise;
  var globalObject = this;
  var serializer = null;
  var localStorage = null;
  try {
    if (!this.localStorage || !('setItem' in this.localStorage)) {
      return ;
    }
    localStorage = this.localStorage;
  } catch (e) {
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
    var dbInfo = {};
    if (options) {
      for (var i in options) {
        dbInfo[i] = options[i];
      }
    }
    dbInfo.keyPrefix = dbInfo.name + '/';
    self._dbInfo = dbInfo;
    var serializerPromise = new Promise(function(resolve) {
      if (moduleType === ModuleType.DEFINE) {
        require(['localforageSerializer'], resolve);
      } else if (moduleType === ModuleType.EXPORT) {
        resolve(require("../utils/serializer"));
      } else {
        resolve(globalObject.localforageSerializer);
      }
    });
    return serializerPromise.then(function(lib) {
      serializer = lib;
      return Promise.resolve();
    });
  }
  function clear(callback) {
    var self = this;
    var promise = self.ready().then(function() {
      var keyPrefix = self._dbInfo.keyPrefix;
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key.indexOf(keyPrefix) === 0) {
          localStorage.removeItem(key);
        }
      }
    });
    executeCallback(promise, callback);
    return promise;
  }
  function getItem(key, callback) {
    var self = this;
    if (typeof key !== 'string') {
      window.console.warn(key + ' used as a key, but it is not a string.');
      key = String(key);
    }
    var promise = self.ready().then(function() {
      var dbInfo = self._dbInfo;
      var result = localStorage.getItem(dbInfo.keyPrefix + key);
      if (result) {
        result = serializer.deserialize(result);
      }
      return result;
    });
    executeCallback(promise, callback);
    return promise;
  }
  function iterate(iterator, callback) {
    var self = this;
    var promise = self.ready().then(function() {
      var keyPrefix = self._dbInfo.keyPrefix;
      var keyPrefixLength = keyPrefix.length;
      var length = localStorage.length;
      for (var i = 0; i < length; i++) {
        var key = localStorage.key(i);
        var value = localStorage.getItem(key);
        if (value) {
          value = serializer.deserialize(value);
        }
        value = iterator(value, key.substring(keyPrefixLength), i + 1);
        if (value !== void(0)) {
          return value;
        }
      }
    });
    executeCallback(promise, callback);
    return promise;
  }
  function key(n, callback) {
    var self = this;
    var promise = self.ready().then(function() {
      var dbInfo = self._dbInfo;
      var result;
      try {
        result = localStorage.key(n);
      } catch (error) {
        result = null;
      }
      if (result) {
        result = result.substring(dbInfo.keyPrefix.length);
      }
      return result;
    });
    executeCallback(promise, callback);
    return promise;
  }
  function keys(callback) {
    var self = this;
    var promise = self.ready().then(function() {
      var dbInfo = self._dbInfo;
      var length = localStorage.length;
      var keys = [];
      for (var i = 0; i < length; i++) {
        if (localStorage.key(i).indexOf(dbInfo.keyPrefix) === 0) {
          keys.push(localStorage.key(i).substring(dbInfo.keyPrefix.length));
        }
      }
      return keys;
    });
    executeCallback(promise, callback);
    return promise;
  }
  function length(callback) {
    var self = this;
    var promise = self.keys().then(function(keys) {
      return keys.length;
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
    var promise = self.ready().then(function() {
      var dbInfo = self._dbInfo;
      localStorage.removeItem(dbInfo.keyPrefix + key);
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
    var promise = self.ready().then(function() {
      if (value === undefined) {
        value = null;
      }
      var originalValue = value;
      return new Promise(function(resolve, reject) {
        serializer.serialize(value, function(value, error) {
          if (error) {
            reject(error);
          } else {
            try {
              var dbInfo = self._dbInfo;
              localStorage.setItem(dbInfo.keyPrefix + key, value);
              resolve(originalValue);
            } catch (e) {
              if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                reject(e);
              }
              reject(e);
            }
          }
        });
      });
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
  var localStorageWrapper = {
    _driver: 'localStorageWrapper',
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
  if (moduleType === ModuleType.EXPORT) {
    module.exports = localStorageWrapper;
  } else if (moduleType === ModuleType.DEFINE) {
    define('localStorageWrapper', function() {
      return localStorageWrapper;
    });
  } else {
    this.localStorageWrapper = localStorageWrapper;
  }
}).call(window);
