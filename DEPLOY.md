# Инструкция по деплою на Vercel

## Быстрый старт

### Шаг 1: Загрузите код на GitHub

```bash
# Если еще не инициализирован git
git init
git add .
git commit -m "Initial commit: Modern Games site"

# Добавьте remote (замените на ваш репозиторий)
git remote add origin https://github.com/ваш-username/ваш-репозиторий.git
git branch -M main
git push -u origin main
```

### Шаг 2: Деплой на Vercel

1. **Войдите в Vercel**
   - Откройте [vercel.com](https://vercel.com)
   - Войдите через GitHub аккаунт

2. **Создайте новый проект**
   - Нажмите **"Add New Project"**
   - Выберите ваш GitHub репозиторий
   - Нажмите **"Import"**

3. **Настройте переменные окружения**
   - В разделе **"Environment Variables"** добавьте:
     ```
     SUPABASE_URL = https://qcqcayqisdcehgnwnkhh.supabase.co
     SUPABASE_ANON_KEY = ваш_anon_key
     JWT_SECRET = сгенерируйте_случайную_строку
     ```
   - Для генерации JWT_SECRET можно использовать:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

4. **Деплой**
   - Нажмите **"Deploy"**
   - Дождитесь завершения деплоя
   - Vercel предоставит вам URL (например: `your-project.vercel.app`)

### Шаг 3: Настройка Supabase

1. **Создайте таблицу в Supabase**
   - Откройте ваш проект на [Supabase](https://supabase.com)
   - Перейдите в **SQL Editor**
   - Выполните SQL из файла `supabase-setup.sql`

2. **Проверьте настройки**
   - Убедитесь, что RLS (Row Level Security) отключен или настроен правильно
   - Проверьте, что API ключи правильные

### Шаг 4: Обновите CORS (если нужно)

Если возникнут проблемы с CORS, обновите настройки в Supabase:
- Settings → API → CORS
- Добавьте ваш Vercel домен

## Проверка работы

После деплоя проверьте:

1. ✅ Главная страница открывается
2. ✅ Регистрация работает
3. ✅ Авторизация работает
4. ✅ Счетчик онлайн обновляется

## Обновление кода

После каждого push в GitHub, Vercel автоматически:
- Обнаружит изменения
- Запустит новый деплой
- Создаст preview для каждого PR

## Troubleshooting

### Socket.io не работает
- Убедитесь, что WebSocket включен в настройках Vercel
- Проверьте, что CORS настроен правильно

### Ошибки подключения к Supabase
- Проверьте переменные окружения в Vercel
- Убедитесь, что таблица создана в Supabase
- Проверьте RLS политики

### Статические файлы не загружаются
- Проверьте, что файлы в папке `public/`
- Убедитесь, что маршруты в `vercel.json` правильные

