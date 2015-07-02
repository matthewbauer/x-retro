/* */ 
(function(process) {
  module.exports = function(config) {
    var BROWSERS = ['PhantomJS'];
    var buildLabel;
    if (process.env.TRAVIS_BUILD_NUMBER && process.env.TRAVIS_BUILD_ID) {
      buildLabel = 'Travis #' + process.env.TRAVIS_BUILD_NUMBER + ' (' + process.env.TRAVIS_BUILD_ID + ')';
    } else {
      buildLabel = 'Local Build ' + new Date().toLocaleString();
    }
    config.set({
      basePath: '.',
      frameworks: ['mocha'],
      files: ['bower_components/modernizr/assert.js', 'bower_components/expect/index.js', 'bower_components/modernizr/modernizr.js', 'dist/localforage.js', 'test/test.api.js', 'test/test.config.js', 'test/test.datatypes.js', 'test/test.drivers.js'],
      exclude: [],
      reporters: ['progress'],
      port: 9876,
      colors: true,
      logLevel: config.LOG_DEBUG,
      autoWatch: false,
      browsers: BROWSERS,
      captureTimeout: 0,
      startConnect: true,
      singleRun: false
    });
  };
})(require("process"));
