const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// 静的ファイルを配信（HTML/CSS/クライアントJS）
app.use(express.static(path.join(__dirname)));

// Render や環境変数対応のポート設定
const PORT = process.env.PORT || 3000;

// ルームごとの状態
const rooms = {}; // { roomId: { baseReturns, players, events, round } }

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentRole = null;
  let currentPlayerId = null;

  // ルーム参加
  socket.on('join_room', ({ roomId, role, playerId }) => {
    currentRoom = roomId;
    currentRole = role;
    currentPlayerId = playerId;
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        baseReturns: [2, 3, 6, 10, 30, 0],
        players: {},
        events: [],
        round: 1
      };
    }
    // GMには全体状態送信
    if (role === 'gm') {
      socket.emit('room_state', rooms[roomId]);
    }
    io.to(roomId).emit('player_list_update', rooms[roomId].players);
  });

  // ルーム初期化
  socket.on('initialize_room', ({ roomId }) => {
    rooms[roomId] = {
      baseReturns: [2, 3, 6, 10, 30, 0],
      players: {},
      events: [],
      round: 1
    };
    io.to(roomId).emit('room_state', rooms[roomId]);
    io.to(roomId).emit('player_list_update', rooms[roomId].players);
  });

  // プレイヤー情報更新
  socket.on('player_update', ({ roomId, playerId, data }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].players[playerId] = data;
    io.to(roomId).emit('player_list_update', rooms[roomId].players);
    io.to(roomId).emit('room_state', rooms[roomId]);
  });

  // GM: イベント適用
  socket.on('apply_event', ({ roomId, idx, delta, text }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].baseReturns[idx] += delta;
    rooms[roomId].events.push({ time: new Date().toISOString(), text: `🎴 ${text}` });
    io.to(roomId).emit('room_state', rooms[roomId]);
  });

  // GM: ラウンド開始
  socket.on('start_round', ({ roomId }) => {
    if (!rooms[roomId]) return;
    let log = [];
    Object.entries(rooms[roomId].players).forEach(([playerId, data]) => {
      if (data.ready && data.investments) {
        let newAssets = 0;
        data.investments.forEach((investment, index) => {
          const returnRate = rooms[roomId].baseReturns[index] / 100;
          newAssets += investment * (1 + returnRate);
        });
        rooms[roomId].players[playerId].funds = Math.floor(newAssets);
        rooms[roomId].players[playerId].ready = false;
        rooms[roomId].players[playerId].investments = [0, 0, 0, 0, 0, 0];
        log.push(`${playerId}の新資産: ${Math.floor(newAssets).toLocaleString()}円`);
      }
    });
    rooms[roomId].events.push({ time: new Date().toISOString(), text: `ラウンド${rooms[roomId].round}が完了。全プレイヤーの資産を更新しました` });
    log.forEach(txt => rooms[roomId].events.push({ time: new Date().toISOString(), text: txt }));
    rooms[roomId].round += 1;
    io.to(roomId).emit('room_state', rooms[roomId]);
    io.to(roomId).emit('player_list_update', rooms[roomId].players);
  });

  // 切断時のプレイヤー削除（必要に応じて拡張）
  socket.on('disconnect', () => {
    // ここでは省略。必要ならplayerId/socketId管理を拡張してください。
  });
});

server.listen(PORT, () => {
  console.log(`Socket.IO server running at http://localhost:${PORT}/`);
});
