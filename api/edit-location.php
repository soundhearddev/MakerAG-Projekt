<?php

/**
 * edit-location.php
 *
 * GET  ?action=list                         → alle Locations aus DB
 * POST { id, location_id, location_note? }  → Item auf bestehende Location setzen
 */

require_once __DIR__ . '/init.php';

if (session_status() === PHP_SESSION_NONE) session_start();

// ── Rate Limiting ─────────────────────────────────────────────────────────────

$rateKey = 'rate_edit_location_' . md5($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$now     = time();

if (!isset($_SESSION[$rateKey]) || $now - $_SESSION[$rateKey]['start'] > 60) {
    $_SESSION[$rateKey] = ['count' => 0, 'start' => $now];
}

if (++$_SESSION[$rateKey]['count'] > 20) {
    sendError('Zu viele Anfragen. Bitte warten.', 429);
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// ── GET: alle Locations listen ────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (($_GET['action'] ?? '') !== 'list') {
        sendError('Unbekannte Aktion', 400);
    }

    try {
        $res = $db->query(
            "SELECT l.id, l.room_id, r.name AS room, l.schrank, l.fach
            FROM locations l
            LEFT JOIN rooms r ON r.id = l.room_id
            ORDER BY r.name, l.schrank, l.fach"
        );

        $locations = $res->fetch_all(MYSQLI_ASSOC);

        sendSuccess(['locations' => $locations]);
    } catch (Throwable $e) {
        sendError('Datenbankfehler', 500, [], $e->getMessage());
    }
}

// ── POST: Location & Note setzen ─────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $itemId     = isset($body['id'])          ? (int)    $body['id']          : 0;
    $locationId = isset($body['location_id']) ? (int)    $body['location_id'] : 0;
    $note       = isset($body['location_note'])
        ? mb_substr(trim($body['location_note']), 0, 255, 'UTF-8')
        : null;
    $note = ($note !== '') ? $note : null;

    if ($itemId     <= 0) sendError('Ungültige Item-ID',      400);
    if ($locationId <= 0) sendError('Ungültige Location-ID',  400);

    try {
        // Item existiert?
        $chkItem = $db->prepare("SELECT id FROM items WHERE id = ? LIMIT 1");
        $chkItem->bind_param('i', $itemId);
        $chkItem->execute();
        if ($chkItem->get_result()->num_rows === 0) sendError('Item nicht gefunden', 404);

        // Location existiert? (mit room-JOIN für konsistente Response)
        $chkLoc = $db->prepare(
            "SELECT l.id, r.name AS room, l.schrank, l.fach
             FROM locations l
             LEFT JOIN rooms r ON r.id = l.room_id
             WHERE l.id = ? LIMIT 1"
        );
        $chkLoc->bind_param('i', $locationId);
        $chkLoc->execute();
        $locRow = $chkLoc->get_result()->fetch_assoc();
        if (!$locRow) sendError('Location nicht gefunden', 404);

        // Item aktualisieren (location_id + location_note)
        $upd = $db->prepare("UPDATE items SET location_id = ?, location_note = ?, updated_at = NOW() WHERE id = ?");
        $upd->bind_param('isi', $locationId, $note, $itemId);
        $upd->execute();

        sendSuccess([
            'id'            => $itemId,
            'location'      => $locRow,
            'location_note' => $note,
        ]);
    } catch (Throwable $e) {
        sendError($e->getMessage(), 500);
    }
}

sendError('Methode nicht erlaubt', 405);
