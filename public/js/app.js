// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let currentUser = null;
let token = null;

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTotalScoreHtml(review) {
    if (!review) return '';
    const total = (review.rhymes || 0) + (review.structure || 0) + (review.style || 0) + (review.charisma || 0) + (review.vibe || 0);
    const maxScore = 50;
    let color = '#ff4444';
    if (total >= 40) color = '#4CAF50';
    else if (total >= 30) color = '#FFC107';
    else if (total >= 20) color = '#FF9800';
    return `<span class="total-score" style="color:${color};font-weight:bold;font-size:16px;">${total}/${maxScore}</span>`;
}

function getCriteriaBarsHtml(review) {
    if (!review) return '';
    const criteria = [
        { key: 'rhymes', label: 'Рифмы' },
        { key: 'structure', label: 'Структура / Ритмика' },
        { key: 'style', label: 'Реализация стиля' },
        { key: 'charisma', label: 'Харизма' },
        { key: 'vibe', label: 'Вайб' }
    ];
    
    return `<div class="criteria-bars">${criteria.map(c => {
        const value = review[c.key] || 0;
        const percentage = (value / 10) * 100;
        return `<div class="criterion-bar">
            <div class="criterion-label">${c.label}</div>
            <div class="criterion-track">
                <div class="criterion-fill" style="width:${percentage}%"></div>
            </div>
            <div class="criterion-value">${value}/10</div>
        </div>`;
    }).join('')}</div>`;
}

function getCriteriaMiniHtml(review) {
    if (!review) return '';
    const total = (review.rhymes || 0) + (review.structure || 0) + (review.style || 0) + (review.charisma || 0) + (review.vibe || 0);
    let color = '#ff4444';
    if (total >= 40) color = '#4CAF50';
    else if (total >= 30) color = '#FFC107';
    else if (total >= 20) color = '#FF9800';
    return `<span class="mini-score" style="color:${color};font-weight:bold;">${total}/50</span>`;
}

// ========== API ЗАПРОСЫ ==========
const API_URL = 'http://localhost:3000/api';

async function apiRequest(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка запроса');
    }
    
    return response.json();
}

// ========== АВТОРИЗАЦИЯ ==========
function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const nav = document.querySelector('.nav');
    
    if (currentUser) {
        if (authButtons) authButtons.style.display = 'none';
        if (userMenu) userMenu.style.display = 'flex';
        const profileName = document.getElementById('profileName');
        const profileAvatar = document.getElementById('profileAvatar');
        if (profileName) profileName.textContent = currentUser.username;
        if (profileAvatar) {
            if (currentUser.avatarPhoto) {
                profileAvatar.innerHTML = `<img src="${currentUser.avatarPhoto}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
            } else {
                profileAvatar.textContent = currentUser.avatar || '👤';
            }
        }
        
        // Добавляем ссылку на админ-панель только для админа
        if (nav && currentUser.role === 'admin') {
            // Проверяем, есть ли уже такая ссылка
            let adminLink = document.getElementById('adminLink');
            if (!adminLink) {
                adminLink = document.createElement('a');
                adminLink.href = 'admin.html';
                adminLink.className = 'nav-btn';
                adminLink.id = 'adminLink';
                adminLink.innerHTML = '👑 Админ-панель';
                nav.appendChild(adminLink);
            }
        } else {
            // Если не админ — удаляем ссылку
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.remove();
        }
    } else {
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';
        // Удаляем ссылку если нет пользователя
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.remove();
    }
}

function setupAuthModals() {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    
    if (loginBtn) loginBtn.onclick = () => openModal('login');
    if (signupBtn) signupBtn.onclick = () => openModal('signup');
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.onclick = () => {
            document.getElementById('loginModal').style.display = 'none';
            document.getElementById('signupModal').style.display = 'none';
        };
    });
    
    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    };
    
    const switchToSignup = document.getElementById('switchToSignup');
    const switchToLogin = document.getElementById('switchToLogin');
    if (switchToSignup) switchToSignup.onclick = (e) => {
        e.preventDefault();
        document.getElementById('loginModal').style.display = 'none';
        openModal('signup');
    };
    if (switchToLogin) switchToLogin.onclick = (e) => {
        e.preventDefault();
        document.getElementById('signupModal').style.display = 'none';
        openModal('login');
    };
    
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('signupForm')?.addEventListener('submit', handleSignup);
}

function openModal(type) {
    if (type === 'login') {
        const modal = document.getElementById('loginModal');
        if (modal) modal.style.display = 'flex';
    } else {
        const modal = document.getElementById('signupModal');
        if (modal) modal.style.display = 'flex';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const data = await apiRequest('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('fostberg_token', token);
        localStorage.setItem('fostberg_user', JSON.stringify(currentUser));
        
        document.getElementById('loginModal').style.display = 'none';
        updateAuthUI();
        location.reload();
    } catch (error) {
        alert(error.message);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    try {
        const data = await apiRequest('/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('fostberg_token', token);
        localStorage.setItem('fostberg_user', JSON.stringify(currentUser));
        
        document.getElementById('signupModal').style.display = 'none';
        updateAuthUI();
        location.reload();
    } catch (error) {
        alert(error.message);
    }
}

function logout() {
    localStorage.removeItem('fostberg_token');
    localStorage.removeItem('fostberg_user');
    token = null;
    currentUser = null;
    updateAuthUI();
    window.location.href = 'index.html';
}

// ========== ВЫПАДАЮЩИЙ ПОИСК ==========
async function initSearchDropdown() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    let dropdown = document.getElementById('searchDropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'searchDropdown';
        dropdown.className = 'search-dropdown';
        searchInput.parentNode.appendChild(dropdown);
    }
    
    searchInput.addEventListener('input', async function() {
        const query = this.value.trim();
        
        if (query === '') {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
            return;
        }
        
        if (query.length < 2) return;
        
        try {
            const tracks = await apiRequest(`/tracks/search?q=${encodeURIComponent(query)}`);
            
            if (!tracks || tracks.length === 0) {
                dropdown.innerHTML = '<div class="search-dropdown-item empty">Ничего не найдено</div>';
                dropdown.style.display = 'block';
                return;
            }
            
            dropdown.innerHTML = tracks.map(track => `
                <div class="search-dropdown-item" data-track-id="${track.id}" data-track-title="${escapeHtml(track.title)}" data-track-artist="${escapeHtml(track.artist)}" data-track-image="${track.artwork_url || ''}">
                    <div class="search-dropdown-cover">
                        ${track.artwork_url ? `<img src="${track.artwork_url}" style="width:100%;height:100%;border-radius:12px;object-fit:cover">` : '🎵'}
                    </div>
                    <div class="search-dropdown-info">
                        <div class="search-dropdown-title">${escapeHtml(track.title)}</div>
                        <div class="search-dropdown-artist">${escapeHtml(track.artist)}</div>
                    </div>
                    <button class="search-dropdown-btn">📖 Открыть</button>
                </div>
            `).join('');
            
            dropdown.style.display = 'block';
            
            document.querySelectorAll('.search-dropdown-item').forEach(item => {
                const btn = item.querySelector('.search-dropdown-btn');
                const trackId = item.dataset.trackId;
                
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    window.location.href = `track.html?id=${trackId}`;
                };
                
                item.onclick = (e) => {
                    if (e.target !== btn) {
                        window.location.href = `track.html?id=${trackId}`;
                    }
                };
            });
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// ========== ГЛАВНАЯ СТРАНИЦА ==========
// ========== ГЛАВНАЯ СТРАНИЦА (ПОПУЛЯРНЫЕ ТРЕКИ ПО РЕЦЕНЗИЯМ) ==========
// ========== ГЛАВНАЯ СТРАНИЦА (ПОПУЛЯРНЫЕ ТРЕКИ В КАРТОЧКАХ) ==========
// ========== ГЛАВНАЯ СТРАНИЦА (ПОПУЛЯРНЫЕ ТРЕКИ + СЛУЧАЙНЫЙ ТРЕК) ==========
// ========== ГЛАВНАЯ СТРАНИЦА (ПОПУЛЯРНЫЕ ТРЕКИ + СЛУЧАЙНЫЙ ТРЕК ПОСЛЕ) ==========
// ========== ГЛАВНАЯ СТРАНИЦА (ПОПУЛЯРНЫЕ ТРЕКИ) ==========
async function loadTopTracksHome() {
    const content = document.getElementById('content');
    if (!content) return;
    
    try {
        const [tracks, randomTrack] = await Promise.all([
            apiRequest('/top-tracks'),
            apiRequest('/random-track')
        ]);
        
        if (!tracks || tracks.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:48px;margin-bottom:16px;">📝</div>
                    <div>Пока нет рецензий</div>
                    <div style="font-size:12px;margin-top:8px;">Используйте поиск, чтобы найти трек и написать рецензию</div>
                </div>
            `;
            return;
        }
        
        const topTracks = tracks.slice(0, 5);
        
        content.innerHTML = `
            <div class="popular-header">
                <h1>🏆 Популярные треки</h1>
                <p>Треки с наибольшим количеством рецензий</p>
            </div>
            <div class="popular-grid">
                ${topTracks.map((track, index) => {
                    const avgScore = (track.avg_rating || 0).toFixed(1);
                    
                    let rankIcon = '';
                    let rankClass = '';
                    if (index === 0) {
                        rankIcon = '🥇';
                        rankClass = 'gold';
                    } else if (index === 1) {
                        rankIcon = '🥈';
                        rankClass = 'silver';
                    } else if (index === 2) {
                        rankIcon = '🥉';
                        rankClass = 'bronze';
                    } else {
                        rankIcon = `#${index + 1}`;
                        rankClass = '';
                    }
                    
                    let scoreClass = 'low';
                    if (avgScore >= 40) scoreClass = 'high';
                    else if (avgScore >= 30) scoreClass = 'medium';
                    
                    return `
                        <div class="popular-card" data-track-id="${track.track_id}" style="cursor:pointer;">
                            <div class="popular-rank ${rankClass}">${rankIcon}</div>
                            <div class="popular-cover">
                                ${track.artwork_url ? `<img src="${track.artwork_url}" alt="${escapeHtml(track.track_title)}">` : '<div class="popular-cover-placeholder">🎵</div>'}
                            </div>
                            <div class="popular-info">
                                <div class="popular-title">${escapeHtml(track.track_title)}</div>
                                <div class="popular-artist">${escapeHtml(track.track_artist)}</div>
                                <div class="popular-stats">
                                    <span class="popular-reviews">📝 ${track.reviews_count} рец.</span>
                                    <span class="popular-score ${scoreClass}">⭐ ${avgScore}/50</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="more-tracks-link" style="margin-bottom: 40px;">
                <a href="tracks.html" class="more-link">🎵 Все оценённые треки →</a>
            </div>
            ${randomTrack ? `
                <div class="random-track-section">
                    <div class="random-track-header">
                        <span class="random-icon">🎲</span>
                        <span class="random-title">СЛУЧАЙНЫЙ ТРЕК</span>
                    </div>
                    <div class="random-track-card" data-track-id="${randomTrack.id}" style="cursor:pointer;">
                        <div class="random-track-cover">
                            ${randomTrack.artwork_url ? `<img src="${randomTrack.artwork_url}" alt="${escapeHtml(randomTrack.title)}">` : '<div class="random-cover-placeholder">🎵</div>'}
                        </div>
                        <div class="random-track-info">
                            <div class="random-track-title">${escapeHtml(randomTrack.title)}</div>
                            <div class="random-track-artist">${escapeHtml(randomTrack.artist)}</div>
                            <button class="random-track-btn">🎲 Мне повезёт</button>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
        
        document.querySelectorAll('.popular-card, .random-track-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.classList.contains('random-track-btn')) return;
                const trackId = card.dataset.trackId;
                if (trackId) window.location.href = `track.html?id=${trackId}`;
            };
        });
        
        const randomBtn = document.querySelector('.random-track-btn');
        if (randomBtn) {
            randomBtn.onclick = (e) => {
                e.stopPropagation();
                const trackId = randomBtn.closest('.random-track-card')?.dataset.trackId;
                if (trackId) window.location.href = `track.html?id=${trackId}`;
            };
        }
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        content.innerHTML = '<div class="empty-state">Ошибка загрузки популярных треков</div>';
    }
}
// ========== ТОП СТРАНИЦА ==========
// ========== ТОП ПОЛЬЗОВАТЕЛЕЙ ПО КОЛИЧЕСТВУ РЕЦЕНЗИЙ ==========
async function loadTopUsers() {
    const content = document.getElementById('content');
    if (!content) return;
    
    try {
        const users = await apiRequest('/top-users');
        
        if (!users || users.length === 0) {
            content.innerHTML = '<div class="empty-state">😔 Пока нет рецензий</div>';
            return;
        }
        
        content.innerHTML = `
            <div class="top-users-header">
                <h1 class="top-users-title">🏆 Топ пользователей</h1>
                <p class="top-users-subtitle">Пользователи, написавшие больше всего рецензий</p>
            </div>
            <div class="top-users-list">
                ${users.map((user, index) => {
                    const avgScore = (user.avg_score || 0).toFixed(1);
                    let roleBadge = '';
                    let roleClass = '';
                    if (user.role === 'admin') {
                        roleBadge = '<span class="role-badge role-admin" style="margin-left: 8px;">👑 Админ</span>';
                        roleClass = 'admin-user';
                    } else if (user.role === 'moderator') {
                        roleBadge = '<span class="role-badge role-moderator" style="margin-left: 8px;">🛡️ Модер</span>';
                        roleClass = 'moderator-user';
                    }
                    
                    const avatarHtml = user.avatar_photo 
                        ? `<img src="${user.avatar_photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` 
                        : (user.avatar || '👤');
                    
                    return `
                        <div class="top-user-item ${roleClass}" data-user-id="${user.id}" style="cursor:pointer;">
                            <div class="top-user-rank">
                                ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                            </div>
                            <div class="top-user-avatar">
                                ${avatarHtml}
                            </div>
                            <div class="top-user-info">
                                <div class="top-user-name">
                                    ${escapeHtml(user.username)}
                                    ${roleBadge}
                                </div>
                                <div class="top-user-stats">
                                    <span class="stat-badge">📝 ${user.reviews_count} рецензий</span>
                                    <span class="stat-badge">❤️ ${user.total_likes || 0} лайков</span>
                                    <span class="stat-badge">⭐ ${avgScore}/50</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        document.querySelectorAll('.top-user-item').forEach(item => {
            item.onclick = () => {
                const userId = item.dataset.userId;
                if (userId) window.location.href = `user.html?id=${userId}`;
            };
        });
        
    } catch (error) {
        console.error('Ошибка:', error);
        content.innerHTML = '<div class="empty-state">Ошибка загрузки топа пользователей</div>';
    }
}

// ========== СТРАНИЦА ТРЕКА ==========
async function initTrackPage() {
    const content = document.getElementById('content');
    if (!content) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get('id');
    
    if (!trackId) {
        window.location.href = 'index.html';
        return;
    }
    
    await loadTrackPage(trackId);
}

async function loadTrackPage(trackId) {
    const content = document.getElementById('content');
    
    try {
        const track = await apiRequest(`/tracks/${trackId}`);
        const reviews = await apiRequest(`/tracks/${trackId}/reviews`);
        
        const avgScore = reviews.length > 0 
            ? (reviews.reduce((sum, r) => sum + (r.rhymes + r.structure + r.style + r.charisma + r.vibe), 0) / reviews.length).toFixed(1)
            : 0;
        
        content.innerHTML = `
            <div class="track-page">
                <div class="track-header">
                    <div class="track-cover-large">
                        ${track.artwork_url ? `<img src="${track.artwork_url}" style="width:100%;height:100%;border-radius:20px;object-fit:cover">` : '🎵'}
                    </div>
                    <div class="track-info-large">
                        <h1>${escapeHtml(track.title)}</h1>
                        <div class="track-artist-large">${escapeHtml(track.artist)}</div>
                        <div class="track-meta">
                            <span class="meta-item">🎸 YouTube Music</span>
                            ${track.duration ? `<span class="meta-item">⏱️ ${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}</span>` : ''}
                        </div>
                        <div class="track-rating-large">
                            <span class="rating-value" style="font-size:24px;font-weight:bold;color:#4CAF50;">${avgScore}/50</span>
                            <span class="rating-count">(${reviews.length} рецензий)</span>
                        </div>
                        <div class="track-player" style="margin-top: 20px;">
                            <div id="youtubePlayer"></div>
                        </div>
                        ${currentUser ? `
                            <button class="write-review-track-btn" id="writeReviewBtn" style="margin-top: 20px;">✍️ Написать рецензию</button>
                        ` : `
                            <button class="write-review-track-btn" id="loginToReviewBtn" style="margin-top: 20px;">🔒 Войдите, чтобы написать рецензию</button>
                        `}
                    </div>
                </div>
                
                <div class="reviews-section">
                    <h2>Рецензии (${reviews.length})</h2>
                    <div class="reviews-list" id="reviewsList">
                        ${reviews.length === 0 ? '<div class="empty-state">Пока нет рецензий. Будьте первым!</div>' : ''}
                    </div>
                </div>
            </div>
        `;
        
        // YouTube плеер
        const playerDiv = document.getElementById('youtubePlayer');
        if (playerDiv && track.sc_id) {
            playerDiv.innerHTML = `
                <iframe 
                    width="100%" 
                    height="250" 
                    src="https://www.youtube.com/embed/${track.sc_id}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            `;
        }
        
        // Рецензии с опознавательными знаками
        const reviewsList = document.getElementById('reviewsList');
        if (reviewsList && reviews.length > 0) {
            reviewsList.innerHTML = reviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(review => {
                const total = (review.rhymes || 0) + (review.structure || 0) + (review.style || 0) + (review.charisma || 0) + (review.vibe || 0);
                const date = new Date(review.created_at).toLocaleDateString('ru-RU');
                const avatarHtml = review.avatar_photo 
                    ? `<img src="${review.avatar_photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` 
                    : (review.avatar || '👤');
                
                // Цвет итогового балла
                let totalColor = '#ff4444';
                if (total >= 40) totalColor = '#4CAF50';
                else if (total >= 30) totalColor = '#FFC107';
                else if (total >= 20) totalColor = '#FF9800';
                
                // Определяем роль автора
                let roleBadge = '';
                let authorNameClass = '';
                let reviewItemClass = 'review-item';
                
                if (review.user_role === 'admin') {
                    roleBadge = '<span class="role-badge role-admin" title="Администратор">👑 Админ</span>';
                    authorNameClass = 'admin-name';
                    reviewItemClass = 'review-item admin-review';
                } else if (review.user_role === 'moderator') {
                    roleBadge = '<span class="role-badge role-moderator" title="Модератор">🛡️ Модер</span>';
                    authorNameClass = 'moderator-name';
                    reviewItemClass = 'review-item moderator-review';
                }
                
                // Кнопка удаления только для модераторов и админов
                const deleteButton = (currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator')) 
                    ? `<button class="delete-review-btn" data-id="${review.id}" style="background: #8b1a1a; color: white; border: none; padding: 4px 12px; border-radius: 20px; cursor: pointer; margin-left: 10px;">🗑 Удалить</button>`
                    : '';
                
                return `
                    <div class="${reviewItemClass}" data-id="${review.id}">
                        <div class="review-item-header">
                            <div class="review-item-author">
                                <div class="author-avatar">${avatarHtml}</div>
                                <div>
                                    <span class="author-name ${authorNameClass}" data-user-id="${review.user_id}" style="cursor: pointer;">${escapeHtml(review.username)}</span>
                                    ${roleBadge}
                                </div>
                            </div>
                            <div class="review-item-score" style="background: ${totalColor}20; color: ${totalColor}; padding: 4px 12px; border-radius: 20px; font-weight: bold;">
                                ${total}/50
                            </div>
                            <div class="review-item-date">${date}</div>
                            ${deleteButton}
                        </div>
                        
                        <!-- Критерии в виде ползунков -->
                        <div class="criteria-container" style="margin: 16px 0; background: #0a0a0a; border-radius: 12px; padding: 12px;">
                            <div class="criteria-item" style="margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span style="font-size: 13px;">🎤 Рифмы</span>
                                    <span style="font-size: 13px; color: #4CAF50;">${review.rhymes}/10</span>
                                </div>
                                <div style="background: #2a2a2a; border-radius: 10px; height: 8px; overflow: hidden;">
                                    <div style="background: #4CAF50; width: ${review.rhymes * 10}%; height: 100%; border-radius: 10px;"></div>
                                </div>
                            </div>
                            <div class="criteria-item" style="margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span style="font-size: 13px;">🥁 Структура / Ритмика</span>
                                    <span style="font-size: 13px; color: #2196F3;">${review.structure}/10</span>
                                </div>
                                <div style="background: #2a2a2a; border-radius: 10px; height: 8px; overflow: hidden;">
                                    <div style="background: #2196F3; width: ${review.structure * 10}%; height: 100%; border-radius: 10px;"></div>
                                </div>
                            </div>
                            <div class="criteria-item" style="margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span style="font-size: 13px;">🎨 Реализация стиля</span>
                                    <span style="font-size: 13px; color: #9C27B0;">${review.style}/10</span>
                                </div>
                                <div style="background: #2a2a2a; border-radius: 10px; height: 8px; overflow: hidden;">
                                    <div style="background: #9C27B0; width: ${review.style * 10}%; height: 100%; border-radius: 10px;"></div>
                                </div>
                            </div>
                            <div class="criteria-item" style="margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span style="font-size: 13px;">⭐ Харизма</span>
                                    <span style="font-size: 13px; color: #FF9800;">${review.charisma}/10</span>
                                </div>
                                <div style="background: #2a2a2a; border-radius: 10px; height: 8px; overflow: hidden;">
                                    <div style="background: #FF9800; width: ${review.charisma * 10}%; height: 100%; border-radius: 10px;"></div>
                                </div>
                            </div>
                            <div class="criteria-item" style="margin-bottom: 4px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span style="font-size: 13px;">🔥 Вайб</span>
                                    <span style="font-size: 13px; color: #E91E63;">${review.vibe}/10</span>
                                </div>
                                <div style="background: #2a2a2a; border-radius: 10px; height: 8px; overflow: hidden;">
                                    <div style="background: #E91E63; width: ${review.vibe * 10}%; height: 100%; border-radius: 10px;"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="review-item-text" style="margin: 12px 0; line-height: 1.5; color: #b0b0b0;">${escapeHtml(review.text)}</div>
                        <div class="review-item-footer">
                            <button class="like-btn" data-id="${review.id}" style="background: transparent; border: none; color: #888; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                ❤️ <span class="like-count">${review.likes}</span>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Обработчики
        const writeBtn = document.getElementById('writeReviewBtn');
        if (writeBtn) {
            writeBtn.onclick = () => {
                window.location.href = `write-review.html?trackId=${track.id}&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}&image=${encodeURIComponent(track.artwork_url || '')}`;
            };
        }
        
        const loginToReviewBtn = document.getElementById('loginToReviewBtn');
        if (loginToReviewBtn) {
            loginToReviewBtn.onclick = () => openModal('login');
        }
        
        document.querySelectorAll('.author-name').forEach(name => {
            name.onclick = (e) => {
                e.stopPropagation();
                const userId = name.dataset.userId;
                if (userId) window.location.href = `user.html?id=${userId}`;
            };
        });
        
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const reviewId = btn.dataset.id;
                if (!currentUser) {
                    alert('Войдите, чтобы ставить лайки');
                    openModal('login');
                    return;
                }
                try {
                    await apiRequest(`/reviews/${reviewId}/like`, { method: 'POST' });
                    loadTrackPage(trackId);
                } catch (error) {
                    alert('Ошибка: ' + error.message);
                }
            };
        });
        
        // Удаление рецензии (для модератора/админа)
        document.querySelectorAll('.delete-review-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm('Удалить эту рецензию?')) {
                    try {
                        await apiRequest(`/admin/reviews/${btn.dataset.id}`, { method: 'DELETE' });
                        loadTrackPage(trackId);
                    } catch (error) {
                        alert('Ошибка при удалении: ' + error.message);
                    }
                }
            };
        });
        
    } catch (error) {
        console.error('Ошибка:', error);
        content.innerHTML = '<div class="empty-state">Ошибка загрузки трека</div>';
    }
}
// ========== СТРАНИЦА ПОЛЬЗОВАТЕЛЯ ==========
async function initUserPage() {
    const content = document.getElementById('content');
    if (!content) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    
    if (!userId) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const user = await apiRequest(`/users/${userId}`);
        const userReviews = await apiRequest(`/users/${userId}/reviews`);
        
        const avatarHtml = user.avatar_photo 
            ? `<img src="${user.avatar_photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` 
            : (user.avatar || '👤');
        
        const isOwnProfile = currentUser && currentUser.id == userId;
        
        content.innerHTML = `
            <div class="profile-container">
                <div class="profile-card">
                    <div class="profile-avatar-large">${avatarHtml}</div>
                    <h2>${escapeHtml(user.username)}</h2>
                    <p>${escapeHtml(user.email)}</p>
                    ${isOwnProfile ? '<a href="profile.html" class="edit-profile-btn">✏️ Редактировать профиль</a>' : ''}
                    <div class="profile-stats">
                        <div class="stat">
                            <span class="stat-value">${userReviews.length}</span>
                            <span class="stat-label">рецензий</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">${userReviews.reduce((sum, r) => sum + r.likes, 0)}</span>
                            <span class="stat-label">получено лайков</span>
                        </div>
                    </div>
                    <h3 style="margin-top: 24px; margin-bottom: 16px;">Рецензии ${escapeHtml(user.username)}</h3>
                    <div class="user-reviews-list" id="userReviewsList"></div>
                </div>
            </div>
        `;
        
        const reviewsList = document.getElementById('userReviewsList');
        if (reviewsList) {
            if (userReviews.length === 0) {
                reviewsList.innerHTML = '<div class="empty-state">Пользователь ещё не написал ни одной рецензии</div>';
            } else {
                reviewsList.innerHTML = userReviews.map(review => `
                    <div class="user-review-item" data-track-id="${review.track_id}" style="cursor: pointer;">
                        <div class="user-review-title">${escapeHtml(review.track_title)}</div>
                        <div class="user-review-artist">${escapeHtml(review.track_artist)}</div>
                        <div class="user-review-score">${getCriteriaMiniHtml(review)}</div>
                        <div class="user-review-text">${escapeHtml(review.text.substring(0, 100))}${review.text.length > 100 ? '...' : ''}</div>
                        <div class="user-review-likes">❤️ ${review.likes} лайков</div>
                    </div>
                `).join('');
                
                document.querySelectorAll('.user-review-item').forEach(item => {
                    item.onclick = () => {
                        const trackId = item.dataset.trackId;
                        if (trackId) window.location.href = `track.html?id=${trackId}`;
                    };
                });
            }
        }
        
    } catch (error) {
        content.innerHTML = '<div class="empty-state">Пользователь не найден</div>';
    }
}

// ========== ЛИЧНЫЙ КАБИНЕТ ==========
async function initProfilePage() {
    const content = document.getElementById('content');
    if (!content) return;
    
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    await loadProfilePage();
}

async function loadProfilePage() {
    try {
        const userReviews = await apiRequest(`/users/${currentUser.id}/reviews`);
        
        const avatarHtml = currentUser.avatarPhoto 
            ? `<img src="${currentUser.avatarPhoto}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` 
            : (currentUser.avatar || '👤');
        
        document.getElementById('profileAvatarLarge').innerHTML = avatarHtml;
        document.getElementById('profileUsername').textContent = currentUser.username;
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('reviewsCount').textContent = userReviews.length;
        document.getElementById('likesCount').textContent = userReviews.reduce((sum, r) => sum + r.likes, 0);
        
        const reviewsList = document.getElementById('userReviewsList');
        if (reviewsList) {
            if (userReviews.length === 0) {
                reviewsList.innerHTML = '<div class="empty-state">Вы ещё не написали ни одной рецензии</div>';
            } else {
                reviewsList.innerHTML = userReviews.map(review => `
                    <div class="user-review-item" data-track-id="${review.track_id}" style="cursor: pointer;">
                        <div class="user-review-title">${escapeHtml(review.track_title)}</div>
                        <div class="user-review-artist">${escapeHtml(review.track_artist)}</div>
                        <div class="user-review-score">${getCriteriaMiniHtml(review)}</div>
                        <div class="user-review-text">${escapeHtml(review.text.substring(0, 100))}${review.text.length > 100 ? '...' : ''}</div>
                        <div class="user-review-likes">❤️ ${review.likes} лайков</div>
                    </div>
                `).join('');
                
                document.querySelectorAll('.user-review-item').forEach(item => {
                    item.onclick = () => {
                        const trackId = item.dataset.trackId;
                        if (trackId) window.location.href = `track.html?id=${trackId}`;
                    };
                });
            }
        }
        
        const logoutBtnProfile = document.getElementById('logoutBtnProfile');
        if (logoutBtnProfile) {
            logoutBtnProfile.onclick = () => {
                localStorage.removeItem('fostberg_token');
                localStorage.removeItem('fostberg_user');
                token = null;
                currentUser = null;
                updateAuthUI();
                window.location.href = 'index.html';
            };
        }
        
        document.getElementById('changeAvatarBtn').onclick = () => {
            document.getElementById('avatarModal').style.display = 'flex';
        };
        
        const photoUpload = document.getElementById('photoUpload');
        if (photoUpload) {
            photoUpload.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const photoData = event.target.result;
                        try {
                            await apiRequest(`/users/${currentUser.id}/avatar`, {
                                method: 'PUT',
                                body: JSON.stringify({ avatarPhoto: photoData })
                            });
                            currentUser.avatarPhoto = photoData;
                            currentUser.avatar = null;
                            localStorage.setItem('fostberg_user', JSON.stringify(currentUser));
                            loadProfilePage();
                            updateAuthUI();
                        } catch (error) {
                            alert('Ошибка загрузки фото');
                        }
                    };
                    reader.readAsDataURL(file);
                }
            };
        }
        
        const avatarGrid = document.getElementById('avatarGrid');
        if (avatarGrid) {
            const avatars = ['😀','😎','🎵','🎸','🎹','🎧','🌟','🔥','💙','💜','🐱','🐶','🐼','🍕','☕','🌙','⭐','🌈','🎤','🥁'];
            avatarGrid.innerHTML = avatars.map(emoji => `<div class="avatar-option" data-avatar="${emoji}">${emoji}</div>`).join('');
            
            document.querySelectorAll('.avatar-option').forEach(opt => {
                opt.onclick = async () => {
                    const newAvatar = opt.dataset.avatar;
                    try {
                        await apiRequest(`/users/${currentUser.id}/avatar`, {
                            method: 'PUT',
                            body: JSON.stringify({ avatar: newAvatar, avatarPhoto: null })
                        });
                        currentUser.avatar = newAvatar;
                        currentUser.avatarPhoto = null;
                        localStorage.setItem('fostberg_user', JSON.stringify(currentUser));
                        loadProfilePage();
                        updateAuthUI();
                        document.getElementById('avatarModal').style.display = 'none';
                    } catch (error) {
                        alert('Ошибка смены аватара');
                    }
                };
            });
        }
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

// ========== НАПИСАНИЕ РЕЦЕНЗИИ ==========
async function initWritePage() {
    const content = document.getElementById('content');
    if (!content) return;
    
    if (!currentUser) {
        alert('Сначала войдите в аккаунт');
        window.location.href = 'index.html';
        return;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get('trackId');
    const trackTitle = urlParams.get('title');
    const trackArtist = urlParams.get('artist');
    const trackImage = urlParams.get('image');
    
    if (trackId && trackTitle && trackArtist) {
        await showReviewForm(trackId, trackTitle, trackArtist, trackImage);
    } else {
        await showTrackSelector();
    }
}

async function showTrackSelector() {
    const content = document.getElementById('content');
    
    content.innerHTML = `
        <div class="review-form-card">
            <h3>✍️ Выберите трек для рецензии</h3>
            <div class="form-row">
                <input type="text" id="trackSearchInput" placeholder="Поиск трека..." autocomplete="off" style="width:100%; padding:12px; border-radius:12px; background:#121212; border:1px solid #2a2a2a; color:#e0e0e0;">
                <div id="trackSearchResults" style="margin-top: 12px;"></div>
            </div>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #2a2a2a; text-align: center;">
                <a href="add-track.html" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: #1a1a1a; border-radius: 30px; color: #4CAF50; text-decoration: none; font-weight: 500;">
                    ➕ Не можете найти трек? Добавьте сами!
                </a>
            </div>
        </div>
    `;
    
    const searchInput = document.getElementById('trackSearchInput');
    const resultsDiv = document.getElementById('trackSearchResults');
    
    searchInput.addEventListener('input', async function() {
        const query = this.value.trim();
        if (query.length < 2) {
            resultsDiv.innerHTML = '';
            return;
        }
        
        try {
            const tracks = await apiRequest(`/tracks/search?q=${encodeURIComponent(query)}`);
            
            if (tracks.length === 0) {
                resultsDiv.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
                return;
            }
            
            resultsDiv.innerHTML = tracks.map(track => `
                <div class="search-dropdown-item" data-track-id="${track.id}" data-title="${escapeHtml(track.title)}" data-artist="${escapeHtml(track.artist)}" data-image="${track.artwork_url || ''}" style="display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid #1a1a1a; cursor:pointer;">
                    <div class="search-dropdown-cover" style="width:48px; height:48px; background:#1a1a1a; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:24px;">
                        ${track.artwork_url ? `<img src="${track.artwork_url}" style="width:100%;height:100%;border-radius:12px;object-fit:cover">` : '🎵'}
                    </div>
                    <div class="search-dropdown-info" style="flex:1;">
                        <div class="search-dropdown-title" style="font-weight:600;">${escapeHtml(track.title)}</div>
                        <div class="search-dropdown-artist" style="color:#888; font-size:13px;">${escapeHtml(track.artist)}</div>
                    </div>
                    <button class="search-dropdown-btn" style="background:#1a1a1a; border:1px solid #3a3a3a; color:#e0e0e0; padding:6px 16px; border-radius:25px; cursor:pointer;">Выбрать</button>
                </div>
            `).join('');
            
            document.querySelectorAll('.search-dropdown-item').forEach(item => {
                const btn = item.querySelector('.search-dropdown-btn');
                const trackId = item.dataset.trackId;
                const title = item.dataset.title;
                const artist = item.dataset.artist;
                const image = item.dataset.image;
                
                btn.onclick = () => {
                    showReviewForm(trackId, title, artist, image);
                };
                
                item.onclick = (e) => {
                    if (e.target !== btn) {
                        showReviewForm(trackId, title, artist, image);
                    }
                };
            });
        } catch (error) {
            resultsDiv.innerHTML = '<div class="empty-state">Ошибка поиска</div>';
        }
    });
}

async function showReviewForm(trackId, trackTitle, trackArtist, trackImage) {
    const content = document.getElementById('content');
    
    content.innerHTML = `
        <div class="review-form-card">
            <h3>✍️ Рецензия на трек</h3>
            <div class="selected-track" style="background:#1a1a1a; border-radius:12px; padding:16px; margin-bottom:20px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    ${trackImage ? `<img src="${trackImage}" style="width:50px;height:50px;border-radius:8px;object-fit:cover">` : '<span style="font-size:32px;">🎵</span>'}
                    <div>
                        <strong>${escapeHtml(trackTitle)}</strong><br>
                        <span style="color:#888; font-size:13px;">${escapeHtml(trackArtist)}</span>
                    </div>
                </div>
            </div>
            <form id="reviewForm">
                <div class="form-row criteria-sliders">
                    <h4 style="margin-bottom: 16px; color: #e0e0e0;">Оцените трек по критериям (1-10):</h4>
                    <div class="slider-group">
                        <label for="rhymes">🎤 Рифмы</label>
                        <input type="range" id="rhymes" name="rhymes" min="1" max="10" value="5" class="criteria-slider">
                        <span class="slider-value" id="rhymesValue">5</span>
                    </div>
                    <div class="slider-group">
                        <label for="structure">🥁 Структура / Ритмика</label>
                        <input type="range" id="structure" name="structure" min="1" max="10" value="5" class="criteria-slider">
                        <span class="slider-value" id="structureValue">5</span>
                    </div>
                    <div class="slider-group">
                        <label for="style">🎨 Реализация стиля</label>
                        <input type="range" id="style" name="style" min="1" max="10" value="5" class="criteria-slider">
                        <span class="slider-value" id="styleValue">5</span>
                    </div>
                    <div class="slider-group">
                        <label for="charisma">⭐ Харизма</label>
                        <input type="range" id="charisma" name="charisma" min="1" max="10" value="5" class="criteria-slider">
                        <span class="slider-value" id="charismaValue">5</span>
                    </div>
                    <div class="slider-group">
                        <label for="vibe">🔥 Вайб</label>
                        <input type="range" id="vibe" name="vibe" min="1" max="10" value="5" class="criteria-slider">
                        <span class="slider-value" id="vibeValue">5</span>
                    </div>
                    <div class="total-score-preview" style="margin-top: 16px; padding: 12px; background: #1a1a1a; border-radius: 8px; text-align: center;">
                        <span style="color: #888;">Итоговый балл: </span>
                        <span id="totalScore" style="font-weight: bold; color: #4CAF50; font-size: 18px;">25/50</span>
                    </div>
                </div>
                <div class="form-row">
                    <textarea id="reviewText" placeholder="Поделитесь впечатлениями..." required rows="5" style="width:100%; background:#121212; border:1px solid #2a2a2a; border-radius:12px; padding:12px; color:#e0e0e0; resize:vertical;"></textarea>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button type="submit" class="submit-review-btn" style="background:#1a1a1a; border:1px solid #3a3a3a; color:#e0e0e0; padding:12px 24px; border-radius:30px; cursor:pointer;">📝 Опубликовать рецензию</button>
                    <button type="button" id="cancelBtn" style="background:#1a1a1a; border:1px solid #3a3a3a; color:#e0e0e0; padding:12px 24px; border-radius:30px; cursor:pointer;">↩️ Назад</button>
                </div>
            </form>
        </div>
    `;
    
    document.getElementById('cancelBtn').onclick = () => showTrackSelector();
    
    const criteria = ['rhymes', 'structure', 'style', 'charisma', 'vibe'];
    function updateTotalScore() {
        const total = criteria.reduce((sum, key) => sum + parseInt(document.getElementById(key).value), 0);
        document.getElementById('totalScore').textContent = `${total}/50`;
    }
    criteria.forEach(key => {
        const slider = document.getElementById(key);
        const valueDisplay = document.getElementById(key + 'Value');
        slider.oninput = () => {
            valueDisplay.textContent = slider.value;
            updateTotalScore();
        };
    });

    document.getElementById('reviewForm').onsubmit = async (e) => {
        e.preventDefault();

        const rhymes = parseInt(document.getElementById('rhymes').value);
        const structure = parseInt(document.getElementById('structure').value);
        const style = parseInt(document.getElementById('style').value);
        const charisma = parseInt(document.getElementById('charisma').value);
        const vibe = parseInt(document.getElementById('vibe').value);
        const text = document.getElementById('reviewText').value;

        if (!text.trim()) {
            alert('Напишите рецензию');
            return;
        }

        try {
            await apiRequest('/reviews', {
                method: 'POST',
                body: JSON.stringify({
                    trackId: trackId,
                    title: trackTitle,
                    artist: trackArtist,
                    image: trackImage,
                    rhymes,
                    structure,
                    style,
                    charisma,
                    vibe,
                    text
                })
            });

            alert('Рецензия опубликована!');
            window.location.href = `track.html?id=${trackId}`;
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    };
}

// Функция для получения значка роли
function getRoleBadge(user) {
    if (!user) return '';
    if (user.role === 'admin') {
        return '<span class="role-badge role-admin" title="Администратор">👑 Админ</span>';
    } else if (user.role === 'moderator') {
        return '<span class="role-badge role-moderator" title="Модератор">🛡️ Модер</span>';
    }
    return '';
}

// ========== ВСЕ ТРЕКИ (СТРАНИЦА tracks.html) ==========
let currentTrackPage = 1;
let totalTrackPages = 1;

async function loadAllTracks() {
    const content = document.getElementById('content');
    if (!content) return;
    
    content.innerHTML = '<div class="loading">Загрузка треков...</div>';
    
    try {
        const data = await apiRequest(`/all-tracks?page=${currentTrackPage}&limit=20`);
        const tracks = data.tracks || [];
        const total = data.total || 0;
        totalTrackPages = Math.ceil(total / 20);
        
        if (tracks.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:48px;margin-bottom:16px;">🎵</div>
                    <div>Пока нет оценённых треков</div>
                    <div style="font-size:12px;margin-top:8px;">Будьте первым, кто оценит трек!</div>
                </div>
            `;
            return;
        }
        
        content.innerHTML = `
            <div class="all-tracks-container">
                <div class="all-tracks-header">
                    <h1>🎵 Все оценённые треки</h1>
                    <p>Треки, которые получили хотя бы одну рецензию</p>
                </div>
                <div class="all-tracks-list">
                    ${tracks.map((track, index) => {
                        const avgScore = (track.avg_score || 0).toFixed(1);
                        const rank = (currentTrackPage - 1) * 20 + index + 1;
                        let scoreClass = 'low';
                        if (avgScore >= 40) scoreClass = 'high';
                        else if (avgScore >= 30) scoreClass = 'medium';
                        
                        return `
                            <div class="track-list-item" data-track-id="${track.id}" style="cursor:pointer;">
                                <div class="track-list-rank">${rank}</div>
                                <div class="track-list-cover">
                                    ${track.artwork_url ? `<img src="${track.artwork_url}" alt="${escapeHtml(track.title)}">` : '<div class="track-list-placeholder">🎵</div>'}
                                </div>
                                <div class="track-list-info">
                                    <div class="track-list-title">${escapeHtml(track.title)}</div>
                                    <div class="track-list-artist">${escapeHtml(track.artist)}</div>
                                </div>
                                <div class="track-list-stats">
                                    <span class="stat-badge">📝 ${track.reviews_count} рец.</span>
                                    <span class="stat-badge ${scoreClass}">⭐ ${avgScore}/50</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                ${totalTrackPages > 1 ? `
                    <div class="pagination">
                        ${Array.from({ length: totalTrackPages }, (_, i) => i + 1).map(page => `
                            <button class="page-btn ${page === currentTrackPage ? 'active' : ''}" data-page="${page}">${page}</button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        
        document.querySelectorAll('.track-list-item').forEach(item => {
            item.onclick = () => {
                const trackId = item.dataset.trackId;
                if (trackId) window.location.href = `track.html?id=${trackId}`;
            };
        });
        
        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.onclick = () => {
                currentTrackPage = parseInt(btn.dataset.page);
                loadAllTracks();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        });
        
    } catch (error) {
        console.error('Ошибка:', error);
        content.innerHTML = '<div class="empty-state">Ошибка загрузки треков</div>';
    }
}
// ========== ЗАПУСК ==========
function init() {
    token = localStorage.getItem('fostberg_token');
    const savedUser = localStorage.getItem('fostberg_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }
    
    updateAuthUI();
    setupAuthModals();
    initSearchDropdown();
    
    const path = window.location.pathname;
    const fullHref = window.location.href;
    
   if (path.includes('top.html') || fullHref.includes('top.html')) {
    loadTopUsers();
} else if (path.includes('write-review.html') || fullHref.includes('write-review.html')) {
        initWritePage();
    } else if (path.includes('profile.html') || fullHref.includes('profile.html')) {
        initProfilePage();
    } else if (path.includes('track.html') || fullHref.includes('track.html')) {
        initTrackPage();
    } else if (path.includes('user.html') || fullHref.includes('user.html')) {
        initUserPage();
    } else if (path.includes('tracks.html') || fullHref.includes('tracks.html')) {
    loadAllTracks();
    } else if (path.includes('add-track.html') || fullHref.includes('add-track.html')) {
        // add-track.html обрабатывается отдельно, здесь ничего не делаем
        // страница сама себя рендерит
    } else {
        loadTopTracksHome();
    }
}

init();