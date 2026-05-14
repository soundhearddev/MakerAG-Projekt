<?php
require_once __DIR__ . '/init.php';

// Hilfsfunktion: quantity aus specs holen
function getQuantityFromSpecs($db, int $id): ?int {
    $stmt = $db->prepare(
        "SELECT `value` FROM specs WHERE item_id = ? AND LOWER(`key`) IN ('anzahl','quantity','menge') LIMIT 1"
    );
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ? (int) $row['value'] : null;
}

// GET: aktuelle quantity_available holen
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = getIntParam('id');
    if ($id <= 0) sendError('Gültige id (> 0) erforderlich');

    try {
        $stmt = $db->prepare("SELECT quantity_available FROM items WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) sendError('Item nicht gefunden', 404);

        $total = getQuantityFromSpecs($db, $id);
        if ($total === null) sendError('Keine Anzahl in specs gefunden', 404);

        $available = $row['quantity_available'] !== null
            ? (int) $row['quantity_available']
            : $total;

        sendSuccess([
            'quantity'           => $total,
            'quantity_available' => $available,
        ]);
    } catch (Throwable $e) {
        error_log('edit-quantity.php GET: ' . $e->getMessage());
        sendError('Datenbankfehler', 500, [], $e->getMessage());
    }
}

// POST: quantity_available setzen
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $id   = isset($body['id'])                 ? (int) $body['id']                 : 0;
    $val  = isset($body['quantity_available']) ? (int) $body['quantity_available'] : -1;

    if ($id <= 0)  sendError('Gültige id (> 0) erforderlich');
    if ($val < 0)  sendError('quantity_available darf nicht negativ sein');

    try {
        $stmt = $db->prepare("SELECT id FROM items WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        if (!$stmt->get_result()->fetch_assoc()) sendError('Item nicht gefunden', 404);

        $total = getQuantityFromSpecs($db, $id);
        if ($total === null) sendError('Keine Anzahl in specs gefunden', 404);

        if ($val > $total) sendError("quantity_available ($val) darf quantity ($total) nicht überschreiten");

        $upd = $db->prepare("UPDATE items SET quantity_available = ? WHERE id = ?");
        $upd->bind_param("ii", $val, $id);
        $upd->execute();

        sendSuccess([
            'quantity'           => $total,
            'quantity_available' => $val,
        ]);
    } catch (Throwable $e) {
        error_log('edit-quantity.php POST: ' . $e->getMessage());
        sendError('Datenbankfehler', 500, [], $e->getMessage());
    }
}

sendError('Methode nicht erlaubt', 405);