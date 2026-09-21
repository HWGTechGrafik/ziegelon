using System.Reflection;

namespace Ziegelon.Windows;

/// <summary>
/// Packt die in der exe mitgelieferte App auf die Platte aus.
///
/// WebView2 kann nur aus einem Ordner heraus anzeigen, nicht aus Ressourcen.
/// Ausgepackt wird bei jedem Start neu: die App ist wenige hundert Kilobyte
/// gross, das dauert nicht messbar, und es kann kein Rest einer aelteren
/// Fassung liegen bleiben.
/// </summary>
public static class AppDateien
{
    private const string Praefix = "app/";

    /// <summary>Ordner unter %LOCALAPPDATA%, in dem die App liegt.</summary>
    public static string Ordner { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Ziegelon", "app");

    /// <summary>
    /// Eigener Ordner fuer WebView2. Muss fest liegen, sonst waeren nach
    /// jedem Start alle Bauvorhaben weg.
    /// </summary>
    public static string BrowserOrdner { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Ziegelon", "browser");

    public static void Auspacken()
    {
        var quelle = Assembly.GetExecutingAssembly();
        var namen = quelle.GetManifestResourceNames()
            .Where(n => n.StartsWith(Praefix, StringComparison.Ordinal))
            .ToArray();

        if (namen.Length == 0)
        {
            throw new InvalidOperationException(
                "In dieser Datei steckt keine App. Vor dem Bauen muss 'npm run build' gelaufen sein.");
        }

        if (Directory.Exists(Ordner)) Directory.Delete(Ordner, recursive: true);
        Directory.CreateDirectory(Ordner);

        foreach (var name in namen)
        {
            // MSBuild setzt je nach Plattform beide Trennzeichen ein.
            var relativ = name[Praefix.Length..].Replace('\\', '/');
            var ziel = Path.Combine(Ordner, relativ.Replace('/', Path.DirectorySeparatorChar));

            Directory.CreateDirectory(Path.GetDirectoryName(ziel)!);
            using var strom = quelle.GetManifestResourceStream(name)
                ?? throw new InvalidOperationException($"Die Ressource {name} liess sich nicht lesen.");
            using var datei = File.Create(ziel);
            strom.CopyTo(datei);
        }
    }
}
