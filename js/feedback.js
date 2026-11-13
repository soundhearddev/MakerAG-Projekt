// ███████╗███████╗███████╗██████╗ ██████╗  █████╗  █████╗ ██╗  ██╗        ██╗ ██████╗
// ██╔════╝██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝        ██║██╔════╝
// █████╗  █████╗  █████╗  ██║  ██║██████╦╝███████║██║  ╚═╝█████═╝         ██║╚█████╗ 
// ██╔══╝  ██╔══╝  ██╔══╝  ██║  ██║██╔══██╗██╔══██║██║  ██╗██╔═██╗    ██╗  ██║ ╚═══██╗
// ██║     ███████╗███████╗██████╔╝██████╦╝██║  ██║╚█████╔╝██║ ╚██╗██╗╚█████╔╝██████╔╝
// ╚═╝     ╚══════╝╚══════╝╚═════╝ ╚═════╝ ╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝╚═╝ ╚════╝ ╚═════╝ 

const submitBtn = document.getElementById("submit");

submitBtn.addEventListener("click", async () => {
  const nameInput = document.getElementById("name");
  const problemInput = document.getElementById("problem");
  const name = nameInput.value.trim();
  const problem = problemInput.value.trim();

  if (!name || !problem) {
    alert(window.T?.feedback_alert_empty || "Bitte alle Felder ausfüllen!");
    return;
  }

  try {
    const res = await fetch("/api/feedback.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, problem }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.error || "Feedback konnte nicht gesendet werden.");
      return;
    }

    alert(window.T?.feedback_alert_sent || "Feedback gesendet!");
    nameInput.value = "";
    problemInput.value = "";
  } catch (err) {
    console.error("Feedback konnte nicht gesendet werden:", err);
    alert("Feedback konnte nicht gesendet werden.");
  }
});

window.langReady.then(() => {
  if (!window.T?.feedback_name_placeholder) return;
  document.getElementById("name").placeholder = window.T.feedback_name_placeholder;
  document.getElementById("problem").placeholder = window.T.feedback_problem_placeholder;
  submitBtn.textContent = window.T.feedback_submit;
});
