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

    socket.on("playlist:downvote", function (trackId) {
      service
        .request("playlist", socket.playlistId, "upvote", trackId)
        .send();
    });

    socket.on("playlist:play", function () {
      streamManager
        .get(socket.playlistId)
        .add(socket);
    });

    socket.on("playlist:search", function (searchString, cb) {
      service
        .request("source", "spotify", "search", searchString)
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