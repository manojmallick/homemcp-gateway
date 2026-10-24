/**
 * Optional live Home Assistant client via hass-ts.
 * Set HASS_URL + HASS_TOKEN to enable; otherwise tools stay dry-run/stub.
 */

export type LiveHa = {
  kind: "live";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handle: (name: string, args: Record<string, unknown>) => Promise<any>;
};

export type StubHa = { kind: "stub" };

export type HaMode = LiveHa | StubHa;

export async function loadHaMode(): Promise<HaMode> {
  const baseUrl = process.env.HASS_URL || process.env.HA_URL || "";
  const token = process.env.HASS_TOKEN || process.env.HA_TOKEN || "";
  if (!baseUrl || !token) return { kind: "stub" };

  try {
    // Optional dependency: file:../hass-ts after pnpm install
    const hass = await import("hass-ts");
    const client = new hass.HassClient({ baseUrl, token });
    return {
      kind: "live",
      client,
      tools: hass.HASS_MCP_TOOLS,
      handle: (name, args) => hass.handleHassMcpTool(client, name, args),
    };
  } catch (e) {
    console.warn(
      "[homemcp] hass-ts not available or failed to init — stub mode:",
      e instanceof Error ? e.message : e,
    );
    return { kind: "stub" };
  }
}
