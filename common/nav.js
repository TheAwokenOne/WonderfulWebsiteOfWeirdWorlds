function loadNav() {
    const isSubPage = window.location.pathname.includes("/tools/");

    const homePath = isSubPage ? "../../index.html" : "index.html";
    const chartPath = isSubPage ? "index.html" : "tools/chart-app/index.html";

    const nav = document.createElement("div");

    nav.innerHTML = `
        <div id="navbar">
            <a href="${homePath}">Home</a>
            <a href="${chartPath}">Chart Tool</a>
        </div>
    `;

    document.body.insertBefore(nav, document.body.firstChild);
}

