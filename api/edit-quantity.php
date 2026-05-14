<?php
require_once __DIR__ . '/init.php';

// Methoden-Whitelist – alles andere sofort abblocken
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    sendError('Methode nicht erlaubt', 405);
}

// ── Hilfsfunktion ─────────────────────────────────────────────────────────────
// Holt quantity_available + Anzahl aus specs in einem einzigen JOIN statt zwei Trips.
// Gibt ['total' => int, 'available' => int] zurück oder null wenn Item nicht existiert.
function fetchQuantityRow(int $id): ?array
{
    global $db;

    $stmt = $db->prepare(
        "SELECT i.quantity_available,
                s.value AS spec_quantity
         FROM items i
         LEFT JOIN specs s
               ON  s.item_id = i.id
               AND LOWER(s.key) IN ('anzahl', 'quantity', 'menge')
         WHERE i.id = ?
         ORDER BY s.id ASC
         LIMIT 1"
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();

    if ($row === false || $row === null) return null; // Item existiert nicht

    // spec_quantity muss numerisch sein – sonst ignorieren
    $total = ($row['spec_quantity'] !== null && is_numeric($row['spec_quantity']))
        ? (int) $row['spec_quantity']
        : null;

    $available = $row['quantity_available'] !== null
        ? (int) $row['quantity_available']
        : $total; // Fallback: noch nie gesetzt → alles verfügbar

    return ['total' => $total, 'available' => $available];
}

// ── GET ───────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = getIntParam('id');
    if ($id <= 0) sendError('Gültige id (> 0) erforderlich');

    $q = fetchQuantityRow($id);
    if ($q === null)          sendError('Item nicht gefunden', 404);
    if ($q['total'] === null) sendError('Keine numerische Anzahl in specs gefunden', 404);

    sendSuccess(['quantity' => $q['total'], 'quantity_available' => $q['available']]);
}

// ── POST ──────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) sendError('Ungültiger JSON-Body', 400);

    $id  = isset($body['id'])                 ? (int) $body['id']                 : 0;
    $val = isset($body['quantity_available']) ? (int) $body['quantity_available'] : -1;

    if ($id  <= 0) sendError('Gültige id (> 0) erforderlich');
    if ($val <  0) sendError('quantity_available darf nicht negativ sein');

    $q = fetchQuantityRow($id);
    if ($q === null)          sendError('Item nicht gefunden', 404);
    if ($q['total'] === null) sendError('Keine numerische Anzahl in specs gefunden', 404);
    if ($val > $q['total'])   sendError("Wert ($val) überschreitet Gesamtanzahl ({$q['total']})");

    $stmt = $db->prepare('UPDATE items SET quantity_available = ? WHERE id = ?');
    $stmt->bind_param('ii', $val, $id);
    $stmt->execute();

    if ($stmt->affected_rows === 0) sendError('Update hatte keinen Effekt', 500);

    sendSuccess(['quantity' => $q['total'], 'quantity_available' => $val]);
}