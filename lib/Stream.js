var _ = require("lodash-node");

function Stream(playlistId, service) {
  var self = this;
  this._playlistId = playlistId;
  this._service = service;
  this._sockets = [];
  this._stream = null;
  this._loading = false;
  service.stream("playlist", this._playlistId, "stream")
    .readable()
    .then(function (stream) {
      stream.on("data", self._handleStreamData.bind(self));
    });
}

Stream.prototype._handleStreamData = function (data) {
  _.invoke(this._sockets, "emit", "playlist:data", data);
};

Stream.prototype.add = function (socket) {
  this._sockets[socket.id] = socket;
};

Stream.prototype.remove = function (socket) {
  this._sockets = _.omit(this._sockets, socket.id);
};

module.exports = Stream;