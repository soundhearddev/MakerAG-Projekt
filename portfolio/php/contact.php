<?php
// zusammen mit Sandro erarbeitet und gemacht
include 'config.php'; // datenbank config

// setzt die variablen leer
$name = $email = $message = "";
$feedbackMessage = "";


if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // setzt die werte von name, email und nachricht in eine variable
    $name = $_POST["name"]; 
    $email = $_POST["email"];
    $message = $_POST["message"];

    $sql = "INSERT INTO data (name, email, message) VALUES ('$name', '$email', '$message')";
    

    // schauen ob es funktioniert hat
    if ($conn->query($sql) === TRUE) {
      $feedbackMessage = "Es hat funktioniert";
      header("Location: feedback.php?message=" . urlencode($feedbackMessage) . "&name=" . urlencode($name));
      exit();
  } else {
      $feedbackMessage = "Fehler: " . $conn->error;
      header("Location: feedback.php?message=" . urlencode($feedbackMessage));
      exit();
  }
}
$conn->close();
?>

<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kontaktformular</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
      href="https://fonts.googleapis.com/css2?family=Ubuntu:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700&display=swap"
      rel="stylesheet">
      
    <link rel="stylesheet" href="../css/contact.css" />
    
  </head>
  <body>
  
  <nav>
    <div class="logo">
      Portfolio
    </div>
    <ul>
      <li>
        <a href="../index.html" class="mobile-dis">
          Home
        </a>
      </li>
      <li>
        <a href="../html/IT-skills.html" class="mobile-dis">
          IT-Skills
        </a>
      </li>
      <li>
        <a href="../html/Lebenslauf.html" class="mobile-dis" data-i18n="CV">
          Lebenslauf
        </a>
      </li>
      <li>
        <a href="contact.php" class="mobile-dis" data-i18n="contact">
          Kontakt
        </a>
      </li>



      <!-- Dropdown für die lernfelder -->

      <li>
        <ul class="dropdown">
          <a href="../html/Lernfelder/lernfelder_lobby.html" data-i18n="LF">Lernfelder</a>
          <ul class="dropdown-content">
            <li><a href="../html/Lernfelder/lf1.html">LF1</a></li>
            <li><a href="../html/Lernfelder/lf2.html">LF2</a></li>
            <li><a href="../html/Lernfelder/lf3.html">LF3</a></li>
            <li><a href="../html/Lernfelder/lf4.html">LF4</a></li>
            <li><a href="../html/Lernfelder/lf5.html">LF5</a></li>
            <li><a href="../html/Lernfelder/lf6.html">LF6</a></li>
            <li><a href="../html/Lernfelder/lf7.html">LF7</a></li>
            <li><a href="../html/Lernfelder/lf8.html">LF8</a></li>
            <li><a href="../html/Lernfelder/lf9.html">LF9</a></li>
            <li><a href="../html/Lernfelder/lf10.html">LF10</a></li>
          </ul>
        </ul>
      </li>
      <li>
        <a href="#settings">
          <img class="settings-icon" src="../img/settings_dunkel.png" alt="Einstellungen" />
        </a>
      </li>
    </ul>
  </nav>


    <div style="height: 70px;"> <!-- Platzhalter --> </div>


    <div class="contact-form">
        <span class="heading" data-i18n="kontaktieren">Kontaktieren sie mich</span>
        <form id="contactForm" method="POST">
            <label id="name" for="name">Name:</label>
            
            <input type="text" id="name" name="name" required>
            
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
            
            <label for="message" data-i18n="Message">Nachricht:</label>
            <textarea id="message" name="message" required></textarea>
            
            <button type="submit" data-i18n="send">Absenden</button>
        </form>
    </div>








  

    <div id="settings" class="settings"> <!-- id="settings" für Js-->
    <a href="#" class="close-btn">&times;</a>
    <h2 data-i18n="settings">Einstellungen</h2>

    <div class="theme-switcher">
      <input type="checkbox" id="toggle" class="theme-checkbox" /> <!-- id="toggle" für Js-->
      <label for="toggle" class="image-button">
        <img src="../img/sun.png" alt="Hellmodus" class="light-image mode-image">
        <img src="../img/full-moon.png" alt="Dunkelmodus" class="dark-image mode-image">
      </label>
    </div>

    <div style="height: 50px;"> <!-- Platzhalter --> </div>

    <p data-i18n="ts">Text Größe</p>
    <div class="slider-container">
      <input type="range" min="10" max="32" value="16" class="slider" id="fontSlider"> <!-- ja ja id="fontslider" Js... die minimale größe ist 10px und die maximale ist 32. der default ist 16 -->
      <button class="apply-button" onclick="applyFontSize()" data-i18n="apply">Anwenden</button> <!-- Wenn der Button gedrückt wird, wird in javascript die funktion applyFontSize -->
    </div>

    <div style="height: 50px;"> <!-- Platzhalter --> </div>

    <div id="language-switcher">
      <button class="lang" data-lang="de">
        DE 
        <img src="../img/german-flag.png">
      </button>
      <button class="lang" data-lang="en">
        EN 
        <img src="../img/usa.png">
      </button>
    </div>

  <script src="../js/script.js"></script>
  <script src="../js/translate.js"></script>

</body>
</html>
