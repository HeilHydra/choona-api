var Waterway = require("waterway");
var config = require("config");
var when = require("when");
var socketIO = require("socket.io");
var socketioJwt = require("socketio-jwt");
var StreamManager = require("./lib/StreamManager");

var service = new Waterway(config.waterway);
var io = socketIO(config.io.port);
var streamManager = new StreamManager(service);

io.on("connection", socketioJwt.authorize({
    secret: new Buffer(config.auth0.secret, "base64"),
    timeout: -1
  }))
  .on("authenticated", function (socket) {
    if (!socket.registered) {
      registerSocket(socket);
    }
  });

service
  .event("playlist", ":playlistId", "added", ":trackId")
  .on(function (res) {
    io.to(res.params.playlistId).emit("playlist:added", res.data);
  });

service
  .event("playlist", ":playlistId", "queue")
  .on(function (res) {
    io.to(res.params.playlistId).emit("playlist:queue", res.data);
  });

service
  .event("playlist", ":playlistId", "empty")
  .on(function (res) {
    io.to(res.params.playlistId).emit("playlist:empty");
  });

service
  .event("playlist", ":playlistId", "playing")
  .on(function (res) {
    io.to(res.params.playlistId).emit("playlist:playing", res.data);
  });

function registerSocket(socket) {
  socket.registered = true;

  socket.on("playlist:join", function (data) {
    if (socket.playlistId) {
      socket.leaveAll();
      streamManager
        .get(socket.playlistId)
        .remove(socket);
    }

    var playlistId = String(data.playlistId);
    socket.join(playlistId);
    socket.playlistId = playlistId;

    when
      .all([
        service.request("playlist", playlistId, "getStatus").send(),
        service.request("playlist", playlistId, "getQueue").send()
      ])
      .spread(function (status, queue) {
        socket.emit("playlist:init", {
          status: status.data,
          queue: queue.data
        });
      });
  });

  socket.on("playlist:add", function (trackId) {
    service
      .request("playlist", socket.playlistId, "add", trackId)
      .send();
  });

  socket.on("playlist:downvote", function (trackId, cb) {
    service
      .request("playlist", socket.playlistId, "user", socket.decoded_token.user_id, "downvote", trackId)
      .send()
      .then(function (res) {
        cb(res.data);
      });
  });

  socket.on("playlist:upvote", function (trackId, cb) {
    service
      .request("playlist", socket.playlistId, "user", socket.decoded_token.user_id, "upvote", trackId)
      .send()
      .then(function (res) {
        cb(res.data);
      });
  });

  socket.on("playlist:stream:start", function () {
    streamManager
      .get(socket.playlistId)
      .add(socket);
  });

  socket.on("playlist:stream:stop", function () {
    streamManager
      .get(socket.playlistId)
      .add(socket);
  });

  socket.on("playlist:search", function (searchString, cb) {
    service
      .request("playlist", socket.playlistId, "search", searchString)
      .send()
      .then(function (res) {
        cb(res.data);
      });
  });

  socket.on("disconnect", function () {
    if (socket.playlistId) {
      streamManager
        .get(socket.playlistId)
        .remove(socket);
    }
  });
}