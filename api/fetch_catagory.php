<?php
header("Content-Type: application/json");
require_once "/var/www/html/secure/config.php";


// alle kategorien aus der datenbank holen
try {
    $db = Database::connect();

    $res = $db->query("SELECT DISTINCT category FROM items");



    echo json_encode($res->fetch_all(MYSQLI_ASSOC));
} catch (Exception $e) {
    echo json_encode([
        "error" => true,
        "message" => $e->getMessage()
    ]);
}
