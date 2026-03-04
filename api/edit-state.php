<?php

/**
 * API Endpoint: edit-state.php
 * Ändert den Status eines Items (z.B. "Verfügbar", "Defekt", "Ausgeliehen")
 *
 * POST { id: 17, status: "Defekt" }
 */

require_once __DIR__ . '/init.php';
error_reporting(E_ALL);
ini_set('display_errors', 1);
// ── Nur POST erlauben ─────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Nur POST erlaubt', 405);
    exit;
}

// ── Rate Limiting (10 Requests pro Minute pro IP) ─────────────────────────────
$ip       = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateKey  = 'rate_edit_state_' . md5($ip);
$maxReqs  = 10;
$window   = 60; // Sekunden

// Session-basiertes Rate Limiting (kein Redis nötig)
if (session_status() === PHP_SESSION_NONE) session_start();
$now = time();

if (!isset($_SESSION[$rateKey])) {
    $_SESSION[$rateKey] = ['count' => 0, 'start' => $now];
}

if ($now - $_SESSION[$rateKey]['start'] > $window) {
    // Fenster zurücksetzen
    $_SESSION[$rateKey] = ['count' => 0, 'start' => $now];
}

$_SESSION[$rateKey]['count']++;

if ($_SESSION[$rateKey]['count'] > $maxReqs) {
    sendError('Zu viele Anfragen. Bitte warten.', 429);
    exit;
}

// ── Input lesen (JSON Body) ───────────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true);

$id     = isset($body['id'])     ? (int) $body['id']                              : 0;
$status = isset($body['status']) ? mb_substr(trim($body['status']), 0, 100, 'UTF-8') : '';

// ── Validierung ───────────────────────────────────────────────────────────────
if ($id <= 0) {
    sendError('Ungültige ID', 400);
    exit;
}

// Whitelist erlaubter Status-Werte
$allowedStatus = ['verfügbar', 'ausgeliehen', 'defekt', 'verschollen', 'entsorgt'];

if (!in_array($status, $allowedStatus, true)) {
    sendError('Ungültiger Status: ' . $status, 400);
    exit;
}

// ── Prüfen ob Item existiert ──────────────────────────────────────────────────
try {

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    $check = $db->prepare("SELECT id FROM items WHERE id = ? LIMIT 1");
    $check->bind_param('i', $id);
    $check->execute();
    if ($check->get_result()->num_rows === 0) {
        sendError('Item nicht gefunden', 404);
        exit;
    }

    // ── Update ────────────────────────────────────────────────────────────────
    $stmt = $db->prepare("UPDATE items SET status = ?, updated_at = NOW() WHERE id = ?");
    $stmt->bind_param('si', $status, $id);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        // Status war bereits gleich – kein Fehler, aber Info mitgeben
        sendSuccess(null, ['message' => 'Status bereits gesetzt', 'id' => $id, 'status' => $status]);
    } else {
        sendSuccess(null, ['message' => 'Status aktualisiert', 'id' => $id, 'status' => $status]);
    }
} catch (Exception $e) {
    sendError($e->getMessage(), 500);
}
