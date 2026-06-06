/**
 * @module bucketing
 * Deterministic, zero-dependency hash-based bucketing for the rollout engine.
 *
 * Design goals:
 * - Same (userId, flagKey) pair ALWAYS produces the same bucket (0-99).
 * - No `Math.random()`, no Node `crypto`, works in Edge / browser runtimes.
 * - Pure bitwise arithmetic over UTF-16 code units.
 *
 * Algorithm: FNV-1a (32-bit variant)
 * https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 *
 * FNV-1a is preferred over djb2 for its better avalanche behaviour across
 * short strings and its resistance to clusters when keys share a common prefix
 * (e.g. "flag-a" vs "flag-b").
 */

// FNV-1a 32-bit constants
const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

/**
 * Compute a 32-bit FNV-1a hash of an arbitrary string.
 *
 * The result is a signed 32-bit integer (JavaScript bitwise ops always yield
 * signed int32). Callers that need an unsigned value should apply `>>> 0`.
 *
 * @param input - The string to hash.
 * @returns A 32-bit signed integer hash.
 */
function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS

  for (let i = 0; i < input.length; i++) {
    // XOR hash with the lower byte of the UTF-16 code unit, then multiply by
    // the FNV prime. `| 0` forces the multiply back into int32 range after
    // each step to avoid floating-point drift on very long strings.
    hash ^= input.charCodeAt(i)
    // Emulate 32-bit unsigned multiply via Math.imul (available everywhere ES6+)
    hash = Math.imul(hash, FNV_PRIME)
  }

  return hash
}

/**
 * Derive a stable bucket number (0–99 inclusive) for a given user and flag.
 *
 * The bucketing key is `"<userId>:<flagKey>"` so that:
 * - Different flags independently distribute the same user across the range.
 * - The same user always lands in the same bucket for the same flag.
 *
 * Usage:
 * ```ts
 * const bucket = getBucket('user-123', 'dark-mode') // e.g. 42
 * if (bucket < flag.rolloutPct) {
 *   // user is in the rollout
 * }
 * ```
 *
 * @param userId  - Stable user identifier (must be non-empty).
 * @param flagKey - The feature flag key being evaluated.
 * @returns An integer in the range [0, 99].
 */
export function getBucket(userId: string, flagKey: string): number {
  if (!userId || !flagKey) {
    // Degenerate input: put into bucket 0 so the caller always gets a valid
    // number without throwing. A rolloutPct of 0 will exclude it; > 0 will
    // include it – deterministic either way.
    return 0
  }

  const key = `${userId}:${flagKey}`
  const hash = fnv1a32(key)

  // `>>> 0` converts signed int32 → unsigned int32 before the modulo so we
  // never get a negative result.
  return (hash >>> 0) % 100
}
