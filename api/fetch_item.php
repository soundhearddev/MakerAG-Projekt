<?php
// NUTZUNG FÜR docs items

header("Content-Type: application/json");
require_once "/var/www/html/secure/config.php";

try {
    $db = Database::connect();

    // Beispiel: alle Infos für einen bestimmten Laptop holen (z.B. ID per GET)
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

    if ($id > 0) {
        $stmt = $db->prepare("SELECT * FROM items WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $item = $result->fetch_assoc();
        echo json_encode($item);
    } else {
        // Optional: alle Laptops holen
        $res = $db->query("SELECT * FROM items");
        echo json_encode($res->fetch_all(MYSQLI_ASSOC));
    }
} catch (Exception $e) {
    echo json_encode([
        "error" => true,
        "message" => $e->getMessage()
    ]);
}
