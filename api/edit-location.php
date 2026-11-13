<?php

/**
 * GET  ?action=list                         → alle Standorte
 * POST { id, location_id, location_note? }  → Item auf bestehenden Standort setzen
 */

require_once __DIR__ . '/init.php';

requireMethod('GET', 'POST');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireWriteAccess();
}
enforceRateLimit();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (getStringParam('action') !== 'list') {
            sendError('Unbekannte Aktion', 400);
        }

        $res = $db->query(
            'SELECT l.id, l.room_id, r.name AS room, l.schrank, l.fach
             FROM locations l
             LEFT JOIN rooms r ON r.id = l.room_id
             ORDER BY r.name, l.schrank, l.fach'
        );
        sendSuccess(['locations' => $res->fetch_all(MYSQLI_ASSOC)]);
    }

    $body = readJsonBody();
    $itemId = (int) ($body['id'] ?? 0);
    $locationId = (int) ($body['location_id'] ?? 0);
    $note = mb_substr(trim((string) ($body['location_note'] ?? '')), 0, 255, 'UTF-8');
    $note = $note !== '' ? $note : null;

    if ($itemId <= 0) {
        sendError('Ungültige Item-ID', 400);
    }
    if ($locationId <= 0) {
        sendError('Ungültige Location-ID', 400);
    }

    $stmt = $db->prepare('SELECT id FROM items WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $itemId);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        sendError('Item nicht gefunden', 404);
    }

    $stmt = $db->prepare(
        'SELECT l.id, r.name AS room, l.schrank, l.fach
         FROM locations l
         LEFT JOIN rooms r ON r.id = l.room_id
         WHERE l.id = ? LIMIT 1'
    );
    $stmt->bind_param('i', $locationId);
    $stmt->execute();
    $location = $stmt->get_result()->fetch_assoc();
    if (!$location) {
        sendError('Location nicht gefunden', 404);
    }

    $stmt = $db->prepare('UPDATE items SET location_id = ?, location_note = ?, updated_at = NOW() WHERE id = ?');
    $stmt->bind_param('isi', $locationId, $note, $itemId);
    $stmt->execute();

    sendSuccess([
        'id' => $itemId,
        'location' => $location,
        'location_note' => $note,
    ]);
} catch (Throwable $e) {
    sendException($e);
}
