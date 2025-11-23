const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const PORT = process.env.PORT || 3000;

// Инициализация базы данных
const db = new sqlite3.Database('./users.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Хранилище онлайн пользователей (socketId -> username)
const socketToUser = new Map();
const onlineUsers = new Set();

// Middleware для проверки JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Регистрация
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
          }
          return res.status(500).json({ error: 'Ошибка при создании пользователя' });
        }

        const token = jwt.sign(
          { id: this.lastID, username, email },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({ token, user: { id: this.lastID, username, email } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Авторизация
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }

    db.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Ошибка сервера' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
        }

        const token = jwt.sign(
          { id: user.id, username: user.username, email: user.email },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Проверка токена
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Socket.io подключения
io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  socket.on('user-online', (userData) => {
    if (userData && userData.username) {
      // Если пользователь уже был онлайн с другого устройства, удаляем старое подключение
      for (const [socketId, username] of socketToUser.entries()) {
        if (username === userData.username && socketId !== socket.id) {
          socketToUser.delete(socketId);
          onlineUsers.delete(username);
        }
      }
      
      socketToUser.set(socket.id, userData.username);
      onlineUsers.add(userData.username);
      io.emit('online-count', onlineUsers.size);
    }
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
    const username = socketToUser.get(socket.id);
    if (username) {
      socketToUser.delete(socket.id);
      onlineUsers.delete(username);
      io.emit('online-count', onlineUsers.size);
    }
  });
});

// Получить количество онлайн игроков
app.get('/api/online-count', (req, res) => {
  res.json({ count: onlineUsers.size });
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

