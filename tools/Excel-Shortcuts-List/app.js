const shortcuts = [
    {
        key: "Ctrl + C",
        title: "Copy",
        tip: "Home → Clipboard → Copy"
    },
    {
        key: "Ctrl + V",
        title: "Paste",
        tip: "Home → Clipboard → Paste"
    },
    {
        key: "Ctrl + Shift + L",
        title: "Toggle Filters",
        tip: "Data → Filter"
    },
    {
        key: "Alt + =",
        title: "AutoSum",
        tip: "Home → Editing → AutoSum"
    },
    {
        key: "Ctrl + T",
        title: "Create Table",
        tip: "Insert → Table"
    },
    {
        key: "Ctrl + Arrow Keys",
        title: "Jump to data edge",
        tip: "Quick navigation across datasets"
    },
    {
        key: "Ctrl + Shift + Arrow",
        title: "Select to edge of data",
        tip: "Great for selecting columns/rows quickly"
    },
    {
        key: "F4",
        title: "Repeat last action / lock cell reference",
        tip: "In formulas: toggles absolute references"
    }
];

// -----------------------------
// Render grid
// -----------------------------
function renderShortcuts(list) {
    const grid = document.getElementById("shortcutGrid");
    grid.innerHTML = "";

    list.forEach(item => {
        const div = document.createElement("div");
        div.className = "shortcut-card";

        div.innerHTML = `
            <div class="shortcut-key">${item.key}</div>
            <div class="shortcut-title">${item.title}</div>
            <div class="shortcut-tip">${item.tip}</div>
        `;

        grid.appendChild(div);
    });
}

// -----------------------------
// Search
// -----------------------------
document.getElementById("searchInput").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();

    const filtered = shortcuts.filter(s =>
        s.key.toLowerCase().includes(query) ||
        s.title.toLowerCase().includes(query) ||
        s.tip.toLowerCase().includes(query)
    );

    renderShortcuts(filtered);
});

// initial load
renderShortcuts(shortcuts);