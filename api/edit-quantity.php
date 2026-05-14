<?php
require_once __DIR__ . '/init.php';

// GET: aktuelle quantity_available holen
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = getIntParam('id');
    if ($id <= 0) sendError('Gültige id (> 0) erforderlich');

    try {
        $stmt = $db->prepare("SELECT quantity, quantity_available FROM items WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) sendError('Item nicht gefunden', 404);
        sendSuccess([
            'quantity'           => (int) $row['quantity'],
            'quantity_available' => $row['quantity_available'] !== null
                ? (int) $row['quantity_available']
                : (int) $row['quantity'],
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
        // quantity darf nicht unterschritten werden
        $stmt = $db->prepare("SELECT quantity FROM items WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) sendError('Item nicht gefunden', 404);

        $total = (int) $row['quantity'];
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