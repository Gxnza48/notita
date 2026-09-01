use r2d2_sqlite::SqliteConnectionManager;
use std::path::PathBuf;

pub type Pool = r2d2::Pool<SqliteConnectionManager>;

const CONNECTION_PRAGMAS: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
"#;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    content_text TEXT NOT NULL DEFAULT '',
    concept_count INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_subject ON notes(subject_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_note ON tasks(note_id);

CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_note ON questions(note_id);

CREATE TABLE IF NOT EXISTS important_markers (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_important_note ON important_markers(note_id);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wpm_stats (
    id TEXT PRIMARY KEY,
    note_id TEXT,
    subject_id TEXT,
    wpm INTEGER NOT NULL,
    char_count INTEGER NOT NULL,
    recorded_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wpm_recorded ON wpm_stats(recorded_at DESC);
"#;

fn db_path(app_data_dir: &std::path::Path) -> PathBuf {
    app_data_dir.join("notita.db")
}

pub fn init_pool(app_data_dir: &std::path::Path) -> Pool {
    std::fs::create_dir_all(app_data_dir).expect("failed to create app data dir");
    // `PRAGMA foreign_keys` (and journal_mode/synchronous) are per-connection
    // settings, not persisted in the database file — with_init re-applies them
    // to every connection the pool hands out, not just the first one, so that
    // ON DELETE CASCADE actually fires regardless of which pooled connection
    // performs the delete.
    let manager = SqliteConnectionManager::file(db_path(app_data_dir))
        .with_init(|conn| conn.execute_batch(CONNECTION_PRAGMAS));
    let pool = r2d2::Pool::builder()
        .max_size(4)
        .build(manager)
        .expect("failed to build sqlite pool");

    {
        let conn = pool.get().expect("failed to get connection for migration");
        conn.execute_batch(SCHEMA).expect("failed to run migrations");
    }

    pool
}
