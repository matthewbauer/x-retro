/* */ 
"format cjs";
(function() {
  'use strict';
  var Promise = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined') ? require("promise") : this.Promise;
  var CustomDrivers = {};
  var DriverType = {
    INDEXEDDB: 'asyncStorage',
    LOCALSTORAGE: 'localStorageWrapper',
    WEBSQL: 'webSQLStorage'
  };
  var DefaultDriverOrder = [DriverType.INDEXEDDB, DriverType.WEBSQL, DriverType.LOCALSTORAGE];
  var LibraryMethods = ['clear', 'getItem', 'iterate', 'key', 'keys', 'length', 'removeItem', 'setItem'];
  var ModuleType = {
    DEFINE: 1,
    EXPORT: 2,
    WINDOW: 3
  };
  var DefaultConfig = {
    description: '',
    driver: DefaultDriverOrder.slice(),
    name: 'localforage',
    size: 4980736,
    storeName: 'keyvaluepairs',
    version: 1.0
  };
  var moduleType = ModuleType.WINDOW;
  if (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined') {
    moduleType = ModuleType.EXPORT;
  } else if (typeof define === 'function' && define.amd) {
    moduleType = ModuleType.DEFINE;
  }
  var driverSupport = (function(self) {
    var indexedDB = indexedDB || self.indexedDB || self.webkitIndexedDB || self.mozIndexedDB || self.OIndexedDB || self.msIndexedDB;
    var result = {};
    result[DriverType.WEBSQL] = !!self.openDatabase;
    result[DriverType.INDEXEDDB] = !!(function() {
      if (typeof self.openDatabase !== 'undefined' && self.navigator && self.navigator.userAgent && /Safari/.test(self.navigator.userAgent) && !/Chrome/.test(self.navigator.userAgent)) {
        return false;
      }
      try {
        return indexedDB && typeof indexedDB.open === 'function' && typeof self.IDBKeyRange !== 'undefined';
      } catch (e) {
        return false;
      }
    })();
    result[DriverType.LOCALSTORAGE] = !!(function() {
      try {
        return (self.localStorage && ('setItem' in self.localStorage) && (self.localStorage.setItem));
      } catch (e) {
        return false;
      }
    })();
    return result;
  })(this);
  var isArray = Array.isArray || function(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
  function callWhenReady(localForageInstance, libraryMethod) {
    localForageInstance[libraryMethod] = function() {
      var _args = arguments;
      return localForageInstance.ready().then(function() {
        return localForageInstance[libraryMethod].apply(localForageInstance, _args);
      });
    };
  }
  function extend() {
    for (var i = 1; i < arguments.length; i++) {
      var arg = arguments[i];
      if (arg) {
        for (var key in arg) {
          if (arg.hasOwnProperty(key)) {
            if (isArray(arg[key])) {
              arguments[0][key] = arg[key].slice();
            } else {
              arguments[0][key] = arg[key];
            }
          }
        }
      }
    }
    return arguments[0];
  }
  function isLibraryDriver(driverName) {
    for (var driver in DriverType) {
      if (DriverType.hasOwnProperty(driver) && DriverType[driver] === driverName) {
        return true;
      }
    }
    return false;
  }
  var globalObject = this;
  function LocalForage(options) {
    this._config = extend({}, DefaultConfig, options);
    this._driverSet = null;
    this._ready = false;
    this._dbInfo = null;
    for (var i = 0; i < LibraryMethods.length; i++) {
      callWhenReady(this, LibraryMethods[i]);
    }
    this.setDriver(this._config.driver);
  }
  LocalForage.prototype.INDEXEDDB = DriverType.INDEXEDDB;
  LocalForage.prototype.LOCALSTORAGE = DriverType.LOCALSTORAGE;
  LocalForage.prototype.WEBSQL = DriverType.WEBSQL;
  LocalForage.prototype.config = function(options) {
    if (typeof(options) === 'object') {
      if (this._ready) {
        return new Error("Can't call config() after localforage " + 'has been used.');
      }
      for (var i in options) {
        if (i === 'storeName') {
          options[i] = options[i].replace(/\W/g, '_');
        }
        this._config[i] = options[i];
      }
      if ('driver' in options && options.driver) {
        this.setDriver(this._config.driver);
      }
      return true;
    } else if (typeof(options) === 'string') {
      return this._config[options];
    } else {
      return this._config;
    }
  };
  LocalForage.prototype.defineDriver = function(driverObject, callback, errorCallback) {
    var defineDriver = new Promise(function(resolve, reject) {
      try {
        var driverName = driverObject._driver;
        var complianceError = new Error('Custom driver not compliant; see ' + 'https://mozilla.github.io/localForage/#definedriver');
        var namingError = new Error('Custom driver name already in use: ' + driverObject._driver);
        if (!driverObject._driver) {
          reject(complianceError);
          return ;
        }
        if (isLibraryDriver(driverObject._driver)) {
          reject(namingError);
          return ;
        }
        var customDriverMethods = LibraryMethods.concat('_initStorage');
        for (var i = 0; i < customDriverMethods.length; i++) {
          var customDriverMethod = customDriverMethods[i];
          if (!customDriverMethod || !driverObject[customDriverMethod] || typeof driverObject[customDriverMethod] !== 'function') {
            reject(complianceError);
            return ;
          }
        }
        var supportPromise = Promise.resolve(true);
        if ('_support' in driverObject) {
          if (driverObject._support && typeof driverObject._support === 'function') {
            supportPromise = driverObject._support();
          } else {
            supportPromise = Promise.resolve(!!driverObject._support);
          }
        }
        supportPromise.then(function(supportResult) {
          driverSupport[driverName] = supportResult;
          CustomDrivers[driverName] = driverObject;
          resolve();
        }, reject);
      } catch (e) {
        reject(e);
      }
    });
    defineDriver.then(callback, errorCallback);
    return defineDriver;
  };
  LocalForage.prototype.driver = function() {
    return this._driver || null;
  };
  LocalForage.prototype.ready = function(callback) {
    var self = this;
    var ready = new Promise(function(resolve, reject) {
      self._driverSet.then(function() {
        if (self._ready === null) {
          self._ready = self._initStorage(self._config);
        }
        self._ready.then(resolve, reject);
      }).catch(reject);
    });
    ready.then(callback, callback);
    return ready;
  };
  LocalForage.prototype.setDriver = function(drivers, callback, errorCallback) {
    var self = this;
    if (typeof drivers === 'string') {
      drivers = [drivers];
    }
    this._driverSet = new Promise(function(resolve, reject) {
      var driverName = self._getFirstSupportedDriver(drivers);
      var error = new Error('No available storage method found.');
      if (!driverName) {
        self._driverSet = Promise.reject(error);
        reject(error);
        return ;
      }
      self._dbInfo = null;
      self._ready = null;
      if (isLibraryDriver(driverName)) {
        var driverPromise = new Promise(function(resolve) {
          if (moduleType === ModuleType.DEFINE) {
            require([driverName], resolve);
          } else if (moduleType === ModuleType.EXPORT) {
            switch (driverName) {
              case self.INDEXEDDB:
                resolve(require("./drivers/indexeddb"));
                break;
              case self.LOCALSTORAGE:
                resolve(require("./drivers/localstorage"));
                break;
              case self.WEBSQL:
                resolve(require("./drivers/websql"));
                break;
            }
          } else {
            resolve(globalObject[driverName]);
          }
        });
        driverPromise.then(function(driver) {
          self._extend(driver);
          resolve();
        });
      } else if (CustomDrivers[driverName]) {
        self._extend(CustomDrivers[driverName]);
        resolve();
      } else {
        self._driverSet = Promise.reject(error);
        reject(error);
      }
    });
    function setDriverToConfig() {
      self._config.driver = self.driver();
    }
    this._driverSet.then(setDriverToConfig, setDriverToConfig);
    this._driverSet.then(callback, errorCallback);
    return this._driverSet;
  };
  LocalForage.prototype.supports = function(driverName) {
    return !!driverSupport[driverName];
  };
  LocalForage.prototype._extend = function(libraryMethodsAndProperties) {
    extend(this, libraryMethodsAndProperties);
  };
  LocalForage.prototype._getFirstSupportedDriver = function(drivers) {
    if (drivers && isArray(drivers)) {
      for (var i = 0; i < drivers.length; i++) {
        var driver = drivers[i];
        if (this.supports(driver)) {
          return driver;
        }
      }
    }
    return null;
  };
  LocalForage.prototype.createInstance = function(options) {
    return new LocalForage(options);
  };
  var localForage = new LocalForage();
  if (moduleType === ModuleType.DEFINE) {
    define('localforage', function() {
      return localForage;
    });
  } else if (moduleType === ModuleType.EXPORT) {
    module.exports = localForage;
  } else {
    this.localforage = localForage;
  }
}).call(window);
