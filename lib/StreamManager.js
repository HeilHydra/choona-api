var Stream = require("./Stream");

function StreamManager(service) {
  this._service = service;
  this._streams = {};
}

StreamManager.prototype.get = function (playlistId) {
  var stream = this._streams[playlistId];
  if (!stream) {
    stream = new Stream(playlistId, this._service);
    this._streams[playlistId] = stream;
  }
  return stream;
};

module.exports = StreamManager;