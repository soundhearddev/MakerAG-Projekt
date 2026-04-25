<?php
include 'config.php'; // Datenbankverbindung einbinden

$sql = "SELECT id, name, email, message FROM data ORDER BY id DESC";
$result = $conn->query($sql);
?>

<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gespeicherte Nachrichten</title>
    <link rel="stylesheet" href="../css/contact.css" />
</head>
<body>
    <h2>Gespeicherte Nachrichten</h2>
    <table>
        <tr>
            <th>ID</th>
            <th>Name</th>
            <th>E-Mail</th>
            <th>Nachricht</th>

        </tr>
        <?php
        
        

        if ($result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                echo "<tr><td>" . $row["id"] . "</td>
                <td>" . $row["name"] . "</td>
                <td>" . $row["email"] . "</td>
                <td>" . nl2br(htmlspecialchars($row["message"])) . "</td>
                ";
            }
        } else {
            echo "<tr><td colspan='4'>Keine Nachrichten gefunden</td></tr>";
        }



    ?>
        </tr>
    </table>
</body>


</html>

<?php $conn->close(); ?>