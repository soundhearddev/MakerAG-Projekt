<?php
require_once __DIR__ . '/init.php';

// item_id aus Query-Parameter holen
$itemId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
$type   = $_GET['type'] ?? 'pdf'; // 'pdf' oder 'image' (erweiterbar)

if ($itemId <= 0) {
    sendError('Fehlende oder ungültige item_id', 400);
    exit;
}

// Erlaubte MIME-/Typ-Werte in der DB
$allowedTypes = match ($type) {
    'image' => ['bild'],
    'pdf'   => ['pdf', 'rechnung', 'anleitung', 'garantie', 'sonstiges'],
    default => ['pdf', 'rechnung', 'anleitung', 'garantie', 'sonstiges'],
};

// Platzhalter für IN-Klausel bauen
$placeholders = implode(',', array_fill(0, count($allowedTypes), '?'));

$stmt = $pdo->prepare(
    "SELECT id, filename, path, type, uploaded_at
     FROM documents
     WHERE item_id = ?
       AND type IN ($placeholders)
     ORDER BY uploaded_at ASC"
);

$stmt->execute(array_merge([$itemId], $allowedTypes));
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Dateien als Array aufbereiten
$files = array_map(fn($row) => [
    'id'          => (int) $row['id'],
    'filename'    => $row['filename'],
    'path'        => rtrim($row['path'], '/') . '/' . $row['filename'],
    'type'        => $row['type'],
    'uploaded_at' => $row['uploaded_at'],
], $rows);

sendSuccess([], [
    'files' => $files,
    'count' => count($files),
]);