// ███████╗███████╗███████╗██████╗ ██████╗  █████╗  █████╗ ██╗  ██╗        ██╗ ██████╗
// ██╔════╝██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝        ██║██╔════╝
// █████╗  █████╗  █████╗  ██║  ██║██████╦╝███████║██║  ╚═╝█████═╝         ██║╚█████╗ 
// ██╔══╝  ██╔══╝  ██╔══╝  ██║  ██║██╔══██╗██╔══██║██║  ██╗██╔═██╗    ██╗  ██║ ╚═══██╗
// ██║     ███████╗███████╗██████╔╝██████╦╝██║  ██║╚█████╔╝██║ ╚██╗██╗╚█████╔╝██████╔╝
// ╚═╝     ╚══════╝╚══════╝╚═════╝ ╚═════╝ ╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝╚═╝ ╚════╝ ╚═════╝ 

const sortField = document.getElementById("submit");

sortField.addEventListener("click", () => {
  const USERname = document.getElementById("name").value.trim();
  const problem = document.getElementById("problem").value.trim();

  if (!USERname || !problem) {
    alert(window.T?.feedback_alert_empty || "Bitte alle Felder ausfüllen!");
    return;
  }

  //übergeben an php
  fetch("/api/feedback.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: USERname, problem: problem }),
  })
    .then((res) => res.json())
    .then((data) => {
      alert(window.T?.feedback_alert_sent || "Feedback gesendet!");
      console.log(data);
    })
    .catch((err) => console.error(err));
});

function applyFeedbackLang() {
  if (!window.T?.feedback_name_placeholder) {
    setTimeout(applyFeedbackLang, 50);
    return;
  }
  document.getElementById("name").placeholder = window.T.feedback_name_placeholder;
  document.getElementById("problem").placeholder = window.T.feedback_problem_placeholder;
  document.getElementById("submit").textContent = window.T.feedback_submit;
}
applyFeedbackLang();