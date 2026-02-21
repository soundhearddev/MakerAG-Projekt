<?php
/**
 * API Endpoint: list_files.php
 * Listet alle PDF-Dateien in einem Unterordner unterhalb von BASE_DIR.
 *
 * GET ?path=some/folder → { files: ["doc1.pdf", "doc2.pdf"] }
 */

require_once __DIR__ . './init.php';



define('BASE_DIR', realpath(__DIR__ . '/../'));

$requestedPath = getStringParam('path');

// Nur sichere Zeichen erlauben
if ($requestedPath !== '' && !preg_match('/^[\w\-\/\.]+$/', $requestedPath)) {
    sendError('Ungültiger Pfad', 400);
}

$fullPath = realpath(BASE_DIR . '/' . $requestedPath);

// Path-Traversal-Schutz
if (!$fullPath || strpos($fullPath, BASE_DIR) !== 0) {
    sendError('Zugriff verweigert', 403);
}

if (!is_dir($fullPath)) {
    sendSuccess([], ['files' => []]);
}

$files = array_values(array_filter(
    scandir($fullPath),
    fn($f) => is_file($fullPath . '/' . $f)
           && strtolower(pathinfo($f, PATHINFO_EXTENSION)) === 'pdf'
));

sendSuccess([], ['files' => $files, 'count' => count($files)]);