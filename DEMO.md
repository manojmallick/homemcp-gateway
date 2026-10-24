# Local demo

Run `pnpm dev` and open `http://localhost:3000/demo`. Stub mode works without Home Assistant credentials.

1. Check the gateway health and current mode.
2. Try a dry-run light action and inspect the response.
3. Try a lock action and observe the default deny policy.
4. Inspect the audit log for both decisions.

For live mode, configure `HASS_URL` and `HASS_TOKEN` in the environment. Live mode can affect real devices; keep dry-run enabled while reviewing policy behavior. Do not expose the unauthenticated API directly to the internet.
