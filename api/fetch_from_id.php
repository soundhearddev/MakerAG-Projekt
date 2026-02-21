<?php
/**
 * API Endpoint: fetch_from_id.php
 * Gibt alle Felder eines Items per ID zurück.
 *
 * GET ?id=42   → ein Item (als Array mit einem Element)
 */

require_once __DIR__ . './init.php';




$id = getIntParam('id');

if ($id <= 0) {
    sendError('Gültige id (> 0) erforderlich');
}

try {
    $stmt = $db->prepare("SELECT * FROM items WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    sendSuccess(enrichItems($items), ['count' => count($items)]);
} catch (Exception $e) {
    error_log('fetch_from_id.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}