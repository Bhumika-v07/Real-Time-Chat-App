const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const clients = new Map();
const rooms = new Map();
const history = new Map();

const server = http.createServer((req, res) => {
  const requestedPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(PUBLIC_DIR, requestedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      return res.end("File not found");
    }

    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(content);
  });
});

server.on("upgrade", (req, socket) => {
  const acceptKey = crypto
    .createHash("sha1")
    .update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
  );

  const id = crypto.randomUUID();
  clients.set(id, {
    id,
    socket,
    name: "Guest",
    room: "general",
    joinedAt: new Date().toISOString(),
  });

  socket.on("data", (buffer) => handleSocketData(id, buffer));
  socket.on("close", () => removeClient(id));
  socket.on("error", () => removeClient(id));
});

function handleSocketData(clientId, buffer) {
  const message = decodeFrame(buffer);
  if (!message) return;

  try {
    const data = JSON.parse(message);
    const client = clients.get(clientId);
    if (!client) return;

    if (data.type === "join") {
      joinRoom(client, data.name, data.room);
    }

    if (data.type === "room-message") {
      addMessage(client.room, {
        type: "room-message",
        from: client.name,
        room: client.room,
        text: cleanText(data.text),
        time: getTime(),
      });
    }

    if (data.type === "private-message") {
      sendPrivateMessage(client, data.to, cleanText(data.text));
    }
  } catch (error) {
    sendToClient(clientId, { type: "error", text: "Invalid message format." });
  }
}

function joinRoom(client, name, room) {
  leaveCurrentRoom(client);

  client.name = cleanText(name) || "Guest";
  client.room = cleanText(room) || "general";

  if (!rooms.has(client.room)) {
    rooms.set(client.room, new Set());
  }

  rooms.get(client.room).add(client.id);

  sendToClient(client.id, {
    type: "history",
    room: client.room,
    messages: history.get(client.room) || [],
  });

  broadcastToRoom(client.room, {
    type: "system",
    text: `${client.name} joined ${client.room}`,
    time: getTime(),
  });

  broadcastPresence();
}

function leaveCurrentRoom(client) {
  const roomClients = rooms.get(client.room);
  if (roomClients) {
    roomClients.delete(client.id);
  }
}

function addMessage(room, message) {
  if (!history.has(room)) {
    history.set(room, []);
  }

  history.get(room).push(message);
  history.set(room, history.get(room).slice(-30));
  broadcastToRoom(room, message);
}

function sendPrivateMessage(sender, receiverName, text) {
  const receiver = [...clients.values()].find((client) => client.name === receiverName);
  const message = {
    type: "private-message",
    from: sender.name,
    to: receiverName,
    text,
    time: getTime(),
  };

  if (!receiver) {
    sendToClient(sender.id, { type: "error", text: "That user is not online." });
    return;
  }

  sendToClient(sender.id, message);
  sendToClient(receiver.id, message);
}

function broadcastToRoom(room, data) {
  const roomClients = rooms.get(room) || new Set();
  roomClients.forEach((id) => sendToClient(id, data));
}

function broadcastPresence() {
  const users = [...clients.values()].map((client) => ({
    name: client.name,
    room: client.room,
  }));

  clients.forEach((client) => {
    sendToClient(client.id, {
      type: "presence",
      users,
      room: client.room,
    });
  });
}

function sendToClient(id, data) {
  const client = clients.get(id);
  if (!client || client.socket.destroyed) return;
  client.socket.write(encodeFrame(JSON.stringify(data)));
}

function removeClient(id) {
  const client = clients.get(id);
  if (!client) return;

  leaveCurrentRoom(client);
  clients.delete(id);

  broadcastToRoom(client.room, {
    type: "system",
    text: `${client.name} left the chat`,
    time: getTime(),
  });

  broadcastPresence();
}

function decodeFrame(buffer) {
  const secondByte = buffer[1];
  let length = secondByte & 127;
  let offset = 2;

  if (length === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    length = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  const mask = buffer.slice(offset, offset + 4);
  offset += 4;

  const payload = buffer.slice(offset, offset + length);
  const decoded = Buffer.alloc(payload.length);

  for (let i = 0; i < payload.length; i++) {
    decoded[i] = payload[i] ^ mask[i % 4];
  }

  return decoded.toString("utf8");
}

function encodeFrame(message) {
  const payload = Buffer.from(message);
  const length = payload.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([129, length]), payload]);
  }

  const header = Buffer.alloc(4);
  header[0] = 129;
  header[1] = 126;
  header.writeUInt16BE(length, 2);
  return Buffer.concat([header, payload]);
}

function cleanText(value) {
  return String(value || "").trim().slice(0, 300);
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getContentType(filePath) {
  const extension = path.extname(filePath);
  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
  };

  return types[extension] || "text/plain";
}

server.listen(PORT, () => {
  console.log(`Chat app running at http://localhost:${PORT}`);
});
