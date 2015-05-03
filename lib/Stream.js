var _ = require("lodash-node");
var spawn = require("child_process").spawn;

function Stream(playlistId, service) {
  var self = this;
  this._playlistId = playlistId;
  this._service = service;
  this._sockets = {};
  this._stream = null;
  this._loading = false;
  service.stream("playlist", this._playlistId, "stream")
    .readable()
    .then(function (stream) {
      var avconv = spawn('avconv', [
        '-i', 'pipe:0', // Input on stdin
        '-acodec', 'pcm_s16le', // PCM 16bits, little-endian
        '-ar', '44100', // Sampling rate
        '-ac', 2, // Mono
        '-f', 'wav',
        'pipe:1' // Output on stdout
        ],
        { stdio: ['pipe', 'pipe', 'ignore'] }
      );
      stream.pipe(avconv.stdin);
      avconv.stdout.on("data", self._handleStreamData.bind(self));
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