function loadNav() {
    const nav = document.createElement("div");

    nav.innerHTML = `
        <div id="navbar">
            <a href="/tool-suite/index.html">Home</a>
            <a href="/tool-suite/tools/chart-app/index.html">Chart Tool</a>
            <a href="/tool-suite/tools/time-study/index.html">Time Study</a>
        </div>
    `;

    document.body.insertBefore(nav, document.body.firstChild);
}
