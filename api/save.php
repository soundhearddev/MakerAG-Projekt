<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
header("Content-Type: application/json");

require_once "/var/www/html/secure/config.php";

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input)
        throw new Exception("Keine Daten empfangen");

    $db = Database::connect();

    foreach ($input as $id => $fields) {
        $sets = [];
        $params = [];
        $types = '';

        foreach ($fields as $col => $val) {
            $sets[] = "$col = ?";
            $params[] = $val;
            $types .= 's'; // alle Werte als String behandeln
        }

        if (empty($sets))
            continue;

        $sql = "UPDATE items SET " . implode(',', $sets) . " WHERE id = ?";
        $stmt = $db->prepare($sql);
        if (!$stmt)
            throw new Exception("Fehler beim vorbereiten: " . $db->error);

        $types .= 'i'; // id als Integer
        $params[] = $id;

        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $stmt->close();
    }

    echo json_encode(["success" => true]);
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
