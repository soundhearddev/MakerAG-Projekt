<?php
require_once __DIR__ . '/init.php';

$id = getIntParam('id');

try {
    if ($id > 0) {
        $stmt = $db->prepare("SELECT * FROM items WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        // fetch_assoc = eine Zeile, dann mit enrichItem anreichern
        $item = $stmt->get_result()->fetch_assoc();

        if (!$item) {
            sendError("Item mit ID {$id} nicht gefunden", 404);
        }

        sendSuccess(enrichItem($item));
    } else {
        // Kein ID-Parameter → alle Items zurückgeben, neueste zuerst
        $result = $db->query("SELECT * FROM items ORDER BY id DESC");
        $items  = $result->fetch_all(MYSQLI_ASSOC);

        sendSuccess(enrichItems($items), ['count' => count($items)]);
    }
} catch (Exception $e) {
    error_log('fetch_item.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}