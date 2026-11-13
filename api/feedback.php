<?php

require_once __DIR__ . '/init.php';

requireMethod('POST');

$body = readJsonBody();
$name = trim((string) ($body['name'] ?? ''));
$problem = trim((string) ($body['problem'] ?? ''));

if ($name === '' || $problem === '') {
    sendError('Name und Nachricht dürfen nicht leer sein', 400);
}
if (mb_strlen($name) > 100 || mb_strlen($problem) > 2000) {
    sendError('Eingabe zu lang', 400);
}

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

try {
    // Max. 3 Einträge pro IP und 10 Minuten.
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM feedback WHERE ip = ? AND created_at > NOW() - INTERVAL 10 MINUTE'
    );
    $stmt->bind_param('s', $ip);
    $stmt->execute();
    if ((int) $stmt->get_result()->fetch_row()[0] >= 3) {
        sendError('Zu viele Anfragen – bitte warte etwas', 429);
    }

    $stmt = $db->prepare('INSERT INTO feedback (name, problem, ip, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->bind_param('sss', $name, $problem, $ip);
    $stmt->execute();

    sendSuccess([], ['message' => 'Feedback gespeichert'], 201);
} catch (Throwable $e) {
    sendException($e);
}
