<?php

// zusammen mit Sandro erarbeitet und gemacht

$servername = "localhost";
$username = "root";
$password = "";
$dbname = "contact_form";

// Verbindung zur Datenbank 
$conn = new mysqli($servername, $username, $password, $dbname);


$conn->set_charset("utf8mb4");


// falls ein fehler passiert kommt ein error
if ($conn->connect_error) {
    die("Verbindung fehlgeschlagen: " . $conn->connect_error);
}
?>
