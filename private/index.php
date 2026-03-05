<?php
/**
 * add_item.php – Admin-Tool zum Hinzufügen neuer Gegenstände
 * Funktionen:
 *   - Neues Item anlegen (items-Tabelle)
 *   - Kategorie zuweisen oder neue erstellen
 *   - Standort zuweisen oder neuen erstellen
 *   - Specs hinzufügen (dynamisch, beliebig viele)
 *   - Tags zuweisen oder neue erstellen
 *   - Bilder + Dokumente hochladen → /docs/{id}/images/ und /docs/{id}/data/
 *   - Seriennummer, Notizen, Zustand, Status
 */

// ─── Konfiguration ────────────────────────────────────────────────────────────
// Init nicht direkt includen weil es JSON-Headers setzt – wir brauchen HTML.
// Stattdessen DB-Verbindung direkt aufbauen.

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Config laden (gleiche Pfade wie init.php)
$_configPaths = [
    '/var/www/secure/config.php',
    __DIR__ . '/../secure/config.php',
    (__DIR__) . '/../../secure/config.php',
    ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/secure/config.php',
];
$db = null;
foreach ($_configPaths as $_path) {
    if (file_exists($_path)) {
        require_once $_path;
        break;
    }
}
if (class_exists('Database')) {
    try {
        $db = Database::connect();
        $db->set_charset('utf8mb4');
    } catch (Exception $e) {
        $db = null;
        $dbError = $e->getMessage();
    }
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function getDocRoot(): string {
    return rtrim($_SERVER['DOCUMENT_ROOT'] ?? '/var/www/public', '/');
}

function createDocsDir(int $id, string $sub): string {
    $path = getDocRoot() . "/docs/{$id}/{$sub}/";
    if (!is_dir($path)) {
        mkdir($path, 0775, true);
    }
    return $path;
}

// ─── POST-Verarbeitung ────────────────────────────────────────────────────────
$result   = null;
$error    = null;
$newId    = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $db) {
    try {

        // 1. Kategorie: bestehende nehmen oder neue anlegen
        $categoryId = null;
        if (!empty($_POST['category_id'])) {
            $categoryId = (int)$_POST['category_id'];
        } elseif (!empty($_POST['new_category_name'])) {
            $cn  = trim($_POST['new_category_name']);
            $pid = !empty($_POST['new_category_parent']) ? (int)$_POST['new_category_parent'] : null;
            $stmt = $db->prepare("INSERT INTO categories (name, parent_id) VALUES (?, ?)");
            $stmt->bind_param('si', $cn, $pid);
            $stmt->execute();
            $categoryId = $db->insert_id;
        }

        // 2. Standort: bestehenden nehmen oder neuen anlegen
        $locationId = null;
        if (!empty($_POST['location_id'])) {
            $locationId = (int)$_POST['location_id'];
        } elseif (!empty($_POST['new_schrank'])) {
            $room  = trim($_POST['new_room']     ?? '');
            $sch   = trim($_POST['new_schrank']  ?? '');
            $reg   = trim($_POST['new_regal']    ?? '');
            $pos   = trim($_POST['new_position'] ?? '');
            $stmt  = $db->prepare("INSERT INTO locations (room, schrank, regal, position) VALUES (?,?,?,?)");
            $stmt->bind_param(
                'ssss',
                $room ?: null,
                $sch  ?: null,
                $reg  ?: null,
                $pos  ?: null
            );
            $stmt->execute();
            $locationId = $db->insert_id;
        }

        // 3. Item einfügen
        $name     = trim($_POST['name']          ?? '');
        $brand    = trim($_POST['brand']         ?? '') ?: null;
        $model    = trim($_POST['model']         ?? '') ?: null;
        $serial   = trim($_POST['serial_number'] ?? '') ?: null;
        $status   = $_POST['status']             ?? 'verfügbar';
        $cond     = $_POST['item_condition']     ?? null;
        $notes    = trim($_POST['notes']         ?? '') ?: null;
        if (!$cond) $cond = null;

        if (!$name) throw new Exception("Name darf nicht leer sein.");

        $stmt = $db->prepare(
            "INSERT INTO items (name, brand, model, serial_number, category_id, status, item_condition, location_id, notes)
             VALUES (?,?,?,?,?,?,?,?,?)"
        );
        $stmt->bind_param('ssssissis',
            $name, $brand, $model, $serial,
            $categoryId, $status, $cond,
            $locationId, $notes
        );
        $stmt->execute();
        $newId = $db->insert_id;

        // 4. Specs einfügen
        if (!empty($_POST['spec_key']) && is_array($_POST['spec_key'])) {
            $stmtSpec = $db->prepare("INSERT INTO specs (item_id, `key`, value) VALUES (?,?,?)");
            foreach ($_POST['spec_key'] as $i => $k) {
                $k = trim($k);
                $v = trim($_POST['spec_value'][$i] ?? '');
                if ($k !== '' && $v !== '') {
                    $stmtSpec->bind_param('iss', $newId, $k, $v);
                    $stmtSpec->execute();
                }
            }
        }

        // 5. Tags: bestehende + neue
        $tagIds = [];

        // Bestehende Tags aus Checkbox-Auswahl
        if (!empty($_POST['tags']) && is_array($_POST['tags'])) {
            foreach ($_POST['tags'] as $tid) {
                $tagIds[] = (int)$tid;
            }
        }

        // Neue Tags (kommagetrennt eingeben)
        if (!empty($_POST['new_tags'])) {
            $newTags = array_map('trim', explode(',', $_POST['new_tags']));
            foreach ($newTags as $nt) {
                if ($nt === '') continue;
                // Erst prüfen ob Tag schon existiert
                $stmtCheck = $db->prepare("SELECT id FROM tags WHERE name = ?");
                $stmtCheck->bind_param('s', $nt);
                $stmtCheck->execute();
                $existing = $stmtCheck->get_result()->fetch_assoc();
                if ($existing) {
                    $tagIds[] = (int)$existing['id'];
                } else {
                    $stmtTag = $db->prepare("INSERT INTO tags (name) VALUES (?)");
                    $stmtTag->bind_param('s', $nt);
                    $stmtTag->execute();
                    $tagIds[] = $db->insert_id;
                }
            }
        }

        // Tags mit Item verknüpfen (Duplikate vermeiden)
        $tagIds = array_unique($tagIds);
        if ($tagIds) {
            $stmtIt = $db->prepare("INSERT IGNORE INTO item_tags (item_id, tag_id) VALUES (?,?)");
            foreach ($tagIds as $tid) {
                $stmtIt->bind_param('ii', $newId, $tid);
                $stmtIt->execute();
            }
        }

        // 6. Datei-Uploads
        $uploadedImages = [];
        $uploadedDocs   = [];

        $imageExts = ['jpg','jpeg','png','gif','webp','svg','avif'];
        $docExts   = ['pdf','doc','docx','xls','xlsx','txt','csv','zip'];

        if (!empty($_FILES['uploads']['name'][0])) {
            $imgDir = createDocsDir($newId, 'images');
            $datDir = createDocsDir($newId, 'data');

            foreach ($_FILES['uploads']['name'] as $i => $origName) {
                if ($_FILES['uploads']['error'][$i] !== UPLOAD_ERR_OK) continue;

                $ext      = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
                $safe     = preg_replace('/[^a-z0-9_\-\.]/i', '_', $origName);
                $tmpPath  = $_FILES['uploads']['tmp_name'][$i];

                if (in_array($ext, $imageExts, true)) {
                    $dest = $imgDir . $safe;
                    if (move_uploaded_file($tmpPath, $dest)) {
                        $uploadedImages[] = $safe;
                    }
                } elseif (in_array($ext, $docExts, true)) {
                    $dest = $datDir . $safe;
                    if (move_uploaded_file($tmpPath, $dest)) {
                        $uploadedDocs[] = $safe;
                    }
                }
            }
        }

        // 7. index.html aus Template kopieren falls vorhanden
        $templateHtml = __DIR__ . '/index.html';
        if (file_exists($templateHtml)) {
            $docsBaseDir = getDocRoot() . "/docs/{$newId}/";
            if (!is_dir($docsBaseDir)) mkdir($docsBaseDir, 0775, true);
            copy($templateHtml, $docsBaseDir . 'index.html');
        }

        $result = [
            'id'      => $newId,
            'name'    => $name,
            'images'  => $uploadedImages,
            'docs'    => $uploadedDocs,
        ];

    } catch (Exception $e) {
        $error = $e->getMessage();
    }
}

// ─── Daten für Formular laden ─────────────────────────────────────────────────
$categories = [];
$locations  = [];
$tags       = [];

if ($db) {
    $categories = $db->query("SELECT c.id, c.name, c.parent_id, p.name AS parent_name
                               FROM categories c
                               LEFT JOIN categories p ON p.id = c.parent_id
                               ORDER BY p.name ASC, c.name ASC")->fetch_all(MYSQLI_ASSOC);
    $locations  = $db->query("SELECT * FROM locations ORDER BY schrank ASC, regal ASC")->fetch_all(MYSQLI_ASSOC);
    $tags       = $db->query("SELECT * FROM tags ORDER BY name ASC")->fetch_all(MYSQLI_ASSOC);
}

?><!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Inventar – Gegenstand hinzufügen</title>
<style>
  body { font-family: monospace; max-width: 900px; margin: 20px auto; padding: 0 16px; background:#f5f5f5; }
  h1,h2,h3 { border-bottom: 2px solid #333; padding-bottom: 4px; }
  fieldset { margin-bottom: 20px; border: 1px solid #999; padding: 12px; background:#fff; }
  legend { font-weight: bold; padding: 0 6px; }
  label { display: block; margin: 8px 0 2px; font-weight: bold; font-size: 0.9em; }
  input[type=text], input[type=number], textarea, select {
    width: 100%; box-sizing: border-box; padding: 6px; font-family: monospace;
    border: 1px solid #aaa; background: #fafafa; font-size: 0.95em;
  }
  textarea { height: 80px; resize: vertical; }
  .row { display: flex; gap: 10px; }
  .row > * { flex: 1; }
  button[type=submit] {
    background: #1a6600; color: #fff; border: none; padding: 12px 30px;
    font-size: 1.1em; font-family: monospace; cursor: pointer; margin-top: 10px;
  }
  button[type=submit]:hover { background: #145200; }
  .spec-row { display: flex; gap: 8px; margin-bottom: 6px; align-items: center; }
  .spec-row input { flex: 1; }
  .spec-row button { flex: 0 0 28px; background:#c00; color:#fff; border:none; cursor:pointer; font-size:1.1em; }
  #add-spec { background:#006; color:#fff; border:none; padding:5px 12px; cursor:pointer; font-family:monospace; }
  .tag-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag-grid label { display: inline-flex; align-items: center; gap: 4px;
    font-weight: normal; background:#eee; padding: 3px 8px; border: 1px solid #ccc; cursor:pointer; }
  .tag-grid label:hover { background:#ddd; }
  .success-box { background:#d4edda; border:1px solid #28a745; padding:14px; margin-bottom:20px; }
  .error-box   { background:#f8d7da; border:1px solid #dc3545; padding:14px; margin-bottom:20px; }
  .dbconn-warn { background:#fff3cd; border:1px solid #ffc107; padding:10px; margin-bottom:16px; }
  .section-toggle { cursor:pointer; user-select:none; }
  .section-toggle::before { content: "▼ "; }
  .section-toggle.collapsed::before { content: "▶ "; }
  .collapsible { }
  .collapsible.hidden { display:none; }
  small { color:#555; font-size:0.82em; }
  .or-divider { text-align:center; font-weight:bold; margin: 8px 0; color:#888; }
  .file-drop { border: 2px dashed #999; padding: 20px; text-align:center;
    background:#fafafa; cursor:pointer; margin-top:6px; }
  .file-drop:hover { background:#f0f0f0; }
  #file-list { margin-top: 6px; font-size:0.85em; }
</style>
</head>
<body>

<h1>Neuen Gegenstand hinzufügen</h1>

<?php if (!$db): ?>
<div class="dbconn-warn">
   <strong>Keine Datenbankverbindung.</strong>
  <?= isset($dbError) ? htmlspecialchars($dbError) : 'config.php nicht gefunden.' ?>
  Das Formular wird trotzdem angezeigt, aber Speichern funktioniert nicht.
</div>
<?php endif; ?>

<?php if ($result): ?>
<div class="success-box">
   <strong>Erfolgreich angelegt!</strong><br>
  Item-ID: <strong><?= $result['id'] ?></strong> – <?= htmlspecialchars($result['name']) ?><br>
  <?php if ($result['images']): ?>
    Bilder: <?= implode(', ', array_map('htmlspecialchars', $result['images'])) ?><br>
  <?php endif; ?>
  <?php if ($result['docs']): ?>
    Dokumente: <?= implode(', ', array_map('htmlspecialchars', $result['docs'])) ?><br>
  <?php endif; ?>
  <br>
  <a href="?">Weiteren Gegenstand hinzufügen</a>
  &nbsp;|&nbsp;
  <a href="/docs/<?= $result['id'] ?>/">Item-Seite öffnen</a>
  &nbsp;|&nbsp;
  <a href="/api/fetch_item.php?id=<?= $result['id'] ?>" target="_blank">API-Antwort ansehen</a>
</div>
<?php endif; ?>

<?php if ($error): ?>
<div class="error-box">
   <strong>Fehler:</strong> <?= htmlspecialchars($error) ?>
</div>
<?php endif; ?>

<form method="POST" enctype="multipart/form-data">

<!-- ═══════════════════════════════════════════════════════ GRUNDDATEN -->
<fieldset>
  <legend>Grunddaten</legend>

  <label>Name <small>(Pflichtfeld)</small></label>
  <input type="text" name="name" required value="<?= htmlspecialchars($_POST['name'] ?? '') ?>"
         placeholder="z.B. Raspberry Pi 4 B 4GB">

  <div class="row">
    <div>
      <label>Marke / Brand</label>
      <input type="text" name="brand" value="<?= htmlspecialchars($_POST['brand'] ?? '') ?>"
             placeholder="z.B. Raspberry Pi">
    </div>
    <div>
      <label>Modell</label>
      <input type="text" name="model" value="<?= htmlspecialchars($_POST['model'] ?? '') ?>"
             placeholder="z.B. 4 B 4GB">
    </div>
  </div>

  <label>Seriennummer</label>
  <input type="text" name="serial_number" value="<?= htmlspecialchars($_POST['serial_number'] ?? '') ?>"
         placeholder="Optional">

  <div class="row">
    <div>
      <label>Status</label>
      <select name="status">
        <?php foreach (['verfügbar','ausgeliehen','defekt','verschollen','entsorgt'] as $s): ?>
          <option value="<?= $s ?>" <?= (($_POST['status'] ?? 'verfügbar') === $s) ? 'selected' : '' ?>>
            <?= $s ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
    <div>
      <label>Zustand</label>
      <select name="item_condition">
        <option value="">– kein –</option>
        <?php foreach (['neu','gut','akzeptabel','schlecht'] as $c): ?>
          <option value="<?= $c ?>" <?= (($_POST['item_condition'] ?? '') === $c) ? 'selected' : '' ?>>
            <?= $c ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
  </div>

  <label>Notizen</label>
  <textarea name="notes" placeholder="Freitext-Notizen…"><?= htmlspecialchars($_POST['notes'] ?? '') ?></textarea>
</fieldset>

<!-- ═══════════════════════════════════════════════════════ KATEGORIE -->
<fieldset>
  <legend>Kategorie</legend>

  <label>Bestehende Kategorie auswählen</label>
  <select name="category_id">
    <option value="">– keine / neue anlegen –</option>
    <?php foreach ($categories as $cat): ?>
      <?php $label = $cat['parent_name'] ? "{$cat['parent_name']} / {$cat['name']}" : $cat['name']; ?>
      <option value="<?= $cat['id'] ?>" <?= (($_POST['category_id'] ?? '') == $cat['id']) ? 'selected' : '' ?>>
        <?= htmlspecialchars($label) ?>
      </option>
    <?php endforeach; ?>
  </select>

  <div class="or-divider">— oder neue anlegen —</div>

  <div class="row">
    <div>
      <label>Name der neuen Kategorie</label>
      <input type="text" name="new_category_name" value="<?= htmlspecialchars($_POST['new_category_name'] ?? '') ?>"
             placeholder="z.B. Smartphone">
    </div>
    <div>
      <label>Oberkategorie (optional)</label>
      <select name="new_category_parent">
        <option value="">– keine (Root) –</option>
        <?php foreach ($categories as $cat): ?>
          <option value="<?= $cat['id'] ?>" <?= (($_POST['new_category_parent'] ?? '') == $cat['id']) ? 'selected' : '' ?>>
            <?= htmlspecialchars($cat['name']) ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
  </div>
  <small>Wenn beides ausgefüllt: "Neue Kategorie" hat Vorrang, außer wenn eine bestehende ausgewählt wurde.</small>
</fieldset>

<!-- ═══════════════════════════════════════════════════════ STANDORT -->
<fieldset>
  <legend>Standort</legend>

  <label>Bestehenden Standort auswählen</label>
  <select name="location_id">
    <option value="">– keiner / neuen anlegen –</option>
    <?php foreach ($locations as $loc): ?>
      <?php $label = implode(', ', array_filter([
          $loc['room']     ? "Raum {$loc['room']}"     : null,
          $loc['schrank']  ? "Schrank {$loc['schrank']}" : null,
          $loc['regal']    ? "Regal {$loc['regal']}"   : null,
          $loc['position'] ? "Pos. {$loc['position']}" : null,
      ])); ?>
      <option value="<?= $loc['id'] ?>" <?= (($_POST['location_id'] ?? '') == $loc['id']) ? 'selected' : '' ?>>
        <?= htmlspecialchars($label ?: "Standort #{$loc['id']}") ?>
      </option>
    <?php endforeach; ?>
  </select>

  <div class="or-divider">— oder neuen anlegen —</div>

  <div class="row">
    <div>
      <label>Raum</label>
      <input type="text" name="new_room" value="<?= htmlspecialchars($_POST['new_room'] ?? '') ?>" placeholder="Optional">
    </div>
    <div>
      <label>Schrank</label>
      <input type="text" name="new_schrank" value="<?= htmlspecialchars($_POST['new_schrank'] ?? '') ?>" placeholder="z.B. S">
    </div>
    <div>
      <label>Regal</label>
      <input type="text" name="new_regal" value="<?= htmlspecialchars($_POST['new_regal'] ?? '') ?>" placeholder="z.B. 3">
    </div>
    <div>
      <label>Position</label>
      <input type="text" name="new_position" value="<?= htmlspecialchars($_POST['new_position'] ?? '') ?>" placeholder="Optional">
    </div>
  </div>
  <small>Neuer Standort wird nur angelegt wenn "Schrank" ausgefüllt ist.</small>
</fieldset>

<!-- ═══════════════════════════════════════════════════════ SPECS -->
<fieldset>
  <legend>Technische Daten (Specs)</legend>
  <small>Beliebig viele Schlüssel-Wert-Paare. z.B. RAM → 4 GB, Anzahl → 3</small>
  <div id="specs-container" style="margin-top:10px;">
    <div class="spec-row">
      <input type="text" name="spec_key[]"   placeholder="Schlüssel (z.B. RAM)">
      <input type="text" name="spec_value[]" placeholder="Wert (z.B. 4 GB)">
      <button type="button" onclick="this.closest('.spec-row').remove()"></button>
    </div>
  </div>
  <button type="button" id="add-spec" onclick="addSpec()">+ Spec hinzufügen</button>
</fieldset>

<!-- ═══════════════════════════════════════════════════════ TAGS -->
<fieldset>
  <legend>Tags</legend>

  <?php if ($tags): ?>
  <label>Bestehende Tags</label>
  <div class="tag-grid">
    <?php foreach ($tags as $tag): ?>
      <label>
        <input type="checkbox" name="tags[]" value="<?= $tag['id'] ?>"
               <?= (isset($_POST['tags']) && in_array($tag['id'], $_POST['tags'])) ? 'checked' : '' ?>>
        <?= htmlspecialchars($tag['name']) ?>
      </label>
    <?php endforeach; ?>
  </div>
  <?php else: ?>
  <p><em>Noch keine Tags vorhanden.</em></p>
  <?php endif; ?>

  <label style="margin-top:12px;">Neue Tags anlegen <small>(kommagetrennt)</small></label>
  <input type="text" name="new_tags" value="<?= htmlspecialchars($_POST['new_tags'] ?? '') ?>"
         placeholder="z.B. microcontroller, blau, selten">
</fieldset>

<!-- ═══════════════════════════════════════════════════════ DATEIEN -->
<fieldset>
  <legend>Dateien hochladen</legend>
  <small>
    Bilder (jpg, png, webp, gif, svg, avif) → <code>/docs/{id}/images/</code><br>
    Dokumente (pdf, doc, docx, xls, xlsx, txt, csv, zip) → <code>/docs/{id}/data/</code><br>
    Wird automatisch nach Dateiendung sortiert.
    Um ein Thumbnail zu erstellen. Laden sie eine Datei mit dem Namen "thumb.png" zum Beispiel hoch. 
  </small>

  <div class="file-drop" onclick="document.getElementById('file-input').click()">
    Klicken zum Auswählen oder Dateien hierher ziehen
    <input type="file" id="file-input" name="uploads[]" multiple style="display:none"
           onchange="showFiles(this)">
  </div>
  <div id="file-list"></div>
</fieldset>

<!-- ═══════════════════════════════════════════════════════ SUBMIT -->
<button type="submit">Gegenstand speichern</button>

</form>

<?php if ($db): ?>
<hr style="margin-top:40px;">
<h2>Aktueller Datenbankstand</h2>
<details>
  <summary style="cursor:pointer; font-weight:bold;">Items (<?= (int)$db->query("SELECT COUNT(*) c FROM items")->fetch_assoc()['c'] ?>)</summary>
  <?php
    $allItems = $db->query("SELECT i.id, i.name, i.brand, i.model, i.status, c.name AS cat, l.schrank, l.regal
                             FROM items i
                             LEFT JOIN categories c ON c.id = i.category_id
                             LEFT JOIN locations l ON l.id = i.location_id
                             ORDER BY i.id DESC LIMIT 50")->fetch_all(MYSQLI_ASSOC);
  ?>
  <table border="1" cellpadding="4" cellspacing="0" style="margin-top:8px; width:100%; font-size:0.85em; background:#fff;">
    <tr style="background:#ddd;">
      <th>ID</th><th>Name</th><th>Marke</th><th>Modell</th><th>Status</th><th>Kategorie</th><th>Schrank</th><th>Regal</th><th>Links</th>
    </tr>
    <?php foreach ($allItems as $row): ?>
    <tr>
      <td><?= $row['id'] ?></td>
      <td><?= htmlspecialchars($row['name']) ?></td>
      <td><?= htmlspecialchars($row['brand'] ?? '–') ?></td>
      <td><?= htmlspecialchars($row['model'] ?? '–') ?></td>
      <td><?= htmlspecialchars($row['status']) ?></td>
      <td><?= htmlspecialchars($row['cat'] ?? '–') ?></td>
      <td><?= htmlspecialchars($row['schrank'] ?? '–') ?></td>
      <td><?= htmlspecialchars($row['regal'] ?? '–') ?></td>
      <td>
        <a href="http://10.1.200.8/docs/<?= $row['id'] ?>/" target="_blank">Seite</a>
        | <a href="http://10.1.200.8/api/fetch_item.php?id=<?= $row['id'] ?>" target="_blank">API</a>
      </td>
    </tr>
    <?php endforeach; ?>
  </table>
</details>

<details style="margin-top:10px;">
  <summary style="cursor:pointer; font-weight:bold;">Kategorien (<?= count($categories) ?>)</summary>
  <table border="1" cellpadding="4" cellspacing="0" style="margin-top:8px; background:#fff; font-size:0.85em;">
    <tr style="background:#ddd;"><th>ID</th><th>Name</th><th>Oberkategorie</th></tr>
    <?php foreach ($categories as $cat): ?>
    <tr>
      <td><?= $cat['id'] ?></td>
      <td><?= htmlspecialchars($cat['name']) ?></td>
      <td><?= htmlspecialchars($cat['parent_name'] ?? '–') ?></td>
    </tr>
    <?php endforeach; ?>
  </table>
</details>

<details style="margin-top:10px;">
  <summary style="cursor:pointer; font-weight:bold;">Standorte (<?= count($locations) ?>)</summary>
  <table border="1" cellpadding="4" cellspacing="0" style="margin-top:8px; background:#fff; font-size:0.85em;">
    <tr style="background:#ddd;"><th>ID</th><th>Raum</th><th>Schrank</th><th>Regal</th><th>Position</th></tr>
    <?php foreach ($locations as $loc): ?>
    <tr>
      <td><?= $loc['id'] ?></td>
      <td><?= htmlspecialchars($loc['room']     ?? '–') ?></td>
      <td><?= htmlspecialchars($loc['schrank']  ?? '–') ?></td>
      <td><?= htmlspecialchars($loc['regal']    ?? '–') ?></td>
      <td><?= htmlspecialchars($loc['position'] ?? '–') ?></td>
    </tr>
    <?php endforeach; ?>
  </table>
</details>

<details style="margin-top:10px;">
  <summary style="cursor:pointer; font-weight:bold;">Tags (<?= count($tags) ?>)</summary>
  <div style="margin-top:8px;">
    <?php foreach ($tags as $t): ?>
      <span style="display:inline-block; background:#eee; border:1px solid #ccc; padding:2px 8px; margin:3px; font-size:0.85em;">
        #<?= htmlspecialchars($t['name']) ?> (ID <?= $t['id'] ?>)
      </span>
    <?php endforeach; ?>
  </div>
</details>
<?php endif; ?>

<script>
function addSpec() {
    const c = document.getElementById('specs-container');
    const div = document.createElement('div');
    div.className = 'spec-row';
    div.innerHTML = `
        <input type="text" name="spec_key[]"   placeholder="Schlüssel">
        <input type="text" name="spec_value[]" placeholder="Wert">
        <button type="button" onclick="this.closest('.spec-row').remove()"></button>
    `;
    c.appendChild(div);
    div.querySelector('input').focus();
}

function showFiles(input) {
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    if (!input.files.length) return;
    const imageExts = ['jpg','jpeg','png','gif','webp','svg','avif'];
    const docExts   = ['pdf','doc','docx','xls','xlsx','txt','csv','zip'];
    Array.from(input.files).forEach(f => {
        const ext = f.name.split('.').pop().toLowerCase();
        let type = imageExts.includes(ext) ? 'Bild' : docExts.includes(ext) ? 'Dokument' : 'Unbekannt';
        const size = (f.size / 1024).toFixed(1) + ' KB';
        const p = document.createElement('div');
        p.textContent = `${type}: ${f.name} (${size})`;
        list.appendChild(p);
    });
}

// Drag & Drop auf die file-drop-Zone
const dropZone = document.querySelector('.file-drop');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.background='#e0e8ff'; });
dropZone.addEventListener('dragleave', () => { dropZone.style.background=''; });
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.background = '';
    fileInput.files = e.dataTransfer.files;
    showFiles(fileInput);
});
</script>

</body>
</html>
