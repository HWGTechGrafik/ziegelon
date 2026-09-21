/**
 * Oeffentlicher Schluessel, mit dem die App Lizenzen prueft.
 *
 * Er darf ausgeliefert werden - damit laesst sich pruefen, aber nichts
 * erzeugen. Der zugehoerige private Schluessel liegt ausschliesslich im
 * Lizenzgenerator unter `privat/` und wird nie mitgeliefert.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ ACHTUNG: Das hier ist ein ENTWICKLUNGSSCHLUESSEL zum Ausprobieren.   │
 * │ Vor der ersten Auslieferung im Lizenzgenerator einmal                │
 * │ "Neues Schluesselpaar" klicken und den dort angezeigten oeffentlichen │
 * │ Schluessel hier einsetzen. Sonst kann jeder, der diesen Stand kennt,  │
 * │ gueltige Lizenzen erzeugen.                                          │
 * └──────────────────────────────────────────────────────────────────────┘
 */
export const LICENSE_PUBLIC_KEY: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: 'S4dPZ1HfAEmjAh8To2E6qB3Cf1ezYS-a1BpDOqWdVcQ',
  y: 'f_P6q16OWPtiydtQzH4Oq77Z41nWW0yCir_4AhSr9lg',
  ext: true,
}

/** Sichtbarer Hinweis in der App, solange der Entwicklungsschluessel drinsteckt. */
export const IS_DEVELOPMENT_KEY = true
