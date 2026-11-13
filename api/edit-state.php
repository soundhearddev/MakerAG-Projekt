<?php

/**
 * POST { id: 17, status: "defekt" }
 */

require_once __DIR__ . '/init.php';

requireMethod('POST');
requireWriteAccess();
enforceRateLimit();

const ALLOWED_STATES = ['verfügbar', 'ausgeliehen', 'defekt', 'verschollen', 'entsorgt'];

$body = readJsonBody();
$id = (int) ($body['id'] ?? 0);
$status = trim((string) ($body['status'] ?? ''));

if ($id <= 0) {
    sendError('Ungültige ID', 400);
}
if (!in_array($status, ALLOWED_STATES, true)) {
    sendError('Ungültiger Status', 400);
}

try {
    $stmt = $db->prepare('SELECT id FROM items WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        sendError('Item nicht gefunden', 404);
    }

    $stmt = $db->prepare('UPDATE items SET status = ?, updated_at = NOW() WHERE id = ?');
    $stmt->bind_param('si', $status, $id);
    $stmt->execute();

    sendSuccess(['id' => $id, 'status' => $status]);
} catch (Throwable $e) {
    sendException($e);
}
