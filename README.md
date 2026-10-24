# HomeMCP Gateway

HomeMCP Gateway is a prototype policy layer for Home Assistant tools. It applies per-entity allow/deny rules, defaults to dry-run, and records decisions in an audit log. It runs with a stub Home Assistant client by default and can use the separately maintained [hass-ts SDK](https://github.com/manojmallick/hass-ts) for live connections.

## Run locally

Requirements: Node.js and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/demo` for the interactive demo. `pnpm demo` runs the command-line walkthrough. Stub mode requires no credentials.

## Live Home Assistant

Set `HASS_URL` and `HASS_TOKEN` in the environment to connect to an instance. The token is a Home Assistant long-lived access token; keep it private and do not commit it. Live mode can control devices when dry-run is disabled. Review the policy and every requested operation before enabling side effects.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/tools` | List available MCP tools |
| POST | `/v1/tools/call` | Request a tool call subject to policy |
| GET / PUT | `/v1/policies` | Read or update entity permissions |
| GET | `/v1/audit` | View recent decisions |
| GET | `/health` | Check service mode and status |

The default policy allows selected light/switch operations, permits sensor reads, and denies locks and alarms. Dry-run is enabled by default.

## Build and checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Security limitations

This is a prototype, not a security-certified gateway. Do not expose it directly to the public internet: the API has no built-in user authentication. Put it behind a trusted network boundary and authenticated proxy. The audit/policy store is local JSON and is not designed for concurrent multi-instance deployments. Review policies carefully; live calls can operate real devices.

Docker deployment is available through a manually triggered workflow after provider settings are configured.

## License

Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). This source-available license restricts commercial use; it is not an OSI-approved open-source license. See the license for terms and exceptions. Third-party dependencies retain their own licenses.
