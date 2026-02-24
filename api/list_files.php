<?php
require_once __DIR__ . '/init.php';

define('BASE_DIR', realpath(__DIR__ . '/../'));

$requestedPath = getStringParam('path');
$type = $_GET['type'] ?? 'pdf';

if ($requestedPath === '') {
    sendSuccess([], ['files' => [], 'count' => 0]);
    exit;
}

// Keine .. erlauben, sonst nur Wort-Zeichen, Bindestrich, Slash, Punkt, Leerzeichen
if (str_contains($requestedPath, '..')) {
    sendError('Ungültiger Pfad', 400);
}

$fullPath = BASE_DIR . '/' . $requestedPath;

if (!is_dir($fullPath)) {
    sendSuccess([], ['files' => [], 'count' => 0]);
    exit;
}

$resolvedPath = realpath($fullPath);

if (!$resolvedPath || !str_starts_with($resolvedPath, BASE_DIR)) {
    sendError('Zugriff verweigert', 403);
}

$allowed = match($type) {
    'image' => ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    default => ['pdf'],
};

$files = array_values(array_filter(
    scandir($resolvedPath),
    fn($f) => is_file($resolvedPath . '/' . $f)
           && in_array(strtolower(pathinfo($f, PATHINFO_EXTENSION)), $allowed)
));

sendSuccess([], ['files' => $files, 'count' => count($files)]);