use crate::config;
use crate::daemon_supervisor::{self, DaemonStatus};
use crate::external_url;
use crate::master_key;
use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
pub struct CommandError {
    code: &'static str,
    message: String,
}

impl CommandError {
    fn external_daemon() -> Self {
        Self {
            code: "external_daemon",
            message: "Daemon is managed by the dev watch process".into(),
        }
    }

    fn internal(err: impl std::fmt::Display) -> Self {
        Self {
            code: "internal",
            message: err.to_string(),
        }
    }
}

impl From<anyhow::Error> for CommandError {
    fn from(err: anyhow::Error) -> Self {
        Self::internal(err)
    }
}

impl From<external_url::ExternalUrlError> for CommandError {
    fn from(err: external_url::ExternalUrlError) -> Self {
        Self {
            code: err.code(),
            message: err.to_string(),
        }
    }
}

pub type CommandResult<T> = Result<T, CommandError>;

#[derive(Debug, Serialize)]
pub struct SaveServerLogsResult {
    path: String,
    bytes: usize,
    lines: usize,
}

#[derive(Debug, Serialize)]
pub struct SaveSessionJsonResult {
    path: String,
    bytes: usize,
}

#[tauri::command]
pub async fn start_daemon(app: AppHandle) -> CommandResult<u32> {
    if config::uses_external_daemon() {
        return Err(CommandError::external_daemon());
    }

    let key = master_key::get_or_create_hex()?;
    daemon_supervisor::get(&app)
        .start(&app, &key)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn stop_daemon(app: AppHandle) -> CommandResult<()> {
    if config::uses_external_daemon() {
        return Err(CommandError::external_daemon());
    }

    daemon_supervisor::get(&app)
        .stop()
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn daemon_status(app: AppHandle) -> DaemonStatus {
    daemon_supervisor::get(&app).status().await
}

#[tauri::command]
pub async fn open_url(app: AppHandle, url: String) -> CommandResult<()> {
    external_url::open(&app, &url).await.map_err(Into::into)
}

#[tauri::command]
pub async fn save_server_logs(
    app: AppHandle,
    file_name: String,
    lines: Vec<String>,
) -> CommandResult<SaveServerLogsResult> {
    let mut path = app.path().download_dir().map_err(CommandError::internal)?;
    let safe_name = sanitize_file_name(&file_name, "server-logs.log", ".log");
    let contents = lines.join("\n");
    let bytes = contents.len();
    let line_count = lines.len();

    path.push(safe_name);
    std::fs::write(&path, contents).map_err(CommandError::internal)?;

    Ok(SaveServerLogsResult {
        path: path.to_string_lossy().into_owned(),
        bytes,
        lines: line_count,
    })
}

#[tauri::command]
pub async fn save_session_json(
    app: AppHandle,
    file_name: String,
    contents: String,
) -> CommandResult<SaveSessionJsonResult> {
    let mut path = app.path().download_dir().map_err(CommandError::internal)?;
    let safe_name = sanitize_file_name(&file_name, "session.json", ".json");
    let bytes = contents.len();

    path.push(safe_name);
    std::fs::write(&path, contents).map_err(CommandError::internal)?;

    Ok(SaveSessionJsonResult {
        path: path.to_string_lossy().into_owned(),
        bytes,
    })
}

fn sanitize_file_name(file_name: &str, fallback: &str, extension: &str) -> String {
    let sanitized: String = file_name
        .chars()
        .map(|ch| match ch {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' => ch,
            _ => '-',
        })
        .collect();

    let trimmed = sanitized.trim_matches(['-', '.']).to_string();
    if trimmed.is_empty() || !trimmed.ends_with(extension) {
        fallback.into()
    } else {
        trimmed
    }
}
