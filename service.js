var Waterway = require("waterway");
var config = require("config");
var when = require("when");
var SocketIO = require("socket.io");
var socketJwt = require("socketio-jwt");
var StreamManager = require("./lib/StreamManager");

var service = new Waterway(config.waterway);
var io = SocketIO(config.io.port);
var streamManager = new StreamManager(service);

io.use(socketioJwt.authorize({
  secret: config.auth0.secret,
  handshake: true
}));

io.on("connection", function (socket) {

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

  socket.on("playlist:add", function (data) {
    service
      .request("playlist", socket.playlistId, "add", data.trackId)
      .send();
  });

  socket.on("playlist:upvote", function (data) {
    service
      .request("playlist", socket.playlistId, "upvote", data.trackId)
      .send();
  });

  socket.on("playlist:downvote", function (data) {
    service
      .request("playlist", socket.playlistId, "upvote", data.trackId)
      .send();
  });

  socket.on("playlist:play", function () {
    streamManager
      .get(socket.playlistId)
      .add(socket);
  });

  socket.on("disconnect", function () {
    streamManager
      .get(socket.playlistId)
      .remove(socket);
  });

});

service
  .event("playlist", ":playlistId", "added", ":trackId")
  .on(function (res) {
    io.to(res.params.playlistId).emit("playlist:added", res.data);
  });

service
  .event("playlist", ":playlistId", "sorted")
  .on(function (res) {
    io.to(res.params.playlistId).emit("playlist:sorted", res.data);
  });

service
  .event("playlist", ":playlistId", "playing")
  .on(function (res) {
    io.to(res.params.playlistId).emit("playlist:playing", res.data);
  });