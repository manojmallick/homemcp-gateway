/** Self-contained HTML demo UI for recording / walkthroughs */

export function demoPageHtml(basePath = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HomeMCP Gateway — Demo</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1020;
      --panel: #141c2e;
      --border: #2a3650;
      --text: #e8eefc;
      --muted: #8b9bb8;
      --ok: #34d399;
      --warn: #fbbf24;
      --bad: #f87171;
      --accent: #60a5fa;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: ui-sans-serif, system-ui, sans-serif;
      background: radial-gradient(ellipse 80% 50% at 50% -20%, #1e3a5f55, transparent), var(--bg);
      color: var(--text); min-height: 100vh; padding: 1.25rem;
    }
    .wrap { max-width: 920px; margin: 0 auto; }
    h1 { margin: 0 0 0.25rem; font-size: 1.6rem; letter-spacing: -0.03em; }
    h1 span { color: var(--accent); }
    .tag { color: var(--muted); margin: 0 0 1.25rem; }
    .grid { display: grid; gap: 0.75rem; grid-template-columns: 1fr 1fr; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 14px; padding: 1rem;
    }
    .card h2 { margin: 0 0 0.5rem; font-size: 0.95rem; color: var(--accent); }
    .row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.65rem; }
    button {
      font: inherit; cursor: pointer; border-radius: 10px; border: 1px solid var(--border);
      background: #1a2438; color: var(--text); padding: 0.5rem 0.75rem; font-weight: 600;
    }
    button.primary { background: linear-gradient(135deg, #2563eb, #7c3aed); border-color: transparent; }
    button.danger { background: #3f1d1d; border-color: #7f1d1d; color: #fecaca; }
    pre {
      margin: 0; background: #0a0e18; border-radius: 10px; padding: 0.75rem;
      overflow: auto; font-size: 0.78rem; line-height: 1.4; max-height: 280px;
      border: 1px solid var(--border); white-space: pre-wrap; word-break: break-word;
    }
    .pill {
      display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px;
      font-size: 0.75rem; font-weight: 700; background: #1e293b; color: var(--muted);
    }
    .pill.ok { color: var(--ok); background: #064e3b55; }
    .pill.warn { color: var(--warn); background: #78350f55; }
    .pill.bad { color: var(--bad); background: #7f1d1d55; }
    .steps { color: var(--muted); font-size: 0.85rem; line-height: 1.5; margin: 0 0 1rem; }
    .steps strong { color: var(--text); }
    footer { margin-top: 1.25rem; color: var(--muted); font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Home<span>MCP</span> Gateway</h1>
    <p class="tag">Demo console — permissions · dry-run · audit · optional live hass-ts</p>
    <p class="steps">
      <strong>1.</strong> Check health ·
      <strong>2.</strong> Dry-run a light turn-on ·
      <strong>3.</strong> Try a denied lock ·
      <strong>4.</strong> Open audit log ·
      <strong>5.</strong> (Optional) set <code>HASS_URL</code>/<code>HASS_TOKEN</code> for live mode
    </p>

    <div class="row">
      <span class="pill" id="mode">mode: …</span>
      <span class="pill" id="status">status: …</span>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Actions</h2>
        <div class="row">
          <button class="primary" id="btn-health">1. Health</button>
          <button id="btn-tools">List tools</button>
          <button id="btn-dry">2. Dry-run light.turn_on</button>
          <button class="danger" id="btn-deny">3. Deny lock unlock</button>
          <button id="btn-audit">4. Audit log</button>
          <button id="btn-live">Execute (respect dry-run policy)</button>
        </div>
        <p class="steps" style="margin:0">Default policy: lights/switches writable, sensors read-only, <strong>locks blocked</strong>. Dry-run defaults <strong>on</strong>.</p>
      </div>
      <div class="card">
        <h2>Response</h2>
        <pre id="out">Click an action…</pre>
      </div>
    </div>

    <footer>
      Stack A: hass-ts → HomeMCP → MCPGate · See DEMO.md · ${basePath || "local"}
    </footer>
  </div>
  <script>
    const out = document.getElementById('out');
    const modeEl = document.getElementById('mode');
    const statusEl = document.getElementById('status');

    function show(data) {
      out.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }

    async function api(path, opts) {
      const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(opts && opts.headers) },
        ...opts,
      });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      return { status: res.status, body };
    }

    async function refreshHealth() {
      const { body } = await api('/health');
      modeEl.textContent = 'mode: ' + (body.haMode || '?');
      modeEl.className = 'pill ' + (body.haMode === 'live' ? 'ok' : 'warn');
      statusEl.textContent = 'status: ' + (body.status || '?');
      statusEl.className = 'pill ok';
      return body;
    }

    document.getElementById('btn-health').onclick = async () => {
      show(await refreshHealth());
    };
    document.getElementById('btn-tools').onclick = async () => {
      show((await api('/v1/tools')).body);
    };
    document.getElementById('btn-dry').onclick = async () => {
      show((await api('/v1/tools/call', {
        method: 'POST',
        body: JSON.stringify({
          tool: 'ha_light_control',
          entity_id: 'light.kitchen',
          action: 'turn_on',
          brightness_pct: 40,
          dryRun: true,
        }),
      })).body);
    };
    document.getElementById('btn-deny').onclick = async () => {
      show((await api('/v1/tools/call', {
        method: 'POST',
        body: JSON.stringify({
          tool: 'ha_call_service',
          domain: 'lock',
          service: 'unlock',
          entity_id: 'lock.front_door',
          dryRun: false,
        }),
      })).body);
    };
    document.getElementById('btn-audit').onclick = async () => {
      show((await api('/v1/audit')).body);
    };
    document.getElementById('btn-live').onclick = async () => {
      show((await api('/v1/tools/call', {
        method: 'POST',
        body: JSON.stringify({
          tool: 'ha_light_control',
          entity_id: 'light.kitchen',
          action: 'toggle',
          dryRun: false,
        }),
      })).body);
    };

    refreshHealth().then((b) => show({ ready: true, ...b })).catch((e) => show(String(e)));
  </script>
</body>
</html>`;
}
