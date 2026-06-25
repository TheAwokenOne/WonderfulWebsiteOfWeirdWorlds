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
    const pictureTilerPath = toolPath("Picture-Tiler");
    const pdfEditorPath = toolPath("PDF-Editor");

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
        if (type === "picture") {
            return currentPath.includes("picture-tiler") ? "active" : "";
        }
        if (type === "pdf") {
            return currentPath.includes("pdf-editor") ? "active" : "";
        }
        return "";
    }

    const nav = document.createElement("div");

    nav.innerHTML = `
        <div id="navbar">
            <a href="${homePath}" class="${getActiveClass('home')}">Home</a>
            <a href="${chartPath}" class="${getActiveClass('chart')}">Chart Tool</a>
            <a href="${featurePath}" class="${getActiveClass('feature')}">Feature Search</a>
            <a href="${pictureTilerPath}" class="${getActiveClass('picture')}">Picture Tiler</a>
            <a href="${pdfEditorPath}" class="${getActiveClass('pdf')}">PDF Editor</a>
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