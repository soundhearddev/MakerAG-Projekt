<?php

// Gibt alle Dateien in einem Unterordner als JSON zurück.
// Erlaubte Basis-Pfade sind nur unterhalb von BASE_DIR.

header("Content-Type: application/json");

define("BASE_DIR", realpath(__DIR__ . "/../"));   // Passe diesen Pfad ggf. an

$requestedPath = $_GET["path"] ?? "";

// Sicherheits-Check: Nur alphanumerische Zeichen, Slash und Punkt erlaubt
if (!preg_match('/^[\w\-\/\.]+$/', $requestedPath)) {
    http_response_code(400);
    echo json_encode(["error" => true, "message" => "Ungültiger Pfad"]);
    exit;
}

$fullPath = realpath(BASE_DIR . "/" . $requestedPath);

// Sicherstellen, dass der Pfad wirklich innerhalb von BASE_DIR liegt (Path-Traversal-Schutz)
if (!$fullPath || strpos($fullPath, BASE_DIR) !== 0) {
    http_response_code(403);
    echo json_encode(["error" => true, "message" => "Zugriff verweigert"]);
    exit;
}

if (!is_dir($fullPath)) {
    echo json_encode(["files" => []]);
    exit;
}

$files = array_values(array_filter(
    scandir($fullPath),
    fn($f) => is_file($fullPath . "/" . $f) && strtolower(pathinfo($f, PATHINFO_EXTENSION)) === "pdf"
));

echo json_encode(["files" => $files]);