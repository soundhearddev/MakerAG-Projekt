<?php

/**
 * GET  ?id=42                               → Gesamtanzahl und verfügbare Anzahl
 * POST { id, quantity_available }           → verfügbare Anzahl setzen
 */

require_once __DIR__ . '/init.php';

requireMethod('GET', 'POST');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireWriteAccess();
}
enforceRateLimit();

/**
 * Gesamtanzahl (aus den Specs) und verfügbare Anzahl eines Items.
 * Gibt null zurück, wenn das Item nicht existiert.
 *
 * @return array{total: ?int, available: ?int}|null
 */
function fetchQuantityRow(int $id): ?array
{
    global $db;

    $keys = "'" . implode("', '", QUANTITY_SPEC_KEYS) . "'";
    $stmt = $db->prepare(
        "SELECT i.quantity_available, s.value AS spec_quantity
         FROM items i
         LEFT JOIN specs s
             ON s.item_id = i.id
             AND LOWER(s.`key`) IN ({$keys})
         WHERE i.id = ?
         ORDER BY s.id ASC
         LIMIT 1"
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();

    if (!$row) {
        return null;
    }

    $total = is_numeric($row['spec_quantity']) ? (int) $row['spec_quantity'] : null;
    $available = $row['quantity_available'] !== null ? (int) $row['quantity_available'] : $total;

    return ['total' => $total, 'available' => $available];
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $id = getIntParam('id');
        if ($id <= 0) {
            sendError('Gültige id (> 0) erforderlich');
        }

        $q = fetchQuantityRow($id);
        if ($q === null) {
            sendError('Item nicht gefunden', 404);
        }
        if ($q['total'] === null) {
            sendError('Keine numerische Anzahl in specs gefunden', 404);
        }

        sendSuccess(['quantity' => $q['total'], 'quantity_available' => $q['available']]);
    }

    $body = readJsonBody();
    $id = (int) ($body['id'] ?? 0);
    $value = (int) ($body['quantity_available'] ?? -1);

    if ($id <= 0) {
        sendError('Gültige id (> 0) erforderlich');
    }
    if ($value < 0) {
        sendError('quantity_available darf nicht negativ sein');
    }

    $q = fetchQuantityRow($id);
    if ($q === null) {
        sendError('Item nicht gefunden', 404);
    }
    if ($q['total'] === null) {
        sendError('Keine numerische Anzahl in specs gefunden', 404);
    }
    if ($value > $q['total']) {
        sendError("Wert ({$value}) überschreitet Gesamtanzahl ({$q['total']})");
    }

    // affected_rows wird bewusst nicht geprüft: MySQL meldet 0, wenn sich der
    // Wert nicht ändert – das ist kein Fehler.
    $stmt = $db->prepare('UPDATE items SET quantity_available = ?, updated_at = NOW() WHERE id = ?');
    $stmt->bind_param('ii', $value, $id);
    $stmt->execute();

    sendSuccess(['quantity' => $q['total'], 'quantity_available' => $value]);
} catch (Throwable $e) {
    sendException($e);
}
