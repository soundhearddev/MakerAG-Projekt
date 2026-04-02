<?php
/**
 * edit-location.php
 *
 * GET  ?action=list               → alle locations aus DB
 * POST { id, location_id }        → Item auf bestehende Location setzen
 * POST { id, room, schrank, regal, position }  → neue Location anlegen + Item setzen
 */

require_once __DIR__ . '/init.php';

// Rate Limiting
if (session_status() === PHP_SESSION_NONE) session_start();

$ip      = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateKey = 'rate_edit_location_' . md5($ip);
$now     = time();

if (!isset($_SESSION[$rateKey]) || $now - $_SESSION[$rateKey]['start'] > 60) {
    $_SESSION[$rateKey] = ['count' => 0, 'start' => $now];
}

if (++$_SESSION[$rateKey]['count'] > 20) {
    sendError('Zu viele Anfragen. Bitte warten.', 429);
}

// ── GET: alle Locations listen ────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? '';
    if ($action !== 'list') sendError('Unbekannte Aktion', 400);

    try {
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        $res = $db->query("SELECT id, room, schrank, regal, position FROM locations ORDER BY schrank, regal");
        $locations = [];
        while ($row = $res->fetch_assoc()) {
            $locations[] = $row;
        }
        sendSuccess(['locations' => $locations]);
    } catch (Throwable $e) {
        sendError($e->getMessage(), 500);
    }
}

// ── POST: Location setzen ─────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $itemId     = isset($body['id'])          ? (int) $body['id']  : 0;
    $locationId = isset($body['location_id']) ? (int) $body['location_id'] : 0;

    if ($itemId <= 0) sendError('Ungültige Item-ID', 400);

    try {
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

        // Item existiert?
        $check = $db->prepare("SELECT id FROM items WHERE id = ? LIMIT 1");
        $check->bind_param('i', $itemId);
        $check->execute();
        if ($check->get_result()->num_rows === 0) sendError('Item nicht gefunden', 404);

        // Neue Location anlegen wenn kein location_id übergeben
        if ($locationId === 0) {
            $room     = isset($body['room'])     ? mb_substr(trim($body['room']),     0, 100, 'UTF-8') : null;
            $schrank  = isset($body['schrank'])  ? mb_substr(trim($body['schrank']),  0, 50,  'UTF-8') : null;
            $regal    = isset($body['regal'])    ? mb_substr(trim($body['regal']),    0, 50,  'UTF-8') : null;
            $position = isset($body['position']) ? mb_substr(trim($body['position']), 0, 100, 'UTF-8') : null;

            // Leere Strings → null
            $room     = $room     !== '' ? $room     : null;
            $schrank  = $schrank  !== '' ? $schrank  : null;
            $regal    = $regal    !== '' ? $regal    : null;
            $position = $position !== '' ? $position : null;

            if ($schrank === null && $regal === null && $room === null) {
                sendError('Mindestens ein Feld (Raum, Schrank oder Regal) muss angegeben werden.', 400);
            }

            // Schauen ob diese Kombination schon existiert
            $dup = $db->prepare(
                "SELECT id FROM locations
                 WHERE (room <=> ?) AND (schrank <=> ?) AND (regal <=> ?) AND (position <=> ?)
                 LIMIT 1"
            );
            $dup->bind_param('ssss', $room, $schrank, $regal, $position);
            $dup->execute();
            $dupRow = $dup->get_result()->fetch_assoc();

            if ($dupRow) {
                $locationId = (int) $dupRow['id'];
            } else {
                $ins = $db->prepare(
                    "INSERT INTO locations (room, schrank, regal, position) VALUES (?, ?, ?, ?)"
                );
                $ins->bind_param('ssss', $room, $schrank, $regal, $position);
                $ins->execute();
                $locationId = (int) $db->insert_id;
            }
        } else {
            // Prüfen ob location_id existiert
            $locCheck = $db->prepare("SELECT id FROM locations WHERE id = ? LIMIT 1");
            $locCheck->bind_param('i', $locationId);
            $locCheck->execute();
            if ($locCheck->get_result()->num_rows === 0) sendError('Location nicht gefunden', 404);
        }

        // Item aktualisieren
        $upd = $db->prepare("UPDATE items SET location_id = ?, updated_at = NOW() WHERE id = ?");
        $upd->bind_param('ii', $locationId, $itemId);
        $upd->execute();

        // Neue Location-Daten zurückgeben
        $locRes = $db->prepare("SELECT id, room, schrank, regal, position FROM locations WHERE id = ? LIMIT 1");
        $locRes->bind_param('i', $locationId);
        $locRes->execute();
        $newLoc = $locRes->get_result()->fetch_assoc();

        sendSuccess(['id' => $itemId, 'location' => $newLoc]);

    } catch (Throwable $e) {
        sendError($e->getMessage(), 500);
    }
}

sendError('Methode nicht erlaubt', 405);