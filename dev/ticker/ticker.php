<?php
require_once __DIR__ . '/../../api/init.php';

try {
    $result = $db->query("SELECT id, name, problem, created_at FROM feedback ORDER BY created_at DESC");
    if ($result === false) {
        sendError('Datenbankfehler', 500);
    }
    $rows = $result->fetch_all(MYSQLI_ASSOC);
    sendSuccess($rows, ['count' => count($rows)]);
} catch (Exception $e) {
    error_log('ticker.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}