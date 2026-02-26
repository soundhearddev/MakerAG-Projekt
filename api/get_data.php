<?php
require_once __DIR__ . '/init.php';

$itemId = getIntParam('id');
$type   = getStringParam('type', 'pdf');

if ($itemId <= 0) {
    sendError('Fehlende oder ungültige id', 400);
}

// Erlaubte DB-Typen je nach Anfrage
$allowedTypes = match ($type) {
    'image' => ['bild'],
    'pdf'   => ['pdf', 'rechnung', 'anleitung', 'garantie', 'sonstiges'],
    default => ['pdf', 'rechnung', 'anleitung', 'garantie', 'sonstiges'],
};

$placeholders = implode(',', array_fill(0, count($allowedTypes), '?'));
$types        = str_repeat('s', count($allowedTypes));

$stmt = $db->prepare(
    "SELECT id, filename, path, type, uploaded_at
     FROM documents
     WHERE item_id = ?
       AND type IN ($placeholders)
     ORDER BY uploaded_at ASC"
);

// bind_param: erst 'i' für item_id, dann 's' für jeden Typ
$stmt->bind_param('i' . $types, $itemId, ...$allowedTypes);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$files = array_map(fn($row) => [
    'id'          => (int) $row['id'],
    'filename'    => $row['filename'],
    'path'        => rtrim($row['path'], '/') . '/' . $row['filename'],
    'type'        => $row['type'],
    'uploaded_at' => $row['uploaded_at'],
], $rows);

sendSuccess($files, ['count' => count($files)]);