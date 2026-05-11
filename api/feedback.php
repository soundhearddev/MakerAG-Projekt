<?php
require_once __DIR__ . '/init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Methode nicht erlaubt', 405);
}

$body = json_decode(file_get_contents('php://input'), true);
$name    = trim($body['name'] ?? '');
$problem = trim($body['problem'] ?? '');

if ($name === '' || $problem === '') {
    sendError('Name und Nachricht dürfen nicht leer sein', 400);
}

if (strlen($name) > 100 || strlen($problem) > 2000) {
    sendError('Eingabe zu lang', 400);
}

// ─── Rate-Limiting ────────────────────────────────────────────────────────────
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

$stmt = $db->prepare(
    "SELECT COUNT(*) AS cnt FROM feedback 
     WHERE ip = ? AND created_at > NOW() - INTERVAL 10 MINUTE"
);
$stmt->bind_param('s', $ip);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();

if ($row['cnt'] >= 3) {
    sendError('Zu viele Anfragen – bitte warte etwas', 429);
}

// ─── Speichern ────────────────────────────────────────────────────────────────
try {
    $stmt = $db->prepare(
        "INSERT INTO feedback (name, problem, ip, created_at) 
         VALUES (?, ?, ?, NOW())"
    );
    $stmt->bind_param('sss', $name, $problem, $ip);
    $stmt->execute();
    sendSuccess([], ['message' => 'Feedback gespeichert'], 201);
} catch (Exception $e) {
    error_log('feedback.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}