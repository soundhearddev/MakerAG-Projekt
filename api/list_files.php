<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

define('BASE_DIR', realpath(__DIR__ . '/../docs'));

if (BASE_DIR === false) {
    http_response_code(500);
    echo json_encode(['error' => true, 'message' => 'BASE_DIR existiert nicht']);
    exit;
}

$requestedPath = urldecode($_GET['path'] ?? '');
$requestedPath = trim($requestedPath, '/');

if ($requestedPath !== '' && !preg_match('#^[a-zA-Z0-9_\-/]+$#', $requestedPath)) {
    http_response_code(400);
    echo json_encode(['error' => true, 'message' => 'Ungültiger Pfad']);
    exit;
}

$targetPath = realpath(BASE_DIR . '/' . $requestedPath);

if ($targetPath === false || strpos($targetPath, BASE_DIR) !== 0) {
    http_response_code(403);
    echo json_encode(['error' => true, 'message' => 'Zugriff verweigert']);
    exit;
}

if (!is_dir($targetPath)) {
    echo json_encode(['files' => []]);
    exit;
}

$files = array_values(array_filter(
    scandir($targetPath),
    fn($f) =>
        is_file($targetPath . '/' . $f) &&
        strtolower(pathinfo($f, PATHINFO_EXTENSION)) === 'pdf'
));

sort($files, SORT_NATURAL | SORT_FLAG_CASE);

echo json_encode(['files' => $files]);
