<?php
require_once __DIR__ . '/init.php';


/*
DATENBANK:

CREATE TABLE feedback (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    problem    TEXT NOT NULL,
    created_at DATETIME NOT NULL
);


*/
// Nur POST erlauben
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Methode nicht erlaubt', 405);
}

// JSON-Body einlesen
$body = json_decode(file_get_contents('php://input'), true);

$name    = trim($body['name'] ?? '');
$problem = trim($body['problem'] ?? '');

// Validierung
if ($name === '' || $problem === '') {
    sendError('Name und Problem dürfen nicht leer sein', 400);
}

try {
    $stmt = $db->prepare("INSERT INTO feedback (name, problem, created_at) VALUES (?, ?, NOW())");
    $stmt->bind_param('ss', $name, $problem);
    $stmt->execute();

    sendSuccess([], ['message' => 'Feedback erfolgreich gespeichert'], 201);
} catch (Exception $e) {
    error_log('feedback.php: ' . $e->getMessage());
    sendError('Datenbankfehler', 500);
}
