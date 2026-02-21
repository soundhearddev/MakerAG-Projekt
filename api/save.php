<?php
/**
 * API Endpoint: save.php
 * Aktualisiert ein oder mehrere Items in der Datenbank.
 *
 * POST body (JSON):
 * {
 *   "42": { "name": "Neuer Name", "notes": "..." },
 *   "99": { "brand": "Dell" }
 * }
 */

require_once __DIR__ . './init.php';



$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !is_array($input)) {
    sendError('Keine gültigen JSON-Daten empfangen');
}

// Erlaubte Spalten – verhindert SQL-Injection über Spaltennamen
$ALLOWED_COLUMNS = [
    'name', 'category', 'subcategory', 'brand', 'model',
    'serial', 'quantity', 'locker', 'notes', 'docs_link',
];

try {
    $updated = 0;

    foreach ($input as $id => $fields) {
        $id = intval($id);
        if ($id <= 0 || !is_array($fields) || empty($fields)) continue;

        $sets   = [];
        $params = [];
        $types  = '';

        foreach ($fields as $col => $val) {
            if (!in_array($col, $ALLOWED_COLUMNS, true)) continue; // unbekannte Spalten ignorieren
            $sets[]   = "`{$col}` = ?";
            $params[] = $val;
            $types   .= 's';
        }

        if (empty($sets)) continue;

        $sql  = "UPDATE items SET " . implode(', ', $sets) . " WHERE id = ?";
        $stmt = $db->prepare($sql);
        if (!$stmt) throw new Exception("Prepare fehlgeschlagen: " . $db->error);

        $types   .= 'i';
        $params[] = $id;
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $stmt->close();
        $updated++;
    }

    sendSuccess([], ['updated' => $updated]);
} catch (Exception $e) {
    error_log('save.php: ' . $e->getMessage());
    sendError('Datenbankfehler beim Speichern', 500);
}