-- SQL скрипт для создания таблицы users в Supabase
-- Выполните этот скрипт в SQL Editor вашего Supabase проекта

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Отключение Row Level Security для упрощения (так как используется собственная JWT аутентификация)
-- Если нужна дополнительная безопасность, включите RLS и настройте политики
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Если хотите включить RLS, раскомментируйте следующее:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations" ON users FOR ALL USING (true) WITH CHECK (true);

