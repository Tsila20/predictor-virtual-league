function loadCSV() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];

    if (!file) {
        alert("Sélectionne un fichier CSV");
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        const text = e.target.result;
        analyzeData(text);
    };

    reader.readAsText(file);
}

function analyzeData(csv) {
    const rows = csv.split("\n");
    let total = 0;
    let homeWins = 0;

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",");
        if (cols[9] === "1") {
            homeWins++;
        }
        total++;
    }

    const confidence = ((homeWins / total) * 100).toFixed(2);

    document.getElementById("result").innerHTML =
        "<h2>Prédiction: Victoire Domicile</h2>" +
        "<p>Confiance: " + confidence + "%</p>";
}
