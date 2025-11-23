// Состояние приложения
let currentUser = null;
let token = localStorage.getItem('token');
let onlineCheckInterval = null;
let heartbeatInterval = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    checkAuth();
    updateOnlineCount();
});

// Инициализация приложения
function initializeApp() {
    // Обновление счетчика онлайн каждые 3 секунды
    onlineCheckInterval = setInterval(updateOnlineCount, 3000);
    
    // Обработка закрытия страницы
    window.addEventListener('beforeunload', () => {
        if (currentUser) {
            markUserOffline();
        }
    });

    // Обработка потери фокуса/скрытия вкладки
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && currentUser) {
            markUserOffline();
        } else if (!document.hidden && currentUser) {
            markUserOnline();
        }
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопки авторизации
    document.getElementById('login-btn').addEventListener('click', () => showModal('login-modal'));
    document.getElementById('register-btn').addEventListener('click', () => showModal('register-modal'));
    document.getElementById('hero-register-btn').addEventListener('click', () => showModal('register-modal'));

    // Закрытие модальных окон
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            hideModal(modal.id);
        });
    });

    // Закрытие по клику вне модального окна
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal.id);
            }
        });
    });

    // Формы
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

// Показать модальное окно
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// Скрыть модальное окно
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    clearErrors();
}

// Очистить ошибки
function clearErrors() {
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
}

// Регистрация
async function handleRegister(e) {
    e.preventDefault();
    clearErrors();

    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            document.getElementById('register-error').textContent = data.error || 'Ошибка регистрации';
            return;
        }

        // Успешная регистрация
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        
        updateUI();
        hideModal('register-modal');
        markUserOnline();
    } catch (error) {
        document.getElementById('register-error').textContent = 'Ошибка подключения к серверу';
    }
}

// Авторизация
async function handleLogin(e) {
    e.preventDefault();
    clearErrors();

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            document.getElementById('login-error').textContent = data.error || 'Ошибка авторизации';
            return;
        }

        // Успешная авторизация
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        
        updateUI();
        hideModal('login-modal');
        markUserOnline();
    } catch (error) {
        document.getElementById('login-error').textContent = 'Ошибка подключения к серверу';
    }
}

// Выход
function handleLogout() {
    markUserOffline();
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    updateUI();
}

// Проверка авторизации
async function checkAuth() {
    if (!token) {
        updateUI();
        return;
    }

    try {
        const response = await fetch('/api/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateUI();
            markUserOnline();
        } else {
            localStorage.removeItem('token');
            token = null;
            updateUI();
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
    }
}

// Обновление UI
function updateUI() {
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    const heroButtons = document.getElementById('hero-buttons');

    if (currentUser) {
        authButtons.classList.add('hidden');
        userMenu.classList.remove('hidden');
        document.getElementById('username-display').textContent = currentUser.username;
        heroButtons.innerHTML = `<p style="color: var(--accent-primary); font-size: 1.2rem;">Добро пожаловать, ${currentUser.username}!</p>`;
    } else {
        authButtons.classList.remove('hidden');
        userMenu.classList.add('hidden');
        heroButtons.innerHTML = '<button id="hero-register-btn" class="btn-hero">Начать Игру</button>';
        document.getElementById('hero-register-btn').addEventListener('click', () => showModal('register-modal'));
    }
}

// Отметить пользователя онлайн
async function markUserOnline() {
    if (!token || !currentUser) return;

    try {
        await fetch('/api/user-online', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // Запускаем heartbeat для поддержания онлайн статуса
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        heartbeatInterval = setInterval(markUserOnline, 15000); // каждые 15 секунд
    } catch (error) {
        console.error('Ошибка отметки онлайн:', error);
    }
}

// Отметить пользователя оффлайн
async function markUserOffline() {
    if (!token || !currentUser) return;

    try {
        await fetch('/api/user-offline', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    } catch (error) {
        console.error('Ошибка отметки оффлайн:', error);
    }
}

// Обновить счетчик онлайн
async function updateOnlineCount() {
    try {
        const response = await fetch('/api/online-count');
        const data = await response.json();
        updateOnlineCountDisplay(data.count);
    } catch (error) {
        console.error('Ошибка получения количества онлайн:', error);
    }
}

// Обновить отображение счетчика
function updateOnlineCountDisplay(count) {
    document.getElementById('online-count').textContent = count;
}

