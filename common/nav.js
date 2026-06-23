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

    const currentPath = window.location.pathname.toLowerCase();

    function getActiveClass(type) {
        if (type === "home") {
            return currentPath.includes("/tools/") ? "" : "active";
        }
        if (type === "chart") {
            return currentPath.includes("chart-app") ? "active" : "";
        }
        if (type === "feature") {
            return currentPath.includes("feature-search") ? "active" : "";
        }
        return "";
    }

    const nav = document.createElement("div");

    nav.innerHTML = `
        <div id="navbar">
            <a href="${homePath}" class="${getActiveClass('home')}">Home</a>
            <a href="${chartPath}" class="${getActiveClass('chart')}">Chart Tool</a>
            <a href="${featurePath}" class="${getActiveClass('feature')}">Feature Search</a>
        </div>
    `;

    document.body.insertBefore(nav, document.body.firstChild);
}

// ✅ Safe load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadNav);
} else {
    loadNav();
}