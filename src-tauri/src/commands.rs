use crate::db::Pool;
use crate::models::*;
use r2d2_sqlite::rusqlite::{self, params};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};

pub struct AppState {
    pub pool: Pool,
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

// ---------- Subjects ----------

#[tauri::command]
pub fn list_subjects(state: State<AppState>) -> Result<Vec<Subject>, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, color, sort_order, created_at FROM subjects ORDER BY sort_order ASC, created_at ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Subject {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                sort_order: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_subject(state: State<AppState>, name: String) -> Result<Subject, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let id = new_id();
    let now = now_ms();
    let sort_order: i64 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM subjects", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO subjects (id, name, color, sort_order, created_at) VALUES (?1, ?2, NULL, ?3, ?4)",
        params![id, name.trim(), sort_order, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(Subject { id, name: name.trim().to_string(), color: None, sort_order, created_at: now })
}

#[tauri::command]
pub fn rename_subject(state: State<AppState>, id: String, name: String) -> Result<(), String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    conn.execute("UPDATE subjects SET name = ?1 WHERE id = ?2", params![name.trim(), id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_subject(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM subjects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_subject_overview(state: State<AppState>, id: String) -> Result<SubjectOverview, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let subject = conn
        .query_row(
            "SELECT id, name, color, sort_order, created_at FROM subjects WHERE id = ?1",
            params![id],
            |row| {
                Ok(Subject {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    sort_order: row.get(3)?,
                    created_at: row.get(4)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let note_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM notes WHERE subject_id = ?1", params![id], |r| r.get(0))
        .unwrap_or(0);
    let concept_count: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(concept_count), 0) FROM notes WHERE subject_id = ?1",
            params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let question_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM questions q JOIN notes n ON q.note_id = n.id WHERE n.subject_id = ?1",
            params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let task_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks t JOIN notes n ON t.note_id = n.id WHERE n.subject_id = ?1",
            params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(SubjectOverview { subject, note_count, concept_count, question_count, task_count })
}

// ---------- Notes ----------

fn row_to_note_summary(row: &rusqlite::Row) -> rusqlite::Result<NoteSummary> {
    Ok(NoteSummary {
        id: row.get(0)?,
        subject_id: row.get(1)?,
        subject_name: row.get(2)?,
        title: row.get(3)?,
        updated_at: row.get(4)?,
        created_at: row.get(5)?,
        pinned: row.get::<_, i64>(6)? != 0,
    })
}

const NOTE_SUMMARY_SELECT: &str = "SELECT n.id, n.subject_id, s.name, n.title, n.updated_at, n.created_at, n.pinned \
     FROM notes n JOIN subjects s ON n.subject_id = s.id";

#[tauri::command]
pub fn list_recent_notes(state: State<AppState>, limit: i64) -> Result<Vec<NoteSummary>, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let sql = format!("{} ORDER BY n.updated_at DESC LIMIT ?1", NOTE_SUMMARY_SELECT);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit], row_to_note_summary)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_notes_by_subject(state: State<AppState>, subject_id: String) -> Result<Vec<NoteSummary>, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let sql = format!("{} WHERE n.subject_id = ?1 ORDER BY n.pinned DESC, n.updated_at DESC", NOTE_SUMMARY_SELECT);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![subject_id], row_to_note_summary)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_note(state: State<AppState>, id: String) -> Result<Note, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, subject_id, title, content, content_text, concept_count, pinned, created_at, updated_at FROM notes WHERE id = ?1",
        params![id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                subject_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                content_text: row.get(4)?,
                concept_count: row.get(5)?,
                pinned: row.get::<_, i64>(6)? != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note(state: State<AppState>, subject_id: String, title: Option<String>) -> Result<Note, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let id = new_id();
    let now = now_ms();
    let title = title.unwrap_or_default();
    conn.execute(
        "INSERT INTO notes (id, subject_id, title, content, content_text, concept_count, pinned, created_at, updated_at) \
         VALUES (?1, ?2, ?3, '', '', 0, 0, ?4, ?4)",
        params![id, subject_id, title, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(Note {
        id,
        subject_id,
        title,
        content: String::new(),
        content_text: String::new(),
        concept_count: 0,
        pinned: false,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub fn rename_note(state: State<AppState>, id: String, title: String) -> Result<(), String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE notes SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, now_ms(), id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn duplicate_note(state: State<AppState>, id: String) -> Result<Note, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let source = conn.query_row(
        "SELECT subject_id, title, content, content_text, concept_count FROM notes WHERE id = ?1",
        params![id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
            ))
        },
    );
    let (subject_id, title, content, content_text, concept_count) = source.map_err(|e| e.to_string())?;

    let new_id = new_id();
    let now = now_ms();
    let new_title = if title.is_empty() { title.clone() } else { format!("{} copy", title) };
    conn.execute(
        "INSERT INTO notes (id, subject_id, title, content, content_text, concept_count, pinned, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?7)",
        params![new_id, subject_id, new_title, content, content_text, concept_count, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Note {
        id: new_id,
        subject_id,
        title: new_title,
        content,
        content_text,
        concept_count,
        pinned: false,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub fn save_note(state: State<AppState>, payload: SaveNotePayload) -> Result<(), String> {
    let mut conn = state.pool.get().map_err(|e| e.to_string())?;
    let now = now_ms();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE notes SET title = ?1, content = ?2, content_text = ?3, concept_count = ?4, updated_at = ?5 WHERE id = ?6",
        params![payload.title, payload.content, payload.content_text, payload.concept_count, now, payload.id],
    )
    .map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM tasks WHERE note_id = ?1", params![payload.id]).map_err(|e| e.to_string())?;
    for t in &payload.tasks {
        tx.execute(
            "INSERT INTO tasks (id, note_id, text, done, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![new_id(), payload.id, t.text, t.done as i64, now],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute("DELETE FROM questions WHERE note_id = ?1", params![payload.id]).map_err(|e| e.to_string())?;
    for q in &payload.questions {
        tx.execute(
            "INSERT INTO questions (id, note_id, text, done, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![new_id(), payload.id, q.text, q.done as i64, now],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute("DELETE FROM important_markers WHERE note_id = ?1", params![payload.id]).map_err(|e| e.to_string())?;
    for m in &payload.important {
        tx.execute(
            "INSERT INTO important_markers (id, note_id, text, done, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![new_id(), payload.id, m.text, m.done as i64, now],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_note(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_pinned(state: State<AppState>, id: String) -> Result<bool, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    conn.execute("UPDATE notes SET pinned = 1 - pinned WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    let pinned: i64 = conn
        .query_row("SELECT pinned FROM notes WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(pinned != 0)
}

// ---------- Search ----------

#[tauri::command]
pub fn search_notes(state: State<AppState>, query: String) -> Result<Vec<SearchHit>, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }
    let like = format!("%{}%", trimmed.replace('%', "\\%").replace('_', "\\_"));
    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.subject_id, s.name, n.title, n.content_text, n.updated_at \
             FROM notes n JOIN subjects s ON n.subject_id = s.id \
             WHERE n.title LIKE ?1 ESCAPE '\\' OR n.content_text LIKE ?1 ESCAPE '\\' \
             ORDER BY n.updated_at DESC LIMIT 50",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![like], |row| {
            let content_text: String = row.get(4)?;
            let snippet = make_snippet(&content_text, trimmed);
            Ok(SearchHit {
                note_id: row.get(0)?,
                subject_id: row.get(1)?,
                subject_name: row.get(2)?,
                title: row.get(3)?,
                snippet,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn make_snippet(text: &str, query: &str) -> String {
    let lower_query = query.to_lowercase();
    // Search directly in `text` (via char_indices) rather than in a separately
    // lowercased copy: lowercasing can change a character's byte length, which
    // would make a byte offset found in the copy land on a non-char-boundary
    // of `text` and panic when slicing.
    let match_start = text
        .char_indices()
        .find(|(byte_idx, _)| text[*byte_idx..].to_lowercase().starts_with(&lower_query));

    if let Some((pos, _)) = match_start {
        let start = pos.saturating_sub(40);
        let end = (pos + query.len() + 60).min(text.len());
        let start = text.char_indices().find(|(i, _)| *i >= start).map(|(i, _)| i).unwrap_or(0);
        let end = text.char_indices().find(|(i, _)| *i >= end).map(|(i, _)| i).unwrap_or(text.len());
        text[start..end].to_string()
    } else {
        text.chars().take(100).collect()
    }
}

// ---------- Settings ----------

#[tauri::command]
pub fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let result: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = ?1", params![key], |r| r.get(0))
        .ok();
    Ok(result)
}

#[tauri::command]
pub fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------- WPM ----------

#[tauri::command]
pub fn record_wpm_sample(
    state: State<AppState>,
    note_id: Option<String>,
    subject_id: Option<String>,
    wpm: i64,
    char_count: i64,
) -> Result<(), String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO wpm_stats (id, note_id, subject_id, wpm, char_count, recorded_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![new_id(), note_id, subject_id, wpm, char_count, now_ms()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_best_wpm(state: State<AppState>) -> Result<Option<WpmRecord>, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT w.wpm, w.note_id, s.name, w.recorded_at \
         FROM wpm_stats w LEFT JOIN notes n ON w.note_id = n.id LEFT JOIN subjects s ON n.subject_id = s.id \
         ORDER BY w.wpm DESC LIMIT 1",
        [],
        |row| {
            Ok(WpmRecord {
                wpm: row.get(0)?,
                note_id: row.get(1)?,
                subject_name: row.get(2)?,
                recorded_at: row.get(3)?,
            })
        },
    );
    Ok(result.ok())
}

#[derive(serde::Serialize)]
pub struct SessionStats {
    pub average: i64,
    pub peak: i64,
    pub samples: i64,
    pub total_chars: i64,
}

#[tauri::command]
pub fn get_session_stats(state: State<AppState>, since_ms: i64) -> Result<SessionStats, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    // char_count is a per-sample running total (not a delta), so the session's
    // total characters typed is its max within the window, not its sum.
    let row = conn.query_row(
        "SELECT COALESCE(AVG(wpm), 0), COALESCE(MAX(wpm), 0), COUNT(*), COALESCE(MAX(char_count), 0) \
         FROM wpm_stats WHERE recorded_at >= ?1",
        params![since_ms],
        |row| {
            let avg: f64 = row.get(0)?;
            let peak: i64 = row.get(1)?;
            let samples: i64 = row.get(2)?;
            let total_chars: i64 = row.get(3)?;
            Ok(SessionStats { average: avg.round() as i64, peak, samples, total_chars })
        },
    );
    row.map_err(|e| e.to_string())
}

// ---------- Export ----------

#[tauri::command]
pub fn export_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

// ---------- Window ----------

/// Syncs the native title bar (DWM immersive dark mode on Windows) with notita's theme.
#[tauri::command]
pub fn set_window_theme(window: tauri::Window, theme: String) -> Result<(), String> {
    let theme = match theme.as_str() {
        "dark" => Some(tauri::Theme::Dark),
        "light" => Some(tauri::Theme::Light),
        _ => None,
    };
    window.set_theme(theme).map_err(|e| e.to_string())
}

// ---------- Diagnostics ----------

/// Appends a frontend error (uncaught exception / unhandled rejection) to a
/// local log file, so issues can be diagnosed from a machine we can't watch
/// live.
#[tauri::command]
pub fn log_client_error(app: tauri::AppHandle, message: String) -> Result<(), String> {
    use std::io::Write;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("client-errors.log");
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "[{}] {}", now_ms(), message).map_err(|e| e.to_string())?;
    Ok(())
}
