/**
 * Lizenzschluessel - Format `ZGL1.<Inhalt>.<Signatur>`.
 *
 * Der Schluessel ist mit **ECDSA P-256** signiert. Die App traegt nur den
 * oeffentlichen Schluessel; erzeugen kann Schluessel ausschliesslich, wer den
 * privaten hat. Anders als bei einer Pruefsumme nuetzt es einem Angreifer
 * also nichts, den Quelltext zu lesen: er kann pruefen, aber nicht faelschen.
 *
 * P-256 und nicht Ed25519, weil P-256 in jedem Browser mit WebCrypto
 * funktioniert - Ed25519 kam dort erst spaet dazu.
 *
 * **Die Grenze ehrlich benannt:** Die App laeuft vollstaendig am Geraet des
 * Nutzers. Wer den Quelltext aendert, haengt die Pruefung ab - bei einer
 * Browser-App ist das nicht zu verhindern. Die Signatur verhindert
 * *erfundene* Schluessel, nicht das Umgehen der Abfrage. Sie haelt den
 * ehrlichen Kunden auf, nicht den entschlossenen.
 */
import { LICENSE_PUBLIC_KEY } from './license-key'

export interface LicenseInfo {
  /** Auf wen die Lizenz ausgestellt ist. */
  customer: string
  /** Ausstellungsdatum, ISO (JJJJ-MM-TT). */
  issuedOn: string
  /** Ablaufdatum, ISO - oder null fuer unbefristet. */
  expiresOn: string | null
  /** Fortlaufende Nummer, damit sich eine Lizenz zuordnen laesst. */
  number: string
}

export type LicenseResult =
  | { ok: true; info: LicenseInfo }
  | { ok: false; reason: 'format' | 'signature' | 'expired'; message: string }

const PREFIX = 'ZGL1'

/** Roher Inhalt eines Schluessels, absichtlich kurze Feldnamen. */
interface Payload {
  v: number
  k: string
  a: string
  b?: string
  n: string
}

// Uint8Array ist seit TypeScript 5.7 generisch ueber den Puffertyp; WebCrypto
// will ausdruecklich einen ArrayBuffer, keinen SharedArrayBuffer.
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/** Leerzeichen und Zeilenumbrueche entfernen - Schluessel werden oft aus E-Mails kopiert. */
export const tidy = (input: string): string => input.replace(/\s+/g, '')

let cachedKey: CryptoKey | null = null

async function publicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  const einlesen = () =>
    crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify',
    ])
  // Nur der ausgelieferte Schluessel wird gemerkt. Ein mitgegebener kommt aus
  // dem Test und waere im Zwischenspeicher nur im Weg.
  if (jwk !== LICENSE_PUBLIC_KEY) return einlesen()
  if (!cachedKey) cachedKey = await einlesen()
  return cachedKey
}

/**
 * Prueft einen Schluessel. Ein abgelaufener Schluessel wird eigens gemeldet -
 * "ungueltig" waere hier irrefuehrend, der Kunde hatte ja einmal eine Lizenz.
 *
 * `key` ist nur fuer den Test da: der bringt ein frisch erzeugtes Paar mit,
 * damit kein privater Schluessel im Repo liegen muss. Die App ruft immer ohne
 * auf und prueft damit gegen den ausgelieferten oeffentlichen Schluessel.
 */
export async function verifyLicense(
  input: string,
  today: Date = new Date(),
  key: JsonWebKey = LICENSE_PUBLIC_KEY,
): Promise<LicenseResult> {
  const parts = tidy(input).split('.')
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return {
      ok: false,
      reason: 'format',
      message: 'Das sieht nicht nach einem Ziegelon-Schlüssel aus.',
    }
  }
  const [, body, signature] = parts as [string, string, string]

  let payload: Payload
  let signed: Uint8Array<ArrayBuffer>
  let sig: Uint8Array<ArrayBuffer>
  try {
    signed = new TextEncoder().encode(body)
    sig = fromBase64Url(signature)
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Payload
  } catch {
    return {
      ok: false,
      reason: 'format',
      message: 'Der Schlüssel ist unvollständig oder beschädigt.',
    }
  }

  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    await publicKey(key),
    sig,
    signed,
  )
  if (!valid || payload.v !== 1 || !payload.k) {
    return {
      ok: false,
      reason: 'signature',
      message: 'Dieser Schlüssel ist nicht gültig.',
    }
  }

  // Vergleich als Text: ISO-Datumsangaben sortieren sich richtig, und es gibt
  // keine Ueberraschungen durch Zeitzonen.
  const todayIso = today.toISOString().slice(0, 10)
  if (payload.b && payload.b < todayIso) {
    return {
      ok: false,
      reason: 'expired',
      message: `Diese Lizenz ist am ${formatDate(payload.b)} abgelaufen.`,
    }
  }

  return {
    ok: true,
    info: {
      customer: payload.k,
      issuedOn: payload.a,
      expiresOn: payload.b ?? null,
      number: payload.n,
    },
  }
}

export const formatDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('de-AT')
