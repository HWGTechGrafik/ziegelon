/**
 * Oeffentlicher Schluessel, mit dem die App Lizenzen prueft.
 *
 * Er darf ausgeliefert werden - damit laesst sich pruefen, aber nichts
 * erzeugen. Der zugehoerige private Schluessel liegt ausschliesslich im
 * Lizenzgenerator unter `privat/ziegelon-schluessel.json` und wird nie
 * mitgeliefert; `privat/` steht in der .gitignore.
 *
 * Dieser Schluessel gehoert zu dem Paar, das der Lizenzgenerator bei seinem
 * ersten Start angelegt hat. Wird dort "Neues Schluesselpaar" geklickt,
 * muss der neue oeffentliche Teil hier einziehen - sonst weist die App jede
 * danach ausgestellte Lizenz zurueck.
 *
 * Die Tests bringen bewusst ein eigenes Wegwerf-Paar mit. Waere hier ein
 * Schluessel hinterlegt, zu dem der private Teil im Repo steht, koennte sich
 * jeder selbst eine Lizenz ausstellen.
 */
export const LICENSE_PUBLIC_KEY: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: '417FRHQfbYcjqRoFNORdh6Tq2URlkc4E4NGAHYsLPtc',
  y: '2fVq0cUug7e712FZetH7Kyxe-H-TBjWJL6Ka2KZCRcE',
  ext: true,
}

/** Sichtbarer Hinweis in der App, solange ein Entwicklungsschluessel drinsteckt. */
export const IS_DEVELOPMENT_KEY = false
