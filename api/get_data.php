<?php
/**
 * get_data.php
 * ─────────────────────────────────────────────────────────────────────────────
 * Listet Dateien aus dem Dateisystem für ein Item auf.
 * Liest aus:
 *   /docs/{id}/images/   → type=image
 *   /docs/{id}/data/     → type=pdf  (und andere Dokumente)
 *
 * Parameter:
 *   id   (int)    – Item-ID
 *   type (string) – 'image' | 'pdf' | 'all'  (Standard: 'pdf')
 * ─────────────────────────────────────────────────────────────────────────────
 */

require_once __DIR__ . '/init.php';

$itemId = getIntParam('id');
$type   = getStringParam('type', 'pdf');

if ($itemId <= 0) {
    sendError('Fehlende oder ungültige id', 400);
}

// ─── Erlaubte Erweiterungen je Typ ────────────────────────────────────────────
$imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
$pdfExts   = ['pdf'];
$dataExts  = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip'];

// ─── Verzeichnisse bestimmen ─────────────────────────────────────────────────
$docRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '/var/www/public', '/');

$dirs = match ($type) {
    'image' => [
        [
            'path'    => "{$docRoot}/docs/{$itemId}/images/",
            'webBase' => "/docs/{$itemId}/images/",
            'exts'    => $imageExts,
        ],
    ],
    'pdf' => [
        [
            'path'    => "{$docRoot}/docs/{$itemId}/data/",
            'webBase' => "/docs/{$itemId}/data/",
            'exts'    => $pdfExts,
        ],
    ],
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
    default => [
        [
            'path'    => "{$docRoot}/docs/{$itemId}/data/",
            'webBase' => "/docs/{$itemId}/data/",
            'exts'    => $dataExts,
        ],
    ],
};

// ─── Dateien einlesen ─────────────────────────────────────────────────────────
$files = [];

foreach ($dirs as $dir) {
    if (!is_dir($dir['path'])) {
        continue;
    }

    $entries = scandir($dir['path']);
    if ($entries === false) {
        continue;
    }

    foreach ($entries as $filename) {
        // Versteckte Dateien und Verzeichnisse überspringen
        if ($filename === '.' || $filename === '..' || str_starts_with($filename, '.')) {
            continue;
        }

        $fullPath = $dir['path'] . $filename;
        if (!is_file($fullPath)) {
            continue;
        }

        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (!in_array($ext, $dir['exts'], true)) {
            continue;
        }

        // Dateityp bestimmen
        $fileType = match (true) {
            in_array($ext, $imageExts, true)   => 'image',
            $ext === 'pdf'                     => 'pdf',
            in_array($ext, ['doc', 'docx'], true) => 'document',
            in_array($ext, ['xls', 'xlsx'], true) => 'spreadsheet',
            default                            => 'file',
        };

        $files[] = [
            'filename'   => $filename,
            'path'       => $dir['webBase'] . $filename,
            'type'       => $fileType,
            'ext'        => $ext,
            'size'       => filesize($fullPath),
            'modified'   => date('Y-m-d H:i:s', filemtime($fullPath)),
        ];
    }
}

// Nach Dateiname sortieren
usort($files, fn($a, $b) => strcmp($a['filename'], $b['filename']));

sendSuccess($files, ['count' => count($files)]);