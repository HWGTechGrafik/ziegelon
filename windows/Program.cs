namespace Ziegelon.Windows;

internal static class Program
{
    /// <summary>
    /// Startet das Fenster.
    ///
    /// Mit <c>--selbsttest &lt;datei.json&gt;</c> wird die App stattdessen
    /// unsichtbar geladen und von innen geprueft. Siehe Selbsttest.
    /// </summary>
    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);

        var i = Array.IndexOf(args, "--selbsttest");
        if (i >= 0 && i + 1 < args.Length)
        {
            var ergebnis = 1;
            // WinForms braucht eine laufende Nachrichtenschleife, damit
            // WebView2 ueberhaupt zeichnet - deshalb der Umweg ueber Run.
            Application.Idle += Einmal;
            Application.Run();
            return ergebnis;

            async void Einmal(object? s, EventArgs e)
            {
                Application.Idle -= Einmal;
                ergebnis = await Selbsttest.AusfuehrenAsync(args[i + 1]);
                Application.ExitThread();
            }
        }

        Application.Run(new Hauptfenster());
        return 0;
    }
}
