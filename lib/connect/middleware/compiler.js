
/*!
 * Ext JS Connect
 * Copyright(c) 2010 Sencha Inc.
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var fs = require('fs')
  , path = require('path')
  , url = require('url');

/**
 * Require cache.
 */

var cache = {};

/**
 * Setup compiler.
 *
 * Options:
 *
 *   - `src`     Source directory, defaults to **CWD**.
 *   - `dest`    Destination directory, defaults `src`.
 *   - `enable`  Array of enabled compilers.
 *
 * Compilers:
 *
 *   - `stylus`         Compiles stylus to css
 *   - `sass`           Compiles sass to css
 *   - `less`           Compiles less to css
 *   - `coffeescript`   Compiles coffee to js
 *
 * TODO: allow options for compilers, they need to be more flexible
 *       or allow direct passing of a function
 *
 * TODO: allow stat disabling (or assume NODE_ENV=production)
 *
 * @param {Object} options
 * @api public
 */

exports = module.exports = function compiler(options){
  options = options || {};

  var srcDir = options.src || process.cwd()
    , destDir = options.dest || srcDir
    , enable = options.enable;

  if (!enable || enable.length === 0) {
    throw new Error('compiler\'s "enable" option is not set, nothing will be compiled.');
  }

  return function compiler(req, res, next){
    if (req.method !== 'GET') return next();
    var pathname = url.parse(req.url).pathname;
    for (var i = 0, len = enable.length; i < len; ++i) {
      var name = enable[i]
        , compiler = compilers[name];
      if (compiler.match.test(pathname)) {
        var src = (srcDir + pathname).replace(compiler.match, compiler.ext)
          , dest = destDir + pathname;

        // Compare mtimes
        fs.stat(src, function(err, srcStats){
          if (err) {
            if (err.errno === process.ENOENT) {
              next();
            } else {
              next(err);
            }
          } else {
            fs.stat(dest, function(err, destStats){
              if (err) {
                // Oh snap! it does not exist, compile it
                if (err.errno === process.ENOENT) {
                  compile();
                } else {
                  next(err);
                }
              } else {
                // Source has changed, compile it
                if (srcStats.mtime > destStats.mtime) {
                  compile();
                } else {
                  // Defer file serving
                  next();
                }
              }
            });
          }
        });

        // Compile to the destination
        function compile() {
          fs.readFile(src, 'utf8', function(err, str){
            if (err) {
              next(err);
            } else {
              compiler.compile(str, function(err, str){
                if (err) {
                  next(err);
                } else {
                  fs.writeFile(dest, str, 'utf8', function(err){
                    next(err);
                  });
                }
              });
            }
          });
        }
        return;
      }
    }
    next();
  };
};

/**
 * Bundled compilers:
 *
 *  - [stylus](http://github.com/learnboost/stylus) to _css_
 *  - [sass](http://github.com/visionmedia/sass.js) to _css_
 *  - [less](http://github.com/cloudhead/less.js) to _css_
 *  - [coffee](http://github.com/jashkenas/coffee-script) to _js_
 */

var compilers = exports.compilers = {
  stylus: {
    match: /\.css$/,
    ext: '.styl',
    compile: function(str, fn){
      var stylus = cache.stylus || (cache.stylus = require('stylus'));
      stylus.render(str, fn);
    }
  },
  sass: {
    match: /\.css$/,
    ext: '.sass',
    compile: function(str, fn){
      var sass = cache.sass || (cache.sass = require('sass'));
      try {
        fn(null, sass.render(str));
      } catch (err) {
        fn(err);
      }
    }
  },
  less: {
    match: /\.css$/,
    ext: '.less',
    compile: function(str, fn){
      var less = cache.less || (cache.less = require('less'));
      try {
        less.render(str, fn);
      } catch (err) {
        fn(err);
      }
    }
  },
  coffeescript: {
    match: /\.js$/,
    ext: '.coffee',
    compile: function(str, fn){
      var coffee = cache.coffee || (cache.coffee = require('coffee-script'));
      try {
        fn(null, coffee.compile(str));
      } catch (err) {
        fn(err);
      }
    }
  }
};