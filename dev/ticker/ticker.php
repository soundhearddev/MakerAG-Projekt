<?php

require_once __DIR__ . '/../../api/init.php';

requireWriteAccess();

try {
    $result = $db->query('SELECT id, name, problem, created_at FROM feedback ORDER BY created_at DESC');
    $rows = $result->fetch_all(MYSQLI_ASSOC);
    sendSuccess($rows, ['count' => count($rows)]);
} catch (Throwable $e) {
    sendException($e);
}
