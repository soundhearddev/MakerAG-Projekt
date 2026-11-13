<?php

require_once __DIR__ . '/init.php';

$id = getIntParam('id');
if ($id <= 0) {
    sendError('Gültige id (> 0) erforderlich');
}

try {
    $stmt = $db->prepare('SELECT * FROM items WHERE id = ?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    // Immer ein Array, auch bei genau einem Treffer: das Frontend erwartet dieses Format.
    $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    sendSuccess(enrichItems($items), ['count' => count($items)]);
} catch (Throwable $e) {
    sendException($e);
}
