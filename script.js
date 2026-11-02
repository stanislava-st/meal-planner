
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

// На телефоне не фокусируем поля автоматически: клавиатура сразу
// заслоняет содержимое карточки/формы. Пользователь нажмёт на поле сам.
function isMobileScreen() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function focusFieldLater(selector, root) {
    if (isMobileScreen()) return;
    setTimeout(() => root.querySelector(selector)?.focus(), 100);
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
    const listToken = new URLSearchParams(location.search).get('list');
    if (listToken) {
        openSharedList(listToken);
    } else {
        checkAuth();
    }
});

// Проверка авторизации
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user || null;
    showMainApp();
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

// Показать форму входа (модальное окно)
function showLoginModal(message = '') {
    const { overlay } = showModal({
        title: 'Авторизация',
        body: `
            <div id="error-message" class="error-message" style="display: none;"></div>
            ${message ? `<p class="hint-text">${escapeHtml(message)}</p>` : ''}
            <p class="hint-text">
                Если вы на сайте в первый раз, введите данные для авторизации и нажмите кнопку "Зарегистрироваться"
            </p>
            <input type="email" id="email" placeholder="Email" class="input-field">
            <input type="password" id="password" placeholder="Пароль" class="input-field">
        `,
        footer: `
            <wa-button id="register-btn" variant="text">Зарегистрироваться</wa-button>
            <wa-button id="login-btn" variant="primary">Войти</wa-button>
        `
    });

    overlay.querySelector('#login-btn').onclick = () => handleLogin(overlay);
    overlay.querySelector('#register-btn').onclick = () => handleRegister();
    focusFieldLater('#email', overlay);
}

// Выполнить действие после авторизации (или показать форму входа)
function requireAuth(action, message = 'Чтобы выполнить это действие, войдите в аккаунт.') {
    if (currentUser) {
        action();
        return;
    }
    pendingAuthAction = action;
    showLoginModal(message);
}

let pendingAuthAction = null;

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

async function handleLogin(overlay) {
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

        if (overlay) overlay.remove();

        showMainApp();

        if (pendingAuthAction) {
            const action = pendingAuthAction;
            pendingAuthAction = null;
            action();
        }

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
    if (savedPage && ['home', 'shopping', 'menu', 'recipes', 'products', 'lists'].includes(savedPage)) {
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
        products: 'nav-products',
        lists: 'nav-lists'
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
    if (typeof stopListRealtime === 'function') stopListRealtime();
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
        case 'lists':
            loadLists();
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
                ${currentUser ? `
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
                ` : `
                <wa-button id="login-nav-btn" variant="primary">Войти</wa-button>
                `}
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
                <wa-button id="nav-lists" variant="text">Мои списки</wa-button>
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
    document.getElementById('nav-lists').onclick = () => loadPage('lists');

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
    
    // Профиль / вход
    const loginNavBtn = document.getElementById('login-nav-btn');
    if (loginNavBtn) {
        loginNavBtn.onclick = () => showLoginModal();
        return;
    }

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

    const userName = currentUser?.email?.split('@')[0] || 'Гость';

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
                    <wa-button id="home-make-list-btn">Создать список для отправки</wa-button>
                    <wa-button id="home-shop-link" variant="primary">Перейти к списку</wa-button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('home-shop-link').onclick = () => loadPage('shopping');
    document.getElementById('home-make-list-btn').onclick = () => {
        const period = getShoppingPeriod();
        createListFromMenu(period.start, period.end);
    };

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
        let menuItems = [];
        if (currentUser) {
            const { data, error } = await supabase
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
            menuItems = data || [];
        }

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
                requireAuth(async () => {
                    try {
                        const { data: recipes } = await supabase
                            .from('recipes')
                            .select('id, name, user_id')
                            .order('name');
                        showHomeAddMenuItem(dateStr, recipes || [], weekDates);
                    } catch (err) {
                        console.error(err);
                    }
                }, 'Чтобы добавлять блюда в меню, войдите в аккаунт.');
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
                container.innerHTML = currentUser
                    ? `<div class="home-empty">Добавьте блюда в меню, чтобы сформировать список покупок.</div>`
                    : `<div class="home-empty">Войдите в аккаунт, чтобы планировать меню и формировать список покупок.</div>`;
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
    const seq = ++contentSeq;
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
        if (seq !== contentSeq) return;
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
    
    if (seq !== contentSeq) return;

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
        addBtn.onclick = () => requireAuth(
            () => showAddProductForm(),
            'Чтобы добавлять свои продукты, войдите в аккаунт.'
        );
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
    
    focusFieldLater('#product-name', overlay);
    
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
    
    document.getElementById('add-unit-btn').onclick = () => requireAuth(
        () => showAddUnitForm(),
        'Чтобы добавлять единицы измерения, войдите в аккаунт.'
    );
    
    document.querySelectorAll('.delete-unit-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            requireAuth(
                () => deleteUnit(btn.getAttribute('data-id')),
                'Чтобы удалять единицы измерения, войдите в аккаунт.'
            );
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
                <input type="text" id="unit-name" class="input-field" placeholder="Например: кг, г, л, шт">
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
    
    focusFieldLater('#unit-name', overlay);
}

async function loadRecipes() {
    const seq = ++contentSeq;
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
        if (seq !== contentSeq) return;
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

    if (seq !== contentSeq) return;

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

    document.getElementById('add-recipe-btn').onclick = () => requireAuth(
        () => showAddRecipeForm(),
        'Чтобы создавать свои рецепты, войдите в аккаунт.'
    );

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

    const ingredientLines = existingIngredients.map(ing => {
        const product = products.find(p => p.id === ing.product_id);
        return `${escapeHtml(product?.name || '?')} — ${ing.quant} ${escapeHtml(product?.units?.name || '')}`;
    }).join('<br>');
    const editableCls = readOnly ? '' : 'detail-field-editable';

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
            <div class="detail-field ${editableCls}" data-field="name">
                <div class="detail-label">Название рецепта</div>
                <div class="detail-view" id="dv-name">${escapeHtml(recipe.name)}</div>
                ${readOnly ? '' : `<input type="text" id="recipe-detail-name" class="input-field detail-edit" value="${escapeHtml(recipe.name)}">`}
            </div>
            <div class="detail-field ${editableCls}" data-field="image">
                <div class="detail-label">Ссылка на фото</div>
                <div class="detail-view ${recipe.image_url ? '' : 'is-empty'}" id="dv-image">${recipe.image_url ? escapeHtml(recipe.image_url) : 'Не задана'}</div>
                ${readOnly ? '' : `<input type="text" id="recipe-detail-image-url" class="input-field detail-edit" value="${escapeHtml(recipe.image_url || '')}" placeholder="https://...">`}
            </div>
            <div class="detail-field ${editableCls}" data-field="ingredients">
                <div class="detail-label">Ингредиенты</div>
                <div class="detail-view ${ingredientLines ? '' : 'is-empty'}" id="dv-ingredients">${ingredientLines || 'Нет ингредиентов'}</div>
                ${readOnly ? '' : `
                    <div class="detail-edit">
                        <div id="recipe-detail-ingredients"></div>
                        <button type="button" id="add-detail-ingredient-btn" class="add-ingredient-btn">+ Добавить ингредиент</button>
                    </div>
                `}
            </div>
            <div class="detail-field ${editableCls}" data-field="instructions">
                <div class="detail-label">Комментарий</div>
                <div class="detail-view ${recipe.instructions ? '' : 'is-empty'}" id="dv-instructions">${recipe.instructions ? escapeHtml(recipe.instructions) : 'Нет комментария'}</div>
                ${readOnly ? '' : `<textarea id="recipe-detail-instructions" class="input-field detail-edit" rows="4" placeholder="Описание приготовления, советы...">${escapeHtml(recipe.instructions || '')}</textarea>`}
            </div>
            <div class="detail-hint">${readOnly ? 'Общий рецепт — просмотр без редактирования' : 'Нажмите на поле, чтобы изменить его'}</div>
        `,
        footer: readOnly ? `
            <wa-button id="cancel-detail-btn" variant="text">Закрыть</wa-button>
        ` : `
            <div id="recipe-detail-error" style="color: var(--text-danger); font-size: 0.85rem; margin-bottom: 0.5rem; display: none; width: 100%;"></div>
            <wa-button id="cancel-detail-btn" variant="text">Закрыть</wa-button>
            <wa-button id="save-detail-btn" variant="primary" style="display: none;">Сохранить изменения</wa-button>
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

        const cancelBtn = overlay.querySelector('#cancel-detail-btn');
        const saveBtn = overlay.querySelector('#save-detail-btn');

        function updateDetailFooter() {
            const editing = !!overlay.querySelector('.detail-field.editing');
            saveBtn.style.display = editing ? '' : 'none';
            cancelBtn.textContent = editing ? 'Отменить изменения' : 'Закрыть';
        }

        overlay.querySelectorAll('.detail-field-editable').forEach(field => {
            const view = field.querySelector('.detail-view');
            if (!view) return;
            view.onclick = () => {
                if (field.classList.contains('editing')) return;
                field.classList.add('editing');
                updateDetailFooter();
                if (field.dataset.field === 'ingredients') return;
                const editor = field.querySelector('.detail-edit');
                const focusTarget = editor && editor.tagName === 'DIV' ? editor.querySelector('input') : editor;
                if (focusTarget) focusTarget.focus();
            };
        });

        updateDetailFooter();
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
                <input type="text" id="recipe-name" class="input-field" placeholder="Например: Борщ">
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

    focusFieldLater('#recipe-name', overlay);
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
    if (!currentUser) return [];
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
            currentUser
                ? supabase
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
                    .eq('user_id', currentUser.id)
                : Promise.resolve({ data: [], error: null }),
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
        btn.onclick = () => requireAuth(
            () => showAddMenuItemForm(btn.dataset.date, recipes),
            'Чтобы добавлять блюда в меню, войдите в аккаунт.'
        );
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
                <wa-button id="shop-make-list-btn" variant="primary">Создать список для отправки</wa-button>
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

    document.getElementById('shop-make-list-btn').onclick = () => {
        const start = document.getElementById('shop-date-start').value;
        const end = document.getElementById('shop-date-end').value;
        if (!start || !end) { alert('Укажите даты начала и окончания периода'); return; }
        if (start > end) { alert('Дата начала должна быть раньше даты окончания'); return; }
        createListFromMenu(start, end);
    };

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
            listDiv.innerHTML = currentUser ? `
                <div style="text-align: center; padding: 3rem; color: #888;">
                    <p>Нет блюд в меню за выбранный период.</p>
                    <p style="font-size: 0.85rem; margin-top: 0.5rem;">Добавьте рецепты в меню, чтобы сформировать список покупок.</p>
                </div>
            ` : `
                <div style="text-align: center; padding: 3rem; color: #888;">
                    <p>Войдите в аккаунт, чтобы планировать меню и формировать список покупок.</p>
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
    const userKey = currentUser?.id || 'guest';
    const checkedKey = `shop_checked_${userKey}`;
    const qtyKey = `shop_qty_${userKey}`;

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
                            <span class="shop-name"><span class="shop-name-text">${escapeHtml(item.name)}</span></span>
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
                            <span class="shop-name"><span class="shop-name-text">${escapeHtml(item.name)}</span></span>
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

// =============================================================
// Совместные списки (рецепты -> продукты)
// =============================================================

let currentListId = null;
let currentListChannel = null;
let listRefreshTimer = null;
let contentSeq = 0;
let currentListCanEdit = true;

function generateToken() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function getShareUrl(token) {
    const base = location.href.split('?')[0].split('#')[0];
    return `${base}?list=${token}`;
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch {}
        ta.remove();
        return ok;
    }
}

function stopListRealtime() {
    if (listRefreshTimer) { clearTimeout(listRefreshTimer); listRefreshTimer = null; }
    if (currentListChannel) {
        supabase.removeChannel(currentListChannel);
        currentListChannel = null;
    }
    currentListId = null;
}

function startListRealtime(listId) {
    stopListRealtime();
    currentListId = listId;
    const onRefresh = () => {
        clearTimeout(listRefreshTimer);
        listRefreshTimer = setTimeout(() => refreshListPanels(listId), 300);
    };
    currentListChannel = supabase
        .channel(`list-${listId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items', filter: `list_id=eq.${listId}` }, onRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'list_recipes', filter: `list_id=eq.${listId}` }, onRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists', filter: `id=eq.${listId}` }, onRefresh)
        .subscribe();
}

// ---------- Страница «Мои списки» ----------

let listsShowArchived = false;

const ICON_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
const ICON_PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
const ICON_ARCHIVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>';
const ICON_RESTORE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><rect x="8" y="3" width="8" height="4" rx="1"/></svg>';

async function loadLists() {
    const seq = ++contentSeq;
    stopListRealtime();
    currentPage = 'lists';
    updateActiveNav();

    const contentDiv = document.getElementById('content');

    if (!currentUser) {
        contentDiv.innerHTML = `
            <div class="lists-container">
                <div class="products-header"><h2>Мои списки</h2></div>
                <div class="home-empty">
                    Войдите в аккаунт, чтобы создавать списки, делиться ими и вести общий чек-лист в реальном времени.
                </div>
            </div>
        `;
        return;
    }

    contentDiv.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
            <div class="loading-spinner" style="margin: 2rem auto;"></div>
            <p>Загрузка списков...</p>
        </div>
    `;

    let lists = [];
    try {
        const selectCols = 'id, name, owner_id, share_token, is_archived, created_at, list_recipes(count), list_items(count)';
        const [ownedRes, memberRes] = await Promise.all([
            supabase.from('shopping_lists').select(selectCols).eq('owner_id', currentUser.id).order('created_at', { ascending: false }),
            supabase.from('list_members').select(`shopping_lists ( ${selectCols} )`).eq('user_id', currentUser.id)
        ]);
        if (ownedRes.error) throw ownedRes.error;
        if (memberRes.error) throw memberRes.error;

        const byId = new Map();
        for (const l of (ownedRes.data || [])) byId.set(l.id, { ...l, role: 'owner' });
        for (const row of (memberRes.data || [])) {
            const l = row.shopping_lists;
            if (l && !byId.has(l.id)) byId.set(l.id, { ...l, role: 'member' });
        }
        lists = [...byId.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (err) {
        console.error('Ошибка загрузки списков:', err);
        contentDiv.innerHTML = `
            <div class="lists-container">
                <div class="products-header"><h2>Мои списки</h2></div>
                <div class="home-empty">Ошибка загрузки: ${escapeHtml(err.message || 'Неизвестная ошибка')}</div>
            </div>
        `;
        return;
    }

    if (seq !== contentSeq) return;

    const activeLists = lists.filter(l => !l.is_archived);
    const archivedLists = lists.filter(l => l.is_archived);
    const visible = listsShowArchived ? archivedLists : activeLists;

    contentDiv.innerHTML = `
        <div class="lists-container">
            <div class="products-header">
                <h2>Мои списки</h2>
                <wa-button id="create-list-btn" variant="primary">+ Создать список</wa-button>
            </div>
            <div class="lists-tabs">
                <button type="button" class="lists-tab ${listsShowArchived ? '' : 'lists-tab-active'}" id="lists-tab-active">Активные<span class="lists-tab-count">${activeLists.length}</span></button>
                <button type="button" class="lists-tab ${listsShowArchived ? 'lists-tab-active' : ''}" id="lists-tab-archived">Архив<span class="lists-tab-count">${archivedLists.length}</span></button>
            </div>
            ${visible.length === 0 ? (listsShowArchived ? `
                <div class="home-empty">Архив пуст. Иконка коробки на карточке убирает готовый список сюда — он не мешает, но остаётся доступным и возвращается в один клик.</div>
            ` : `
                <div class="home-empty">Пока нет списков. Создайте первый — добавьте рецепты и поделитесь ссылкой!</div>
            `) : `
                <div class="lists-grid">
                    ${visible.map(l => {
                        const rCount = l.list_recipes?.[0]?.count ?? 0;
                        const iCount = l.list_items?.[0]?.count ?? 0;
                        return `
                            <div class="list-card" data-id="${l.id}">
                                <div class="list-card-head">
                                    <div class="list-card-name">${escapeHtml(l.name)}</div>
                                    <div class="list-card-badges">
                                        ${l.share_token ? '<span class="list-badge list-badge-shared">Ссылка активна</span>' : ''}
                                        ${l.role === 'member' ? '<span class="list-badge list-badge-member">Участник</span>' : ''}
                                    </div>
                                </div>
                                <div class="list-card-meta">
                                    <span>${rCount} рецептов · ${iCount} продуктов</span>
                                    <span class="list-card-date">${new Date(l.created_at).toLocaleDateString('ru-RU')}</span>
                                </div>
                                <div class="list-card-actions">
                                    <wa-button class="list-open-btn" data-id="${l.id}" variant="primary">Открыть</wa-button>
                                    ${l.role === 'owner' ? `
                                        <div class="list-card-tools">
                                            <button type="button" class="icon-btn list-share-btn" data-id="${l.id}" title="${l.share_token ? 'Скопировать ссылку для отправки' : 'Создать ссылку для отправки'}" aria-label="Поделиться">${ICON_LINK}</button>
                                            <button type="button" class="icon-btn list-rename-btn" data-id="${l.id}" title="Переименовать" aria-label="Переименовать">${ICON_PENCIL}</button>
                                            <button type="button" class="icon-btn list-archive-btn" data-id="${l.id}" title="${l.is_archived ? 'Вернуть список из архива' : 'Убрать в архив: скроет из активных, можно вернуть'}" aria-label="В архив">${l.is_archived ? ICON_RESTORE : ICON_ARCHIVE}</button>
                                            <button type="button" class="icon-btn icon-btn-danger list-delete-btn" data-id="${l.id}" title="Удалить список навсегда" aria-label="Удалить">${ICON_TRASH}</button>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;

    document.getElementById('lists-tab-active').onclick = () => { listsShowArchived = false; loadLists(); };
    document.getElementById('lists-tab-archived').onclick = () => { listsShowArchived = true; loadLists(); };
    document.getElementById('create-list-btn').onclick = () => showCreateListForm();

    contentDiv.querySelectorAll('.list-open-btn').forEach(btn => {
        btn.onclick = () => {
            const l = lists.find(x => x.id === btn.dataset.id);
            if (l) loadListDetail(l, { canEdit: true });
        };
    });

    contentDiv.querySelectorAll('.list-share-btn').forEach(btn => {
        btn.onclick = () => {
            const l = lists.find(x => x.id === btn.dataset.id);
            if (l) showShareModal(l);
        };
    });

    contentDiv.querySelectorAll('.list-rename-btn').forEach(btn => {
        btn.onclick = () => {
            const l = lists.find(x => x.id === btn.dataset.id);
            if (l) showRenameListForm(l);
        };
    });

    contentDiv.querySelectorAll('.list-archive-btn').forEach(btn => {
        btn.onclick = async () => {
            const l = lists.find(x => x.id === btn.dataset.id);
            if (!l) return;
            showLoading('Сохранение...');
            const { error } = await supabase.from('shopping_lists').update({ is_archived: !l.is_archived }).eq('id', l.id);
            hideLoading();
            if (error) { alert('Не удалось изменить статус: ' + error.message); return; }
            loadLists();
        };
    });

    contentDiv.querySelectorAll('.list-delete-btn').forEach(btn => {
        btn.onclick = async () => {
            const confirmed = await showConfirm('Удалить список? Все рецепты и продукты списка будут удалены.');
            if (!confirmed) return;
            showLoading('Удаление...');
            const { error } = await supabase.from('shopping_lists').delete().eq('id', btn.dataset.id);
            hideLoading();
            if (error) { alert('Не удалось удалить: ' + error.message); return; }
            loadLists();
        };
    });
}

function showCreateListForm() {
    const { overlay } = showModal({
        title: 'Новый список',
        body: `
            <div class="form-group">
                <label for="list-name">Название списка</label>
                <input type="text" id="list-name" class="input-field" placeholder="Например: Неделя 1, День рождения">
            </div>
        `,
        footer: `
            <div id="list-form-error" style="color: var(--text-danger); font-size: 0.85rem; margin-bottom: 0.5rem; display: none; width: 100%;"></div>
            <wa-button id="modal-cancel-btn" variant="text">Отмена</wa-button>
            <wa-button id="save-list-btn" variant="primary">Создать</wa-button>
        `
    });

    focusFieldLater('#list-name', overlay);

    overlay.querySelector('#save-list-btn').onclick = async () => {
        const name = overlay.querySelector('#list-name').value.trim();
        const errEl = overlay.querySelector('#list-form-error');
        if (!name) { errEl.textContent = 'Введите название'; errEl.style.display = 'block'; return; }

        showLoading('Создание...');

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            hideLoading();
            overlay.remove();
            currentUser = null;
            pendingAuthAction = () => showCreateListForm();
            showLoginModal('Сессия истекла — войдите снова, чтобы создать список.');
            return;
        }
        currentUser = session.user;

        const { error } = await supabase
            .from('shopping_lists')
            .insert([{ name, owner_id: session.user.id }]);
        hideLoading();
        if (error) {
            errEl.textContent = error.message.includes('row-level security')
                ? 'Нет прав на создание. Обновите RLS-политики shopping_lists (см. supabase_setup.sql) и войдите заново.'
                : error.message;
            errEl.style.display = 'block';
            return;
        }
        overlay.remove();
        listsShowArchived = false;
        loadLists();
    };
}

function showRenameListForm(list) {
    const { overlay } = showModal({
        title: 'Переименовать список',
        body: `
            <div class="form-group">
                <label for="list-name">Название списка</label>
                <input type="text" id="list-name" class="input-field" value="${escapeHtml(list.name)}">
            </div>
        `,
        footer: `
            <div id="list-form-error" style="color: var(--text-danger); font-size: 0.85rem; margin-bottom: 0.5rem; display: none; width: 100%;"></div>
            <wa-button id="modal-cancel-btn" variant="text">Отмена</wa-button>
            <wa-button id="save-list-btn" variant="primary">Сохранить</wa-button>
        `
    });

    focusFieldLater('#list-name', overlay);

    overlay.querySelector('#save-list-btn').onclick = async () => {
        const name = overlay.querySelector('#list-name').value.trim();
        const errEl = overlay.querySelector('#list-form-error');
        if (!name) { errEl.textContent = 'Введите название'; errEl.style.display = 'block'; return; }

        showLoading('Сохранение...');
        const { error } = await supabase.from('shopping_lists').update({ name }).eq('id', list.id);
        hideLoading();
        if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
        overlay.remove();
        loadLists();
    };
}

// ---------- Шаринг ----------

function showShareModal(list) {
    const hasToken = !!list.share_token;
    const { overlay } = showModal({
        title: 'Поделиться списком',
        body: `
            ${hasToken ? `
                <p class="hint-text">Все, у кого есть ссылка, могут просматривать список. Для редактирования нужен вход в аккаунт.</p>
                <div class="share-link-row">
                    <input type="text" id="share-link-input" class="input-field" readonly value="${escapeHtml(getShareUrl(list.share_token))}">
                    <wa-button id="copy-share-btn" variant="primary">Скопировать</wa-button>
                </div>
            ` : `
                <p class="hint-text">Ссылка не создана. Создайте её, чтобы отправить список другому человеку.</p>
            `}
        `,
        footer: `
            ${hasToken ? `
                <wa-button id="revoke-share-btn" variant="text" style="color: var(--text-danger); margin-right: auto;">Отозвать доступ</wa-button>
                <wa-button id="regen-share-btn" variant="text">Обновить ссылку</wa-button>
            ` : `
                <wa-button id="modal-cancel-btn" variant="text">Закрыть</wa-button>
                <wa-button id="regen-share-btn" variant="primary">Создать ссылку</wa-button>
            `}
        `
    });

    const regenBtn = overlay.querySelector('#regen-share-btn');
    if (regenBtn) regenBtn.onclick = async () => {
        showLoading('Создание ссылки...');
        const token = generateToken();
        const { error } = await supabase.from('shopping_lists').update({ share_token: token }).eq('id', list.id);
        hideLoading();
        if (error) { alert('Не удалось создать ссылку: ' + error.message); return; }
        list.share_token = token;
        overlay.remove();
        showShareModal(list);
    };

    const copyBtn = overlay.querySelector('#copy-share-btn');
    if (copyBtn) copyBtn.onclick = async () => {
        const ok = await copyText(getShareUrl(list.share_token));
        copyBtn.textContent = ok ? 'Скопировано!' : 'Не удалось скопировать';
        setTimeout(() => { copyBtn.textContent = 'Скопировать'; }, 2000);
    };

    const revokeBtn = overlay.querySelector('#revoke-share-btn');
    if (revokeBtn) revokeBtn.onclick = async () => {
        const confirmed = await showConfirm('Отозвать доступ по ссылке? Все, кто откроет старую ссылку, потеряют доступ.');
        if (!confirmed) return;
        showLoading('Отзыв доступа...');
        const { error } = await supabase.from('shopping_lists').update({ share_token: null }).eq('id', list.id);
        hideLoading();
        if (error) { alert('Не удалось отозвать доступ: ' + error.message); return; }
        list.share_token = null;
        overlay.remove();
        showShareModal(list);
    };
}

// ---------- Детальный вид списка ----------

async function openSharedList(token) {
    showLoading('Загрузка списка...');
    try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user || null;
        renderNavigation();

        let list = null;
        let canEdit = false;

        if (!currentUser) {
            // Гостевой доступ по ссылке: анонимная сессия (без формы входа),
            // затем вступление в список по токену — даёт право редактировать.
            // Требует включённых Anonymous Sign-ins в настройках Supabase Auth.
            try {
                const { error: anonErr } = await supabase.auth.signInAnonymously();
                if (!anonErr) {
                    const { data: { user: anonUser } } = await supabase.auth.getUser();
                    currentUser = anonUser || null;
                    renderNavigation();
                }
            } catch (e) {
                console.error(e);
            }
        }

        if (currentUser) {
            try {
                const { data } = await supabase.rpc('join_list_by_token', { p_token: token });
                if (data && data.length > 0) {
                    list = data[0];
                    canEdit = true;
                }
            } catch (e) {
                console.error(e);
            }
        }

        if (!list) {
            try {
                const { data } = await supabase.rpc('get_shared_list', { p_token: token });
                if (data && data.length > 0) list = data[0];
            } catch (e) {
                console.error(e);
            }
        }

        hideLoading();

        if (!list) {
            document.getElementById('content').innerHTML = `
                <div class="lists-container">
                    <div class="products-header"><h2>Список</h2></div>
                    <div class="home-empty">Список не найден или ссылка недействительна.</div>
                </div>
            `;
            return;
        }

        loadListDetail(list, { canEdit, token });
    } catch (err) {
        hideLoading();
        console.error(err);
        document.getElementById('content').innerHTML = `
            <div class="lists-container">
                <div class="products-header"><h2>Список</h2></div>
                <div class="home-empty">Ошибка загрузки: ${escapeHtml(err.message || 'Неизвестная ошибка')}</div>
            </div>
        `;
    }
}

async function loadListDetail(list, opts = {}) {
    const seq = ++contentSeq;
    stopListRealtime();
    currentListId = list.id;
    currentListCanEdit = opts.canEdit ?? !!currentUser;
    currentPage = 'lists';
    updateActiveNav();

    const canEdit = currentListCanEdit;
    const isOwner = currentUser && list.owner_id === currentUser.id;
    const contentDiv = document.getElementById('content');

    contentDiv.innerHTML = `
        <div class="lists-container">
            <div class="list-detail-header">
                <a href="#" id="back-to-lists" class="list-back-link">← Мои списки</a>
                <div class="list-detail-title-row">
                    <h2>${escapeHtml(list.name)}</h2>
                    <div class="list-card-badges">
                        ${list.is_archived ? '<span class="list-badge list-badge-archived">Архив</span>' : ''}
                        ${list.share_token ? '<span class="list-badge list-badge-shared">Ссылка активна</span>' : ''}
                    </div>
                </div>
                <div class="list-detail-actions">
                    ${isOwner ? `
                        <wa-button id="detail-share-btn" variant="text">Поделиться</wa-button>
                        <wa-button id="detail-rename-btn" variant="text">Переименовать</wa-button>
                    ` : ''}
                </div>
            </div>
            ${(!currentUser || currentUser.is_anonymous) ? `
                <div class="list-guest-banner">
                    <span>${currentUser
                        ? 'Вы редактируете список по ссылке как гость. Войдите, чтобы закрепить доступ за аккаунтом.'
                        : 'Список открыт по ссылке в режиме просмотра. Войдите, чтобы редактировать его вместе с другими.'}</span>
                    <wa-button id="guest-login-btn" variant="primary" size="small">Войти</wa-button>
                </div>
            ` : ''}
            <div class="list-mobile-tabs" id="list-mobile-tabs">
                <button type="button" class="list-mobile-tab list-mobile-tab-active" data-tab="items">Продукты</button>
                <button type="button" class="list-mobile-tab" data-tab="recipes">Рецепты</button>
            </div>
            <div class="list-detail-columns mobile-show-items" id="list-detail-columns">
                <div class="list-panel list-panel-recipes">
                    <div class="list-panel-header">
                        <h3>Рецепты</h3>
                        ${canEdit ? '<wa-button id="add-list-recipe-btn" variant="primary" size="small">+ Добавить рецепт</wa-button>' : ''}
                    </div>
                    <div id="list-recipes-body"></div>
                </div>
                <div class="list-panel list-panel-items">
                    <div class="list-panel-header">
                        <h3>Продукты</h3>
                        ${canEdit ? `
                            <div class="list-panel-actions">
                                <wa-button id="add-list-item-btn" variant="primary" size="small">+ Продукт</wa-button>
                                <wa-button id="reset-checked-btn" variant="text" size="small">Сбросить отметки</wa-button>
                            </div>
                        ` : ''}
                    </div>
                    <div id="list-items-body"></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('back-to-lists').onclick = (e) => {
        e.preventDefault();
        loadLists();
    };

    document.getElementById('list-mobile-tabs').querySelectorAll('.list-mobile-tab').forEach(btn => {
        btn.onclick = () => {
            const tab = btn.dataset.tab;
            document.getElementById('list-mobile-tabs').querySelectorAll('.list-mobile-tab')
                .forEach(b => b.classList.toggle('list-mobile-tab-active', b === btn));
            const cols = document.getElementById('list-detail-columns');
            cols.classList.toggle('mobile-show-items', tab === 'items');
            cols.classList.toggle('mobile-show-recipes', tab === 'recipes');
        };
    });

    const guestBtn = document.getElementById('guest-login-btn');
    if (guestBtn) guestBtn.onclick = () => {
        if (currentUser && !currentUser.is_anonymous) {
            openSharedList(opts.token);
            return;
        }
        pendingAuthAction = () => openSharedList(opts.token);
        showLoginModal('Войдите, чтобы закрепить доступ к списку за аккаунтом.');
    };

    const shareBtn = document.getElementById('detail-share-btn');
    if (shareBtn) shareBtn.onclick = () => showShareModal(list);

    const renameBtn = document.getElementById('detail-rename-btn');
    if (renameBtn) renameBtn.onclick = () => showRenameListForm(list);

    const addRecipeBtn = document.getElementById('add-list-recipe-btn');
    if (addRecipeBtn) addRecipeBtn.onclick = () => showAddListRecipeForm(list.id);

    const addItemBtn = document.getElementById('add-list-item-btn');
    if (addItemBtn) addItemBtn.onclick = () => showAddListItemForm(list.id);

    const resetBtn = document.getElementById('reset-checked-btn');
    if (resetBtn) resetBtn.onclick = async () => {
        showLoading('Сохранение...');
        const { error } = await supabase.from('list_items').update({ is_checked: false }).eq('list_id', list.id).eq('is_checked', true);
        hideLoading();
        if (error) { alert('Не удалось сбросить: ' + error.message); return; }
        refreshListPanels(list.id);
    };

    await refreshListPanels(list.id, seq);
    if (seq !== contentSeq) return;
    startListRealtime(list.id);
}

async function refreshListPanels(listId, seq = contentSeq) {
    const [recipesRes, itemsRes] = await Promise.all([
        supabase
            .from('list_recipes')
            .select('id, recipe_id, portions, recipes ( id, name, image_url, user_id, recipe_ingredients ( product_id ) )')
            .eq('list_id', listId)
            .order('created_at'),
        supabase
            .from('list_items')
            .select('id, product_id, name, unit, qty, is_checked, source')
            .eq('list_id', listId)
            .order('is_checked')
            .order('name')
    ]);

    if (seq !== contentSeq || currentListId !== listId) return;

    const recipesBody = document.getElementById('list-recipes-body');
    const itemsBody = document.getElementById('list-items-body');
    if (!recipesBody || !itemsBody) return;

    const listRecipes = recipesRes.data || [];
    const items = itemsRes.data || [];
    const dis = currentListCanEdit ? '' : 'disabled';

    // продукт -> рецепты, из которых он берётся (для тегов у строк)
    const productRecipes = new Map();
    for (const lr of listRecipes) {
        const recipeName = lr.recipes?.name;
        if (!recipeName || !lr.recipe_id) continue;
        for (const ri of (lr.recipes?.recipe_ingredients || [])) {
            if (!ri.product_id) continue;
            const pKey = String(ri.product_id);
            if (!productRecipes.has(pKey)) productRecipes.set(pKey, new Map());
            productRecipes.get(pKey).set(String(lr.recipe_id), recipeName);
        }
    }

    recipesBody.innerHTML = listRecipes.length === 0
        ? '<div class="home-empty">Нет рецептов. Добавьте рецепты — продукты появятся автоматически.</div>'
        : listRecipes.map(lr => `
            <div class="list-recipe-row" data-id="${lr.id}">
                ${lr.recipes?.image_url
                    ? `<img class="list-recipe-thumb" src="${escapeHtml(lr.recipes.image_url)}" alt="">`
                    : '<div class="list-recipe-thumb list-recipe-thumb-placeholder">🍽</div>'
                }
                <div class="list-recipe-info">
                    <div class="list-recipe-name" data-recipe-id="${lr.recipe_id}">${escapeHtml(lr.recipes?.name || 'Рецепт удалён')}</div>
                    <div class="list-recipe-portions">
                        <label>Порций:</label>
                        <input type="number" class="list-portions-input" data-id="${lr.id}" min="1" step="1" value="${lr.portions}" ${dis}>
                    </div>
                </div>
                ${currentListCanEdit ? '<button class="list-recipe-remove" title="Удалить">&times;</button>' : ''}
            </div>
        `).join('');

    itemsBody.innerHTML = items.length === 0
        ? '<div class="home-empty">Список продуктов пуст.</div>'
        : `<div class="shop-list-card">${items.map(item => {
            const recipeNames = item.source === 'recipe'
                ? [...(productRecipes.get(String(item.product_id))?.values() || [])]
                : [];
            const tags = recipeNames.length > 0
                ? recipeNames.map(n => `<span class="list-badge list-badge-recipe">${escapeHtml(n)}</span>`).join(' ')
                : (item.source === 'recipe' ? '<span class="list-badge list-badge-recipe">из рецепта</span>' : '');
            return `
            <div class="shop-item ${item.is_checked ? 'shop-item-done' : ''}" data-id="${item.id}">
                <label class="shop-label">
                    <input type="checkbox" class="shop-checkbox list-item-check" data-id="${item.id}" ${item.is_checked ? 'checked' : ''} ${dis}>
                    <span class="shop-name"><span class="shop-name-text">${escapeHtml(item.name)}</span>${tags ? ' ' + tags : ''}</span>
                </label>
                <span class="list-item-qty-wrap">
                    <input type="number" class="list-item-qty-input" data-id="${item.id}" value="${item.qty}" step="any" min="0" ${dis}>
                    <span class="shop-qty">${escapeHtml(item.unit)}</span>
                    ${item.source === 'manual' && currentListCanEdit ? '<button class="list-item-remove" title="Удалить">&times;</button>' : ''}
                </span>
            </div>
        `;
        }).join('')}</div>`;

    wireListPanelEvents(listId);
}

function wireListPanelEvents(listId) {
    const recipesBody = document.getElementById('list-recipes-body');
    const itemsBody = document.getElementById('list-items-body');
    if (!recipesBody || !itemsBody) return;

    recipesBody.querySelectorAll('.list-portions-input').forEach(inp => {
        inp.onchange = async () => {
            const portions = parseInt(inp.value, 10);
            if (!portions || portions < 1) { inp.value = 1; return; }
            showLoading('Сохранение...');
            const { error } = await supabase.from('list_recipes').update({ portions }).eq('id', inp.dataset.id);
            if (error) { hideLoading(); alert('Не удалось сохранить: ' + error.message); return; }
            try {
                await regenerateListItems(listId);
            } catch (e) {
                console.error(e);
                alert('Не удалось пересчитать продукты: ' + (e.message || e));
            }
            hideLoading();
            refreshListPanels(listId);
        };
    });

    recipesBody.querySelectorAll('.list-recipe-remove').forEach(btn => {
        btn.onclick = async () => {
            const row = btn.closest('.list-recipe-row');
            const confirmed = await showConfirm('Удалить рецепт из списка?');
            if (!confirmed) return;
            showLoading('Удаление...');
            const { error } = await supabase.from('list_recipes').delete().eq('id', row.dataset.id);
            if (error) { hideLoading(); alert('Не удалось удалить: ' + error.message); return; }
            try {
                await regenerateListItems(listId);
            } catch (e) {
                console.error(e);
                alert('Не удалось пересчитать продукты: ' + (e.message || e));
            }
            hideLoading();
            refreshListPanels(listId);
        };
    });

    recipesBody.querySelectorAll('.list-recipe-name').forEach(el => {
        el.onclick = async () => {
            const recipeId = el.dataset.recipeId;
            if (!recipeId) return;
            try {
                showLoading('Загрузка...');
                const { data: recipe, error } = await supabase
                    .from('recipes')
                    .select('id, name, image_url, instructions, user_id, recipe_ingredients (id, quant, product_id)')
                    .eq('id', recipeId)
                    .single();
                hideLoading();
                if (error) throw error;
                if (recipe) showRecipeDetail(recipe, recipe.user_id !== currentUser?.id);
            } catch (err) {
                hideLoading();
                console.error(err);
            }
        };
    });

    itemsBody.querySelectorAll('.list-item-check').forEach(cb => {
        cb.onchange = async () => {
            const id = cb.dataset.id;
            const row = cb.closest('.shop-item');
            if (row) row.classList.toggle('shop-item-done', cb.checked);
            const { error } = await supabase.from('list_items').update({ is_checked: cb.checked }).eq('id', id);
            if (error) {
                if (row) row.classList.toggle('shop-item-done', !cb.checked);
                cb.checked = !cb.checked;
                alert('Не удалось сохранить: ' + error.message);
            }
        };
    });

    itemsBody.querySelectorAll('.list-item-qty-input').forEach(inp => {
        inp.onchange = async () => {
            const qty = parseFloat(inp.value);
            if (isNaN(qty) || qty < 0) return;
            const { error } = await supabase.from('list_items').update({ qty }).eq('id', inp.dataset.id);
            if (error) alert('Не удалось сохранить: ' + error.message);
        };
    });

    itemsBody.querySelectorAll('.list-item-remove').forEach(btn => {
        btn.onclick = async () => {
            const row = btn.closest('.shop-item');
            const confirmed = await showConfirm('Удалить продукт из списка?');
            if (!confirmed) return;
            showLoading('Удаление...');
            const { error } = await supabase.from('list_items').delete().eq('id', row.dataset.id);
            hideLoading();
            if (error) { alert('Не удалось удалить: ' + error.message); return; }
            refreshListPanels(listId);
        };
    });
}

// Пересчёт продуктов из рецептов списка (source='recipe')
async function regenerateListItems(listId) {
    const { data: listRecipes, error } = await supabase
        .from('list_recipes')
        .select('recipe_id, portions, recipes ( recipe_ingredients ( product_id, quant, products ( name, units ( name ) ) ) )')
        .eq('list_id', listId);
    if (error) throw error;

    if ((listRecipes || []).length > 0 && !(listRecipes || []).some(lr => lr.recipes)) {
        console.error('Рецепты списка недоступны — пересчёт пропущен, чтобы не потерять продукты и отметки.');
        return;
    }

    const agg = {};
    for (const lr of (listRecipes || [])) {
        const portions = lr.portions || 1;
        for (const ri of (lr.recipes?.recipe_ingredients || [])) {
            if (!ri.product_id) continue;
            const key = String(ri.product_id);
            const p = ri.products;
            if (!agg[key]) {
                agg[key] = { productId: ri.product_id, name: p?.name || 'Продукт', unit: p?.units?.name || '', qty: 0 };
            }
            agg[key].qty += Number(ri.quant) * portions;
        }
    }

    for (const v of Object.values(agg)) {
        let unit = v.unit;
        let qty = Math.round(v.qty * 100) / 100;
        const conv = CONVERSIONS[(unit || '').toLowerCase().trim()];
        if (conv && v.qty > 99) {
            qty = Math.round((v.qty / conv.factor) * 100) / 100;
            unit = conv.target;
        }
        v.qty = qty;
        v.unit = unit;
    }

    const { data: existing, error: exErr } = await supabase
        .from('list_items')
        .select('id, product_id, qty, unit, name')
        .eq('list_id', listId)
        .eq('source', 'recipe');
    if (exErr) throw exErr;

    // Ключи нормализуем к строкам: Object.entries() всегда даёт строковые ключи,
    // а product_id из PostgREST может прийти числом — иначе Map их не найдёт,
    // продукты пересоздадутся и все отметки собьются.
    const existingByProduct = new Map();
    for (const i of (existing || [])) {
        const key = String(i.product_id);
        if (!existingByProduct.has(key)) existingByProduct.set(key, []);
        existingByProduct.get(key).push(i);
    }

    for (const [key, v] of Object.entries(agg)) {
        const matches = existingByProduct.get(key) || [];
        const ex = matches.shift();
        if (ex) {
            if (Number(ex.qty) !== v.qty || ex.unit !== v.unit || ex.name !== v.name) {
                const { error: upErr } = await supabase
                    .from('list_items')
                    .update({ qty: v.qty, unit: v.unit, name: v.name })
                    .eq('id', ex.id);
                if (upErr) throw upErr;
            }
        } else {
            const { error: insErr } = await supabase.from('list_items').insert([{
                list_id: listId,
                product_id: v.productId,
                name: v.name,
                unit: v.unit,
                qty: v.qty,
                is_checked: false,
                source: 'recipe'
            }]);
            if (insErr) throw insErr;
        }
        if (matches.length > 0) {
            const { error: dupErr } = await supabase.from('list_items').delete().in('id', matches.map(m => m.id));
            if (dupErr) throw dupErr;
        }
        existingByProduct.delete(key);
    }

    const staleIds = [];
    for (const arr of existingByProduct.values()) staleIds.push(...arr.map(i => i.id));
    if (staleIds.length > 0) {
        const { error: delErr } = await supabase.from('list_items').delete().in('id', staleIds);
        if (delErr) throw delErr;
    }
}

// ---------- Список покупок из меню (для отправки по ссылке) ----------

async function createListFromMenu(startStr, endStr) {
    if (!currentUser) {
        pendingAuthAction = () => createListFromMenu(startStr, endStr);
        showLoginModal('Войдите, чтобы создать список из меню.');
        return;
    }

    showLoading('Создание списка...');

    try {
        const { data: menuItems, error: menuErr } = await supabase
            .from('menu')
            .select('recipe_id, quant')
            .gte('date', startStr)
            .lte('date', endStr)
            .eq('user_id', currentUser.id);
        if (menuErr) throw menuErr;

        const portionsByRecipe = new Map();
        for (const m of (menuItems || [])) {
            if (!m.recipe_id) continue;
            const key = String(m.recipe_id);
            const cur = portionsByRecipe.get(key) || { recipeId: m.recipe_id, portions: 0 };
            cur.portions += Number(m.quant || 1);
            portionsByRecipe.set(key, cur);
        }

        if (portionsByRecipe.size === 0) {
            hideLoading();
            alert('В меню за выбранный период нет рецептов. Сначала добавьте рецепты в меню.');
            return;
        }

        const name = `Меню на неделю: ${formatDateDisplay(startStr)} — ${formatDateDisplay(endStr)}`;

        const { data: list, error: listErr } = await supabase
            .from('shopping_lists')
            .insert([{ name, owner_id: currentUser.id }])
            .select()
            .single();
        if (listErr) throw listErr;

        const rows = [...portionsByRecipe.values()].map(v => ({
            list_id: list.id,
            recipe_id: v.recipeId,
            portions: Math.max(1, Math.round(v.portions))
        }));
        const { error: recErr } = await supabase.from('list_recipes').insert(rows);
        if (recErr) throw recErr;

        try {
            await regenerateListItems(list.id);
        } catch (e) {
            console.error('Не удалось пересчитать продукты списка:', e);
        }

        hideLoading();
        await loadListDetail(list, { canEdit: true, token: null });
        showShareModal(list);
    } catch (err) {
        hideLoading();
        console.error(err);
        alert('Не удалось создать список: ' + (err.message || err));
    }
}

// ---------- Формы добавления в список ----------

function showAddListRecipeForm(listId) {
    const { overlay } = showModal({
        title: 'Добавить рецепт в список',
        body: `
            <div class="form-group">
                <label>Рецепт</label>
                <div id="list-recipe-select-container"></div>
            </div>
            <div class="form-group">
                <label for="list-recipe-portions">Количество порций</label>
                <input type="number" id="list-recipe-portions" class="input-field" min="1" step="1" value="1">
            </div>
        `,
        footer: `
            <div id="list-recipe-error" style="color: var(--text-danger); font-size: 0.85rem; margin-bottom: 0.5rem; display: none; width: 100%;"></div>
            <wa-button id="modal-cancel-btn" variant="text">Отмена</wa-button>
            <wa-button id="save-list-recipe-btn" variant="primary">Добавить</wa-button>
        `
    });

    const errEl = overlay.querySelector('#list-recipe-error');
    let recipeSelect = null;

    (async () => {
        const { data: recipes, error } = await supabase.from('recipes').select('id, name').order('name');
        if (error) {
            errEl.textContent = 'Ошибка загрузки рецептов: ' + error.message;
            errEl.style.display = 'block';
            return;
        }
        recipeSelect = createCustomSelect(
            overlay.querySelector('#list-recipe-select-container'),
            (recipes || []).map(r => ({ id: r.id, name: r.name })),
            'Выберите рецепт',
            () => {}
        );
    })();

    overlay.querySelector('#save-list-recipe-btn').onclick = async () => {
        errEl.style.display = 'none';
        const recipeId = recipeSelect && recipeSelect.getValue();
        const portions = parseInt(overlay.querySelector('#list-recipe-portions').value, 10);

        if (!recipeId) { errEl.textContent = 'Выберите рецепт'; errEl.style.display = 'block'; return; }
        if (!portions || portions < 1) { errEl.textContent = 'Укажите количество порций'; errEl.style.display = 'block'; return; }

        showLoading('Добавление...');
        const { error } = await supabase.from('list_recipes').insert([{ list_id: listId, recipe_id: recipeId, portions }]);
        if (error) { hideLoading(); errEl.textContent = error.message; errEl.style.display = 'block'; return; }
        try {
            await regenerateListItems(listId);
        } catch (e) {
            hideLoading();
            console.error(e);
            errEl.textContent = 'Рецепт добавлен, но продукты пересчитать не удалось: ' + (e.message || '');
            errEl.style.display = 'block';
            return;
        }
        hideLoading();
        overlay.remove();
        refreshListPanels(listId);
    };
}

function showAddListItemForm(listId) {
    const { overlay } = showModal({
        title: 'Добавить продукт',
        body: `
            <div class="form-group">
                <label for="item-name">Название продукта</label>
                <input type="text" id="item-name" class="input-field" placeholder="Например: Хлеб">
            </div>
            <div class="form-group">
                <label for="item-qty">Количество</label>
                <input type="number" id="item-qty" class="input-field" min="0" step="any" value="1">
            </div>
            <div class="form-group">
                <label for="item-unit">Единица измерения</label>
                <input type="text" id="item-unit" class="input-field" placeholder="кг, шт, л...">
            </div>
        `,
        footer: `
            <div id="item-form-error" style="color: var(--text-danger); font-size: 0.85rem; margin-bottom: 0.5rem; display: none; width: 100%;"></div>
            <wa-button id="modal-cancel-btn" variant="text">Отмена</wa-button>
            <wa-button id="save-item-btn" variant="primary">Добавить</wa-button>
        `
    });

    focusFieldLater('#item-name', overlay);

    overlay.querySelector('#save-item-btn').onclick = async () => {
        const name = overlay.querySelector('#item-name').value.trim();
        const qty = parseFloat(overlay.querySelector('#item-qty').value);
        const unit = overlay.querySelector('#item-unit').value.trim();
        const errEl = overlay.querySelector('#item-form-error');

        if (!name) { errEl.textContent = 'Введите название продукта'; errEl.style.display = 'block'; return; }
        if (isNaN(qty) || qty < 0) { errEl.textContent = 'Укажите количество'; errEl.style.display = 'block'; return; }

        showLoading('Добавление...');
        const { error } = await supabase.from('list_items').insert([{
            list_id: listId,
            name,
            unit,
            qty,
            is_checked: false,
            source: 'manual'
        }]);
        hideLoading();
        if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
        overlay.remove();
        refreshListPanels(listId);
    };
}
