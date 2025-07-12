// server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
// ① 静的ファイルをこのディレクトリ（リポジトリルート）から配信
app.use(express.static(path.join(__dirname)));

// HTTPサーバーを起動
const server = http.createServer(app);
// Socket.IO を紐づけ
const io = new Server(server);

// ここに既存の socket.io のロジック（join_room, start_round など）をペースト
io.on('connection', socket => {
  socket.on('join_room', ({ roomId, role }) => {
    socket.join(roomId);
    // …既存コード…
  });
  // それ以外のイベントハンドラも同様に
});

// ② Render が渡すポートを優先。なければローカル用の 3000 番
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
