// Owns the lifecycle of the daemon sidecar process. Spawn / kill / status,
// guarded by an async mutex so concurrent Tauri commands can't race.

use crate::config::SECRET_KEY_ENV;
use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;

const SIDECAR_NAME: &str = "claude-code-provider-gateway-daemon";

/// Enough stderr to explain a startup crash, bounded so a chatty daemon can't
/// grow this without limit.
const STDERR_KEEP_LINES: usize = 20;
const READY_TIMEOUT: Duration = Duration::from_secs(30);
const READY_POLL: Duration = Duration::from_millis(100);

#[derive(Default)]
struct Diagnostics {
    stderr: VecDeque<String>,
    last_error: Option<String>,
}

#[derive(Default)]
struct SupervisorState {
    child: Mutex<Option<CommandChild>>,
    diag: Mutex<Diagnostics>,
    /// Serializes start attempts. Kept separate from `child` because `start`
    /// awaits readiness, and the exit watcher needs the `child` lock during
    /// that window to clear a process that died on us.
    start_lock: Mutex<()>,
}

#[derive(Default)]
pub struct DaemonSupervisor {
    state: Arc<SupervisorState>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DaemonStatus {
    pub running: bool,
    pub pid: Option<u32>,
    /// Why the daemon is not running, when we know. Lets the panel show the
    /// real reason instead of the webview's generic fetch failure.
    pub last_error: Option<String>,
}

impl DaemonSupervisor {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub async fn start(&self, app: &AppHandle, master_key_hex: &str) -> Result<u32> {
        let _serialized = self.state.start_lock.lock().await;

        if let Some(pid) = self.state.child.lock().await.as_ref().map(|c| c.pid()) {
            return Ok(pid);
        }

        // A previous tauri dev that died without a clean ExitRequested can
        // leave the daemon running and holding port 6767. The new sidecar
        // would then crash with EADDRINUSE and the panel would silently talk
        // to the stale (old-code) daemon. Sweep before we spawn. This also
        // deletes the PID file, so the readiness wait below cannot be fooled
        // by a leftover one.
        tauri::async_runtime::spawn_blocking(kill_stale_daemon)
            .await
            .context("stale daemon cleanup task failed")?;

        {
            let mut diag = self.state.diag.lock().await;
            diag.stderr.clear();
            diag.last_error = None;
        }

        let sidecar = app
            .shell()
            .sidecar(SIDECAR_NAME)
            .context("sidecar binary not declared in tauri.conf.json")?
            .env(SECRET_KEY_ENV, master_key_hex);

        let (mut rx, child) = sidecar.spawn().context("failed to spawn daemon sidecar")?;

        let pid = child.pid();
        *self.state.child.lock().await = Some(child);

        // Drain stdout/stderr so the daemon doesn't block on a full pipe, and
        // keep the tail of stderr so an early exit can be explained.
        let watcher = self.state.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        log::info!("[daemon] {}", String::from_utf8_lossy(&line).trim_end())
                    }
                    CommandEvent::Stderr(line) => {
                        let text = String::from_utf8_lossy(&line).trim_end().to_string();
                        log::warn!("[daemon] {text}");
                        if !text.is_empty() {
                            let mut diag = watcher.diag.lock().await;
                            while diag.stderr.len() >= STDERR_KEEP_LINES {
                                diag.stderr.pop_front();
                            }
                            diag.stderr.push_back(text);
                        }
                    }
                    CommandEvent::Error(err) => {
                        log::error!("[daemon] error: {err}");
                        let mut diag = watcher.diag.lock().await;
                        if diag.last_error.is_none() {
                            diag.last_error = Some(err.to_string());
                        }
                    }
                    CommandEvent::Terminated(payload) => {
                        log::info!("[daemon] exited code={:?}", payload.code);
                        reap(&watcher, pid, payload.code).await;
                        break;
                    }
                    _ => {}
                }
            }
        });

        self.await_ready(pid).await?;
        Ok(pid)
    }

    /// Resolves once the daemon proves it is serving, or errors out. The
    /// daemon writes its PID file only after *both* the proxy and the panel
    /// report listening, so a PID file holding this child's pid is proof that
    /// startup completed — not merely that `spawn` succeeded.
    async fn await_ready(&self, pid: u32) -> Result<()> {
        let deadline = Instant::now() + READY_TIMEOUT;

        loop {
            if pid_file_matches(pid) {
                return Ok(());
            }

            // The watcher clears `child` on exit, so this means it died.
            if self.state.child.lock().await.is_none() {
                let reason = self.state.diag.lock().await.last_error.clone();
                return Err(anyhow!(
                    reason.unwrap_or_else(|| "daemon exited during startup".to_string())
                ));
            }

            if Instant::now() >= deadline {
                let message = {
                    let mut diag = self.state.diag.lock().await;
                    let mut message = format!(
                        "daemon did not finish starting within {}s",
                        READY_TIMEOUT.as_secs()
                    );
                    if let Some(tail) = join_stderr(&diag.stderr) {
                        message.push_str(&format!(": {tail}"));
                    }
                    // Claim the error slot before the kill so `reap` keeps
                    // this more specific reason.
                    diag.last_error = Some(message.clone());
                    message
                };

                // Don't leave a wedged process holding the ports; a retry
                // needs them free.
                if let Some(child) = self.state.child.lock().await.take() {
                    let _ = child.kill();
                }

                return Err(anyhow!(message));
            }

            tokio::time::sleep(READY_POLL).await;
        }
    }

    pub async fn stop(&self) -> Result<()> {
        let mut guard = self.state.child.lock().await;
        let Some(child) = guard.take() else {
            return Ok(());
        };

        self.state.diag.lock().await.last_error = None;

        child.kill().map_err(|e| anyhow!("kill failed: {e}"))?;
        Ok(())
    }

    pub async fn status(&self) -> DaemonStatus {
        let pid = self.state.child.lock().await.as_ref().map(|c| c.pid());
        let last_error = self.state.diag.lock().await.last_error.clone();
        DaemonStatus {
            running: pid.is_some(),
            pid,
            last_error,
        }
    }
}

/// Drops the handle of an exited process and records why it went away.
async fn reap(state: &SupervisorState, pid: u32, code: Option<i32>) {
    // Only act if the handle is still *this* process. `stop` and the
    // readiness timeout take the handle first and own their diagnostics;
    // a late event from an old child must not touch the current state.
    let mut guard = state.child.lock().await;
    if guard.as_ref().map(|c| c.pid()) != Some(pid) {
        return;
    }
    // Record the reason before `child` is observably cleared, so
    // `await_ready` never sees the exit without it.
    let mut diag = state.diag.lock().await;
    guard.take();

    // A more specific reason (spawn error, readiness timeout) wins.
    if diag.last_error.is_some() {
        return;
    }

    let mut message = match code {
        Some(code) => format!("daemon exited unexpectedly (code {code})"),
        None => "daemon was terminated unexpectedly".to_string(),
    };
    if let Some(tail) = join_stderr(&diag.stderr) {
        message.push_str(&format!(": {tail}"));
    }
    diag.last_error = Some(message);
}

fn join_stderr(lines: &VecDeque<String>) -> Option<String> {
    if lines.is_empty() {
        return None;
    }
    Some(
        lines
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .join(" | "),
    )
}

pub fn get(app: &AppHandle) -> Arc<DaemonSupervisor> {
    app.state::<Arc<DaemonSupervisor>>().inner().clone()
}

/// Mirrors the daemon's own `getConfigDir()`, including the CCPG_CONFIG_DIR
/// override — otherwise the readiness wait would watch the wrong path.
fn config_dir() -> Option<PathBuf> {
    match std::env::var("CCPG_CONFIG_DIR") {
        Ok(dir) if !dir.is_empty() => return Some(PathBuf::from(dir)),
        _ => {}
    }

    let base = if cfg!(windows) {
        PathBuf::from(std::env::var("APPDATA").ok()?)
    } else {
        PathBuf::from(std::env::var("HOME").ok()?).join(".config")
    };
    Some(base.join("claude-code-provider-gateway"))
}

fn pid_file_path() -> Option<PathBuf> {
    Some(config_dir()?.join("daemon.pid"))
}

fn pid_file_matches(pid: u32) -> bool {
    let Some(path) = pid_file_path() else {
        return false;
    };
    let Ok(content) = std::fs::read_to_string(&path) else {
        return false;
    };
    content.trim().parse::<u32>().ok() == Some(pid)
}

fn kill_stale_daemon() {
    let Some(path) = pid_file_path() else {
        return;
    };
    let Ok(content) = std::fs::read_to_string(&path) else {
        return;
    };
    let Ok(pid) = content.trim().parse::<u32>() else {
        return;
    };
    if pid == 0 {
        return;
    }

    log::warn!("found stale daemon pid={pid}, terminating");

    #[cfg(unix)]
    {
        let pid_str = pid.to_string();
        let _ = std::process::Command::new("kill")
            .args(["-TERM", &pid_str])
            .status();
        // Give it half a second to exit gracefully, then force.
        std::thread::sleep(std::time::Duration::from_millis(500));
        let _ = std::process::Command::new("kill")
            .args(["-KILL", &pid_str])
            .status();
    }

    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output();
        std::thread::sleep(std::time::Duration::from_millis(200));
    }

    let _ = std::fs::remove_file(&path);
}
