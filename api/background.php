<?php
/**
 * get_data.php
 * Listet Dateien aus dem Dateisystem für ein Item auf.
 * Liest aus:
 *   /docs/{id}/images/   → type=image
 *   /docs/{id}/data/     → type=pdf (und andere Dokumente)
 *
 * GET ?id=42&type=image  → alle Bilder für Item 42
 * GET ?id=42&type=pdf    → alle PDFs für Item 42
 * GET ?id=42&type=all    → alles
 */

require_once __DIR__ . '/init.php';

$itemId = getIntParam('id');
$type   = getStringParam('type', 'pdf'); // Standard: nur PDFs

if ($itemId <= 0) {
    sendError('Fehlende oder ungültige id', 400);
}

// ─── Erlaubte Dateierweiterungen je Typ ───────────────────────────────────────
$imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
$pdfExts   = ['pdf'];
$dataExts  = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip'];

// ─── Zu durchsuchende Verzeichnisse bestimmen ────────────────────────────────
// rtrim entfernt den abschließenden / falls DOCUMENT_ROOT ihn hat
$docRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '/var/www/public', '/');

// match = modernes PHP 8 switch, gibt einen Wert zurück.
// Je nach $type verschiedene Ordner mit ihren erlaubten Dateitypen definieren.
// 'path' = absoluter Pfad auf dem Server (für is_dir, scandir, filesize usw.)
// 'webBase' = relativer Web-Pfad der im JSON zurückgegeben wird (für den Browser)
$dirs = match ($type) {
    'image' => [[
        'path'    => "{$docRoot}/docs/{$itemId}/images/",
        'webBase' => "/docs/{$itemId}/images/",
        'exts'    => $imageExts,
    ]],
    'pdf' => [[
        'path'    => "{$docRoot}/docs/{$itemId}/data/",
        'webBase' => "/docs/{$itemId}/data/",
        'exts'    => $pdfExts,
    ]],
    'all' => [
        [
            'path'    => "{$docRoot}/docs/{$itemId}/images/",
            'webBase' => "/docs/{$itemId}/images/",
            'exts'    => $imageExts,
        ],
        [
            'path'    => "{$docRoot}/docs/{$itemId}/data/",
            'webBase' => "/docs/{$itemId}/data/",
            'exts'    => $dataExts,
        ],
    ],
    // default = alles was nicht 'image', 'pdf', 'all' ist → data-Ordner
    default => [[
        'path'    => "{$docRoot}/docs/{$itemId}/data/",
        'webBase' => "/docs/{$itemId}/data/",
        'exts'    => $dataExts,
    ]],
};

// ─── Dateien einlesen ─────────────────────────────────────────────────────────
$files = [];

foreach ($dirs as $dir) {
    // is_dir = prüft ob der Ordner existiert (nicht jedes Item hat Dateien)
    if (!is_dir($dir['path'])) {
        continue; // Ordner nicht vorhanden → nächsten Ordner probieren
    }

    // scandir liest alle Einträge im Ordner (inkl. '.' und '..')
    $entries = scandir($dir['path']);
    if ($entries === false) {
        continue; // Keine Leserechte oder anderer Fehler
    }

    foreach ($entries as $filename) {
        // '.' = aktueller Ordner, '..' = übergeordneter Ordner → überspringen
        // str_starts_with = versteckte Dateien ignorieren (.htaccess, .DS_Store usw.)
        if ($filename === '.' || $filename === '..' || str_starts_with($filename, '.')) {
            continue;
        }

        $fullPath = $dir['path'] . $filename;
        // is_file = sicherstellen dass es keine Unterordner sind
        if (!is_file($fullPath)) {
            continue;
        }

        // pathinfo mit PATHINFO_EXTENSION gibt nur die Dateiendung zurück: "PDF" → "pdf"
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        // in_array(..., true) = strikter Vergleich (kein Typ-Coercing)
        if (!in_array($ext, $dir['exts'], true)) {
            continue; // Dateiendung nicht erlaubt → überspringen
        }

        // ─── Dateityp bestimmen ────────────────────────────────────────────────
        // match(true) = der erste case der true ergibt wird genommen
        // in_array für Listen, direkter Vergleich für einzelne Werte
        $fileType = match (true) {
            in_array($ext, $imageExts, true)           => 'image',
            $ext === 'pdf'                             => 'pdf',
            in_array($ext, ['doc', 'docx'], true)      => 'document',
            in_array($ext, ['xls', 'xlsx'], true)      => 'spreadsheet',
            default                                    => 'file',
        };

        $files[] = [
            'filename'   => $filename,
            'path'       => $dir['webBase'] . $filename,  // Web-Pfad für den Browser
            'type'       => $fileType,
            'ext'        => $ext,
            'size'       => filesize($fullPath),           // Dateigröße in Bytes
            // date() mit filemtime() = letzte Änderungszeit als lesbaren String
            'modified'   => date('Y-m-d H:i:s', filemtime($fullPath)),
        ];
    }
}

// ─── Alphabetisch sortieren ───────────────────────────────────────────────────
// usort = sortieren mit eigener Vergleichsfunktion
// fn($a, $b) = Arrow Function (PHP 7.4+), strcmp vergleicht zwei Strings alphabetisch
// strcmp gibt negativ/0/positiv zurück – genau was usort braucht
usort($files, fn($a, $b) => strcmp($a['filename'], $b['filename']));

sendSuccess($files, ['count' => count($files)]);