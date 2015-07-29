var Builder = require('systemjs-builder')

var builder = new Builder()
builder.loadConfig('config.js').then(function () {
	builder.config({defaultJSExtensions: true})
  return builder.build('index.coffee!', 'index.min.js', {
    minify: true
  })
})
.then(function () {
  console.log('Build complete')
})
.catch(function (err) {
  console.log(err)
})
