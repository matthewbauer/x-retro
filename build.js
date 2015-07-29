var Builder = require('systemjs-builder')

var builder = new Builder()
builder.loadConfig('config.js').then(function () {
	builder.config({defaultJSExtensions: true})
  return builder.buildSFX('index.coffee!', 'index.min.js', {
    minify: true,
    runtime: false
  })
})
.then(function () {
  console.log('Build complete')
})
.catch(function (err) {
  console.log(err)
})
