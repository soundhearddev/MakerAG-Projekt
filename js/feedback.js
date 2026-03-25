const sortField = document.getElementById('submit');

sortField.addEventListener("click", () => {
    const USERname = document.getElementById('name').value.trim();
    const problem = document.getElementById('problem').value.trim();

    if (!USERname || !problem) {
        alert("Bitte alle Felder ausfüllen!");
        return;
    }



    //übergeben an php
    fetch('/api/feedback.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: USERname, problem: problem })
    })
        .then(res => res.json())
        .then(data => {
            alert("Feedback gesendet!");
            console.log(data);
        })
        .catch(err => console.error(err));
});