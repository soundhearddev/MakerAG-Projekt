<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once "/var/www/html/secure/config.php";

try {
    $db = Database::connect();
    echo "DB verbunden<br>";

    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    echo "ID: $id<br>";

    // Test DB-Abfrage
    $stmt = $db->prepare("SELECT id FROM items LIMIT 1");
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();
    print_r($row);
} catch (Exception $e) {
    echo "Fehler: " . $e->getMessage();
}

