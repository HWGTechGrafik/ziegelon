/**
 * Schnuert die Windows-Fassung zum Weitergeben.
 *
 * Erwartet, dass 'npm run build' und 'dotnet publish -c Release windows'
 * schon gelaufen sind - 'npm run auslieferung' erledigt beides davor.
 *
 * Ergebnis:
 *   auslieferung/Ziegelon/            der Ordner, den der Kunde bekommt
 *   auslieferung/Ziegelon-Windows.zip dasselbe gepackt, zum Verschicken
 *
 * Der Ordner steht in der .gitignore. Die exe ist ueber 100 MB gross und
 * gehoert nicht in die Versionsverwaltung.
 *
 * Die Anleitung steht hier im Skript und nicht als eigene Datei daneben,
 * damit sie mitwandert, wenn sich an der App etwas aendert - eine Datei,
 * die man beim Bauen vergisst, veraltet still.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gebaut = join(
  wurzel,
  'windows/bin/Release/net9.0-windows/win-x64/publish/Ziegelon.exe',
)
const ziel = join(wurzel, 'auslieferung')
const ordner = join(ziel, 'Ziegelon')
const zip = join(ziel, 'Ziegelon-Windows.zip')

// Der Text fuer den Kunden. Umlaute ausgeschrieben - das liest ein Mensch.
const ANLEITUNG = `Ziegelon für Windows
=====================

Ziegelon rechnet den Ziegel-, Laibungs-, Eckstein- und Überlegerbedarf eines
Bauvorhabens und führt die Bestellung gegen das, was schon bestellt ist, und
gegen den Restbestand.


Starten
-------
Ziegelon.exe doppelklicken. Eine Installation gibt es nicht - diese eine Datei
ist alles, was gebraucht wird. Sie lässt sich auch von einem USB-Stick starten.

Beim allerersten Start meldet sich Windows möglicherweise mit "Der Computer
wurde geschützt". Auf "Weitere Informationen" und dann "Trotzdem ausführen"
klicken. Das liegt daran, dass die Datei nicht bei Microsoft registriert ist,
und nicht an einem Fehler.


Freischalten
------------
Ziegelon fragt einmalig nach dem Lizenzschlüssel. Den Schlüssel bekommen Sie
von uns - entweder als Text zum Einfügen oder als Datei, die sich über
"Lizenzdatei wählen" auswählen lässt. Danach fragt die App nicht mehr danach.


Wo die Daten liegen
-------------------
Alle Bauvorhaben und der Ziegel-Katalog liegen auf diesem Rechner unter

    %LOCALAPPDATA%\\Ziegelon

Nichts davon verlässt den Rechner. Es gibt keine Anmeldung und keinen Server.


Sicherung
---------
In den Einstellungen unter "Sicherung" legt "Sichern" alle Bauvorhaben und den
Ziegel-Katalog in einer einzigen Datei ab. Diese Datei lässt sich mit
"Einspielen" wieder einlesen - auf demselben Rechner nach einem Neuaufsetzen
oder auf einem zweiten Gerät. Beim Einspielen bleibt bestehen, was dort neuer
ist als in der Datei; gelöscht wird nichts.

Der Lizenzschlüssel gehört zum Gerät und steht nicht in der Sicherung.


Am Handy und am Tablet
----------------------
Dieselbe App läuft im Browser:

    https://hwgtechgrafik.github.io/ziegelon/

Dort lässt sie sich über "Zum Startbildschirm hinzufügen" wie eine App ablegen
und funktioniert danach auch ohne Internet. Der Lizenzschlüssel ist derselbe.
Daten gleichen Sie über "Sichern" und "Einspielen" ab.


Ziegeltypen aus Excel
---------------------
Im Ziegel-Katalog geben "Als Excel" und "Aus Excel" die Ziegeltypen als Tabelle
aus und lesen sie wieder ein. Die Spalte "Kennung" dabei bitte stehen lassen -
nur damit findet ein umbenannter Ziegeltyp zu sich selbst zurück. Gelöscht wird
beim Einlesen nichts.


Wenn die App nicht startet
--------------------------
Ziegelon nutzt die WebView2-Laufzeit von Microsoft. Auf Windows 10 und 11 ist
sie normalerweise vorhanden. Fehlt sie, sagt die App das beim Start; die
Laufzeit gibt es kostenlos bei Microsoft:

    https://developer.microsoft.com/microsoft-edge/webview2/
`

if (!existsSync(gebaut)) {
  console.error(
    'Die gebaute exe fehlt. Erst "npm run build" und dann\n' +
      '"dotnet publish -c Release windows" laufen lassen.',
  )
  process.exit(1)
}

rmSync(ziel, { recursive: true, force: true })
mkdirSync(ordner, { recursive: true })

copyFileSync(gebaut, join(ordner, 'Ziegelon.exe'))
// Auch gleich nach release/, damit beide Stellen denselben Stand tragen.
mkdirSync(join(wurzel, 'release'), { recursive: true })
copyFileSync(gebaut, join(wurzel, 'release/Ziegelon.exe'))

// Byte-Reihenfolge-Marke und CRLF: so zeigt jede Windows-Fassung des Editors
// die Umlaute richtig an, auch eine aeltere.
writeFileSync(
  join(ordner, 'Bitte zuerst lesen.txt'),
  '﻿' + ANLEITUNG.replace(/\n/g, '\r\n'),
  'utf8',
)

// Packen ueber PowerShell - spart eine Abhaengigkeit, und die Windows-Fassung
// wird ohnehin nur unter Windows geschnuert.
execFileSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${ordner}' -DestinationPath '${zip}' -CompressionLevel Optimal -Force`,
  ],
  { stdio: 'inherit' },
)

const mb = (pfad) => (statSync(pfad).size / 1024 / 1024).toFixed(1)
console.log(`Ordner:  auslieferung/Ziegelon (${mb(join(ordner, 'Ziegelon.exe'))} MB)`)
console.log(`Gepackt: auslieferung/Ziegelon-Windows.zip (${mb(zip)} MB)`)
