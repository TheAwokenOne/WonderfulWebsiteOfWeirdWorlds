function loadNav() {
    const isSubPage = window.location.pathname.includes("/tools/");

    function toolPath(folderName) {
        return isSubPage
            ? `../${folderName}/index.html`
            : `tools/${folderName}/index.html`;
    }

    const homePath = isSubPage ? "../../index.html" : "index.html";
    const chartPath = toolPath("Chart-App");
    const featurePath = toolPath("Feature-Search");

    const nav = document.createElement("div");

    nav.innerHTML = `
        <div id="navbar">
            <a href="${homePath}">Home</a>
            <a href="${chartPath}">Chart Tool</a>
            <a href="${featurePath}">Feature Search</a>
        </div>
    `;

    document.body.insertBefore(nav, document.body.firstChild);
}

// window.addEventListener("DOMContentLoaded", loadNav);