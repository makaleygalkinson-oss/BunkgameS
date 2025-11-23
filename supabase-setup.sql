-- SQL скрипт для создания таблиц в Supabase
-- Выполните этот скрипт в SQL Editor вашего Supabase проекта

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Таблица онлайн пользователей
CREATE TABLE IF NOT EXISTS online_users (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_online_users_user_id ON online_users(user_id);
CREATE INDEX IF NOT EXISTS idx_online_users_last_seen ON online_users(last_seen);

-- Отключение Row Level Security для упрощения (так как используется собственная JWT аутентификация)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE online_users DISABLE ROW LEVEL SECURITY;

-- Функция для автоматической очистки неактивных пользователей (старше 30 секунд)
CREATE OR REPLACE FUNCTION cleanup_old_online_users()
RETURNS void AS $$
BEGIN
  DELETE FROM online_users 
  WHERE last_seen < NOW() - INTERVAL '30 seconds';
END;
$$ LANGUAGE plpgsql;

-- Включение Realtime для таблицы online_users (для обновлений в реальном времени)
ALTER PUBLICATION supabase_realtime ADD TABLE online_users;

