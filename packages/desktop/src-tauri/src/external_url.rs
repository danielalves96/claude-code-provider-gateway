use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use thiserror::Error;
use url::Url;

const ALLOWED_EXTERNAL_URL_HOSTS: &[&str] = &[
    "aistudio.google.com",
    "api.together.ai",
    "app.hyperbolic.xyz",
    "auth.openai.com",
    "api.cline.bot",
    "bailian.console.alibabacloud.com",
    "bailian.console.aliyun.com",
    "bigmodel.cn",
    "build.nvidia.com",
    "chutes.ai",
    "cloud.cerebras.ai",
    "cloud.siliconflow.cn",
    "commandcode.ai",
    "console.byteplus.com",
    "console.groq.com",
    "console.mistral.ai",
    "console.volcengine.com",
    "console.x.ai",
    "dashboard.cohere.com",
    "fireworks.ai",
    "github.com",
    "huggingface.co",
    "ollama.com",
    "opencode.ai",
    "openrouter.ai",
    "platform.deepseek.com",
    "platform.mimodel.ai",
    "platform.minimaxi.com",
    "platform.moonshot.ai",
    "studio.nebius.com",
    "www.blackbox.ai",
    "www.perplexity.ai",
    "z.ai",
];

#[derive(Debug, Error)]
pub enum ExternalUrlError {
    #[error("Invalid URL")]
    InvalidUrl,
    #[error("Only https:// URLs can be opened externally")]
    UnsupportedScheme,
    #[error("URL host is required")]
    MissingHost,
    #[error("External URL host is not allowed: {0}")]
    HostNotAllowed(String),
    #[error("Failed to open external URL: {0}")]
    OpenFailed(String),
}

impl ExternalUrlError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidUrl => "invalid_url",
            Self::UnsupportedScheme => "unsupported_scheme",
            Self::MissingHost => "missing_host",
            Self::HostNotAllowed(_) => "host_not_allowed",
            Self::OpenFailed(_) => "open_failed",
        }
    }
}

#[allow(deprecated)]
pub async fn open(app: &AppHandle, raw: &str) -> Result<(), ExternalUrlError> {
    validate(raw)?;
    app.shell()
        .open(raw, None)
        .map_err(|err| ExternalUrlError::OpenFailed(err.to_string()))?;

    activate_browser_window().await;

    Ok(())
}

pub fn validate(raw: &str) -> Result<(), ExternalUrlError> {
    let parsed = Url::parse(raw).map_err(|_| ExternalUrlError::InvalidUrl)?;
    if parsed.scheme() != "https" {
        return Err(ExternalUrlError::UnsupportedScheme);
    }

    let host = parsed.host_str().ok_or(ExternalUrlError::MissingHost)?;
    if !ALLOWED_EXTERNAL_URL_HOSTS.contains(&host) {
        return Err(ExternalUrlError::HostNotAllowed(host.to_string()));
    }

    Ok(())
}

#[cfg(target_os = "linux")]
async fn activate_browser_window() {
    tokio::time::sleep(std::time::Duration::from_millis(400)).await;
    // Optional desktop nicety: xdotool/wmctrl may not be installed, and either
    // failure mode should never fail the URL open command.
    let _ = std::process::Command::new("sh")
        .arg("-c")
        .arg(concat!(
            "xdotool search --classname 'Navigator' 2>/dev/null | head -1 | xargs -r xdotool windowactivate 2>/dev/null || ",
            "xdotool search --class 'Chromium'      2>/dev/null | head -1 | xargs -r xdotool windowactivate 2>/dev/null || ",
            "xdotool search --class 'google-chrome' 2>/dev/null | head -1 | xargs -r xdotool windowactivate 2>/dev/null || ",
            "wmctrl -a 'Firefox'      2>/dev/null || ",
            "wmctrl -a 'Chromium'     2>/dev/null || ",
            "wmctrl -a 'Google Chrome' 2>/dev/null || true"
        ))
        .spawn();
}

#[cfg(not(target_os = "linux"))]
async fn activate_browser_window() {}

#[cfg(test)]
mod tests {
    use super::validate;

    #[test]
    fn allows_known_external_hosts_over_https() {
        assert!(validate("https://github.com/danielalves96/claude-code-provider-gateway").is_ok());
        assert!(validate("https://github.com/login/device").is_ok());
        assert!(validate("https://auth.openai.com/oauth/authorize?state=abc").is_ok());
        assert!(validate("https://api.cline.bot/api/v1/auth/authorize").is_ok());
        assert!(validate("https://commandcode.ai/studio").is_ok());
        assert!(validate("https://openrouter.ai/settings/keys").is_ok());
        assert!(validate("https://console.groq.com/keys").is_ok());
    }

    #[test]
    fn rejects_non_https_urls() {
        assert!(validate("http://github.com/login/device").is_err());
        assert!(validate("javascript:alert(1)").is_err());
        assert!(validate("file:///tmp/test").is_err());
    }

    #[test]
    fn rejects_unlisted_or_lookalike_hosts() {
        assert!(validate("https://example.com").is_err());
        assert!(validate("https://github.com.evil.test/login/device").is_err());
        assert!(validate("https://evil.test/?next=https://github.com").is_err());
    }
}
