import { describe, expect, it } from 'vitest'
import { verifyLicense } from './license'

/**
 * Der Test erzeugt sein eigenes Schluesselpaar - bei jedem Lauf ein frisches -
 * und gibt den oeffentlichen Teil an verifyLicense weiter.
 *
 * Frueher stand hier der private Schluessel, der zum ausgelieferten passte.
 * Das Repo ist oeffentlich, damit haette sich jeder selbst eine Lizenz
 * ausstellen koennen. Geprueft wird weiterhin die echte Signaturkette, nur
 * eben mit einem Paar, das niemandem etwas nuetzt.
 */
const PAAR = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])
const PUB = (await crypto.subtle.exportKey('jwk', PAAR.publicKey)) as JsonWebKey

// Bewusst ohne Buffer: derselbe Weg wie im Browser, damit der Test die echte
// Kette prueft und nicht eine Node-eigene Abkuerzung.
const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/** Baut einen echten, signierten Schluessel - wie es der Generator tut. */
async function issue(payload: Record<string, unknown>): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    PAAR.privateKey,
    new TextEncoder().encode(body),
  )
  return `ZGL1.${body}.${toBase64Url(new Uint8Array(signature))}`
}

const HEUTE = new Date('2026-09-21T12:00:00Z')

describe('verifyLicense', () => {
  it('nimmt einen gültig signierten Schlüssel an', async () => {
    const key = await issue({ v: 1, k: 'Bau Huber GmbH', a: '2026-09-01', n: '0001' })
    const result = await verifyLicense(key, HEUTE, PUB)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.info).toEqual({
      customer: 'Bau Huber GmbH',
      issuedOn: '2026-09-01',
      expiresOn: null,
      number: '0001',
    })
  })

  it('nimmt einen befristeten Schlüssel an, solange er läuft', async () => {
    const key = await issue({
      v: 1, k: 'Bau Huber GmbH', a: '2026-09-01', b: '2027-09-01', n: '0002',
    })
    const result = await verifyLicense(key, HEUTE, PUB)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.info.expiresOn).toBe('2027-09-01')
  })

  it('meldet einen abgelaufenen Schlüssel eigens - nicht als ungültig', async () => {
    const key = await issue({
      v: 1, k: 'Bau Huber GmbH', a: '2025-01-01', b: '2026-09-20', n: '0003',
    })
    const result = await verifyLicense(key, HEUTE, PUB)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('expired')
    expect(result.message).toContain('20.9.2026')
  })

  it('lässt einen Schlüssel am letzten Gültigkeitstag noch zu', async () => {
    const key = await issue({
      v: 1, k: 'Bau Huber GmbH', a: '2025-01-01', b: '2026-09-21', n: '0004',
    })
    expect((await verifyLicense(key, HEUTE, PUB)).ok).toBe(true)
  })

  it('weist einen veränderten Inhalt zurück', async () => {
    const key = await issue({ v: 1, k: 'Bau Huber GmbH', a: '2026-09-01', n: '0005' })
    const [prefix, , signature] = key.split('.') as [string, string, string]
    // Kundenname austauschen, Signatur unverändert lassen.
    const gefaelscht = toBase64Url(
      new TextEncoder().encode(
        JSON.stringify({ v: 1, k: 'Wer anderer', a: '2026-09-01', n: '0005' }),
      ),
    )

    const result = await verifyLicense(`${prefix}.${gefaelscht}.${signature}`, HEUTE, PUB)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('signature')
  })

  it('weist eine erfundene Signatur zurück', async () => {
    const key = await issue({ v: 1, k: 'Bau Huber GmbH', a: '2026-09-01', n: '0006' })
    const [prefix, body] = key.split('.') as [string, string, string]
    const result = await verifyLicense(`${prefix}.${body}.${'A'.repeat(86)}`, HEUTE, PUB)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('signature')
  })

  it('erkennt Unsinn am Format, bevor gerechnet wird', async () => {
    for (const unsinn of ['', 'hallo', 'ZGL1.nur-zwei-teile', 'XXXX.a.b']) {
      const result = await verifyLicense(unsinn, HEUTE, PUB)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('format')
    }
  })

  it('verträgt Zeilenumbrüche und Leerzeichen aus einer E-Mail', async () => {
    const key = await issue({ v: 1, k: 'Bau Huber GmbH', a: '2026-09-01', n: '0007' })
    const zerpflueckt = `${key.slice(0, 30)}\n  ${key.slice(30, 60)} \n${key.slice(60)}`
    expect((await verifyLicense(zerpflueckt, HEUTE, PUB)).ok).toBe(true)
  })

  it('weist eine unbekannte Formatversion zurück', async () => {
    const key = await issue({ v: 2, k: 'Bau Huber GmbH', a: '2026-09-01', n: '0008' })
    const result = await verifyLicense(key, HEUTE, PUB)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('signature')
  })
})
