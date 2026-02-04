<?php
header("Content-Type: application/json");
require_once "/var/www/secure/config.php";


// verbindung mit datenbank und info von id her nehmen also input id und output namen und so von der id
try {
    $db = Database::connect();

    // id von get parameter holen
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    $stmt = $db->prepare("SELECT * FROM items WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $res = $stmt->get_result();
    echo json_encode($res->fetch_all(MYSQLI_ASSOC));
} catch (Exception $e) {
    echo json_encode([
        "error" => true,
        "message" => $e->getMessage()
    ]);
}
