require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const PORT = process.env.PORT || 3000;

// Инициализация Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ОШИБКА: SUPABASE_URL и SUPABASE_ANON_KEY должны быть установлены в .env файле');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Функция для очистки неактивных пользователей
async function cleanupInactiveUsers() {
  try {
    await supabase.rpc('cleanup_old_online_users');
  } catch (error) {
    console.error('Ошибка очистки неактивных пользователей:', error);
  }
}

// Запускаем очистку каждые 10 секунд
setInterval(cleanupInactiveUsers, 10000);

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

    // Проверка существующего пользователя
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .limit(1);

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Ошибка проверки пользователя:', checkError);
      return res.status(500).json({ error: 'Ошибка при проверке пользователя' });
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание нового пользователя
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          username,
          email,
          password: hashedPassword
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Ошибка Supabase:', insertError);
      return res.status(500).json({ error: 'Ошибка при создании пользователя' });
    }

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { 
        id: newUser.id, 
        username: newUser.username, 
        email: newUser.email 
      } 
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
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

    // Поиск пользователя по username или email
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${username},email.eq.${username}`)
      .limit(1);

    if (fetchError) {
      console.error('Ошибка поиска пользователя:', fetchError);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const user = users[0];

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email 
      } 
    });
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Проверка токена
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// API для отметки пользователя онлайн
app.post('/api/user-online', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const username = req.user.username;

    // Обновляем или создаем запись онлайн пользователя
    const { error } = await supabase
      .from('online_users')
      .upsert(
        {
          user_id: userId,
          username: username,
          last_seen: new Date().toISOString()
        },
        {
          onConflict: 'user_id'
        }
      );

    if (error) {
      console.error('Ошибка обновления онлайн статуса:', error);
      return res.status(500).json({ error: 'Ошибка обновления статуса' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка API user-online:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для отметки пользователя оффлайн
app.post('/api/user-offline', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('online_users')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Ошибка удаления онлайн статуса:', error);
      return res.status(500).json({ error: 'Ошибка обновления статуса' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка API user-offline:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить количество онлайн игроков
app.get('/api/online-count', async (req, res) => {
  try {
    // Сначала очищаем неактивных
    await cleanupInactiveUsers();

    // Получаем количество активных пользователей
    const { count, error } = await supabase
      .from('online_users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Ошибка получения количества онлайн:', error);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }

    res.json({ count: count || 0 });
  } catch (error) {
    console.error('Ошибка API online-count:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Запуск сервера (только для локальной разработки)
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Подключено к Supabase: ${supabaseUrl}`);
  });
}

// Экспорт для Vercel
module.exports = server;
