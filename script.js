
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let loadingCounter = 0;

function showLoading(message = 'Загрузка...') {

    loadingCounter++;

    const existing = document.querySelector('.loading-overlay');

    if (existing) {
        const textEl = existing.querySelector('.loading-text');
        if (textEl) textEl.textContent = message;
        return;
    }

    const overlay = document.createElement('div');

    overlay.className = 'loading-overlay';

    overlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">${message}</div>
        </div>
    `;

    document.body.appendChild(overlay);
}

function hideLoading() {
    loadingCounter--;
    
    if (loadingCounter <= 0) {
        loadingCounter = 0;
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
}

let currentUser = null;
let currentPage = 'home'; // home, shopping, menu, recipes, products

const CONVERSIONS = {
    'г': { target: 'кг', factor: 1000 },
    'грамм': { target: 'кг', factor: 1000 },
    'мл': { target: 'л', factor: 1000 },
    'миллилитр': { target: 'л', factor: 1000 },
};

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

// Проверка авторизации
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        currentUser = user;
        showMainApp();
    } else {
        showLoginForm();
    }
}

function translateAuthError(error) {
    if (error.message.includes('Invalid login credentials')) {
        return 'Неверный email или пароль.';
    }

    if (error.message.includes('User already registered')) {
        return 'Пользователь с таким email уже зарегистрирован.';
    }

    if (error.message.includes('Password should be at least')) {
        return 'Пароль должен содержать минимум 6 символов.';
    }

    if (error.message.includes('Email not confirmed')) {
        return 'Подтвердите адрес электронной почты.';
    }

    return error.message;
}

// Показать форму входа
function showLoginForm() {
    document.getElementById('app').innerHTML = `
        <div class="login-container">
            <wa-card style="max-width: 400px; margin: 3rem auto;">
                <h1 slot="header">Авторизация</h1>
                <div id="error-message" class="error-message" style="display: none;"></div>
                <p class="hint-text">
                    Если вы на сайте в первый раз, введите данные для авторизации и нажмите кнопку "Зарегистрироваться"
                </p>
                <input type="email" id="email" placeholder="Email" class="input-field">
                <input type="password" id="password" placeholder="Пароль" class="input-field">
                
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; margin-top: 0rem;">
                    <wa-button id="register-btn" variant="text">Зарегистрироваться</wa-button>    
                    <wa-button id="login-btn" variant="primary">Войти</wa-button> 
                </div>
            </wa-card>
        </div>
    `;
    
    document.getElementById('login-btn').onclick = () => handleLogin();
    document.getElementById('register-btn').onclick = () => handleRegister();
}

function showError(message) { // вспомогательная функция для показа/скрытия ошибок
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

function showSuccess(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.className = 'error-message success';
    }
}

async function handleRegister() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    hideError();

    if (!email) {
        showError('Введите email');
        return;
    }

    if (!password) {
        showError('Введите пароль');
        return;
    }

    showLoading('Регистрация...');

    try {
        const { error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) {
            showError(translateAuthError(error));
            return;
        }

        showSuccess('Регистрация успешна! Теперь войдите.');
        document.getElementById('password').value = '';

    } catch (err) {
        console.error(err);
        showError('Произошла непредвиденная ошибка.');
    } finally {
        hideLoading();
    }
}

async function handleLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    hideError();

    if (!email) {
        showError('Введите email');
        return;
    }

    if (!password) {
        showError('Введите пароль');
        return;
    }
    showLoading('Вход...');

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            showError(translateAuthError(error));
            return;
        }

        currentUser = (await supabase.auth.getUser()).data.user;

        showMainApp();

    } catch (err) {
        console.error(err);
        showError('Произошла непредвиденная ошибка.');
    } finally {
        hideLoading();
    }
}

// Показать главное приложение
// Показать главное приложение
function showMainApp() {
    renderNavigation();
    
    // Загружаем последнюю открытую страницу или домашнюю
    const savedPage = localStorage.getItem('currentPage');
    if (savedPage && ['home', 'shopping', 'menu', 'recipes', 'products'].includes(savedPage)) {
        loadPage(savedPage);
    } else {
        loadPage('home');
    }
}

function updateActiveNav() {
    const map = {
        home: 'nav-home',
        shopping: 'nav-shopping',
        menu: 'nav-menu',
        recipes: 'nav-recipes',
        products: 'nav-products'
    };
    for (const [page, id] of Object.entries(map)) {
        const btn = document.getElementById(id);
        if (!btn) continue;
        if (page === currentPage) {
            btn.style.fontWeight = '700';
            btn.style.color = 'var(--primary-dark)';
        } else {
            btn.style.fontWeight = '';
            btn.style.color = '';
        }
    }
}

// Загрузка страницы по имени
function loadPage(page) {
    currentPage = page;
    localStorage.setItem('currentPage', page);
    updateActiveNav();
    
    switch (page) {
        case 'home':
            loadHome();
            break;
        case 'shopping':
            loadShoppingList();
            break;
        case 'menu':
            loadMenuPlanner();
            break;
        case 'recipes':
            loadRecipes();
            break;
        case 'products':
            loadProducts();
            break;
        default:
            loadHome();
    }
}

// Навигация
function renderNavigation() {
    document.getElementById('app').innerHTML = `
        <div class="app-header">
            <div class="profile-container">
                <button id="profile-btn" class="profile-btn">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="white"/>
                    </svg>
                </button>
                <div id="profile-dropdown" class="profile-dropdown hidden">
                    <div class="profile-email" id="profile-email">${currentUser?.email || 'Пользователь'}</div>
                    <div class="dropdown-divider"></div>
                    <button id="settings-btn" class="dropdown-item">Настройки</button>
                    <button id="logout-btn" class="dropdown-item logout">Выход</button>
                </div>
            </div>
            <button id="burger-btn" class="burger-btn" aria-label="Меню">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
            <div class="nav-buttons">
                <wa-button id="nav-home" variant="text">Домашняя страница</wa-button>
                <wa-button id="nav-shopping" variant="text">Список продуктов</wa-button>
                <wa-button id="nav-menu" variant="text">Меню</wa-button>
                <wa-button id="nav-recipes" variant="text">Рецепты</wa-button>
                <wa-button id="nav-products" variant="text">Продукты</wa-button>
            </div>
        </div>
        <div id="content"></div>
    `;
    
    // Навигационные кнопки
    document.getElementById('nav-home').onclick = () => loadPage('home');
    document.getElementById('nav-shopping').onclick = () => loadPage('shopping');
    document.getElementById('nav-menu').onclick = () => loadPage('menu');
    document.getElementById('nav-recipes').onclick = () => loadPage('recipes');
    document.getElementById('nav-products').onclick = () => loadPage('products');

    const burgerBtn = document.getElementById('burger-btn');
    const navButtons = document.querySelector('.nav-buttons');
    if (burgerBtn && navButtons) {
        burgerBtn.onclick = (e) => {
            e.stopPropagation();
            navButtons.classList.toggle('nav-open');
        };
        document.addEventListener('click', (e) => {
            if (!burgerBtn.contains(e.target) && !navButtons.contains(e.target)) {
                navButtons.classList.remove('nav-open');
            }
        });
        navButtons.querySelectorAll('wa-button').forEach(btn => {
            btn.addEventListener('click', () => navButtons.classList.remove('nav-open'));
        });
    }

    updateActiveNav();
    
    // Профиль (оставляем как было)
    const profileBtn = document.getElementById('profile-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    profileBtn.onclick = (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('hidden');
    };
    
    document.addEventListener('click', (e) => {
        if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.add('hidden');
        }
    });
    
    document.getElementById('settings-btn').onclick = () => {
        profileDropdown.classList.add('hidden');
        showSettings();
    };
    
    document.getElementById('logout-btn').onclick = () => {
        profileDropdown.classList.add('hidden');
        handleLogout();
    };
}

// Выход
async function handleLogout() {
    showLoading('Выход...');
    await supabase.auth.signOut();
    currentUser = null;
    localStorage.removeItem('currentPage'); // очищаем сохранённую страницу
    hideLoading();
    checkAuth();
}

async function loadHome() {
    const contentDiv = document.getElementById('content');

    const userName = currentUser?.email?.split('@')[0] || 'Пользователь';

    contentDiv.innerHTML = `
        <div class="home-container">
            <h1 class="home-welcome">Добро пожаловать, ${escapeHtml(userName)}!</h1>
            <div id="home-recent-header" class="home-section-header"></div>
            <div class="home-left">
                <div id="home-recent"></div>
                <div id="home-weekly-menu"></div>
            </div>
            <div class="home-right">
                <div class="home-section-header">
                    <h2>Список покупок</h2>
                </div>
                <div id="home-shop-list"></div>
                <div class="home-shop-footer">
                    <wa-button id="home-shop-link" variant="primary">Перейти к списку</wa-button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('home-shop-link').onclick = () => loadPage('shopping');

    loadHomeRecent();
    loadHomeWeeklyMenu();
    loadHomeShopList();
}

async function loadHomeRecent() {
    const container = document.getElementById('home-recent');
    const headerContainer = document.getElementById('home-recent-header');
    if (headerContainer) headerContainer.innerHTML = `<h2>Недавние рецепты</h2>`;
    if (!container) return;

    try {
        const { data: recipes, error } = await supabase
            .from('recipes')
            .select(`
                id, name, image_url, instructions,
                recipe_ingredients ( quant, products ( name, units ( name ) ) )
            `)
            .order('id', { ascending: false })
            .limit(3);

        if (error) throw error;

        if (!recipes || recipes.length === 0) {
            container.innerHTML = `
                <div class="home-empty">Нет рецептов. <a href="#" id="home-add-recipe-link">Добавьте первый!</a></div>
            `;
            const addLink = document.getElementById('home-add-recipe-link');
            if (addLink) addLink.onclick = (e) => {
                e.preventDefault();
                loadPage('recipes');
            };
            return;
        }

        container.innerHTML = `
            <div class="home-recent-grid">
                ${recipes.map(r => {
                    const desc = (r.recipe_ingredients || [])
                        .map(ri => {
                            const n = ri.products?.name || '';
                            const u = ri.products?.units?.name || '';
                            return `${n} — ${ri.quant} ${u}`;
                        })
                        .slice(0, 3)
                        .join(', ');
                    return `
                        <div class="home-recent-card" data-id="${r.id}">
                            ${r.image_url
                                ? `<img src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.name)}">`
                                : `<div class="home-recent-placeholder">🍽</div>`
                            }
                            <div class="home-recent-name">${escapeHtml(r.name)}</div>
                            ${desc ? `<div class="home-recent-desc">${escapeHtml(desc)}</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.querySelectorAll('.home-recent-card').forEach(card => {
            card.onclick = async () => {
                try {
                    showLoading('Загрузка...');
                    const { data: recipe, error: rErr } = await supabase
                        .from('recipes')
                        .select('id, name, image_url, instructions, recipe_ingredients (id, quant, product_id)')
                        .eq('id', card.dataset.id)
                        .single();
                    hideLoading();
                    if (rErr) throw rErr;
                    if (recipe) showRecipeDetail(recipe);
                } catch (err) {
                    hideLoading();
                    console.error(err);
                }
            };
        });
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="home-empty">Ошибка загрузки</div>`;
    }
}

function getWeekDates() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(formatDateISO(d));
    }
    return dates;
}

async function loadHomeWeeklyMenu() {
    const container = document.getElementById('home-weekly-menu');
    if (!container) return;

    const weekDates = getWeekDates();
    const todayStr = formatDateISO(new Date());

    try {
        const { data: menuItems, error } = await supabase
            .from('menu')
            .select(`
                id,
                date,
                quant,
                recipe_id,
                recipes ( id, name, image_url )
            `)
            .gte('date', weekDates[0])
            .lte('date', weekDates[6])
            .eq('user_id', currentUser.id);

        if (error) throw error;

        const menuByDate = {};
        for (const item of (menuItems || [])) {
            if (!menuByDate[item.date]) menuByDate[item.date] = [];
            menuByDate[item.date].push(item);
        }

        const DOW_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

        let daysHtml = '';
        for (let i = 0; i < 7; i++) {
            const dateStr = weekDates[i];
            const d = new Date(dateStr + 'T00:00:00');
            const dow = i;
            const isToday = dateStr === todayStr;
            const items = menuByDate[dateStr] || [];

            daysHtml += `
                <div class="home-week-day ${isToday ? 'home-week-day-today' : ''}" data-date="${dateStr}">
                    <div class="home-week-day-head">
                        <span class="home-week-day-name">${DOW_SHORT[dow]}</span>
                        <span class="home-week-day-date">${d.getDate()}</span>
                    </div>
                    <div class="home-week-day-items">
                        ${items.length === 0
                            ? '<span class="home-week-empty">—</span>'
                            : items.map(item => {
                                const r = item.recipes;
                                return `
                                    <div class="home-week-item" data-menu-id="${item.id}" data-recipe-id="${r?.id || ''}">
                                        <span class="home-week-item-name">${escapeHtml(r?.name || '?')}</span>
                                        <span class="home-week-item-remove" data-menu-id="${item.id}" title="Удалить">&times;</span>
                                    </div>
                                `;
                            }).join('')
                        }
                        <button class="home-week-add-btn" data-date="${dateStr}" title="Добавить">+</button>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="home-section-header">
                <h2>Меню на неделю</h2>
            </div>
            <div class="home-week-grid">
                ${daysHtml}
            </div>
        `;

        container.querySelectorAll('.home-week-add-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const dateStr = btn.dataset.date;
                try {
                    const { data: recipes } = await supabase
                        .from('recipes')
                        .select('id, name, user_id')
                        .order('name');
                    showHomeAddMenuItem(dateStr, recipes || [], weekDates);
                } catch (err) {
                    console.error(err);
                }
            };
        });

        container.querySelectorAll('.home-week-item-remove').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const menuId = btn.dataset.menuId;
                const confirmed = await showConfirm('Удалить блюдо из меню?');
                if (!confirmed) return;
                showLoading('Удаление...');
                const { error: delErr } = await supabase.from('menu').delete().eq('id', menuId);
                hideLoading();
                if (delErr) { alert(delErr.message); return; }
                showSuccess('Блюдо удалено');
                loadHomeWeeklyMenu();
                loadHomeShopList();
            };
        });

        container.querySelectorAll('.home-week-item').forEach(el => {
            el.onclick = async (e) => {
                if (e.target.closest('.home-week-item-remove')) return;
                const recipeId = el.dataset.recipeId;
                if (!recipeId) return;
                try {
                    showLoading('Загрузка...');
                    const { data: recipe, error: rErr } = await supabase
                        .from('recipes')
                        .select('id, name, image_url, instructions, user_id, recipe_ingredients (id, quant, product_id)')
                        .eq('id', recipeId)
                        .single();
                    hideLoading();
                    if (rErr) throw rErr;
                    if (recipe) {
                        const isOwner = recipe.user_id === currentUser?.id;
                        showRecipeDetail(recipe, !isOwner);
                    }
                } catch (err) {
                    hideLoading();
                    console.error(err);
                }
            };
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="home-section-header"><h2>Меню на неделю</h2></div><div class="home-empty">Ошибка загрузки</div>`;
    }
}

function showHomeAddMenuItem(dateStr, recipes, weekDates) {
    const { overlay } = showModal({
        title: 'Добавить блюдо',
        body: `
            <div class="form-group">
                <label>Рецепт</label>
                <div id="home-menu-recipe-container"></div>
                <div style="margin-top: 0.5rem;">
                    <button type="button" id="home-menu-filter-btn" style="background: none; border: 1px solid #ccc; border-radius: 8px; padding: 0.3rem 0.7rem; font-size: 0.8rem; color: #666; cursor: pointer;">Скрыть общие рецепты</button>
                </div>
            </div>
            <div class="form-group">
                <label for="home-menu-quant">Количество порций</label>
                <input type="number" id="home-menu-quant" class="input-field" min="1" step="1" value="1">
            </div>
        `,
        footer: `
            <div id="home-menu-error" style="color: var(--text-danger); font-size: 0.85rem; margin-bottom: 0.5rem; display: none; width: 100%;"></div>
            <wa-button id="home-menu-cancel" variant="text">Отмена</wa-button>
            <wa-button id="home-menu-save" variant="primary">Сохранить</wa-button>
        `
    });

    let hideShared = false;
    let allRecipes = recipes;

    function getFilteredRecipes() {
        if (hideShared) return allRecipes.filter(r => r.user_id === currentUser?.id);
        return allRecipes;
    }

    let recipeSelect = createCustomSelect(
        overlay.querySelector('#home-menu-recipe-container'),
        getFilteredRecipes().map(r => ({ id: r.id, name: r.name })),
        'Выберите рецепт',
        () => {}
    );

    overlay.querySelector('#home-menu-filter-btn').onclick = () => {
        hideShared = !hideShared;
        overlay.querySelector('#home-menu-filter-btn').textContent = hideShared ? 'Показать все рецепты' : 'Скрыть общие рецепты';
        const container = overlay.querySelector('#home-menu-recipe-container');
        container.innerHTML = '';
        recipeSelect = createCustomSelect(
            container,
            getFilteredRecipes().map(r => ({ id: r.id, name: r.name })),
            'Выберите рецепт',
            () => {}
        );
    };

    const errEl = overlay.querySelector('#home-menu-error');
    overlay.querySelector('#home-menu-cancel').onclick = () => overlay.remove();

    overlay.querySelector('#home-menu-save').onclick = async () => {
        const recipeId = recipeSelect.getValue();
        const quant = parseInt(overlay.querySelector('#home-menu-quant').value, 10);
        errEl.style.display = 'none';

        if (!recipeId) { errEl.textContent = 'Выберите рецепт'; errEl.style.display = 'block'; return; }
        if (!quant || quant <= 0) { errEl.textContent = 'Укажите количество порций'; errEl.style.display = 'block'; return; }

        showLoading('Сохранение...');
        const { error } = await supabase.from('menu').insert([{ date: dateStr, recipe_id: recipeId, quant, user_id: currentUser.id }]);
        hideLoading();
        if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
        overlay.remove();
        showSuccess('Блюдо добавлено');
        loadHomeWeeklyMenu();
        loadHomeShopList();
    };
}

function loadHomeShopList() {
    const container = document.getElementById('home-shop-list');
    if (!container) return;

    const period = getShoppingPeriod();

    (async () => {
        try {
            const items = await fetchShoppingData(period.start, period.end);

            if (items.length === 0) {
                container.innerHTML = `<div class="home-empty">Добавьте блюда в меню, чтобы сформировать список покупок.</div>`;
                return;
            }

            renderShopList(container, items);
        } catch (err) {
            console.error(err);
            container.innerHTML = `<div class="home-empty">Ошибка загрузки списка</div>`;
        }
    })();
}

async function loadProducts() {
    const contentDiv = document.getElementById('content');
    
    contentDiv.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
            <div class="loading-spinner" style="margin: 2rem auto;"></div>
            <p>Загрузка продуктов...</p>
        </div>
    `;
    
    let products = [];
    
    try {
        const result = await supabase
            .from('products')
            .select(`
                id,
                name,
                units_id,
                user_id,
                units (
                    name
                )
            `)
            .order('name');
        
        if (result.error) {
            throw result.error;
        }
        
        products = result.data || [];
    } catch (err) {
        console.error('Ошибка загрузки продуктов:', err);
        const isNetwork = err.message && err.message.includes('Failed to fetch');
        contentDiv.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #dc2626;">
                <p>Ошибка загрузки продуктов</p>
                <p style="font-size: 0.85rem; color: #888; margin-top: 0.5rem;">
                    ${isNetwork
                        ? 'Не удаётся подключиться к серверу. Проверьте подключение к интернету или откройте сайт через локальный сервер (Live Server, VS Code).'
                        : err.message || 'Неизвестная ошибка'}
                </p>
                <wa-button id="retry-btn" variant="primary" style="margin-top: 1rem;">Повторить</wa-button>
            </div>
        `;
        document.getElementById('retry-btn').onclick = () => loadProducts();
        return;
    }
    
    // Рендерим таблицу
    contentDiv.innerHTML = `
        <div class="products-container">
            <div class="products-header">
                <h2>Мои продукты</h2>
                <div style="display: flex; gap: 0.75rem; align-items: center;">
                    <wa-button id="add-product-btn" variant="primary">Добавить продукт</wa-button>
                </div>
            </div>
            
            <div class="products-table-wrapper">
                <table class="products-table">
                    <thead>
                        <tr>
                            <th>Название продукта</th>
                            <th>Единица измерения</th>
                            <th style="width: 50px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.length === 0 ? `
                            <tr>
                                <td colspan="3" class="empty-state">Нет продуктов. Добавьте первый!</td>
                            </tr>
                        ` : products.map(product => `
                            <tr ${product.user_id !== currentUser?.id ? 'data-shared="true"' : ''}>
                                <td>${escapeHtml(product.name)}</td>
                                <td>${product.units?.name || '—'}</td>
                                <td>
                                    ${product.user_id === currentUser?.id
                                        ? `<button class="delete-product-btn" data-id="${product.id}">Удалить</button>`
                                        : ''
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Кнопка добавления
    const addBtn = document.getElementById('add-product-btn');
    if (addBtn) {
        addBtn.onclick = () => showAddProductForm();
    }
    
    // Кнопки удаления
    const deleteBtns = document.querySelectorAll('.delete-product-btn');
    for (const btn of deleteBtns) {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const productId = btn.getAttribute('data-id');
            await deleteProduct(productId);
        };
    }
}

async function deleteProduct(productId) {
    const confirmed = await showConfirm('Вы уверены, что хотите удалить этот продукт?');
    if (!confirmed) return;
    
    showLoading('Удаление...');
    
    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);
        
        hideLoading();
        
        if (error) throw error;
        
        showSuccess('Продукт удалён');
        loadProducts();
    } catch (err) {
        hideLoading();
        console.error('Ошибка удаления:', err);
        const isNetwork = err.message && err.message.includes('Failed to fetch');
        alert(isNetwork
            ? 'Не удаётся подключиться к серверу. Проверьте подключение к интернету.'
            : 'Не удалось удалить продукт: ' + (err.message || 'Неизвестная ошибка'));
    }
}

async function showAddProductForm() {
    let units = [];
    
    try {
        const result = await supabase
            .from('units')
            .select('id, name')
            .order('name');
        
        if (result.error) throw result.error;
        units = result.data || [];
    } catch (err) {
        console.error('Ошибка загрузки единиц измерения:', err);
        const isNetwork = err.message && err.message.includes('Failed to fetch');
        alert(isNetwork
            ? 'Не удаётся подключиться к серверу. Проверьте подключение к интернету.'
            : 'Ошибка загрузки единиц измерения: ' + (err.message || 'Неизвестная ошибка'));
        return;
    }
    
    const { overlay } = showModal({
        title: 'Добавить продукт',
        body: `
            <div class="form-group">
                <label for="product-name">Название продукта</label>
                <input type="text" id="product-name" class="input-field" placeholder="Например: Помидоры">
            </div>
            <div class="form-group">
                <label>Единица измерения</label>
                <div id="product-unit"></div>
            </div>
        `,
        footer: `
            <div id="modal-error" style="color: var(--text-danger); font-size: 0.85rem; margin-bottom: 0.5rem; display: none; width: 100%;"></div>
            <wa-button id="modal-cancel-btn" variant="text">Отмена</wa-button>
            <wa-button id="save-product-btn" variant="primary">Сохранить</wa-button>
        `
    });
    
    const unitSelect = createCustomSelect(
        overlay.querySelector('#product-unit'),
        units.map(u => ({ id: u.id, name: u.name })),
        'Выберите единицу измерения',
        () => {}
    );
    
    setTimeout(() => overlay.querySelector('#product-name')?.focus(), 100);
    
    const modalError = overlay.querySelector('#modal-error');
    function showModalError(msg) { modalError.textContent = msg; modalError.style.display = 'block'; }
    function hideModalError() { modalError.style.display = 'none'; }
    
    overlay.querySelector('#save-product-btn').onclick = async () => {
        const name = overlay.querySelector('#product-name').value.trim();
        const unitsId = unitSelect.getValue();
        
        hideModalError();
        
        if (!name) {
            showModalError('Введите название продукта');
            return;
        }
        
        if (!unitsId) {
            showModalError('Выберите единицу измерения');
            return;
        }
        
        showLoading('Сохранение...');
        
        try {
            const { data, error } = await supabase
                .from('products')
                .insert([{
                    name: name,
                    units_id: unitsId,
                    user_id: currentUser?.id
                }])
                .select();
            
            hideLoading();
            
            if (error) throw error;
            
            overlay.remove();
            showSuccess('Продукт добавлен');
            loadProducts();
        } catch (err) {
            hideLoading();
            console.error('Ошибка сохранения:', err);
            showModalError(err.message || 'Неизвестная ошибка');
        }
    };
}

function createCustomSelect(container, options, placeholder, onSelect) {
    let selectedValue = null;
    let isOpen = false;

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';

    const trigger = document.createElement('input');
    trigger.type = 'text';
    trigger.className = 'custom-select-trigger';
    trigger.placeholder = placeholder;
    trigger.autocomplete = 'off';

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.innerHTML = `<svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';

    function renderOptions(filter) {
        const lf = (filter || '').toLowerCase();
        const filtered = options.filter(opt => opt.name.toLowerCase().includes(lf));

        dropdown.innerHTML = '';
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'custom-select-empty';
            empty.textContent = 'Нет элементов';
            dropdown.appendChild(empty);
        } else {
            filtered.forEach(opt => {
                const item = document.createElement('div');
                item.className = 'custom-select-option';
                if (opt.id == selectedValue) item.classList.add('selected');
                item.textContent = opt.name;
                item.dataset.value = opt.id;
                item.onmousedown = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectOption(opt);
                };
                dropdown.appendChild(item);
            });
        }
    }

    function selectOption(opt) {
        selectedValue = opt.id;
        trigger.value = opt.name;
        close();
        if (onSelect) onSelect(opt.id);
    }

    function positionDropdown() {
        const rect = trigger.getBoundingClientRect();
        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = rect.width + 'px';

        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 260 && rect.top > 260) {
            dropdown.style.top = 'auto';
            dropdown.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
        } else {
            dropdown.style.top = (rect.bottom + 6) + 'px';
            dropdown.style.bottom = 'auto';
        }
    }

    function open() {
        if (isOpen) return;
        isOpen = true;
        wrapper.classList.add('open');
        renderOptions(trigger.value);
        document.body.appendChild(dropdown);
        dropdown.style.display = 'block';
        positionDropdown();
    }

    function close() {
        isOpen = false;
        wrapper.classList.remove('open');
        dropdown.style.display = 'none';
        if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);

        if (selectedValue) {
            const opt = options.find(o => o.id == selectedValue);
            trigger.value = opt ? opt.name : '';
        } else {
            trigger.value = '';
        }
    }

    trigger.oninput = () => {
        if (!isOpen) open();
        renderOptions(trigger.value);
        positionDropdown();
    };

    trigger.onfocus = () => {
        open();
    };

    trigger.onblur = () => {
        setTimeout(() => {
            if (document.activeElement !== trigger && !dropdown.contains(document.activeElement)) {
                close();
            }
        }, 150);
    };

    trigger.onkeydown = (e) => {
        if (e.key === 'Escape') {
            trigger.blur();
            close();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const items = dropdown.querySelectorAll('.custom-select-option');
            if (items.length > 0) items[0].focus();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const first = dropdown.querySelector('.custom-select-option');
            if (first) first.dispatchEvent(new Event('mousedown'));
        }
    };

    dropdown.onmousedown = (e) => e.stopPropagation();

    wrapper.appendChild(trigger);
    wrapper.appendChild(arrow);
    wrapper.appendChild(dropdown);
    container.appendChild(wrapper);

    return {
        getValue: () => selectedValue,
        setValue: (val) => {
            selectedValue = val;
            const opt = options.find(o => o.id == val);
            trigger.value = opt ? opt.name : '';
        },
        destroy: () => {
            close();
            wrapper.remove();
        }
    };
}

function showModal({ title, body, footer, maxWidth, onClose }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: '9999'
    });
    overlay.innerHTML = `
        <div class="modal-container" ${maxWidth ? `style="max-width:${maxWidth}"` : ''}>
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">${body}</div>
            <div class="modal-footer">${footer || ''}</div>
        </div>
    `;

    document.body.appendChild(overlay);

    function close() {
        overlay.remove();
        if (onClose) onClose();
    }

    overlay.querySelector('.modal-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const cancelBtn = overlay.querySelector('#modal-cancel-btn');
    if (cancelBtn) cancelBtn.onclick = close;

    return { overlay, close };
}

// Функция для экранирования HTML (безопасность)
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showConfirm(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-container" style="max-width: 380px;">
                <div class="modal-body" style="text-align: center; padding: 2rem 1.5rem 1rem;">
                    <p style="font-size: 1rem; color: var(--text-primary); margin: 0;">${message}</p>
                </div>
                <div class="modal-footer" style="justify-content: center;">
                    <wa-button id="confirm-no" variant="text">Нет</wa-button>
                    <wa-button id="confirm-yes" variant="primary">Да</wa-button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#confirm-no').onclick = () => { overlay.remove(); resolve(false); };
        overlay.querySelector('#confirm-yes').onclick = () => { overlay.remove(); resolve(true); };
        overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
}

function showSettings() {
    alert('Настройки пока в разработке');
}

async function loadUnits() {
    const contentDiv = document.getElementById('content');
    
    contentDiv.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
            <div class="loading-spinner" style="margin: 2rem auto;"></div>
            <p>Загрузка единиц измерения...</p>
        </div>
    `;
    
    let units = [];
    
    try {
        const result = await supabase
            .from('units')
            .select('id, name')
            .order('name');
        
        if (result.error) throw result.error;
        units = result.data || [];
    } catch (err) {
        console.error('Ошибка загрузки единиц:', err);
        const isNetwork = err.message && err.message.includes('Failed to fetch');
        contentDiv.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #dc2626;">
                <p>Ошибка загрузки единиц измерения</p>
                <p style="font-size: 0.85rem; color: #888; margin-top: 0.5rem;">
                    ${isNetwork
                        ? 'Не удаётся подключиться к серверу. Проверьте подключение к интернету.'
                        : err.message || 'Неизвестная ошибка'}
                </p>
                <wa-button id="retry-units-btn" variant="primary" style="margin-top: 1rem;">Повторить</wa-button>
            </div>
        `;
        document.getElementById('retry-units-btn').onclick = () => loadUnits();
        return;
    }
    
    contentDiv.innerHTML = `
        <div class="products-container">
            <div class="products-header">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <a href="#" id="back-to-products" style="color: var(--primary); font-size: 0.9rem; text-decoration: none;">← Назад к продуктам</a>
                    <h2 style="margin: 0;">Единицы измерения</h2>
                </div>
                <wa-button id="add-unit-btn" variant="primary">+ Добавить единицу</wa-button>
            </div>
            
            <div class="products-table-wrapper">
                <table class="products-table">
                    <thead>
                        <tr>
                            <th>Название</th>
                            <th style="width: 50px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${units.length === 0 ? `
                            <tr>
                                <td colspan="2" class="empty-state">Нет единиц измерения. Добавьте первую!</td>
                            </tr>
                        ` : units.map(unit => `
                            <tr>
                                <td>${escapeHtml(unit.name)}</td>
                                <td>
                                    <button class="delete-unit-btn" data-id="${unit.id}">Удалить</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('back-to-products').onclick = (e) => {
        e.preventDefault();
        loadProducts();
    };
    
    document.getElementById('add-unit-btn').onclick = () => showAddUnitForm();
    
    document.querySelectorAll('.delete-unit-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            await deleteUnit(btn.getAttribute('data-id'));
        };
    });
}

async function deleteUnit(unitId) {
    const confirmed = await showConfirm('Вы уверены, что хотите удалить эту единицу измерения?');
    if (!confirmed) return;
    
    showLoading('Удаление...');
    
    try {
        const { error } = await supabase
            .from('units')
            .delete()
            .eq('id', unitId);
        
        hideLoading();
        
        if (error) throw error;
        
        showSuccess('Единица удалена');
        loadUnits();
    } catch (err) {
        hideLoading();
        console.error('Ошибка удаления единицы:', err);
        const isNetwork = err.message && err.message.includes('Failed to fetch');
        alert(isNetwork
            ? 'Не удаётся подключиться к серверу. Проверьте подключение к интернету.'
            : 'Не удалось удалить единицу: ' + (err.message || 'Неизвестная ошибка'));
    }
}

function showAddUnitForm() {
    const { overlay } = showModal({
        title: 'Добавить единицу измерения',
        body: `
            <div class="form-group">
                <label for="unit-name">Название единицы</label>
                <input type="text" id="unit-name" class="input-field" placeholder="Например: кг, г, л, шт" autofocus>
            </div>
        `,
        footer: `
            <wa-button id="cancel-unit-btn" variant="text">Отмена</wa-button>
            <wa-button id="save-unit-btn" variant="primary">Сохранить</wa-button>
        `
    });

    overlay.querySelector('#cancel-unit-btn').onclick = () => overlay.remove();

    overlay.querySelector('#save-unit-btn').onclick = async () => {
        const name = overlay.querySelector('#unit-name').value.trim();
        
        if (!name) {
            alert('Введите название единицы измерения');
            return;
        }
        
        showLoading('Сохранение...');
        
        try {
            const { error } = await supabase
                .from('units')
                .insert([{ name: name }]);
            
            hideLoading();
            
            if (error) throw error;
            
            overlay.remove();
            showSuccess('Единица добавлена');
            loadUnits();
        } catch (err) {
            hideLoading();
            console.error('Ошибка сохранения единицы:', err);
            const isNetwork = err.message && err.message.includes('Failed to fetch');
            alert(isNetwork
                ? 'Не удаётся подключиться к серверу. Проверьте подключение к интернету.'
                : 'Не удалось сохранить единицу: ' + (err.message || 'Неизвестная ошибка'));
        }
    };
    
    setTimeout(() => overlay.querySelector('#unit-name').focus(), 100);
}

async function loadRecipes() {
    const contentDiv = document.getElementById('content');

    contentDiv.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
            <div class="loading-spinner" style="margin: 2rem auto;"></div>
            <p>Загрузка рецептов...</p>
        </div>
    `;

    let recipes = [];

    try {
        const result = await supabase
            .from('recipes')
            .select(`
                id,
                name,
                image_url,
                instructions,
                user_id,
                recipe_ingredients (
                    id,
                    quant,
                    product_id,
                    products (
                        name,
                        units ( name )
                    )
                )
            `)
            .order('name');

        if (result.error) throw result.error;
        recipes = result.data || [];
    } catch (err) {
        console.error('Ошибка загрузки рецептов:', err);
        const isNetwork = err.message && err.message.includes('Failed to fetch');
        contentDiv.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #dc2626;">
                <p>Ошибка загрузки рецептов</p>
                <p style="font-size: 0.85rem; color: #888; margin-top: 0.5rem;">
                    ${isNetwork
                        ? 'Не удаётся подключиться к серверу. Проверьте подключение к интернету.'
                        : err.message || 'Неизвестная ошибка'}
                </p>
                <wa-button id="retry-recipes-btn" variant="primary" style="margin-top: 1rem;">Повторить</wa-button>
            </div>
        `;
        document.getElementById('retry-recipes-btn').onclick = () => loadRecipes();
        return;
    }

    contentDiv.innerHTML = `
        <div class="recipes-container">
            <div class="products-header">
                <h2>Мои рецепты</h2>
                <div style="display: flex; gap: 0.75rem; align-items: center;">
                    <wa-button id="filter-my-recipes-btn" variant="text" style="font-size: 0.85rem;">Оставить только мои</wa-button>
                    <wa-button id="add-recipe-btn" variant="primary">+ Добавить рецепт</wa-button>
                </div>
            </div>

            ${recipes.length === 0 ? `
                <div class="recipes-empty">
                    <p>Нет рецептов. Добавьте первый!</p>
                </div>
            ` : `
                <div class="recipes-grid">
                    ${recipes.map(recipe => {
                        const isOwner = recipe.user_id === currentUser?.id;
                        const ingredientsList = (recipe.recipe_ingredients || [])
                            .map(ri => {
                                const productName = ri.products?.name || '—';
                                const unitName = ri.products?.units?.name || '';
                                return `${escapeHtml(productName)} — ${ri.quant} ${escapeHtml(unitName)}`;
                            })
                            .join(', ');

                        return `
                            <div class="recipe-card" data-id="${recipe.id}" ${!isOwner ? 'data-shared="true"' : ''}>
                                ${isOwner ? `<button class="recipe-card-delete" data-id="${recipe.id}" title="Удалить">&times;</button>` : ''}
                                <div class="recipe-card-image">
                                    ${recipe.image_url
                                        ? `<img src="${escapeHtml(recipe.image_url)}" alt="${escapeHtml(recipe.name)}">`
                                        : `<div class="recipe-card-placeholder">🍽️</div>`
                                    }
                                </div>
                                <div class="recipe-card-body">
                                    <div class="recipe-card-name">${escapeHtml(recipe.name)}</div>
                                    ${ingredientsList ? `<div class="recipe-card-ingredients">${escapeHtml(ingredientsList)}</div>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;

    document.getElementById('add-recipe-btn').onclick = () => showAddRecipeForm();

    let showOnlyMyRecipes = false;

    document.getElementById('filter-my-recipes-btn').onclick = () => {
        showOnlyMyRecipes = !showOnlyMyRecipes;
        const btn = document.getElementById('filter-my-recipes-btn');
        btn.textContent = showOnlyMyRecipes ? 'Показать все' : 'Оставить только мои';
        document.querySelectorAll('.recipe-card').forEach(card => {
            if (showOnlyMyRecipes && card.dataset.shared === 'true') {
                card.style.display = 'none';
            } else {
                card.style.display = '';
            }
        });
    };

    document.querySelectorAll('.recipe-card-delete').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            await deleteRecipe(btn.getAttribute('data-id'));
        };
    });

    document.querySelectorAll('.recipe-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.recipe-card-delete')) return;
            const recipeId = card.dataset.id;
            const recipe = recipes.find(r => String(r.id) === String(recipeId));
            if (recipe) {
                const isOwner = recipe.user_id === currentUser?.id;
                showRecipeDetail(recipe, !isOwner);
            }
        });
    });
}

async function deleteRecipe(recipeId) {
    const confirmed = await showConfirm('Вы уверены, что хотите удалить этот рецепт?');
    if (!confirmed) return;

    showLoading('Удаление...');

    try {
        const { error } = await supabase
            .from('recipes')
            .delete()
            .eq('id', recipeId);

        hideLoading();

        if (error) throw error;

        showSuccess('Рецепт удалён');
        loadRecipes();
    } catch (err) {
        hideLoading();
        console.error('Ошибка удаления рецепта:', err);
        const isNetwork = err.message && err.message.includes('Failed to fetch');
        alert(isNetwork
            ? 'Не удаётся подключиться к серверу. Проверьте подключение к интернету.'
            : 'Не удалось удалить рецепт: ' + (err.message || 'Неизвестная ошибка'));
    }
}

async function showRecipeDetail(recipe, readOnly = false) {
    let products = [];

    showLoading('Загрузка...');
    try {
        const result = await supabase
            .from('products')
            .select(`id, name, units ( name )`)
            .order('name');

        if (result.error) throw result.error;
        products = result.data || [];
    } catch (err) {
        hideLoading();
        console.error('Ошибка загрузки продуктов:', err);
        alert('Не удалось загрузить продукты');
        return;
    }
    hideLoading();

    const existingIngredients = (recipe.recipe_ingredients || []).map(ri => ({
        product_id: ri.product_id,
        quant: ri.quant
    }));

    const { overlay } = showModal({
        title: escapeHtml(recipe.name),
        maxWidth: '550px',
        body: `
            <div class="recipe-detail-image">
                ${recipe.image_url
                    ? `<img src="${escapeHtml(recipe.image_url)}" alt="${escapeHtml(recipe.name)}">`
                    : `<div class="recipe-card-placeholder" style="height:200px;">🍽️</div>`
                }
            </div>
            ${readOnly ? `
                ${existingIngredients.length > 0 ? `
                    <div class="form-group">
                        <label>Ингредиенты</label>
                        <div style="font-size: 0.9rem; color: #555; line-height: 1.6;">
                            ${existingIngredients.map(ing => {
                                const product = products.find(p => p.id === ing.product_id);
                                return `${escapeHtml(product?.name || '?')} — ${ing.quant} ${escapeHtml(product?.units?.name || '')}`;
                            }).join('<br>')}
                        </div>
                    </div>
                ` : ''}
                ${recipe.instructions ? `
                    <div class="form-group">
                        <label>Комментарий</label>
                        <div style="font-size: 0.9rem; color: #555; line-height: 1.6;">${escapeHtml(recipe.instructions)}</div>
                    </div>
                ` : ''}
                <div style="text-align: center; padding: 0.5rem 0; color: #999; font-size: 0.8rem;">Общий рецепт — просмотр без редактирования</div>
            ` : `
                <div class="form-group">
                    <label for="recipe-detail-name">Название рецепта</label>
                    <input type="text" id="recipe-detail-name" class="input-field" value="${escapeHtml(recipe.name)}">
                </div>
                <div class="form-group">
                    <label for="recipe-detail-image-url">Ссылка на фото</label>
                    <input type="text" id="recipe-detail-image-url" class="input-field" value="${escapeHtml(recipe.image_url || '')}" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label>Ингредиенты</label>
                    <div id="recipe-detail-ingredients"></div>
                    <button type="button" id="add-detail-ingredient-btn" class="add-ingredient-btn">+ Добавить ингредиент</button>
                </div>
                <div class="form-group">
                    <label for="recipe-detail-instructions">Комментарий</label>
                    <textarea id="recipe-detail-instructions" class="input-field" rows="3" placeholder="Описание приготовления, советы...">${escapeHtml(recipe.instructions || '')}</textarea>
                </div>
            `}
        `,
        footer: readOnly ? `
            <wa-button id="cancel-detail-btn" variant="text">Закрыть</wa-button>
        ` : `
            <div id="recipe-detail-error" style="color: var(--text-danger); font-size: 0.85rem; margin-bottom: 0.5rem; display: none; width: 100%;"></div>
            <wa-button id="cancel-detail-btn" variant="text">Отменить изменения</wa-button>
            <wa-button id="save-detail-btn" variant="primary">Сохранить изменения</wa-button>
        `
    });

    const ingredientsListEl = overlay.querySelector('#recipe-detail-ingredients');

    overlay.querySelector('#cancel-detail-btn').onclick = () => overlay.remove();

    if (!readOnly) {
        function addDetailIngredientRow(productId = '', quant = '') {
        const row = document.createElement('div');
        row.className = 'ingredient-row';

        const selectContainer = document.createElement('div');
        selectContainer.className = 'ingredient-select-wrap';

        row.innerHTML = `
            <input type="number" class="input-field ingredient-quantity" placeholder="Кол-во" min="0" step="0.01" value="${quant}">
            <button type="button" class="ingredient-remove-btn" title="Удалить">&times;</button>
        `;

        row.querySelector('.ingredient-remove-btn').onclick = () => row.remove();

        const quantityInput = row.querySelector('.ingredient-quantity');
        row.insertBefore(selectContainer, quantityInput);

        const select = createCustomSelect(
            selectContainer,
            products.map(p => ({ id: p.id, name: `${p.name} (${p.units?.name || ''})` })),
            'Выберите продукт',
            () => {}
        );

        if (productId) select.setValue(productId);
        row._productSelect = select;
        ingredientsListEl.appendChild(row);
    }

    for (const ing of existingIngredients) {
            addDetailIngredientRow(ing.product_id, ing.quant);
        }

        if (existingIngredients.length === 0) {
            addDetailIngredientRow();
        }

        overlay.querySelector('#add-detail-ingredient-btn').onclick = () => addDetailIngredientRow();

        overlay.querySelector('#save-detail-btn').onclick = async () => {
        const name = overlay.querySelector('#recipe-detail-name').value.trim();
        const imageUrl = overlay.querySelector('#recipe-detail-image-url').value.trim();
        const instructions = overlay.querySelector('#recipe-detail-instructions').value.trim();
        const errorEl = overlay.querySelector('#recipe-detail-error');

        function showError(msg) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
        function hideError() { errorEl.style.display = 'none'; }

        hideError();

        if (!name) { showError('Введите название рецепта'); return; }

        const rows = ingredientsListEl.querySelectorAll('.ingredient-row');
        const ingredients = [];

        for (const row of rows) {
            const pid = row._productSelect ? row._productSelect.getValue() : null;
            const q = parseFloat(row.querySelector('.ingredient-quantity').value);
            if (!pid || !q || q <= 0) {
                showError('Заполните все ингредиенты');
                return;
            }
            ingredients.push({ product_id: pid, quant: q });
        }

        showLoading('Сохранение...');

        try {
            const { error: updateError } = await supabase
                .from('recipes')
                .update({
                    name,
                    image_url: imageUrl || null,
                    instructions: instructions || null
                })
                .eq('id', recipe.id);

            if (updateError) throw updateError;

            await supabase
                .from('recipe_ingredients')
                .delete()
                .eq('recipe_id', recipe.id);

            if (ingredients.length > 0) {
                const { error: ingError } = await supabase
                    .from('recipe_ingredients')
                    .insert(ingredients.map(ing => ({
                        recipe_id: recipe.id,
                        product_id: ing.product_id,
                        quant: ing.quant
                    })));

                if (ingError) throw ingError;
            }

            hideLoading();
            overlay.remove();
            showSuccess('Рецепт обновлён');
            if (currentPage === 'home') loadHome();
            else loadRecipes();
        } catch (err) {
            hideLoading();
            console.error('Ошибка обновления рецепта:', err);
            showError(err.message || 'Неизвестная ошибка');
        }
    };

        setTimeout(() => overlay.querySelector('#recipe-detail-name').focus(), 100);
    } else {
        setTimeout(() => overlay.querySelector('#cancel-detail-btn').focus(), 100);
    }
}

async function showAddRecipeForm() {
    let products = [];

    try {
        const result = await supabase
            .from('products')
            .select(`
                id,
                name,
                units ( name )
            `)
            .order('name');

        if (result.error) throw result.error;
        products = result.data || [];
    } catch (err) {
        console.error('Ошибка загрузки продуктов:', err);
        alert('Не удалось загрузить список продуктов');
        return;
    }

    const { overlay } = showModal({
        title: 'Добавить рецепт',
        maxWidth: '550px',
        body: `
            <div class="form-group">
                <label for="recipe-name">Название рецепта</label>
                <input type="text" id="recipe-name" class="input-field" placeholder="Например: Борщ" autofocus>
            </div>
            <div class="form-group">
                <label for="recipe-image-url">Ссылка на фото (необязательно)</label>
                <input type="text" id="recipe-image-url" class="input-field" placeholder="https://...">
            </div>
            <div class="form-group">
                <label>Ингредиенты</label>
                <div id="recipe-ingredients-list"></div>
                <button type="button" id="add-ingredient-btn" class="add-ingredient-btn">+ Добавить ингредиент</button>
            </div>
            <div class="form-group">
                <label for="recipe-comment">Комментарий</label>
                <textarea id="recipe-comment" class="input-field" rows="3" placeholder="Описание приготовления, советы..."></textarea>
            </div>
        `,
        footer: `
            <div id="recipe-modal-error" style="color: var(--text-danger); font-size: 0.85rem; margin-bottom: 0.5rem; display: none; width: 100%;"></div>
            <wa-button id="cancel-recipe-btn" variant="text">Отмена</wa-button>
            <wa-button id="save-recipe-btn" variant="primary">Сохранить</wa-button>
        `
    });

    const ingredientsList = overlay.querySelector('#recipe-ingredients-list');

    function addIngredientRow() {
        const row = document.createElement('div');
        row.className = 'ingredient-row';

        const selectContainer = document.createElement('div');
        selectContainer.className = 'ingredient-select-wrap';

        row.innerHTML = `
            <input type="number" class="input-field ingredient-quantity" placeholder="Кол-во" min="0" step="0.01">
            <button type="button" class="ingredient-remove-btn" title="Удалить">&times;</button>
        `;

        row.querySelector('.ingredient-remove-btn').onclick = () => row.remove();

        const quantityInput = row.querySelector('.ingredient-quantity');
        row.insertBefore(selectContainer, quantityInput);

        const select = createCustomSelect(
            selectContainer,
            products.map(p => ({ id: p.id, name: `${p.name} (${p.units?.name || ''})` })),
            'Выберите продукт',
            () => {}
        );

        row._productSelect = select;
        ingredientsList.appendChild(row);
    }

    addIngredientRow();

    overlay.querySelector('#add-ingredient-btn').onclick = () => addIngredientRow();
    overlay.querySelector('#cancel-recipe-btn').onclick = () => overlay.remove();

    overlay.querySelector('#save-recipe-btn').onclick = async () => {
        const name = overlay.querySelector('#recipe-name').value.trim();
        const imageUrl = overlay.querySelector('#recipe-image-url').value.trim();
        const instructions = overlay.querySelector('#recipe-comment').value.trim();
        const modalError = overlay.querySelector('#recipe-modal-error');

        function showModalError(msg) {
            modalError.textContent = msg;
            modalError.style.display = 'block';
        }
        function hideModalError() {
            modalError.style.display = 'none';
        }

        hideModalError();

        if (!name) {
            showModalError('Введите название рецепта');
            return;
        }

        const ingredientRows = ingredientsList.querySelectorAll('.ingredient-row');
        const ingredients = [];

        for (const row of ingredientRows) {
            const productId = row._productSelect ? row._productSelect.getValue() : null;
            const quant = parseFloat(row.querySelector('.ingredient-quantity').value);

            if (!productId || !quant || quant <= 0) {
                showModalError('Заполните все ингредиенты (продукт и количество)');
                return;
            }

            ingredients.push({ product_id: productId, quant });
        }

        showLoading('Сохранение...');

        try {
            const { data: recipeData, error: recipeError } = await supabase
                .from('recipes')
                .insert([{
                    name,
                    image_url: imageUrl || null,
                    instructions: instructions || null,
                    user_id: currentUser?.id
                }])
                .select();

            if (recipeError) throw recipeError;

            const recipeId = recipeData[0].id;

            if (ingredients.length > 0) {
                const { error: ingError } = await supabase
                    .from('recipe_ingredients')
                    .insert(ingredients.map(ing => ({
                        recipe_id: recipeId,
                        product_id: ing.product_id,
                        quant: ing.quant
                    })));

                if (ingError) throw ingError;
            }

            hideLoading();
            overlay.remove();
            showSuccess('Рецепт добавлен');
            loadRecipes();
        } catch (err) {
            hideLoading();
            console.error('Ошибка сохранения рецепта:', err);
            showModalError(err.message || 'Неизвестная ошибка');
        }
    };

    setTimeout(() => overlay.querySelector('#recipe-name').focus(), 100);
}

function getMenuPeriod() {
    const saved = localStorage.getItem('menuPeriod');
    if (saved) {
        try {
            const p = JSON.parse(saved);
            if (p.start && p.end) return p;
        } catch {}
    }
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: formatDateISO(monday), end: formatDateISO(sunday) };
}

function saveMenuPeriod(start, end) {
    localStorage.setItem('menuPeriod', JSON.stringify({ start, end }));
}

function formatDateISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDateDisplay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDate();
    const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${day} ${months[d.getMonth()]}`;
}

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

function getDayOfWeek(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const jsDay = d.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
}

function generateDates(startStr, endStr) {
    const dates = [];
    const current = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    while (current <= end) {
        dates.push(formatDateISO(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

async function fetchShoppingData(startStr, endStr) {
    const { data: menuItems, error: menuErr } = await supabase
        .from('menu')
        .select('recipe_id, quant')
        .gte('date', startStr)
        .lte('date', endStr)
        .eq('user_id', currentUser.id);
    if (menuErr) throw menuErr;
    if (!menuItems || menuItems.length === 0) return [];

    const recipeIds = [...new Set(menuItems.map(m => m.recipe_id))];

    const [ingsResult, productsResult] = await Promise.all([
        supabase.from('recipe_ingredients').select('recipe_id, product_id, quant').in('recipe_id', recipeIds),
        supabase.from('products').select('id, name, units ( name )')
    ]);

    if (ingsResult.error) throw ingsResult.error;
    if (productsResult.error) throw productsResult.error;

    const productMap = {};
    for (const p of (productsResult.data || [])) productMap[p.id] = p;

    const quantByRecipe = {};
    for (const m of menuItems) quantByRecipe[m.recipe_id] = (quantByRecipe[m.recipe_id] || 0) + Number(m.quant);

    const aggregated = {};
    for (const ri of (ingsResult.data || [])) {
        const mult = quantByRecipe[ri.recipe_id] || 1;
        aggregated[ri.product_id] = (aggregated[ri.product_id] || 0) + Number(ri.quant) * mult;
    }

    const items = [];
    for (const [pid, totalQty] of Object.entries(aggregated)) {
        const p = productMap[pid];
        if (!p) continue;
        let unit = p.units?.name || '';
        let qty = totalQty;
        const lower = unit.toLowerCase().trim();
        const conv = CONVERSIONS[lower];
        if (conv && totalQty > 99) {
            qty = Math.round((totalQty / conv.factor) * 100) / 100;
            unit = conv.target;
        }
        items.push({ name: p.name, qty, unit, productId: pid });
    }
    items.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return items;
}

async function loadMenuPlanner() {
    const contentDiv = document.getElementById('content');
    const period = getMenuPeriod();

    contentDiv.innerHTML = `
        <div class="menu-container">
            <div class="products-header">
                <h2>Меню</h2>
            </div>
            <div class="menu-period-bar">
                <div class="menu-period-dates">
                    <label>С:</label>
                    <input type="date" id="menu-date-start" class="input-field menu-date-input" value="${period.start}">
                    <label>По:</label>
                    <input type="date" id="menu-date-end" class="input-field menu-date-input" value="${period.end}">
                    <wa-button id="menu-apply-period" variant="primary">Применить</wa-button>
                </div>
            </div>
            <div id="menu-calendar"></div>
        </div>
    `;

    document.getElementById('menu-apply-period').onclick = () => {
        const start = document.getElementById('menu-date-start').value;
        const end = document.getElementById('menu-date-end').value;
        if (!start || !end) {
            alert('Выберите обе даты');
            return;
        }
        if (start > end) {
            alert('Дата начала не может быть позже даты окончания');
            return;
        }
        saveMenuPeriod(start, end);
        loadMenuCalendar(start, end);
    };

    loadMenuCalendar(period.start, period.end);
}

async function loadMenuCalendar(startStr, endStr) {
    const calendarDiv = document.getElementById('menu-calendar');
    if (!calendarDiv) return;

    calendarDiv.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div class="loading-spinner" style="margin: 1rem auto;"></div>
        </div>
    `;

    const dates = generateDates(startStr, endStr);

    let menuItems = [];
    let recipes = [];

    try {
        const [menuResult, recipesResult] = await Promise.all([
            supabase
                .from('menu')
                .select(`
                    id,
                    date,
                    recipe_id,
                    quant,
                    recipes (
                        id,
                        name,
                        image_url
                    )
                `)
                .gte('date', startStr)
                .lte('date', endStr)
                .eq('user_id', currentUser.id),
            supabase
                .from('recipes')
                .select('id, name, user_id')
                .order('name')
        ]);

        if (menuResult.error) throw menuResult.error;
        if (recipesResult.error) throw recipesResult.error;

        menuItems = menuResult.data || [];
        recipes = recipesResult.data || [];
    } catch (err) {
        console.error('Ошибка загрузки меню:', err);
        calendarDiv.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--text-danger);">
                <p>Ошибка загрузки меню</p>
                <p style="font-size: 0.85rem; color: #888; margin-top: 0.5rem;">${err.message || 'Неизвестная ошибка'}</p>
                <wa-button id="menu-retry-btn" variant="primary" style="margin-top: 1rem;">Повторить</wa-button>
            </div>
        `;
        document.getElementById('menu-retry-btn').onclick = () => loadMenuCalendar(startStr, endStr);
        return;
    }

    const menuByDate = {};
    for (const item of menuItems) {
        if (!menuByDate[item.date]) menuByDate[item.date] = [];
        menuByDate[item.date].push(item);
    }

    let html = '<div class="menu-grid">';
    for (const dateStr of dates) {
        const dow = getDayOfWeek(dateStr);
        const isToday = dateStr === formatDateISO(new Date());
        const items = menuByDate[dateStr] || [];

        html += `
            <div class="menu-day ${isToday ? 'menu-day-today' : ''}">
                <div class="menu-day-header">
                    <div class="menu-day-date">
                        <span class="menu-day-weekday">${WEEKDAYS_SHORT[dow]}</span>
                        <span class="menu-day-num">${formatDateDisplay(dateStr)}</span>
                    </div>
                    <button class="menu-day-add-btn" data-date="${dateStr}" title="Добавить блюдо">+</button>
                </div>
                <div class="menu-day-items">
                    ${items.length === 0
                        ? '<div class="menu-day-empty">Нет блюд</div>'
                        : items.map(item => {
                            const r = item.recipes;
                            return `
                                <div class="menu-item" data-recipe-id="${r?.id || ''}" style="cursor: pointer;">
                                    <div class="menu-item-info">
                                        ${r?.image_url
                                            ? `<img src="${escapeHtml(r.image_url)}" class="menu-item-thumb" alt="">`
                                            : `<div class="menu-item-thumb menu-item-thumb-placeholder">🍽</div>`
                                        }
                                        <div class="menu-item-text">
                                            <div class="menu-item-name">${escapeHtml(r?.name || 'Рецепт удалён')}</div>
                                            <div class="menu-item-quant">${item.quant} порц.</div>
                                        </div>
                                    </div>
                                    <button class="menu-item-delete" data-id="${item.id}" title="Удалить">&times;</button>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
        `;
    }
    html += '</div>';
    calendarDiv.innerHTML = html;

    calendarDiv.querySelectorAll('.menu-day-add-btn').forEach(btn => {
        btn.onclick = () => showAddMenuItemForm(btn.dataset.date, recipes);
    });

    calendarDiv.querySelectorAll('.menu-item-delete').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const confirmed = await showConfirm('Удалить это блюдо из меню?');
            if (!confirmed) return;
            await deleteMenuItem(btn.dataset.id, startStr, endStr);
        };
    });

    calendarDiv.querySelectorAll('.menu-item').forEach(el => {
        el.onclick = async (e) => {
            if (e.target.closest('.menu-item-delete')) return;
            const recipeId = el.dataset.recipeId;
            if (!recipeId) return;
            try {
                showLoading('Загрузка...');
                const { data: recipe, error } = await supabase
                    .from('recipes')
                    .select(`
                        id,
                        name,
                        image_url,
                        instructions,
                        user_id,
                        recipe_ingredients (
                            id,
                            quant,
                            product_id
                        )
                    `)
                    .eq('id', recipeId)
                    .single();
                hideLoading();
                if (error) throw error;
                if (recipe) {
                    const isOwner = recipe.user_id === currentUser?.id;
                    showRecipeDetail(recipe, !isOwner);
                }
            } catch (err) {
                hideLoading();
                console.error('Ошибка загрузки рецепта:', err);
                alert('Не удалось загрузить рецепт: ' + (err.message || 'Неизвестная ошибка'));
            }
        };
    });
}

async function deleteMenuItem(itemId, startStr, endStr) {
    showLoading('Удаление...');
    try {
        const { error } = await supabase
            .from('menu')
            .delete()
            .eq('id', itemId);
        hideLoading();
        if (error) throw error;
        showSuccess('Блюдо удалено');
        loadMenuCalendar(startStr, endStr);
    } catch (err) {
        hideLoading();
        console.error('Ошибка удаления:', err);
        alert('Не удалось удалить: ' + (err.message || 'Неизвестная ошибка'));
    }
}

function showAddMenuItemForm(dateStr, recipes) {
    const { overlay } = showModal({
        title: `Добавить блюдо — ${WEEKDAYS_FULL[getDayOfWeek(dateStr)]}, ${formatDateDisplay(dateStr)}`,
        body: `
            <div class="form-group">
                <label>Рецепт</label>
                <div id="menu-recipe-select-container"></div>
                <div style="margin-top: 0.5rem;">
                    <button type="button" id="menu-filter-btn" style="background: none; border: 1px solid #ccc; border-radius: 8px; padding: 0.3rem 0.7rem; font-size: 0.8rem; color: #666; cursor: pointer;">Скрыть общие рецепты</button>
                </div>
            </div>
            <div class="form-group">
                <label for="menu-quant">Количество порций</label>
                <input type="number" id="menu-quant" class="input-field" min="1" step="1" value="1" placeholder="1">
            </div>
        `,
        footer: `
            <div id="menu-modal-error" style="color: var(--text-danger); font-size: 0.85rem; margin-bottom: 0.5rem; display: none; width: 100%;"></div>
            <wa-button id="cancel-menu-item-btn" variant="text">Отмена</wa-button>
            <wa-button id="save-menu-item-btn" variant="primary">Сохранить</wa-button>
        `
    });

    let hideShared = false;
    let allRecipes = recipes;

    function getFilteredRecipes() {
        if (hideShared) return allRecipes.filter(r => r.user_id === currentUser?.id);
        return allRecipes;
    }

    let recipeSelect = createCustomSelect(
        overlay.querySelector('#menu-recipe-select-container'),
        getFilteredRecipes().map(r => ({ id: r.id, name: r.name })),
        'Выберите рецепт',
        () => {}
    );

    overlay.querySelector('#menu-filter-btn').onclick = () => {
        hideShared = !hideShared;
        overlay.querySelector('#menu-filter-btn').textContent = hideShared ? 'Показать все рецепты' : 'Скрыть общие рецепты';
        const container = overlay.querySelector('#menu-recipe-select-container');
        container.innerHTML = '';
        recipeSelect = createCustomSelect(
            container,
            getFilteredRecipes().map(r => ({ id: r.id, name: r.name })),
            'Выберите рецепт',
            () => {}
        );
    };

    const modalError = overlay.querySelector('#menu-modal-error');
    function showModalError(msg) { modalError.textContent = msg; modalError.style.display = 'block'; }

    overlay.querySelector('#cancel-menu-item-btn').onclick = () => overlay.remove();

    overlay.querySelector('#save-menu-item-btn').onclick = async () => {
        const recipeId = recipeSelect.getValue();
        const quant = parseInt(overlay.querySelector('#menu-quant').value, 10);

        modalError.style.display = 'none';

        if (!recipeId) { showModalError('Выберите рецепт'); return; }
        if (!quant || quant <= 0) { showModalError('Укажите количество порций'); return; }

        showLoading('Сохранение...');
        try {
            const { error } = await supabase
                .from('menu')
                .insert([{
                    date: dateStr,
                    recipe_id: recipeId,
                    quant: quant,
                    user_id: currentUser.id
                }]);
            hideLoading();
            if (error) throw error;
            overlay.remove();
            showSuccess('Блюдо добавлено');
            const period = getMenuPeriod();
            loadMenuCalendar(period.start, period.end);
        } catch (err) {
            hideLoading();
            console.error('Ошибка сохранения:', err);
            showModalError(err.message || 'Неизвестная ошибка');
        }
    };

    setTimeout(() => {
        const trigger = overlay.querySelector('.custom-select-trigger');
        if (trigger) trigger.focus();
    }, 100);
}

function getShoppingPeriod() {
    const saved = localStorage.getItem('shoppingPeriod');
    if (saved) {
        try {
            const p = JSON.parse(saved);
            if (p.start && p.end) return p;
        } catch {}
    }
    return getMenuPeriod();
}

function saveShoppingPeriod(start, end) {
    localStorage.setItem('shoppingPeriod', JSON.stringify({ start, end }));
}

function loadShoppingList() {
    const contentDiv = document.getElementById('content');
    const period = getShoppingPeriod();

    contentDiv.innerHTML = `
        <div class="shopping-container">
            <div class="products-header">
                <h2>Список покупок</h2>
            </div>
            <div class="menu-period-bar">
                <div class="menu-period-dates">
                    <label>С:</label>
                    <input type="date" id="shop-date-start" class="input-field menu-date-input" value="${period.start}">
                    <label>По:</label>
                    <input type="date" id="shop-date-end" class="input-field menu-date-input" value="${period.end}">
                    <wa-button id="shop-apply-period" variant="primary">Применить</wa-button>
                </div>
            </div>
            <div id="shop-list"></div>
        </div>
    `;

    document.getElementById('shop-apply-period').onclick = () => {
        const start = document.getElementById('shop-date-start').value;
        const end = document.getElementById('shop-date-end').value;
        if (!start || !end) { alert('Выберите обе даты'); return; }
        if (start > end) { alert('Дата начала не может быть позже даты окончания'); return; }
        saveShoppingPeriod(start, end);
        loadShopItems(start, end);
    };

    loadShopItems(period.start, period.end);
}

async function loadShopItems(startStr, endStr) {
    const listDiv = document.getElementById('shop-list');
    if (!listDiv) return;

    listDiv.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div class="loading-spinner" style="margin: 1rem auto;"></div>
        </div>
    `;

    try {
        const items = await fetchShoppingData(startStr, endStr);

        if (items.length === 0) {
            listDiv.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #888;">
                    <p>Нет блюд в меню за выбранный период.</p>
                    <p style="font-size: 0.85rem; margin-top: 0.5rem;">Добавьте рецепты в меню, чтобы сформировать список покупок.</p>
                </div>
            `;
            return;
        }

        renderShopList(listDiv, items);
    } catch (err) {
        console.error('Ошибка загрузки списка покупок:', err);
        listDiv.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--text-danger);">
                <p>Ошибка загрузки</p>
                <p style="font-size: 0.85rem; color: #888; margin-top: 0.5rem;">${err.message || 'Неизвестная ошибка'}</p>
                <wa-button id="shop-retry-btn" variant="primary" style="margin-top: 1rem;">Повторить</wa-button>
            </div>
        `;
        document.getElementById('shop-retry-btn').onclick = () => loadShopItems(startStr, endStr);
    }
}

function renderShopList(container, items) {
    const checkedKey = `shop_checked_${currentUser.id}`;
    const qtyKey = `shop_qty_${currentUser.id}`;

    const savedQty = JSON.parse(localStorage.getItem(qtyKey) || '{}');
    const savedChecked = JSON.parse(localStorage.getItem(checkedKey) || '[]');
    const checkedSet = new Set(savedChecked);

    const currentQtyMap = {};
    for (const item of items) {
        currentQtyMap[item.productId] = item.qty;
    }

    for (const item of items) {
        if (savedQty[item.productId] !== undefined && savedQty[item.productId] !== item.qty) {
            checkedSet.delete(item.productId);
        }
    }

    const newQtyMap = {};
    for (const item of items) {
        newQtyMap[item.productId] = item.qty;
    }
    localStorage.setItem(qtyKey, JSON.stringify(newQtyMap));
    localStorage.setItem(checkedKey, JSON.stringify([...checkedSet]));

    function saveChecked() {
        localStorage.setItem(checkedKey, JSON.stringify([...checkedSet]));
    }

    function render() {
        const unchecked = items.filter(i => !checkedSet.has(i.productId));
        const checked = items.filter(i => checkedSet.has(i.productId));

        let html = '';
        if (unchecked.length > 0) {
            html += '<div class="shop-section">';
            for (const item of unchecked) {
                html += `
                    <div class="shop-item" data-id="${item.productId}">
                        <label class="shop-label">
                            <input type="checkbox" class="shop-checkbox" data-id="${item.productId}">
                            <span class="shop-name">${escapeHtml(item.name)}</span>
                        </label>
                        <span class="shop-qty">${item.qty} ${escapeHtml(item.unit)}</span>
                    </div>
                `;
            }
            html += '</div>';
        }

        if (checked.length > 0) {
            html += '<div class="shop-divider"></div>';
            html += '<div class="shop-section shop-section-done">';
            for (const item of checked) {
                html += `
                    <div class="shop-item shop-item-done" data-id="${item.productId}">
                        <label class="shop-label">
                            <input type="checkbox" class="shop-checkbox" data-id="${item.productId}" checked>
                            <span class="shop-name">${escapeHtml(item.name)}</span>
                        </label>
                        <span class="shop-qty">${item.qty} ${escapeHtml(item.unit)}</span>
                    </div>
                `;
            }
            html += '</div>';
        }

        if (items.length === 0) {
            html = `
                <div style="text-align: center; padding: 3rem; color: #888;">
                    <p>Список покупок пуст.</p>
                </div>
            `;
        }

        container.innerHTML = `<div class="shop-list-card">${html}</div>`;

        container.querySelectorAll('.shop-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.dataset.id;
                if (cb.checked) {
                    checkedSet.add(id);
                } else {
                    checkedSet.delete(id);
                }
                saveChecked();
                render();
            });
        });
    }

    render();
}
