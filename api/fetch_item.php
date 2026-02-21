<?php
/**
 * API Endpoint: fetch_item.php
 * Gibt ein einzelnes Item per ID zurück, oder alle Items.
 *
 * GET ?id=42   → ein Item
 * GET          → alle Items
 */

require_once __DIR__ . './init.php';


$id = getIntParam('id');

try {
    if ($id > 0) {
        $stmt = $db->prepare("SELECT * FROM items WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $item = $stmt->get_result()->fetch_assoc();

        if (!$item) {
            sendError("Item mit ID {$id} nicht gefunden", 404);
        }

        sendSuccess(enrichItem($item));
    } else {
        $result = $db->query("SELECT * FROM items ORDER BY id DESC");
        $items  = $result->fetch_all(MYSQLI_ASSOC);

        sendSuccess(enrichItems($items), ['count' => count($items)]);
    }
} catch (Exception $e) {
    error_log('fetch_item.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}