use crate::{build_app, db, generate_initial_key, store::MemStore};
use launchwhitely_core::KeyRole;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::oneshot;
use ulid::Ulid;

// ── Test server harness ────────────────────────────────────────────────────

struct TestServer {
    pub base_url: String,
    pub admin_key: String,
    _shutdown: oneshot::Sender<()>,
}

impl TestServer {
    async fn start() -> Self {
        // In-memory SQLite: fast, isolated per-test, no temp-file path issues.
        // max_connections(1) ensures all connections share the same in-memory DB.
        let conn_opts = SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .foreign_keys(true);
        let pool = Arc::new(
            SqlitePoolOptions::new()
                .max_connections(1)
                .connect_with(conn_opts)
                .await
                .unwrap(),
        );
        db::run_migrations(&pool).await.unwrap();

        let id = Ulid::new().to_string();
        let raw_key = generate_initial_key(&id);
        db::keys::create(&pool, &id, &raw_key, &KeyRole::Admin, None, "test-admin")
            .await
            .unwrap();

        let store = Arc::new(MemStore::new());
        crate::store::load_from_db(&pool, &store).await.unwrap();

        let app = build_app(Arc::clone(&pool), Arc::clone(&store));

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let (tx, rx) = oneshot::channel::<()>();
        tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    rx.await.ok();
                })
                .await
                .ok();
        });

        // Give the server a moment to accept connections
        tokio::time::sleep(Duration::from_millis(50)).await;

        TestServer {
            base_url: format!("http://{addr}"),
            admin_key: raw_key,
            _shutdown: tx,
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    fn admin_auth(&self) -> String {
        format!("Bearer {}", self.admin_key)
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/// Read up to `max` SSE events from a response body.
/// Stops early if the stream ends or no bytes arrive within 5 s total.
async fn read_sse_events(response: reqwest::Response, max: usize) -> Vec<(String, String)> {
    use futures::StreamExt;

    let mut stream = response.bytes_stream();
    let mut buf = String::new();
    let mut events: Vec<(String, String)> = Vec::new();
    let deadline = std::time::Instant::now() + Duration::from_secs(5);

    while events.len() < max {
        if std::time::Instant::now() > deadline {
            break;
        }
        let chunk = tokio::time::timeout(Duration::from_millis(400), stream.next()).await;
        match chunk {
            Ok(Some(Ok(bytes))) => buf.push_str(&String::from_utf8_lossy(&bytes)),
            Ok(Some(Err(_))) | Ok(None) => break, // stream error or closed
            Err(_) => continue,                   // per-chunk timeout, keep waiting
        }

        // Parse any complete SSE events (terminated by blank line)
        while let Some(end) = buf.find("\n\n") {
            let raw = buf[..end].to_string();
            buf = buf[end + 2..].to_string();

            let mut event_type = "message".to_string();
            let mut data = String::new();
            for line in raw.lines() {
                if line.starts_with(':') {
                    continue; // SSE comment
                }
                if let Some(t) = line.strip_prefix("event: ") {
                    event_type = t.trim().to_string();
                } else if let Some(d) = line.strip_prefix("data: ") {
                    data = d.trim().to_string();
                }
            }
            if !data.is_empty() {
                events.push((event_type, data));
            }
        }
    }
    events
}

// ── Tests ──────────────────────────────────────────────────────────────────

#[tokio::test]
async fn health_returns_200() {
    let server = TestServer::start().await;
    let res = reqwest::get(&server.url("/health")).await.unwrap();
    assert_eq!(res.status(), 200);
}

#[tokio::test]
async fn missing_auth_returns_401() {
    let server = TestServer::start().await;
    let res = reqwest::get(&server.url("/api/flags")).await.unwrap();
    assert_eq!(res.status(), 401);
}

#[tokio::test]
async fn wrong_token_returns_401() {
    let server = TestServer::start().await;
    let client = reqwest::Client::new();
    let res = client
        .get(&server.url("/api/flags"))
        .header(
            "Authorization",
            "Bearer lw_notavalidkeyatall00000000000000000000000000000000000000000000",
        )
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 401);
}

#[tokio::test]
async fn admin_flag_lifecycle() {
    let server = TestServer::start().await;
    let client = reqwest::Client::new();
    let auth = server.admin_auth();

    // Create environment
    let res = client
        .post(&server.url("/api/envs"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"key": "prod", "name": "Production"}))
        .send()
        .await
        .unwrap();
    assert_eq!(
        res.status(),
        200,
        "create env: {}",
        res.text().await.unwrap()
    );

    // Create flag (variations required by API)
    let res = client
        .post(&server.url("/api/flags"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({
            "key": "dark-mode",
            "kind": "bool",
            "variations": [false, true],
            "description": "Dark mode toggle"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(
        res.status(),
        200,
        "create flag: {}",
        res.text().await.unwrap()
    );
    let flag: serde_json::Value = res.json().await.unwrap();
    assert_eq!(flag["key"], "dark-mode");
    assert_eq!(flag["kind"], "bool");

    // List flags — should contain exactly one
    let res = client
        .get(&server.url("/api/flags"))
        .header("Authorization", &auth)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let flags: Vec<serde_json::Value> = res.json().await.unwrap();
    assert_eq!(flags.len(), 1);
    assert_eq!(flags[0]["key"], "dark-mode");

    // Get flag by key
    let res = client
        .get(&server.url("/api/flags/dark-mode"))
        .header("Authorization", &auth)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);

    // Toggle flag on (default config was auto-created when flag was created)
    let res = client
        .patch(&server.url("/api/envs/prod/flags/dark-mode/toggle"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"enabled": true}))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200, "toggle: {}", res.text().await.unwrap());
    let config: serde_json::Value = res.json().await.unwrap();
    assert_eq!(config["enabled"], true);
    assert_eq!(config["flag_key"], "dark-mode");
    assert_eq!(config["env_key"], "prod");

    // Toggle back off
    let res = client
        .patch(&server.url("/api/envs/prod/flags/dark-mode/toggle"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"enabled": false}))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let config: serde_json::Value = res.json().await.unwrap();
    assert_eq!(config["enabled"], false);

    // Delete flag
    let res = client
        .delete(&server.url("/api/flags/dark-mode"))
        .header("Authorization", &auth)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);

    // List flags — should now be empty
    let res = client
        .get(&server.url("/api/flags"))
        .header("Authorization", &auth)
        .send()
        .await
        .unwrap();
    let flags: Vec<serde_json::Value> = res.json().await.unwrap();
    assert_eq!(flags.len(), 0);
}

#[tokio::test]
async fn sdk_key_access_control() {
    let server = TestServer::start().await;
    let client = reqwest::Client::new();
    let auth = server.admin_auth();

    // Create env
    client
        .post(&server.url("/api/envs"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"key": "test", "name": "Test"}))
        .send()
        .await
        .unwrap();

    // Create SDK key scoped to "test"
    let res = client
        .post(&server.url("/api/keys"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"role": "sdk", "env_key": "test", "name": "test-sdk"}))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.unwrap();
    let sdk_key = body["raw_key"].as_str().unwrap().to_string();
    let sdk_auth = format!("Bearer {sdk_key}");

    // SDK key CAN access /api/sdk/flags
    let res = client
        .get(&server.url("/api/sdk/flags"))
        .header("Authorization", &sdk_auth)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let ruleset: serde_json::Value = res.json().await.unwrap();
    assert_eq!(ruleset["env_key"], "test");

    // SDK key CANNOT access admin /api/flags → 403
    let res = client
        .get(&server.url("/api/flags"))
        .header("Authorization", &sdk_auth)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 403);

    // SDK key CANNOT create flags → 403
    let res = client
        .post(&server.url("/api/flags"))
        .header("Authorization", &sdk_auth)
        .json(&serde_json::json!({"key": "x", "kind": "bool", "variations": [false, true]}))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 403);

    // SDK key CAN use /api/eval → 200
    let res = client
        .post(&server.url("/api/eval"))
        .header("Authorization", &sdk_auth)
        .json(&serde_json::json!({"context": {"key": "user-abc", "attributes": {}}}))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let eval_res: serde_json::Value = res.json().await.unwrap();
    assert!(eval_res["results"].is_array());
    // No flags yet → empty results
    assert_eq!(eval_res["results"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn eval_returns_correct_variation() {
    let server = TestServer::start().await;
    let client = reqwest::Client::new();
    let auth = server.admin_auth();

    // Create env + flag
    client
        .post(&server.url("/api/envs"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"key": "ev", "name": "Eval Env"}))
        .send()
        .await
        .unwrap();

    client
        .post(&server.url("/api/flags"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({
            "key": "my-flag",
            "kind": "bool",
            "variations": [false, true]
        }))
        .send()
        .await
        .unwrap();

    // Create SDK key
    let res = client
        .post(&server.url("/api/keys"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"role": "sdk", "env_key": "ev", "name": "sdk"}))
        .send()
        .await
        .unwrap();
    let body: serde_json::Value = res.json().await.unwrap();
    let sdk_key = body["raw_key"].as_str().unwrap().to_string();
    let sdk_auth = format!("Bearer {sdk_key}");

    // Eval while flag is off → off_variation (index 0 = false)
    let res = client
        .post(&server.url("/api/eval"))
        .header("Authorization", &sdk_auth)
        .json(&serde_json::json!({
            "context": {"key": "u1", "attributes": {}},
            "flag_key": "my-flag"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let eval: serde_json::Value = res.json().await.unwrap();
    let results = eval["results"].as_array().unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0]["value"], false);
    assert_eq!(results[0]["reason"]["kind"], "OFF");

    // Toggle flag on
    client
        .patch(&server.url("/api/envs/ev/flags/my-flag/toggle"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"enabled": true}))
        .send()
        .await
        .unwrap();

    // Eval while flag is on → fallthrough variation (index 0 = false, default fallthrough)
    // Default config has fallthrough = 0 (off_variation), so still false but reason changes
    let res = client
        .post(&server.url("/api/eval"))
        .header("Authorization", &sdk_auth)
        .json(&serde_json::json!({
            "context": {"key": "u1", "attributes": {}},
            "flag_key": "my-flag"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let eval: serde_json::Value = res.json().await.unwrap();
    let results = eval["results"].as_array().unwrap();
    assert_eq!(results.len(), 1);
    // Flag is on, so reason is FALLTHROUGH (not OFF)
    assert_eq!(results[0]["reason"]["kind"], "FALLTHROUGH");
}

#[tokio::test]
async fn sse_receives_patch_on_toggle() {
    let server = TestServer::start().await;
    let client = reqwest::Client::new();
    let auth = server.admin_auth();

    // Create env + flag
    let res = client
        .post(&server.url("/api/envs"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"key": "se", "name": "Stream Env"}))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);

    let res = client
        .post(&server.url("/api/flags"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({
            "key": "sf",
            "kind": "bool",
            "variations": [false, true]
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);

    // Create SDK key
    let res = client
        .post(&server.url("/api/keys"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"role": "sdk", "env_key": "se", "name": "sdk"}))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.unwrap();
    let sdk_key = body["raw_key"].as_str().unwrap().to_string();

    // Connect to SSE stream — subscribe before the snapshot so no patch is missed
    let sse_response = client
        .get(&server.url("/api/sdk/stream"))
        .header("Authorization", format!("Bearer {sdk_key}"))
        .send()
        .await
        .unwrap();
    assert_eq!(sse_response.status(), 200);

    // Spawn reader: collects up to 2 events
    let reader = tokio::spawn(read_sse_events(sse_response, 2));

    // Give the stream time to deliver the initial `put` event
    tokio::time::sleep(Duration::from_millis(150)).await;

    // Toggle flag on via admin → triggers SSE `patch`
    let res = client
        .patch(&server.url("/api/envs/se/flags/sf/toggle"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"enabled": true}))
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);

    // Wait for both events (5 s outer timeout)
    let events = tokio::time::timeout(Duration::from_secs(5), reader)
        .await
        .expect("SSE read timed out after 5 s")
        .expect("SSE reader task panicked");

    assert!(
        events.len() >= 2,
        "expected ≥2 SSE events (put + patch), got {}: {:?}",
        events.len(),
        events
    );

    // First event: initial put — data is nested under "data" key in the SSE payload
    assert_eq!(events[0].0, "put", "first event should be 'put'");
    let put_data: serde_json::Value = serde_json::from_str(&events[0].1).unwrap();
    assert_eq!(put_data["data"]["env_key"], "se");

    // Second event: patch after toggle
    assert_eq!(events[1].0, "patch", "second event should be 'patch'");
    let patch_data: serde_json::Value = serde_json::from_str(&events[1].1).unwrap();
    assert_eq!(patch_data["flag_key"], "sf");
    assert_eq!(patch_data["data"]["enabled"], true);
}

#[tokio::test]
async fn audit_log_records_actions() {
    let server = TestServer::start().await;
    let client = reqwest::Client::new();
    let auth = server.admin_auth();

    // Create env + flag
    client
        .post(&server.url("/api/envs"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({"key": "al", "name": "Audit Log Env"}))
        .send()
        .await
        .unwrap();

    client
        .post(&server.url("/api/flags"))
        .header("Authorization", &auth)
        .json(&serde_json::json!({
            "key": "al-flag",
            "kind": "bool",
            "variations": [false, true]
        }))
        .send()
        .await
        .unwrap();

    // Fetch audit log
    let res = client
        .get(&server.url("/api/audit"))
        .header("Authorization", &auth)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 200);
    let entries: Vec<serde_json::Value> = res.json().await.unwrap();
    // At least the flag.create action should be recorded
    assert!(!entries.is_empty(), "audit log should not be empty");
    let actions: Vec<&str> = entries
        .iter()
        .filter_map(|e| e["action"].as_str())
        .collect();
    assert!(
        actions.contains(&"flag.create"),
        "expected flag.create in audit log, got: {actions:?}"
    );
}

#[tokio::test]
async fn unknown_env_returns_404() {
    let server = TestServer::start().await;
    let client = reqwest::Client::new();
    let auth = server.admin_auth();

    let res = client
        .get(&server.url("/api/envs/does-not-exist"))
        .header("Authorization", &auth)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 404);
}

#[tokio::test]
async fn duplicate_flag_key_returns_409() {
    let server = TestServer::start().await;
    let client = reqwest::Client::new();
    let auth = server.admin_auth();

    let body = serde_json::json!({
        "key": "dup",
        "kind": "bool",
        "variations": [false, true]
    });
    client
        .post(&server.url("/api/flags"))
        .header("Authorization", &auth)
        .json(&body)
        .send()
        .await
        .unwrap();

    let res = client
        .post(&server.url("/api/flags"))
        .header("Authorization", &auth)
        .json(&body)
        .send()
        .await
        .unwrap();
    assert_eq!(res.status(), 409);
}
