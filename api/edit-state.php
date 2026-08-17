<?php
/**
 * edit-state.php
 * POST { id: 17, status: "defekt" }
 */

require_once __DIR__ . '/init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Nur POST erlaubt', 405);
}

require_once __DIR__ . '/RateLimiter.php';

$rateLimiter = new RateLimiter();
if (!$rateLimiter->check()) {
    sendError('Zu viele Anfragen – bitte warte kurz', 429);
}

// Input
$body   = json_decode(file_get_contents('php://input'), true);
$id     = isset($body['id'])     ? (int) $body['id']                                  : 0;
$status = isset($body['status']) ? mb_substr(trim($body['status']), 0, 100, 'UTF-8')  : '';

if ($id <= 0) sendError('Ungültige ID', 400);

$allowed = ['verfügbar', 'ausgeliehen', 'defekt', 'verschollen', 'entsorgt'];
if (!in_array($status, $allowed, true)) {
    sendError('Ungültiger Status: ' . $status, 400);
}

// DB
try {

    $check = $db->prepare("SELECT id FROM items WHERE id = ? LIMIT 1");
    $check->bind_param('i', $id);
    $check->execute();
    if ($check->get_result()->num_rows === 0) sendError('Item nicht gefunden', 404);

    $stmt = $db->prepare("UPDATE items SET status = ?, updated_at = NOW() WHERE id = ?");
    $stmt->bind_param('si', $status, $id);
    $stmt->execute();

    sendSuccess(['id' => $id, 'status' => $status]);

} catch (Throwable $e) {
    sendError($e->getMessage(), 500);
}