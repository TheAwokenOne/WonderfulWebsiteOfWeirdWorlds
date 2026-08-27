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
    const excelShortcutsPath = toolPath("Excel-Shortcuts-List");
    const pdiChecklistPath = toolPath("pdi_checklist_test");
    const downTimeTrackerPath = toolPath("Downtime-Tracker");
    const trackSearchPath = toolPath("Track-Search");

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
        if (type === "excel") {
            return currentPath.includes("excel-shortcuts-list") ? "active" : "";
        }
        if (type === "pdi") {
            return currentPath.includes("pdi_checklist_test") ? "active" : "";
        }
        if (type === "downtime") {
            return currentPath.includes("downtime-tracker") ? "active" : "";
        }
        if (type === "tracksearch") {
            return currentPath.includes("track-search") ? "active" : "";
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
            <a href="${excelShortcutsPath}" class="${getActiveClass('excel')}">Excel Shortcuts</a>
            <a href="${pdiChecklistPath}" class="${getActiveClass('pdi')}">PDI Checklist</a>
            <a href="${downTimeTrackerPath}" class="${getActiveClass('downtime')}">Downtime Tracker</a>
            <a href="${trackSearchPath}" class="${getActiveClass('tracksearch')}">Track Search</a>
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