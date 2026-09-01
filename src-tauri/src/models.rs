use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subject {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectOverview {
    pub subject: Subject,
    pub note_count: i64,
    pub concept_count: i64,
    pub question_count: i64,
    pub task_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub subject_id: String,
    pub title: String,
    pub content: String,
    pub content_text: String,
    pub concept_count: i64,
    pub pinned: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteSummary {
    pub id: String,
    pub subject_id: String,
    pub subject_name: String,
    pub title: String,
    pub updated_at: i64,
    pub created_at: i64,
    pub pinned: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MarkerInput {
    pub text: String,
    #[serde(default)]
    pub done: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SaveNotePayload {
    pub id: String,
    pub title: String,
    pub content: String,
    pub content_text: String,
    pub concept_count: i64,
    #[serde(default)]
    pub tasks: Vec<MarkerInput>,
    #[serde(default)]
    pub questions: Vec<MarkerInput>,
    #[serde(default)]
    pub important: Vec<MarkerInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit {
    pub note_id: String,
    pub subject_id: String,
    pub subject_name: String,
    pub title: String,
    pub snippet: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WpmRecord {
    pub wpm: i64,
    pub note_id: Option<String>,
    pub subject_name: Option<String>,
    pub recorded_at: i64,
}
