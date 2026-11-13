<?php

/**
 * Listet Dateien eines Items aus dem Dateisystem.
 *
 * GET ?id=42&type=image   Bilder   (docs/items/42/images/)
 * GET ?id=42&type=pdf     PDFs     (docs/items/42/data/)
 * GET ?id=42&type=html    HTML     (docs/items/42/data/)
 * GET ?id=42&type=all     Bilder und Dokumente
 * GET ?id=42              Dokumente (Standard)
 */

require_once __DIR__ . '/init.php';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
const DATA_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip'];

$itemId = getIntParam('id');
if ($itemId <= 0) {
    sendError('Fehlende oder ungültige id', 400);
}

// Zu durchsuchende Unterordner mit den dort erlaubten Endungen.
$sources = match (getStringParam('type', 'pdf')) {
    'image' => ['images' => IMAGE_EXTS],
    'pdf' => ['data' => ['pdf']],
    'html' => ['data' => ['html', 'htm']],
    'all' => ['images' => IMAGE_EXTS, 'data' => DATA_EXTS],
    default => ['data' => DATA_EXTS],
};

$files = [];

foreach ($sources as $sub => $allowedExts) {
    $dir = findItemDir($itemId, $sub);
    if ($dir === null) {
        continue;
    }

    foreach (scandir($dir) ?: [] as $filename) {
        // Versteckte Dateien (inkl. . und ..) und Unterordner überspringen.
        if (str_starts_with($filename, '.') || !is_file($dir . $filename)) {
            continue;
        }

        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowedExts, true)) {
            continue;
        }

        $files[] = [
            'filename' => $filename,
            'path' => "/docs/items/{$itemId}/{$sub}/{$filename}",
            'type' => match (true) {
                in_array($ext, IMAGE_EXTS, true) => 'image',
                $ext === 'pdf' => 'pdf',
                in_array($ext, ['html', 'htm'], true) => 'html',
                in_array($ext, ['doc', 'docx'], true) => 'document',
                in_array($ext, ['xls', 'xlsx'], true) => 'spreadsheet',
                default => 'file',
            },
            'ext' => $ext,
            'size' => filesize($dir . $filename),
            'modified' => date('Y-m-d H:i:s', filemtime($dir . $filename)),
        ];
    }
}

usort($files, static fn(array $a, array $b): int => strcmp($a['filename'], $b['filename']));

sendSuccess($files, ['count' => count($files)]);
