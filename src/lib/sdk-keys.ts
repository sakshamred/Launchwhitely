import crypto from 'node:crypto'

const SDK_KEY_SUFFIX_BYTES = 32

export function hashSdkKey(rawKey: string) {
  return crypto.createHash('sha256').update(rawKey).digest('hex')
}

export function generateSdkKey(prefix: 'prj' | 'env') {
  const rawKey = `lw_${prefix}_${crypto.randomBytes(SDK_KEY_SUFFIX_BYTES).toString('hex')}`
  const keyHash = hashSdkKey(rawKey)
  const keyPrefix = rawKey.slice(0, 12)

  return {
    rawKey,
    keyHash,
    keyPrefix,
  }
}
