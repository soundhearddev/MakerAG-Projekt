<?php
/**
 * API Endpoint: list_files.php
 * Listet alle PDF-Dateien in einem Unterordner unterhalb von BASE_DIR.
 *
 * GET ?path=some/folder → { files: ["doc1.pdf", "doc2.pdf"] }
 */

require_once __DIR__ . '/init.php';

define('BASE_DIR', realpath(__DIR__ . '/../'));

$requestedPath = getStringParam('path');

// Leerer Pfad → leeres Ergebnis
if ($requestedPath === '') {
    sendSuccess([], ['files' => [], 'count' => 0]);
    exit;
}

// Nur sichere Zeichen erlauben (keine ..)
if (!preg_match('/^[\w\-\/]+$/', $requestedPath)) {
    sendError('Ungültiger Pfad', 400);
}

$fullPath = BASE_DIR . '/' . $requestedPath;

// Ordner existiert nicht → leeres Array, kein Fehler
if (!is_dir($fullPath)) {
    sendSuccess([], ['files' => [], 'count' => 0]);
    exit;
}

// Nur jetzt realpath, da Ordner garantiert existiert
$resolvedPath = realpath($fullPath);

// Path-Traversal-Schutz
if (!$resolvedPath || !str_starts_with($resolvedPath, BASE_DIR)) {
    sendError('Zugriff verweigert', 403);
}

$files = array_values(array_filter(
    scandir($resolvedPath),
    fn($f) => is_file($resolvedPath . '/' . $f)
           && strtolower(pathinfo($f, PATHINFO_EXTENSION)) === 'pdf'
));

sendSuccess([], ['files' => $files, 'count' => count($files)]);