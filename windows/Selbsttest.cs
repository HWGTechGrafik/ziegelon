using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Ziegelon.Windows;

/// <summary>
/// Startet die App unsichtbar und prueft im laufenden Fenster nach, ob sie
/// wirklich funktioniert. Das Ergebnis landet als JSON in einer Datei.
///
/// Es gibt diesen Weg, weil sich der Inhalt eines WebView2 nicht von aussen
/// abbilden laesst - er wird in einem eigenen Prozess gezeichnet. Ohne eine
/// Pruefung von innen bliebe offen, ob die Seite ueberhaupt laedt und ob
/// IndexedDB unter dem erfundenen Rechnernamen arbeitet. Genau daran haengt
/// alles: ohne IndexedDB waeren die Bauvorhaben nach jedem Start weg.
/// </summary>
public static class Selbsttest
{
    private const string Rechnername = "ziegelon.local";

    private const string Pruefskript = """
        window.__pruefung = null;
        (async () => {
          const ergebnis = {
            titel: document.title,
            herkunft: location.origin,
            oberflaecheGeladen: !!document.querySelector('#root')?.children.length,
            textanfang: (document.body.innerText || '').trim().slice(0, 120),
            signaturpruefungVorhanden: typeof crypto?.subtle?.importKey === 'function',
          };
          try {
            const db = await new Promise((gut, schlecht) => {
              const anfrage = indexedDB.open('ziegelon-selbsttest', 1);
              anfrage.onupgradeneeded = () => anfrage.result.createObjectStore('proben');
              anfrage.onsuccess = () => gut(anfrage.result);
              anfrage.onerror = () => schlecht(anfrage.error);
            });
            await new Promise((gut, schlecht) => {
              const t = db.transaction('proben', 'readwrite').objectStore('proben').put('gespeichert', 'k');
              t.onsuccess = gut; t.onerror = () => schlecht(t.error);
            });
            ergebnis.indexedDb = await new Promise((gut, schlecht) => {
              const t = db.transaction('proben', 'readonly').objectStore('proben').get('k');
              t.onsuccess = () => gut(t.result); t.onerror = () => schlecht(t.error);
            });
            db.close();
            indexedDB.deleteDatabase('ziegelon-selbsttest');
          } catch (fehler) {
            ergebnis.indexedDb = 'FEHLER: ' + fehler;
          }
          window.__pruefung = JSON.stringify(ergebnis);
        })();
        """;

    public static async Task<int> AusfuehrenAsync(string zieldatei)
    {
        var bericht = "{}";
        using var fenster = new Form
        {
            // Ausserhalb des Bildschirms: das Fenster muss sichtbar sein,
            // damit WebView2 wirklich zeichnet, soll aber niemanden stoeren.
            StartPosition = FormStartPosition.Manual,
            Location = new Point(-4000, -4000),
            Size = new Size(1180, 860),
            ShowInTaskbar = false,
        };
        using var ansicht = new WebView2 { Dock = DockStyle.Fill };
        fenster.Controls.Add(ansicht);
        fenster.Show();

        try
        {
            AppDateien.Auspacken();

            var umgebung = await CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null,
                userDataFolder: AppDateien.BrowserOrdner);
            await ansicht.EnsureCoreWebView2Async(umgebung);

            ansicht.CoreWebView2.SetVirtualHostNameToFolderMapping(
                Rechnername, AppDateien.Ordner, CoreWebView2HostResourceAccessKind.Allow);

            var geladen = new TaskCompletionSource<bool>();
            ansicht.CoreWebView2.NavigationCompleted += (_, e) => geladen.TrySetResult(e.IsSuccess);

            ansicht.CoreWebView2.Navigate($"https://{Rechnername}/index.html");

            var erfolgreich = await WarteAuf(geladen.Task, TimeSpan.FromSeconds(30));
            if (!erfolgreich)
            {
                bericht = """{"fehler":"Die Seite wurde nicht geladen."}""";
            }
            else
            {
                // Der Oberflaeche einen Moment geben, sich aufzubauen.
                await Task.Delay(1500);
                await ansicht.CoreWebView2.ExecuteScriptAsync(Pruefskript);

                // ExecuteScriptAsync wartet nicht auf Zusagen, deshalb nachfragen.
                for (var versuch = 0; versuch < 50; versuch++)
                {
                    var roh = await ansicht.CoreWebView2.ExecuteScriptAsync("window.__pruefung");
                    if (roh is not "null" and not "undefined")
                    {
                        bericht = System.Text.Json.JsonSerializer.Deserialize<string>(roh) ?? roh;
                        break;
                    }
                    await Task.Delay(200);
                }
            }
        }
        catch (Exception ex)
        {
            bericht = System.Text.Json.JsonSerializer.Serialize(new { fehler = ex.Message });
        }

        await File.WriteAllTextAsync(zieldatei, bericht);
        fenster.Close();
        return bericht.Contains("\"fehler\"") ? 1 : 0;
    }

    private static async Task<bool> WarteAuf(Task<bool> aufgabe, TimeSpan frist)
    {
        var fertig = await Task.WhenAny(aufgabe, Task.Delay(frist));
        return fertig == aufgabe && aufgabe.Result;
    }
}
