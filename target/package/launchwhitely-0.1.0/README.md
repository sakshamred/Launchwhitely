# LaunchWhitely

A self-hostable feature flag server — own your flags, ship zero cloud dependencies.

Single Rust binary. SQLite database. Real-time SSE streaming. Sub-millisecond in-memory evaluation. Drop-in LaunchDarkly-alternative API.

---

## Features

- **Boolean + multivariate flags** — bool, string, number, JSON variations
- **Targeting rules** — match users by attribute with 10+ operators (in, contains, regex, semver, segment…)
- **Reusable segments** — define audiences once, reference everywhere
- **Deterministic percentage rollouts** — XxHash64 bucketing; same context key always gets same variation
- **Multiple environments** — production, staging, dev — each with independent config
- **API-key auth** — admin keys (full access) and per-env SDK keys (read-only eval)
- **Real-time SSE** — SDK clients receive flag changes within milliseconds, no polling
- **Audit log** — every mutation is logged with before/after snapshots
- **Zero infra** — one binary, one SQLite file, no Postgres, no Redis, no cloud

---

## Install

### Option 1 — `cargo install` (build from source)

```sh
cargo install launchwhitely
```

Requires Rust stable toolchain. Builds the binary from crates.io.

### Option 2 — `npm` / `npx` (downloads pre-built binary)

```sh
# Global install
npm install -g launchwhitely

# One-shot (no install required)
npx launchwhitely serve
```

Supports Linux x64/arm64, macOS x64/arm64, Windows x64.

### Option 3 — `curl | sh` (Linux & macOS)

```sh
curl -sSfL https://raw.githubusercontent.com/your-org/launchwhitely/main/install.sh | sh
```

Installs to `~/.local/bin`. Set `LAUNCHWHITELY_INSTALL_DIR` to override. Set `LAUNCHWHITELY_VERSION` to pin a version.

### Option 4 — Download binary directly

Grab a pre-built binary from the [releases page](https://github.com/your-org/launchwhitely/releases).

| Platform | File |
|---|---|
| Linux x64 | `launchwhitely-x86_64-unknown-linux-gnu.tar.gz` |
| Linux arm64 | `launchwhitely-aarch64-unknown-linux-gnu.tar.gz` |
| macOS x64 | `launchwhitely-x86_64-apple-darwin.tar.gz` |
| macOS arm64 (M-series) | `launchwhitely-aarch64-apple-darwin.tar.gz` |
| Windows x64 | `launchwhitely-x86_64-pc-windows-msvc.zip` |

---

## Quick Start

```sh
# Start the server (creates launchwhitely.db on first run, prints the admin key)
launchwhitely serve

# ──────────────────────────────────────────────────
# On first start you'll see:
#
#  ╔══════════════════════════════════════════════════════════════╗
#  ║          LaunchWhitely — Initial Admin Key Created           ║
#  ╠══════════════════════════════════════════════════════════════╣
#  ║  Save this key — it will NOT be shown again.                ║
#  ║  Raw Key: lw_<64-hex-chars>                                  ║
#  ╚══════════════════════════════════════════════════════════════╝
#
# Copy the raw key and export it:
export ADMIN_KEY="lw_<paste-key-here>"
# ──────────────────────────────────────────────────

# Create an environment
curl -sSf http://localhost:7777/api/envs \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key":"production","name":"Production"}'

# Create a boolean flag
curl -sSf http://localhost:7777/api/flags \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key":"dark-mode","kind":"bool","variations":[false,true],"description":"Dark mode toggle"}'

# Enable the flag in production
curl -sSf -X PATCH http://localhost:7777/api/envs/production/flags/dark-mode/toggle \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'

# Create an SDK key scoped to production
curl -sSf http://localhost:7777/api/keys \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"role":"sdk","env_key":"production","name":"my-app-sdk"}'

# ── In your app ──────────────────────────────────────────────────────────────

export SDK_KEY="lw_<paste-sdk-key>"

# Evaluate a flag for a user
curl -sSf http://localhost:7777/api/eval \
  -H "Authorization: Bearer $SDK_KEY" \
  -H "Content-Type: application/json" \
  -d '{"context":{"key":"user-123","attributes":{"plan":"pro"}},"flag_key":"dark-mode"}'

# Subscribe to real-time updates (SSE)
curl -sSf http://localhost:7777/api/sdk/stream \
  -H "Authorization: Bearer $SDK_KEY" \
  -H "Accept: text/event-stream"
```

---

## CLI Reference

```
launchwhitely serve [OPTIONS]
    --db <PATH>       SQLite database path [default: launchwhitely.db]
    --port <PORT>     HTTP port [default: 7777]
    --host <HOST>     Bind host [default: 0.0.0.0]
    --log <LEVEL>     Log level: trace|debug|info|warn|error [default: info]

launchwhitely migrate --db <PATH>
    Run database migrations (safe to run multiple times)

launchwhitely key create --role <admin|sdk> [--env <ENV_KEY>] --name <NAME> --db <PATH>
launchwhitely key list   --db <PATH>
launchwhitely key revoke --id <KEY_ID> --db <PATH>

launchwhitely env create --key <KEY> --name <NAME> --db <PATH>
launchwhitely env list   --db <PATH>

launchwhitely flag create --key <KEY> --kind <bool|string|number|json> [--description <DESC>] --db <PATH>
launchwhitely flag list   --db <PATH>
launchwhitely flag get    --key <KEY> --db <PATH>
launchwhitely flag toggle --key <KEY> --env <ENV_KEY> --enabled <true|false> --db <PATH>
```

---

## HTTP API

All endpoints require `Authorization: Bearer <key>`. Admin key = full access. SDK key = read-only eval endpoints only.

### Flags

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/flags` | List all flags (admin) |
| `POST` | `/api/flags` | Create flag (admin) |
| `GET` | `/api/flags/:key` | Get flag (admin) |
| `PUT` | `/api/flags/:key` | Update flag description/variations (admin) |
| `DELETE` | `/api/flags/:key` | Delete flag (admin) |
| `PUT` | `/api/envs/:env/flags/:key/config` | Set full config for a flag in an env (admin) |
| `PATCH` | `/api/envs/:env/flags/:key/toggle` | Enable/disable flag (admin) |

### Environments

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/envs` | List environments (admin) |
| `POST` | `/api/envs` | Create environment (admin) |
| `GET` | `/api/envs/:key` | Get environment (admin) |
| `DELETE` | `/api/envs/:key` | Delete environment (admin) |

### Segments

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/envs/:env/segments` | List segments (admin) |
| `POST` | `/api/envs/:env/segments` | Create segment (admin) |
| `GET` | `/api/envs/:env/segments/:key` | Get segment (admin) |
| `PUT` | `/api/envs/:env/segments/:key` | Update segment (admin) |
| `DELETE` | `/api/envs/:env/segments/:key` | Delete segment (admin) |

### API Keys

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/keys` | List keys (admin) |
| `POST` | `/api/keys` | Create key (admin) |
| `DELETE` | `/api/keys/:id` | Revoke key (admin) |

### SDK / Eval

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sdk/flags` | Full ruleset snapshot for SDK key's env |
| `POST` | `/api/eval` | Evaluate flags for a context |
| `GET` | `/api/sdk/stream` | SSE stream of flag changes |
| `GET` | `/health` | Health check (no auth) |

### Audit

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/audit?flag_key=&env_key=&limit=&offset=` | List audit entries (admin) |

---

## SSE Streaming

Connect to `/api/sdk/stream` with an SDK key. On connect you receive a full `put` event, then incremental `patch`/`delete` events as flags change.

```
event: put
data: {"type":"put","data":{"env_key":"production","flags":[...],"configs":[...],"segments":[],...}}

event: patch
data: {"type":"patch","flag_key":"dark-mode","data":{...updated config...}}

event: delete
data: {"type":"delete","flag_key":"old-flag"}
```

Reconnect on disconnect — the server sends keepalive comments every 15 seconds.

---

## Flag Config Schema

```json
{
  "flag_key": "dark-mode",
  "env_key": "production",
  "enabled": true,
  "targets": { "user-456": 1 },
  "rules": [
    {
      "id": "rule-1",
      "clauses": [
        { "attribute": "plan", "op": "in", "values": ["pro", "enterprise"], "negate": false }
      ],
      "serve": 1
    }
  ],
  "fallthrough": 0,
  "off_variation": 0,
  "salt": "abc123"
}
```

`fallthrough` and `serve` are either a variation index (`0`, `1`, …) or a rollout array:
```json
[{ "variation": 0, "weight": 50000 }, { "variation": 1, "weight": 50000 }]
```
Weights must sum to `100000` (= 100.000%).

---

## Security

- API keys are stored as `sha256(raw_key)` — raw key material is never persisted
- Auth uses constant-time comparison to prevent timing attacks
- Eval reads from in-memory state only — zero DB queries per evaluation
- Rate limiting, TLS termination, and network isolation are your reverse-proxy's job (nginx, Caddy, etc.)

---

## Development

```sh
git clone https://github.com/your-org/launchwhitely
cd launchwhitely

cargo test        # 31 tests (21 unit + 10 integration)
cargo clippy -- -D warnings
cargo fmt --check
cargo build --release
```

No `.env` file required. No external services required.

---

## Publishing Checklist

Everything below needs to be done **once manually** before the automated CI pipeline takes over.

### 1. Update placeholder URLs (required)

Search and replace `your-org` in these files with your actual GitHub org/user:

- [ ] `Cargo.toml` → `[workspace.package] repository`
- [ ] `npm/package.json` → `repository.url` and `homepage`
- [ ] `npm/install.js` → `REPO` constant
- [ ] `install.sh` → `REPO` variable
- [ ] `README.md` → all links

### 2. Initialize git and push (required)

```sh
cd /path/to/launchwhitely

git init
git add .
git commit -m "feat: initial LaunchWhitely implementation"

# Create repo on GitHub first (github.com → New repository → "launchwhitely")
git remote add origin https://github.com/your-org/launchwhitely.git
git branch -M main
git push -u origin main
```

### 3. Set up GitHub repository secrets (required for CI)

Go to: **GitHub repo → Settings → Secrets and variables → Actions**

| Secret name | What it is | How to get it |
|---|---|---|
| `CARGO_REGISTRY_TOKEN` | crates.io API token | [crates.io → Account settings → API Tokens](https://crates.io/settings/tokens) |
| `NPM_TOKEN` | npm automation token | `npm login` → [npmjs.com → Access Tokens → Generate New Token → Automation](https://www.npmjs.com/settings/tokens) |

### 4. Set up GitHub Environments (required)

Go to: **GitHub repo → Settings → Environments**

Create two environments:
- `crates-io` (add `CARGO_REGISTRY_TOKEN` secret here too, or leave it as a repo-level secret)
- `npm` (add `NPM_TOKEN` secret here too)

### 5. Register on crates.io (first time only)

```sh
# Log in to crates.io (opens browser)
cargo login

# Dry-run to check for issues
cargo publish -p launchwhitely-core --dry-run
cargo publish -p launchwhitely --dry-run
```

Note: `launchwhitely-core` must be published before `launchwhitely` since it's a dependency.

### 6. Register npm package name (first time only)

```sh
# Log in to npm
npm login

# Check the name is available
npm info launchwhitely

# Dry-run publish
cd npm && npm publish --dry-run
```

### 7. Trigger your first release

```sh
# Tag the release — CI does everything automatically from here
git tag v0.1.0
git push origin v0.1.0
```

CI will:
1. Run tests + clippy + fmt
2. Build binaries for all 5 platforms
3. Create GitHub Release with all binaries attached
4. Publish `launchwhitely` and `launchwhitely-core` to crates.io
5. Publish `launchwhitely` to npm

### 8. Verify install methods work (post-release smoke test)

```sh
# cargo install
cargo install launchwhitely

# npm
npm install -g launchwhitely
launchwhitely --version

# npx
npx launchwhitely --version

# curl | sh
curl -sSfL https://raw.githubusercontent.com/your-org/launchwhitely/main/install.sh | sh
```

---

## What's NOT Done Yet (optional stretch goals)

These are not required to ship v0.1.0 but would make the project more complete:

- [ ] **TypeScript SDK** — `npm install launchwhitely-js` — SSE client that caches the ruleset and calls `evaluate()` locally
- [ ] **Embedded admin UI** — small SPA served from the binary itself (no separate deployment)
- [ ] **musl Linux build** — fully static binary for alpine/docker (`x86_64-unknown-linux-musl`)
- [ ] **Docker image** — `ghcr.io/your-org/launchwhitely:latest`
- [ ] **Homebrew formula** — `brew install your-org/tap/launchwhitely`
- [ ] **TLS support** — built-in HTTPS with rustls + ACME (currently relies on reverse proxy)
- [ ] **OIDC / webhook auth** — alternative to API keys

---

## License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT license ([LICENSE-MIT](LICENSE-MIT))

at your option.
