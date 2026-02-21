<?php
/**
 * API Endpoint: background.php
 * Verwaltet SVG-Hintergrundmuster (auflisten, hochladen, löschen, info).
 *
 * GET  ?action=list              → Alle SVGs auflisten
 * POST ?action=delete  + name    → SVG löschen
 * GET  ?action=info    + name    → Infos zu einer SVG-Datei
 * GET  ?action=debug             → Debug-Infos
 */

require_once __DIR__ . '/bootstrap.php';

// ─── Konfiguration ────────────────────────────────────────────────────────────
define('BG_FOLDER', dirname(__DIR__) . '/images/background/');
define('WEB_PATH',  '/images/background/');

// ─── Ordner sicherstellen ─────────────────────────────────────────────────────
if (!is_dir(BG_FOLDER) && !@mkdir(BG_FOLDER, 0755, true)) {
    error_log('background.php: mkdir fehlgeschlagen – ' . BG_FOLDER);
    sendError('Ordner konnte nicht erstellt werden', 500);
}
if (!is_readable(BG_FOLDER)) {
    sendError('Kein Lesezugriff auf den Hintergrundordner', 500);
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

// ─── Action ───────────────────────────────────────────────────────────────────
$action = getStringParam('action', 'list');

// ─── LIST ─────────────────────────────────────────────────────────────────────
if ($action === 'list') {
    $files    = @glob(BG_FOLDER . '*.svg') ?: [];
    $patterns = [];

    foreach ($files as $file) {
        $name = basename($file);
        if ($name[0] === '.') continue;
        $patterns[] = [
            'name'     => $name,
            'path'     => WEB_PATH . $name,
            'size'     => (int) @filesize($file),
            'modified' => (int) @filemtime($file),
        ];
    }

    usort($patterns, fn($a, $b) => strcmp($a['name'], $b['name']));
    sendSuccess($patterns, ['count' => count($patterns)]);
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
if ($action === 'delete') {
    $name = basename(getStringParam('name'));

    if ($name === '') sendError('Kein Dateiname angegeben', 400);
    if (pathinfo($name, PATHINFO_EXTENSION) !== 'svg') sendError('Nur SVG-Dateien können gelöscht werden', 400);

    $path = BG_FOLDER . $name;
    if (!file_exists($path)) sendError('Datei nicht gefunden: ' . $name, 404);

    if (!@unlink($path)) {
        error_log('background.php: unlink fehlgeschlagen – ' . $path);
        sendError('Löschen fehlgeschlagen – Schreibrecht prüfen', 500);
    }

    error_log('background.php: Gelöscht – ' . $name);
    sendSuccess(['deleted' => $name], ['message' => 'Pattern gelöscht']);
}

// ─── INFO ─────────────────────────────────────────────────────────────────────
if ($action === 'info') {
    $name = basename(getStringParam('name'));
    if ($name === '') sendError('Kein Dateiname angegeben', 400);

    $path = BG_FOLDER . $name;
    if (!file_exists($path)) sendError('Datei nicht gefunden: ' . $name, 404);

    $info = [
        'name'     => $name,
        'path'     => WEB_PATH . $name,
        'size'     => (int) filesize($path),
        'modified' => (int) filemtime($path),
        'readable' => is_readable($path),
        'writable' => is_writable($path),
    ];

    $content = @file_get_contents($path);
    if ($content) {
        if (preg_match('/\bwidth=["\']([^"\']+)["\']/',   $content, $m)) $info['width']   = $m[1];
        if (preg_match('/\bheight=["\']([^"\']+)["\']/',  $content, $m)) $info['height']  = $m[1];
        if (preg_match('/\bviewBox=["\']([^"\']+)["\']/', $content, $m)) $info['viewBox'] = $m[1];
    }

    sendSuccess(['pattern' => $info]);
}

// ─── DEBUG ────────────────────────────────────────────────────────────────────
if ($action === 'debug') {
    $files = @glob(BG_FOLDER . '*.svg') ?: [];
    sendSuccess([
        'bg_folder'     => BG_FOLDER,
        'web_path'      => WEB_PATH,
        'folder_exists' => is_dir(BG_FOLDER),
        'is_readable'   => is_readable(BG_FOLDER),
        'is_writable'   => is_writable(BG_FOLDER),
        'svg_count'     => count($files),
        'svg_files'     => array_map('basename', $files),
        'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? '(nicht gesetzt)',
        'script_dir'    => __DIR__,
        'php_version'   => PHP_VERSION,
        'post_max'      => ini_get('post_max_size'),
    ]);
}

// ─── Fallback ─────────────────────────────────────────────────────────────────
sendError("Unbekannte Aktion: '{$action}'", 400);