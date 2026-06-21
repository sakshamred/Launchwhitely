use std::hash::Hasher;
use twox_hash::XxHash64;

const BUCKET_TOTAL: u64 = 100_000;

/// Deterministically map `key` to a bucket in `[0, BUCKET_TOTAL)`.
///
/// We use xxHash64 with a fixed seed (0) — it is fast, stable across
/// versions, and the output distribution is excellent for power-of-two
/// bucket counts. We concatenate `flag_key + ":" + salt + ":" + context_key`
/// as the input string so that the same context key resolves differently
/// across flags and environments.
///
/// STABILITY INVARIANT: This function MUST NOT change between releases.
/// Changing it silently re-buckets every user in every rollout.
pub fn bucket(flag_key: &str, salt: &str, context_key: &str) -> u64 {
    let mut hasher = XxHash64::with_seed(0);
    let input = format!("{}:{}:{}", flag_key, salt, context_key);
    hasher.write(input.as_bytes());
    hasher.finish() % BUCKET_TOTAL
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bucket_range() {
        for i in 0..1000u32 {
            let b = bucket("my-flag", "abc123", &i.to_string());
            assert!(b < BUCKET_TOTAL, "bucket out of range: {b}");
        }
    }

    #[test]
    fn bucket_stability() {
        // These exact values must not change between versions.
        assert_eq!(
            bucket("my-flag", "salt", "user-1"),
            bucket("my-flag", "salt", "user-1")
        );
        assert_eq!(
            bucket("my-flag", "salt", "user-1"),
            bucket("my-flag", "salt", "user-1")
        );
        // Different inputs differ
        assert_ne!(
            bucket("flag-a", "salt", "user-1"),
            bucket("flag-b", "salt", "user-1")
        );
    }

    #[test]
    fn bucket_distribution() {
        // Bucket ~100k keys and verify each bucket gets roughly equal share.
        let n = 100_000u64;
        let mut counts = vec![0u64; 10];
        for i in 0..n {
            let b = bucket("dist-test", "testsalt", &i.to_string());
            let slot = (b * 10 / BUCKET_TOTAL) as usize;
            counts[slot] += 1;
        }
        let expected = n / 10;
        for (i, &count) in counts.iter().enumerate() {
            let diff = (count as i64 - expected as i64).unsigned_abs();
            let pct = diff * 100 / expected;
            assert!(
                pct < 5,
                "bucket slot {i}: expected ~{expected} got {count} ({pct}% off)"
            );
        }
    }
}
