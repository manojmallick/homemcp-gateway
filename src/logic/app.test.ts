import { describe, it, expect } from "vitest";

// --- Pure helper: matchPerm (extracted from app.ts for testability) ---

type Perm = "read" | "write" | "none";
interface Policy {
  agentId: string;
  entities: Record<string, Perm>;
  dryRunDefault: boolean;
}

function matchPerm(entityId: string, policy: Policy): Perm {
  if (!entityId) return "read";
  const domain = entityId.split(".")[0] + ".*";
  return policy.entities[entityId] ?? policy.entities[domain] ?? "none";
}

const DEFAULT_POLICY: Policy = {
  agentId: "default",
  entities: {
    "light.*": "write",
    "switch.*": "write",
    "sensor.*": "read",
    "lock.*": "none",
    "alarm_control_panel.*": "none",
  },
  dryRunDefault: true,
};

// --- Pure helper: audit ID format ---

function makeAuditId(ts: number): string {
  return `a_${ts.toString(36)}`;
}

// --- Pure helper: policy validation ---

type PermResult = "allowed" | "denied" | "readonly";

function evaluatePerm(perm: Perm, action: "read" | "write"): PermResult {
  if (perm === "none") return "denied";
  if (action === "write" && perm === "read") return "readonly";
  return "allowed";
}

// --- Tests ---

describe("matchPerm — default policy", () => {
  it("allows write to lights", () => {
    expect(matchPerm("light.kitchen", DEFAULT_POLICY)).toBe("write");
  });

  it("allows write to switches", () => {
    expect(matchPerm("switch.porch", DEFAULT_POLICY)).toBe("write");
  });

  it("allows read for sensors", () => {
    expect(matchPerm("sensor.temp", DEFAULT_POLICY)).toBe("read");
  });

  it("denies access to locks", () => {
    expect(matchPerm("lock.front_door", DEFAULT_POLICY)).toBe("none");
  });

  it("denies access to alarm panels", () => {
    expect(matchPerm("alarm_control_panel.home", DEFAULT_POLICY)).toBe("none");
  });

  it("returns none for unknown domains", () => {
    expect(matchPerm("media_player.tv", DEFAULT_POLICY)).toBe("none");
  });

  it("per-entity override takes precedence over domain wildcard", () => {
    const policy: Policy = {
      agentId: "restricted",
      entities: {
        "light.*": "write",
        "light.office": "none", // override
      },
      dryRunDefault: true,
    };
    expect(matchPerm("light.office", policy)).toBe("none");
    expect(matchPerm("light.kitchen", policy)).toBe("write");
  });

  it("returns read for empty entityId", () => {
    expect(matchPerm("", DEFAULT_POLICY)).toBe("read");
  });
});

describe("makeAuditId", () => {
  it("returns a string starting with a_", () => {
    const id = makeAuditId(Date.now());
    expect(id.startsWith("a_")).toBe(true);
  });

  it("is deterministic for the same timestamp", () => {
    const ts = 1722000000000;
    expect(makeAuditId(ts)).toBe(makeAuditId(ts));
  });

  it("produces unique ids for different timestamps", () => {
    expect(makeAuditId(1000)).not.toBe(makeAuditId(2000));
  });
});

describe("evaluatePerm", () => {
  it("allows read from read permission", () => {
    expect(evaluatePerm("read", "read")).toBe("allowed");
  });

  it("denies write with read-only permission", () => {
    expect(evaluatePerm("read", "write")).toBe("readonly");
  });

  it("allows read and write with write permission", () => {
    expect(evaluatePerm("write", "read")).toBe("allowed");
    expect(evaluatePerm("write", "write")).toBe("allowed");
  });

  it("denies all with none permission", () => {
    expect(evaluatePerm("none", "read")).toBe("denied");
    expect(evaluatePerm("none", "write")).toBe("denied");
  });
});
