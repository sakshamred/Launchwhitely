const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }

  return hash
}

export function getBucket(userId: string, flagKey: string): number {
  if (!userId || !flagKey) return 0
  return (fnv1a32(`${userId}:${flagKey}`) >>> 0) % 100
}
