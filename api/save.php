<?php
/**
 * API Endpoint: save.php
 * Aktualisiert ein oder mehrere Items in der Datenbank.
 * Angepasst an die normalisierte DB-Struktur.
 *
 * POST body (JSON):
 * {
 *   "42": {
 *     "name": "Neuer Name",
 *     "brand": "Dell",
 *     "model": "XPS 15",
 *     "serial_number": "ABC123",
 *     "status": "verfügbar",
 *     "item_condition": "gut",
 *     "category_id": 8,
 *     "location_id": 3,
 *     "notes": "..."
 *   }
 * }
 *
 * Für Specs können zusätzlich über "specs" übergeben werden:
 * {
 *   "42": {
 *     "name": "...",
 *     "specs": { "Anzahl": "5", "RAM": "8 GB" }
 *   }
 * }
 */

require_once __DIR__ . '/init.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !is_array($input)) {
    sendError('Keine gültigen JSON-Daten empfangen');
}

// Erlaubte Spalten der items-Tabelle
const ALLOWED_COLUMNS = [
    'name',
    'brand',
    'model',
    'serial_number',
    'category_id',
    'status',
    'item_condition',
    'location_id',
    'notes',
];

// Erlaubte Werte für ENUM-Felder
const ALLOWED_STATUS = ['verfügbar', 'ausgeliehen', 'defekt', 'verschollen', 'entsorgt'];
const ALLOWED_CONDITION = ['neu', 'gut', 'akzeptabel', 'schlecht'];

try {
    $updated = 0;

    foreach ($input as $id => $fields) {
        $id = intval($id);
        if ($id <= 0 || !is_array($fields) || empty($fields)) continue;

        // Prüfen ob Item existiert
        $check = $db->prepare("SELECT id FROM items WHERE id = ?");
        $check->bind_param('i', $id);
        $check->execute();
        if (!$check->get_result()->fetch_assoc()) {
            error_log("save.php: Item {$id} nicht gefunden – übersprungen");
            continue;
        }

        // ── items-Tabelle updaten ─────────────────────────────────────────────
        $sets   = [];
        $params = [];
        $types  = '';

        foreach ($fields as $col => $val) {
            if ($col === 'specs') continue; // Specs separat behandeln
            if (!in_array($col, ALLOWED_COLUMNS, true)) continue;

            // ENUM-Validierung
            if ($col === 'status' && !in_array($val, ALLOWED_STATUS, true)) continue;
            if ($col === 'item_condition' && !in_array($val, ALLOWED_CONDITION, true)) continue;

            // Integer-Felder
            if (in_array($col, ['category_id', 'location_id'])) {
                $sets[]   = "`{$col}` = ?";
                $params[] = ($val === null || $val === '') ? null : intval($val);
                $types   .= 'i';
            } else {
                $sets[]   = "`{$col}` = ?";
                $params[] = ($val === '') ? null : $val;
                $types   .= 's';
            }
        }

        if (!empty($sets)) {
            $sql  = "UPDATE items SET " . implode(', ', $sets) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            if (!$stmt) throw new Exception("Prepare fehlgeschlagen: " . $db->error);

            $types   .= 'i';
            $params[] = $id;
            $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $stmt->close();
        }

        // ── Specs updaten (wenn übergeben) ───────────────────────────────────
        if (isset($fields['specs']) && is_array($fields['specs'])) {
            foreach ($fields['specs'] as $key => $val) {
                $key = mb_substr(trim($key), 0, 100);
                $val = mb_substr(trim((string)$val), 0, 255);
                if ($key === '') continue;

                // INSERT OR UPDATE (UPSERT über ON DUPLICATE KEY geht nicht ohne UNIQUE,
                // daher: erst prüfen, dann insert/update)
                $checkSpec = $db->prepare("SELECT id FROM specs WHERE item_id = ? AND `key` = ?");
                $checkSpec->bind_param('is', $id, $key);
                $checkSpec->execute();
                $existing = $checkSpec->get_result()->fetch_assoc();

                if ($existing) {
                    $upd = $db->prepare("UPDATE specs SET `value` = ? WHERE id = ?");
                    $upd->bind_param('si', $val, $existing['id']);
                    $upd->execute();
                } else {
                    $ins = $db->prepare("INSERT INTO specs (item_id, `key`, `value`) VALUES (?, ?, ?)");
                    $ins->bind_param('iss', $id, $key, $val);
                    $ins->execute();
                }
            }
        }

        $updated++;
    }

    sendSuccess([], ['updated' => $updated]);
} catch (Exception $e) {
    error_log('save.php: ' . $e->getMessage());
    sendError('Datenbankfehler beim Speichern', 500);
}
