const socket = new WebSocket(`ws://${window.location.host}`);

const joinForm = document.getElementById("joinForm");
const messageForm = document.getElementById("messageForm");
const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const messageInput = document.getElementById("messageInput");
const messageMode = document.getElementById("messageMode");
const privateTo = document.getElementById("privateTo");
const messages = document.getElementById("messages");
const usersList = document.getElementById("usersList");
const roomTitle = document.getElementById("roomTitle");
const statusText = document.getElementById("status");
let currentUser = "Student";

socket.addEventListener("open", () => {
  statusText.textContent = "Online";
  joinRoom();
});

socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "history") {
    messages.innerHTML = "";
    roomTitle.textContent = data.room;
    data.messages.forEach(addMessage);
  }

  if (["room-message", "private-message", "system", "error"].includes(data.type)) {
    addMessage(data);
  }

  if (data.type === "presence") {
    showUsers(data.users, data.room);
  }
});

socket.addEventListener("close", () => {
  statusText.textContent = "Offline";
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  joinRoom();
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();
  if (!text) return;

  if (messageMode.value === "private") {
    socket.send(
      JSON.stringify({
        type: "private-message",
        to: privateTo.value.trim(),
        text,
      })
    );
  } else {
    socket.send(JSON.stringify({ type: "room-message", text }));
  }

  messageInput.value = "";
  messageInput.focus();
});

messageMode.addEventListener("change", () => {
  privateTo.classList.toggle("hidden", messageMode.value !== "private");
});

function joinRoom() {
  currentUser = nameInput.value.trim() || "Student";

  socket.send(
    JSON.stringify({
      type: "join",
      name: currentUser,
      room: roomInput.value || "general",
    })
  );
}

function addMessage(message) {
  const item = document.createElement("article");
  const isOwnMessage = message.from === currentUser;
  const messageSide = isOwnMessage ? "own" : "other";
  item.className = `message ${messageSide}`;

  if (message.type === "system" || message.type === "error") {
    item.className = "message system";
    item.textContent = message.text;
  } else {
    if (message.type === "private-message") {
      item.classList.add("private");
    }

    const receiver = message.to ? ` to ${message.to}` : "";
    const initial = getInitial(message.from);

    item.innerHTML = `
      <div class="avatar">${escapeHtml(initial)}</div>
      <div class="bubble">
        <div class="meta">
          <span>${escapeHtml(message.from)}${escapeHtml(receiver)}</span>
          <span>${escapeHtml(message.time)}</span>
        </div>
        <div>${escapeHtml(message.text)}</div>
      </div>
    `;
  }

  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function showUsers(users, currentRoom) {
  usersList.innerHTML = "";

  users
    .filter((user) => user.room === currentRoom)
    .forEach((user) => {
      const li = document.createElement("li");
      li.textContent = `${user.name} - ${user.room}`;
      usersList.appendChild(li);
    });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInitial(name) {
  return String(name || "?").trim().charAt(0).toUpperCase();
}
