const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'fostberg.db'));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT DEFAULT '👤',
        avatar_photo TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sc_id TEXT UNIQUE,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        artwork_url TEXT,
        duration INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        track_id INTEGER NOT NULL,
        rhymes INTEGER CHECK(rhymes >= 1 AND rhymes <= 10),
        structure INTEGER CHECK(structure >= 1 AND structure <= 10),
        style INTEGER CHECK(style >= 1 AND style <= 10),
        charisma INTEGER CHECK(charisma >= 1 AND charisma <= 10),
        vibe INTEGER CHECK(vibe >= 1 AND vibe <= 10),
        text TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS track_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    suggested_title TEXT,
    suggested_artist TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_likes (
        user_id INTEGER NOT NULL,
        review_id INTEGER NOT NULL,
        PRIMARY KEY (user_id, review_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
    )`);
    
    // Создание таблицы предложений (если нет)
db.run(`CREATE TABLE IF NOT EXISTS track_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    suggested_title TEXT,
    suggested_artist TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`, (err) => {
    if (err) console.error('❌ Ошибка создания track_suggestions:', err);
    else console.log('✅ Таблица track_suggestions создана');
});
    console.log('✅ База данных готова');
});

module.exports = db;