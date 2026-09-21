using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Ziegelon.Windows;

/// <summary>
/// Fenster, das die App anzeigt.
///
/// Die App wird nicht ueber file:// geladen, sondern ueber einen erfundenen
/// Rechnernamen, der auf den Ordner zeigt. Das hat einen handfesten Grund:
/// unter file:// gibt es keinen richtigen Ursprung, und damit auch keine
/// IndexedDB - die Bauvorhaben waeren nach jedem Start weg. Der Name bleibt
/// ueber alle Fassungen gleich, damit die Daten auch ein Update ueberleben.
/// </summary>
public sealed class Hauptfenster : Form
{
    private const string Rechnername = "ziegelon.local";
    private const string Startseite = $"https://{Rechnername}/index.html";

    private static readonly Color Grund = Color.FromArgb(0xF4, 0xF2, 0xEF);

    private readonly WebView2 _ansicht = new() { Dock = DockStyle.Fill };

    public Hauptfenster()
    {
        Text = "Ziegelon";
        BackColor = Grund;
        MinimumSize = new Size(420, 560);
        Size = new Size(1180, 860);
        StartPosition = FormStartPosition.CenterScreen;
        try { Icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath!); }
        catch { /* Ohne Symbol laeuft es genauso. */ }

        Controls.Add(_ansicht);
        Load += async (_, _) => await StartenAsync();
    }

    private async Task StartenAsync()
    {
        try
        {
            AppDateien.Auspacken();

            var umgebung = await CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null,
                userDataFolder: AppDateien.BrowserOrdner);
            await _ansicht.EnsureCoreWebView2Async(umgebung);

            var kern = _ansicht.CoreWebView2;
            kern.SetVirtualHostNameToFolderMapping(
                Rechnername, AppDateien.Ordner, CoreWebView2HostResourceAccessKind.Allow);

            // Es ist eine Anwendung, kein Browser: kein Zoom per Strg+Rad,
            // keine Entwicklerwerkzeuge, kein Dahinterliegendes Kontextmenue
            // mit "Seitenquelltext anzeigen".
            kern.Settings.IsZoomControlEnabled = false;
            kern.Settings.AreDevToolsEnabled = false;
            kern.Settings.AreDefaultContextMenusEnabled = false;
            kern.Settings.IsStatusBarEnabled = false;

            // Ein Klick auf einen fremden Link soll den richtigen Browser
            // oeffnen und nicht die App ueberschreiben.
            kern.NewWindowRequested += (_, e) =>
            {
                e.Handled = true;
                Oeffnen(e.Uri);
            };
            kern.NavigationStarting += (_, e) =>
            {
                if (e.Uri.StartsWith($"https://{Rechnername}", StringComparison.OrdinalIgnoreCase)) return;
                e.Cancel = true;
                Oeffnen(e.Uri);
            };

            kern.Navigate(Startseite);
        }
        catch (WebView2RuntimeNotFoundException)
        {
            Fehler(
                "Auf diesem Rechner fehlt die WebView2-Laufzeit.\n\n" +
                "Sie ist auf Windows 10 und 11 normalerweise vorhanden und lässt sich " +
                "kostenlos bei Microsoft nachinstallieren:\n" +
                "https://developer.microsoft.com/microsoft-edge/webview2/");
        }
        catch (Exception ex)
        {
            Fehler($"Die App ließ sich nicht starten:\n\n{ex.Message}");
        }
    }

    private static void Oeffnen(string adresse)
    {
        try
        {
            System.Diagnostics.Process.Start(
                new System.Diagnostics.ProcessStartInfo(adresse) { UseShellExecute = true });
        }
        catch
        {
            // Kein Standardbrowser hinterlegt - dann passiert eben nichts.
        }
    }

    private void Fehler(string text)
    {
        MessageBox.Show(this, text, "Ziegelon", MessageBoxButtons.OK, MessageBoxIcon.Error);
        Close();
    }
}
