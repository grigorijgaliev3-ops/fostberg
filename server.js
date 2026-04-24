require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'fostberg_secret_key_2025';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        req.user = user;
        next();
    });
}

// ========== MIDDLEWARE ДЛЯ РОЛЕЙ (НОВОЕ) ==========
function isAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Доступ запрещён. Требуются права администратора.' });
    }
}

function isModerator(req, res, next) {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'moderator')) {
        next();
    } else {
        res.status(403).json({ error: 'Доступ запрещён. Требуются права модератора.' });
    }
}

// ========== АВТОРИЗАЦИЯ ==========
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Все поля обязательны' });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, [username, email, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Пользователь уже существует' });
                return res.status(500).json({ error: err.message });
            }
            const token = jwt.sign({ id: this.lastID, username, role: 'user' }, JWT_SECRET);
            res.json({ token, user: { id: this.lastID, username, email, avatar: '👤', role: 'user' } });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Неверный email или пароль' });
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Неверный email или пароль' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
        res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, avatarPhoto: user.avatar_photo, role: user.role } });
    });
});

// ========== ПОИСК ТРЕКОВ ==========
app.get('/api/tracks/search', async (req, res) => {
    const query = req.query.q;
    console.log('🔍 Поиск:', query);
    
    if (!query || query.length < 2) {
        return res.json([]);
    }
    
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                q: query,
                type: 'video',
                maxResults: 10,
                key: YOUTUBE_API_KEY
            }
        });
        
        console.log('✅ Найдено видео:', response.data.items.length);
        
        const tracks = response.data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            artist: item.snippet.channelTitle,
            artwork_url: item.snippet.thumbnails.medium.url
        }));
        
        for (const track of tracks) {
            db.run(`INSERT OR IGNORE INTO tracks (sc_id, title, artist, artwork_url) VALUES (?, ?, ?, ?)`,
                [track.id, track.title, track.artist, track.artwork_url]);
        }
        
        res.json(tracks);
    } catch (error) {
        console.error('YouTube error:', error.message);
        res.json([]);
    }
});

// ========== ПОЛУЧИТЬ ТРЕК ==========
app.get('/api/tracks/:id', async (req, res) => {
    const trackParam = req.params.id;
    
    db.get(`SELECT * FROM tracks WHERE sc_id = ? OR id = ?`, [trackParam, trackParam], async (err, track) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (track) {
            return res.json(track);
        }
        
        if (trackParam && trackParam.length === 11) {
            try {
                const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                    params: {
                        part: 'snippet',
                        id: trackParam,
                        key: YOUTUBE_API_KEY
                    }
                });
                
                if (!response.data.items || response.data.items.length === 0) {
                    return res.status(404).json({ error: 'Трек не найден' });
                }
                
                const video = response.data.items[0];
                const newTrack = {
                    sc_id: video.id,
                    title: video.snippet.title,
                    artist: video.snippet.channelTitle,
                    artwork_url: video.snippet.thumbnails.medium.url
                };
                
                db.run(`INSERT INTO tracks (sc_id, title, artist, artwork_url) VALUES (?, ?, ?, ?)`,
                    [newTrack.sc_id, newTrack.title, newTrack.artist, newTrack.artwork_url],
                    function() {
                        newTrack.id = this.lastID;
                        res.json(newTrack);
                    }
                );
            } catch (error) {
                res.status(500).json({ error: 'Ошибка получения трека' });
            }
        } else {
            res.status(404).json({ error: 'Трек не найден' });
        }
    });
});

// ========== РУЧНОЕ ДОБАВЛЕНИЕ ТРЕКА ==========
app.post('/api/tracks/add', (req, res) => {
    const { title, artist, youtubeUrl, artworkUrl } = req.body;
    
    if (!title || !artist) {
        return res.status(400).json({ error: 'Название и исполнитель обязательны' });
    }
    
    let sc_id = null;
    if (youtubeUrl) {
        const match = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        if (match) sc_id = match[1];
    }
    
    db.run(`INSERT OR REPLACE INTO tracks (sc_id, title, artist, artwork_url) VALUES (?, ?, ?, ?)`,
        [sc_id, title, artist, artworkUrl || null],
        function(err) {
            if (err) {
                console.error('❌ Ошибка добавления трека:', err);
                return res.status(500).json({ error: err.message });
            }
            
            db.get(`SELECT * FROM tracks WHERE rowid = ?`, [this.lastID], (err, track) => {
                if (err || !track) {
                    db.get(`SELECT * FROM tracks WHERE sc_id = ? OR (title = ? AND artist = ?)`,
                        [sc_id, title, artist], (err, track) => {
                            if (err || !track) {
                                return res.status(500).json({ error: 'Трек не найден после сохранения' });
                            }
                            res.json({ success: true, track: { ...track, id: track.sc_id || track.id } });
                        });
                } else {
                    res.json({ success: true, track: { ...track, id: track.sc_id || track.id } });
                }
            });
        });
});

// ========== РЕЦЕНЗИИ ==========
app.get('/api/tracks/:trackId/reviews', (req, res) => {
    const trackParam = req.params.trackId;
    
    const findTrackSql = `SELECT id FROM tracks WHERE sc_id = ? OR id = ?`;
    db.get(findTrackSql, [trackParam, trackParam], (err, track) => {
        if (err) {
            console.error('❌ Ошибка поиска трека:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!track) {
            console.log('⚠️ Трек не найден, param:', trackParam);
            return res.json([]);
        }
        
        db.all(`SELECT r.*, u.username, u.avatar, u.avatar_photo, u.role as user_role
                FROM reviews r
                JOIN users u ON r.user_id = u.id
                WHERE r.track_id = ?
                ORDER BY r.created_at DESC`,
            [track.id],
            (err, rows) => {
                if (err) {
                    console.error('❌ Ошибка получения рецензий:', err);
                    return res.status(500).json({ error: err.message });
                }
                res.json(rows || []);
            });
    });
});

app.post('/api/reviews', authenticateToken, (req, res) => {
    const { trackId, title, artist, image, rhymes, structure, style, charisma, vibe, text } = req.body;
    console.log('📝 Новая рецензия:', { trackId, title, artist, rhymes, structure, style, charisma, vibe, text });
    
    if (!title || !artist || !rhymes || !structure || !style || !charisma || !vibe || !text) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    const findTrackSql = `SELECT id FROM tracks WHERE LOWER(title) = LOWER(?) AND LOWER(artist) = LOWER(?)`;
    db.get(findTrackSql, [title, artist], (err, existingTrack) => {
        if (err) {
            console.error('❌ Ошибка поиска трека:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (existingTrack) {
            console.log('✅ Трек найден, ID:', existingTrack.id);
            addReview(existingTrack.id);
        } else {
            console.log('🆕 Трек не найден, создаём новый');
            db.run(`INSERT INTO tracks (sc_id, title, artist, artwork_url) VALUES (?, ?, ?, ?)`,
                [trackId || null, title, artist, image || null],
                function(err) {
                    if (err) {
                        console.error('❌ Ошибка создания трека:', err);
                        return res.status(500).json({ error: err.message });
                    }
                    console.log('✅ Трек создан, ID:', this.lastID);
                    addReview(this.lastID);
                });
        }
        
        function addReview(trackDbId) {
            db.run(`INSERT INTO reviews (user_id, track_id, rhymes, structure, style, charisma, vibe, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.user.id, trackDbId, rhymes, structure, style, charisma, vibe, text],
                function(err) {
                    if (err) {
                        console.error('❌ Ошибка сохранения рецензии:', err);
                        return res.status(500).json({ error: err.message });
                    }
                    console.log('✅ Рецензия сохранена, ID:', this.lastID);
                    res.json({ id: this.lastID, success: true, trackId: trackDbId });
                });
        }
    });
});

app.post('/api/reviews/:reviewId/like', authenticateToken, (req, res) => {
    const reviewId = req.params.reviewId;
    
    db.get(`SELECT * FROM user_likes WHERE user_id = ? AND review_id = ?`, 
        [req.user.id, reviewId], 
        (err, like) => {
            if (like) {
                db.run(`DELETE FROM user_likes WHERE user_id = ? AND review_id = ?`, [req.user.id, reviewId]);
                db.run(`UPDATE reviews SET likes = likes - 1 WHERE id = ?`, [reviewId]);
                res.json({ liked: false });
            } else {
                db.run(`INSERT INTO user_likes (user_id, review_id) VALUES (?, ?)`, [req.user.id, reviewId]);
                db.run(`UPDATE reviews SET likes = likes + 1 WHERE id = ?`, [reviewId]);
                res.json({ liked: true });
            }
        });
});

// ========== ПОСЛЕДНИЕ РЕЦЕНЗИИ ==========
app.get('/api/recent-reviews', (req, res) => {
    db.all(`SELECT r.*, u.username, u.avatar, u.avatar_photo, u.role as user_role,
                   t.id as track_id, t.title as track_title, t.artist as track_artist, t.artwork_url
            FROM reviews r 
            JOIN users u ON r.user_id = u.id 
            JOIN tracks t ON r.track_id = t.id 
            ORDER BY r.created_at DESC 
            LIMIT 20`,
        (err, reviews) => {
            if (err) {
                console.error('❌ Ошибка recent-reviews:', err.message);
                return res.json([]);
            }
            res.json(reviews || []);
        });
});

// ========== ТОП ТРЕКОВ ==========
app.get('/api/top-tracks', (req, res) => {
    db.all(`SELECT t.id as track_id, t.title as track_title, t.artist as track_artist, t.artwork_url,
                   COUNT(r.id) as reviews_count, 
                   AVG(r.rhymes + r.structure + r.style + r.charisma + r.vibe) as avg_rating, 
                   SUM(r.likes) as total_likes
            FROM tracks t
            LEFT JOIN reviews r ON t.id = r.track_id
            GROUP BY t.id
            HAVING reviews_count > 0
            ORDER BY reviews_count DESC
            LIMIT 20`, 
        (err, tracks) => {
            if (err) {
                console.error('❌ Ошибка top-tracks:', err.message);
                return res.json([]);
            }
            res.json(tracks || []);
        });
});

// ========== ПОЛЬЗОВАТЕЛИ ==========
app.get('/api/users/:id', (req, res) => {
    db.get(`SELECT id, username, email, avatar, avatar_photo FROM users WHERE id = ?`, 
        [req.params.id], 
        (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'Пользователь не найден' });
            res.json(user);
        });
});

app.get('/api/users/:userId/reviews', (req, res) => {
    db.all(`SELECT r.*, t.title as track_title, t.artist as track_artist
            FROM reviews r
            JOIN tracks t ON r.track_id = t.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC`,
        [req.params.userId],
        (err, reviews) => {
            if (err) {
                console.error('❌ Ошибка user-reviews:', err.message);
                return res.json([]);
            }
            res.json(reviews || []);
        });
});

app.put('/api/users/:userId/avatar', authenticateToken, (req, res) => {
    if (req.user.id !== parseInt(req.params.userId)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    const { avatar, avatarPhoto } = req.body;
    db.run(`UPDATE users SET avatar = ?, avatar_photo = ? WHERE id = ?`,
        [avatar || '👤', avatarPhoto || null, req.params.userId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// ========== УПРАВЛЕНИЕ РОЛЯМИ (ТОЛЬКО ДЛЯ АДМИНА) ==========
// Получить всех пользователей
app.get('/api/admin/users', authenticateToken, isAdmin, (req, res) => {
    db.all(`SELECT id, username, email, role, created_at FROM users`, [], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(users);
    });
});

// Изменить роль пользователя
app.put('/api/admin/users/:userId/role', authenticateToken, isAdmin, (req, res) => {
    const { role } = req.body;
    const userId = req.params.userId;
    
    if (!['user', 'moderator', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Неверная роль' });
    }
    
    db.run(`UPDATE users SET role = ? WHERE id = ?`, [role, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, role });
    });
});

// Удалить пользователя
app.delete('/api/admin/users/:userId', authenticateToken, isAdmin, (req, res) => {
    const userId = req.params.userId;
    
    if (userId == req.user.id) {
        return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }
    
    db.run(`DELETE FROM users WHERE id = ?`, [userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ========== МОДЕРАЦИЯ РЕЦЕНЗИЙ ==========
// Удалить рецензию (для модератора и админа)
app.delete('/api/admin/reviews/:reviewId', authenticateToken, isModerator, (req, res) => {
    const reviewId = req.params.reviewId;
    
    db.run(`DELETE FROM reviews WHERE id = ?`, [reviewId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Редактировать трек (для модератора и админа)
app.put('/api/admin/tracks/:trackId', authenticateToken, isModerator, (req, res) => {
    const trackId = req.params.trackId;
    const { title, artist, artwork_url } = req.body;
    
    db.run(`UPDATE tracks SET title = ?, artist = ?, artwork_url = ? WHERE id = ?`,
        [title, artist, artwork_url, trackId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Создать админа, если нет пользователей
db.get(`SELECT COUNT(*) as count FROM users`, [], async (err, row) => {
    if (row && row.count === 0) {
        const adminHash = await bcrypt.hash('admin123', 10);
        db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
            ['admin', 'admin@fostberg.com', adminHash, 'admin']);
        console.log('✅ Админ создан: admin@fostberg.com / admin123');
    }
});
// ========== ТОП ПОЛЬЗОВАТЕЛЕЙ ПО КОЛИЧЕСТВУ РЕЦЕНЗИЙ ==========
app.get('/api/top-users', (req, res) => {
    db.all(`SELECT u.id, u.username, u.avatar, u.avatar_photo, u.role,
                   COUNT(r.id) as reviews_count,
                   SUM(r.likes) as total_likes,
                   AVG((r.rhymes + r.structure + r.style + r.charisma + r.vibe)) as avg_score
            FROM users u
            LEFT JOIN reviews r ON u.id = r.user_id
            GROUP BY u.id
            HAVING reviews_count > 0
            ORDER BY reviews_count DESC
            LIMIT 20`, 
        (err, users) => {
            if (err) {
                console.error('❌ Ошибка top-users:', err.message);
                return res.json([]);
            }
            res.json(users || []);
        });
});

// ========== СЛУЧАЙНЫЙ ТРЕК ==========
app.get('/api/random-track', (req, res) => {
    db.get(`SELECT DISTINCT t.id, t.title, t.artist, t.artwork_url
            FROM tracks t
            INNER JOIN reviews r ON t.id = r.track_id
            ORDER BY RANDOM() 
            LIMIT 1`, 
        (err, track) => {
            if (err || !track) {
                return res.json(null);
            }
            res.json(track);
        });
});

// ========== ВСЕ ОЦЕНЁННЫЕ ТРЕКИ (С ПАГИНАЦИЕЙ) ==========
app.get('/api/all-tracks', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    console.log('📊 Все оценённые треки, страница:', page);
    
    db.get(`SELECT COUNT(DISTINCT t.id) as total
            FROM tracks t
            INNER JOIN reviews r ON t.id = r.track_id`, 
        (err, countResult) => {
            if (err) {
                console.error('❌ Ошибка подсчёта:', err);
                return res.json({ tracks: [], total: 0 });
            }
            
            const total = countResult ? countResult.total : 0;
            console.log('📊 Всего треков с рецензиями:', total);
            
            db.all(`SELECT DISTINCT t.id, t.title, t.artist, t.artwork_url,
                           COUNT(r.id) as reviews_count,
                           AVG((r.rhymes + r.structure + r.style + r.charisma + r.vibe)) as avg_score
                    FROM tracks t
                    INNER JOIN reviews r ON t.id = r.track_id
                    GROUP BY t.id
                    ORDER BY t.id DESC
                    LIMIT ? OFFSET ?`,
                [limit, offset],
                (err, tracks) => {
                    if (err) {
                        console.error('❌ Ошибка получения треков:', err);
                        return res.json({ tracks: [], total: 0 });
                    }
                    console.log('📊 Отправлено треков:', tracks.length);
                    res.json({ tracks: tracks || [], total: total });
                });
        });
});
app.get('/api/test123', (req, res) => {
    res.json({ message: 'Test works!' });
});
// ========== ЗАПУСК СЕРВЕРА ==========
app.listen(PORT, () => {
    console.log(`🚀 Сервер на http://localhost:${PORT}`);
});