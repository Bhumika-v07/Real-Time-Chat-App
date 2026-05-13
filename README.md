# Real-Time Chat Application

A simple real-time chat project made with Node.js, WebSocket, HTML, CSS, and JavaScript.

This project is intentionally kept beginner-friendly and easy to explain in interviews. It does not use React, Express, Socket.IO, or a database, so the real-time logic is visible in the code.

## Features

- Create a temporary user account by entering a name
- Join chat rooms
- Send real-time room messages
- Send private messages to online users
- See online users in the current room
- View recent chat history while the server is running
- Responsive layout for laptop and mobile screens

## How To Run

```bash
node server.js
```

Then open:

```text
http://localhost:3000
```

Open the same URL in two browser tabs to test real-time messaging.

## Project Structure

```text
real-time-chat-app/
  server.js
  public/
    index.html
    style.css
    app.js
  README.md
  INTERVIEW_NOTES.md
```

## How It Works

1. The browser opens a WebSocket connection to the Node.js server.
2. The user joins with a name and room.
3. The server stores connected users in memory.
4. When a user sends a room message, the server broadcasts it to everyone in that room.
5. When a user sends a private message, the server sends it only to the sender and receiver.
6. Recent room messages are stored in memory until the server restarts.

## Limitations

- No permanent database
- No password login
- Chat history is lost when the server restarts
- File sharing and notifications are not included

These limitations are good future improvements to discuss with recruiters.
