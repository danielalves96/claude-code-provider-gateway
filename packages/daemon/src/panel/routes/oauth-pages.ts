const BASE_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    background: #262624;
    color: #f1f1ef;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    background: #2c2c2b;
    border: 1px solid #3e3e38;
    border-radius: 20px;
    padding: 48px 56px;
    max-width: 440px;
    width: 90vw;
    text-align: center;
    box-shadow: 0 24px 64px rgba(0,0,0,.45);
    animation: slide-up 0.35s cubic-bezier(.16,1,.3,1) both;
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .wordmark {
    font-size: 13px;
    font-weight: 500;
    color: #83827d;
    letter-spacing: .08em;
    text-transform: uppercase;
    margin-bottom: 32px;
  }
  .wordmark span {
    color: #FF6C2D;
  }
  .icon-wrap {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 28px;
    animation: pop 0.4s cubic-bezier(.16,1,.3,1) 0.15s both;
  }
  @keyframes pop {
    from { opacity: 0; transform: scale(.5); }
    to   { opacity: 1; transform: scale(1); }
  }
  .icon-wrap.success { background: rgba(127,176,105,.12); border: 1.5px solid rgba(127,176,105,.3); }
  .icon-wrap.error   { background: rgba(239,68,68,.10);  border: 1.5px solid rgba(239,68,68,.28);  }
  .icon-wrap svg { width: 36px; height: 36px; }
  h1 { font-size: 22px; font-weight: 600; margin-bottom: 10px; }
  p  { font-size: 15px; color: #c3c0b6; line-height: 1.55; }
  .hint {
    margin-top: 32px;
    font-size: 13px;
    color: #52514a;
  }
  .provider-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #1b1b19;
    border: 1px solid #3e3e38;
    border-radius: 99px;
    padding: 5px 14px;
    font-size: 13px;
    color: #b7b5a9;
    margin-bottom: 24px;
  }
  .dot {
    width: 7px; height: 7px;
    border-radius: 50%;
  }
  .dot.success { background: #7fb069; box-shadow: 0 0 6px #7fb069; }
  .dot.error   { background: #ef4444; box-shadow: 0 0 6px #ef4444; }
`;

function shell(body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Claude Code Gateway</title>
  <style>${BASE_STYLES}</style>
</head>
<body>${body}</body>
</html>`;
}

export function oauthSuccessPage(provider: string): string {
  const providerLabel = escapeHtml(provider);
  return shell(`
  <div class="card">
    <div class="wordmark">Claude Code <span>Gateway</span></div>
    <div class="icon-wrap success">
      <svg viewBox="0 0 24 24" fill="none" stroke="#7fb069" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5"/>
      </svg>
    </div>
    <div class="provider-badge">
      <span class="dot success"></span>
      ${providerLabel}
    </div>
    <h1>Connected successfully</h1>
    <p>Your account is now linked. You can close this tab and return to the gateway.</p>
    <div class="hint">This window can be safely closed.</div>
  </div>
  <script>setTimeout(() => window.close(), 4000)</script>
`);
}

export function oauthErrorPage(provider: string, message?: string): string {
  const providerLabel = escapeHtml(provider);
  const detail = message ?? "An unexpected error occurred during authentication.";
  return shell(`
  <div class="card">
    <div class="wordmark">Claude Code <span>Gateway</span></div>
    <div class="icon-wrap error">
      <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </div>
    <div class="provider-badge">
      <span class="dot error"></span>
      ${providerLabel}
    </div>
    <h1>Connection failed</h1>
    <p>${escapeHtml(detail)}</p>
    <div class="hint">Return to the gateway and try again.</div>
  </div>
`);
}

export function oauthBadRequestPage(): string {
  return shell(`
  <div class="card">
    <div class="wordmark">Claude Code <span>Gateway</span></div>
    <div class="icon-wrap error">
      <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      </svg>
    </div>
    <h1>Invalid request</h1>
    <p>Invalid OAuth state or missing authorization code.</p>
    <div class="hint">Return to the gateway and try again.</div>
  </div>
`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
