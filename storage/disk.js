/**
 * 重写disk，实现以文件的md5命名
 * 
 */
var fs = require('fs')
var os = require('os')
var path = require('path')
var crypto = require('crypto')
var mkdirp = require('mkdirp')

function getFilename (req, file, cb) {
  crypto.pseudoRandomBytes(16, function (err, raw) {
    cb(err, err ? undefined : raw.toString('hex'))
  })
}

function getDestination (req, file, cb) {
  cb(null, os.tmpdir())
}

function DiskStorage (opts) {
  this.getFilename = (opts.filename || getFilename)

  if (typeof opts.destination === 'string') {
    mkdirp.sync(opts.destination)
    this.getDestination = function ($0, $1, cb) { cb(null, opts.destination) }
  } else {
    this.getDestination = (opts.destination || getDestination)
  }
}

DiskStorage.prototype._handleFile = function _handleFile (req, file, cb) {
  var that = this
  var hash = crypto.createHash('md5')
  that.getDestination(req, file, function (err, destination) {
    if (err) return cb(err)

    that.getFilename(req, file, function (err, filename) {
      if (err) return cb(err)

      var finalPath = path.join(destination, filename)
      var outStream = fs.createWriteStream(finalPath)

      // 监控文件流，计算md5
      file.stream.on('data', function (chunk) {
        hash.update(chunk)
      })
      file.stream.pipe(outStream)
      outStream.on('error', cb)
      outStream.on('finish', function () {
        const md5 = hash.digest('hex').toLowerCase();
        const fileFormat = (file.originalname).split('.');
        const filename = md5 + '.' + fileFormat[fileFormat.length - 1];
        const oldPath = finalPath;
        finalPath = path.join(destination, filename)

        // 计算完成了md5，把文件重命名
        fs.rename(oldPath, finalPath, () => {
          cb(null, {
            destination: destination,
            filename: filename,
            path: finalPath,
            size: outStream.bytesWritten
          })
        })
      })
    })
  })
}

DiskStorage.prototype._removeFile = function _removeFile (req, file, cb) {
  var path = file.path

  delete file.destination
  delete file.filename
  delete file.path

  fs.unlink(path, cb)
}

module.exports = function (opts) {
  return new DiskStorage(opts)
}