/**
 * Bloqueia URLs que apontam para redes privadas ou metadata services,
 * prevenindo SSRF em endpoints que fazem fetch de URLs controladas pelo usuário.
 */

const PRIVATE_HOSTNAME_RE = /^(
  localhost |
  0\.0\.0\.0 |
  127\. |           # loopback
  10\. |            # RFC 1918
  192\.168\. |      # RFC 1918
  172\.(1[6-9]|2\d|3[01])\. | # RFC 1918 172.16–31
  169\.254\. |      # link-local / AWS metadata
  100\.64\. |       # CGNAT
  ::1 |             # IPv6 loopback
  \[::1\] |
  fc | fd            # IPv6 ULA
)/.source.replace(/\s+|\n/g, '')

const PRIVATE_RE = new RegExp(PRIVATE_HOSTNAME_RE, 'i')

const BLOCKED_HOSTS = new Set([
  '169.254.169.254',  // AWS/GCP/Azure instance metadata
  '100.100.100.200',  // Alibaba Cloud metadata
  'metadata.google.internal',
])

export function isPrivateUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return true
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return true

  const host = url.hostname.toLowerCase()

  if (BLOCKED_HOSTS.has(host)) return true
  if (PRIVATE_RE.test(host)) return true

  return false
}
