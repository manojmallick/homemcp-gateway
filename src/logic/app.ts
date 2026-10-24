import { Hono } from "hono";
import { demoPageHtml } from "./demo-page.js";
import { loadHaMode, type HaMode } from "./ha-client.js";
import { readJsonFile, writeJsonFile } from "./persist.js";

/**
 * HomeMCP Gateway — firewall between LLMs and Home Assistant.
 * Pairs with hass-ts: when HASS_URL + HASS_TOKEN are set, tool calls can execute live
 * (still gated by policy + dry-run).
 */

export const app = new Hono();

type Perm = "read" | "write" | "none";

interface Policy {
  agentId: string;
  entities: Record<string, Perm>;
  dryRunDefault: boolean;
}

interface AuditRow {
  id: string;
  at: string;
  agentId: string;
  tool: string;
  entityId?: string;
  dryRun: boolean;
  allowed: boolean;
  detail: string;
}

const DEFAULT_POLICIES: Policy[] = [
  {
    agentId: "default",
    entities: {
      "light.*": "write",
      "switch.*": "write",
      "sensor.*": "read",
      "lock.*": "none",
      "alarm_control_panel.*": "none",
    },
    dryRunDefault: true,
  },
];

let policies: Policy[] = [...DEFAULT_POLICIES];
const audit: AuditRow[] = [];
let haMode: HaMode = { kind: "stub" };
let haReady: Promise<void> | null = null;
let dataReady: Promise<void> | null = null;

function ensureData() {
  if (!dataReady) {
    dataReady = (async () => {
      policies = await readJsonFile("policies.json", DEFAULT_POLICIES);
      const savedAudit = await readJsonFile<AuditRow[]>("audit.json", []);
      audit.splice(0, audit.length, ...savedAudit.slice(0, 200));
    })();
  }
  return dataReady;
}

function ensureHa() {
  if (!haReady) {
    haReady = loadHaMode().then((m) => {
      haMode = m;
    });
  }
  return haReady;
}

async function ensureAll() {
  await Promise.all([ensureData(), ensureHa()]);
}

function matchPerm(entityId: string, policy: Policy): Perm {
  if (!entityId) return "read";
  const domain = entityId.split(".")[0] + ".*";
  return policy.entities[entityId] ?? policy.entities[domain] ?? "none";
}

function pushAudit(row: Omit<AuditRow, "id" | "at">) {
  audit.unshift({
    id: `a_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    ...row,
  });
  if (audit.length > 200) audit.length = 200;
  void writeJsonFile("audit.json", audit);
}

const FALLBACK_TOOLS = [
  {
    name: "ha_list_entities",
    description: "List entities (optional domain filter)",
    inputSchema: {
      type: "object",
      properties: { domain: { type: "string" } },
    },
  },
  {
    name: "ha_get_state",
    description: "Get entity state",
    inputSchema: {
      type: "object",
      properties: { entity_id: { type: "string" } },
      required: ["entity_id"],
    },
  },
  {
    name: "ha_call_service",
    description: "Call HA service",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        service: { type: "string" },
        entity_id: { type: "string" },
        service_data: { type: "object" },
      },
      required: ["domain", "service"],
    },
  },
  {
    name: "ha_light_control",
    description: "Control a light",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string" },
        action: { type: "string", enum: ["turn_on", "turn_off", "toggle"] },
        brightness_pct: { type: "number" },
      },
      required: ["entity_id", "action"],
    },
  },
];

app.get("/", async (c) => {
  await ensureAll();
  // Browser gets the interactive demo; curl/API clients still get JSON via Accept
  const accept = c.req.header("accept") || "";
  if (accept.includes("text/html")) {
    return c.html(demoPageHtml());
  }
  return c.json({
    name: "HomeMCP Gateway",
    tagline: "Per-device permissions · dry-run · audit for HA agents",
    pairsWith: "hass-ts",
    haMode: haMode.kind,
    demo: "/demo",
    endpoints: [
      "GET /health",
      "GET /demo",
      "GET /v1/policies",
      "PUT /v1/policies",
      "GET /v1/tools",
      "POST /v1/tools/call",
      "GET /v1/audit",
    ],
    env: {
      HASS_URL: "optional — enables live mode with hass-ts",
      HASS_TOKEN: "long-lived access token",
      HOMECP_DATA_DIR: "optional — persist policies + audit to disk",
    },
  });
});

app.get("/demo", (c) => c.html(demoPageHtml()));

app.get("/health", async (c) => {
  await ensureAll();
  return c.json({
    status: "ok",
    haMode: haMode.kind,
    policies: policies.length,
    audit: audit.length,
    durable: Boolean(process.env.HOMECP_DATA_DIR),
  });
});

app.get("/v1/policies", async (c) => {
  await ensureData();
  return c.json({ policies });
});

app.put("/v1/policies", async (c) => {
  await ensureData();
  try {
    const body = await c.req.json();
    const next = body.policies as Policy[];
    if (!Array.isArray(next) || next.length === 0) {
      return c.json({ error: "policies array required" }, 400);
    }
    policies = next;
    await writeJsonFile("policies.json", policies);
    return c.json({ ok: true, policies });
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
});

app.get("/v1/tools", async (c) => {
  await ensureAll();
  const tools = haMode.kind === "live" ? haMode.tools : FALLBACK_TOOLS;
  return c.json({ tools, haMode: haMode.kind });
});

app.get("/v1/audit", async (c) => {
  await ensureData();
  return c.json({ entries: audit.slice(0, Number(c.req.query("limit") ?? 50)) });
});

app.post("/v1/tools/call", async (c) => {
  await ensureAll();
  const body = await c.req.json<{
    agentId?: string;
    tool: string;
    entity_id?: string;
    dryRun?: boolean;
    arguments?: Record<string, unknown>;
    domain?: string;
    service?: string;
    service_data?: Record<string, unknown>;
    action?: string;
    brightness_pct?: number;
  }>();

  const agentId = body.agentId ?? "default";
  const policy = policies.find((p) => p.agentId === agentId) ?? policies[0]!;
  const args = {
    ...(body.arguments ?? {}),
    entity_id: body.entity_id ?? body.arguments?.entity_id,
    domain: body.domain ?? body.arguments?.domain,
    service: body.service ?? body.arguments?.service,
    service_data: body.service_data ?? body.arguments?.service_data,
    action: body.action ?? body.arguments?.action,
    brightness_pct: body.brightness_pct ?? body.arguments?.brightness_pct,
  } as Record<string, unknown>;

  const entityId = String(args.entity_id ?? "");
  const dryRun = body.dryRun ?? policy.dryRunDefault;
  const needWrite =
    body.tool !== "ha_get_state" && body.tool !== "ha_list_entities";
  const perm = matchPerm(entityId, policy);

  if (perm === "none" || (needWrite && perm !== "write" && entityId)) {
    pushAudit({
      agentId,
      tool: body.tool,
      entityId,
      dryRun,
      allowed: false,
      detail: `denied perm=${perm}`,
    });
    return c.json({ ok: false, error: "permission_denied", perm }, 403);
  }

  if (dryRun) {
    pushAudit({
      agentId,
      tool: body.tool,
      entityId,
      dryRun: true,
      allowed: true,
      detail: "dry-run only — no HA side effect",
    });
    return c.json({
      ok: true,
      dryRun: true,
      wouldCall: { tool: body.tool, arguments: args },
      haMode: haMode.kind,
    });
  }

  if (haMode.kind === "live") {
    try {
      const result = await haMode.handle(body.tool, args);
      pushAudit({
        agentId,
        tool: body.tool,
        entityId,
        dryRun: false,
        allowed: true,
        detail: result.isError ? "live error" : "live ok",
      });
      return c.json({
        ok: !result.isError,
        dryRun: false,
        haMode: "live",
        result,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      pushAudit({
        agentId,
        tool: body.tool,
        entityId,
        dryRun: false,
        allowed: true,
        detail: `live fail: ${message}`,
      });
      return c.json({ ok: false, error: message, haMode: "live" }, 502);
    }
  }

  pushAudit({
    agentId,
    tool: body.tool,
    entityId,
    dryRun: false,
    allowed: true,
    detail: "stub ok — set HASS_URL/HASS_TOKEN + install hass-ts for live",
  });
  return c.json({
    ok: true,
    dryRun: false,
    haMode: "stub",
    result: {
      stub: true,
      message:
        "Install the public hass-ts dependency and configure HASS_URL and HASS_TOKEN.",
    },
  });
});
