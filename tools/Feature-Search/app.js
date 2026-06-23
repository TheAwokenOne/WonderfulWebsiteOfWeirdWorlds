let DATABASE = null;

async function loadData() {
    const password = document.getElementById("password").value;
    const status = document.getElementById("status");

    try {
        status.innerText = "Loading...";

        const response = await fetch("data/data.enc");
        const buffer = await response.arrayBuffer();

        DATABASE = await decryptFile(password, buffer);

        status.innerText = "✅ Database Loaded";
    } catch (err) {
        console.error(err);
        status.innerText = "❌ Failed to decrypt (bad password or file)";
    }
}

function runSearch() {
    const input = document.getElementById("featureInput").value.trim();
    const resultsDiv = document.getElementById("results");

    if (!DATABASE) {
        resultsDiv.innerText = "⚠️ Load database first";
        return;
    }

    let matches = [];

    for (const job in DATABASE) {
        if (DATABASE[job].includes(input)) {
            matches.push(job);
        }
    }

    resultsDiv.innerHTML = `
        <b>Found ${matches.length} jobs:</b><br>
        ${matches.join("<br>")}
    `;
}
