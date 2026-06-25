let pdfBytes = null;
let previewPagesList = [];
let totalPages = 0;
let renderedPages = [];
let manualSelection = new Set();
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
// -----------------------------
// Load PDF
// -----------------------------
// -----------------------------
// Drop + click upload
// -----------------------------

dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
    handleFile(e.target.files[0]);
});

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    const file = e.dataTransfer.files[0];
    handleFile(file);
});


async function handleFile(file) {
    if (!file || file.type !== "application/pdf") {
        alert("Please select a valid PDF");
        return;
    }

    pdfBytes = await file.arrayBuffer();

    dropZone.innerText = file.name; // ✅ show filename

    manualSelection.clear(); // reset selection
    renderAllPages();
}

// -----------------------------
// Step buttons
// -----------------------------
function stepValue(id, change) {
    const input = document.getElementById(id);

    let value = parseInt(input.value) || 0;
    value += change;

    if (value < 1) value = 1;

    input.value = value;
    updateSelection();
}

// -----------------------------
// Render ALL pages
// -----------------------------
async function renderAllPages() {
    const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;

    totalPages = pdf.numPages;
    renderedPages = [];

    const grid = document.getElementById("previewGrid");
    grid.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const imgURL = canvas.toDataURL();

        const container = document.createElement("div");
        container.className = "page-item";

        // ✅ FIXED click (now works)
        container.addEventListener("click", () => handlePageClick(i));

        container.innerHTML = `
            <img src="${imgURL}">
            <div class="page-number">${i}</div>
        `;

        grid.appendChild(container);
        renderedPages.push(container);
    }

    updateSelection();
}

// -----------------------------
// Manual click logic (FIXED)
// -----------------------------
function handlePageClick(pageNum) {
    const mode = document.getElementById("mode").value;

    if (mode !== "manual") return;

    if (manualSelection.has(pageNum)) {
        manualSelection.delete(pageNum);
    } else {
        manualSelection.add(pageNum);
    }

    updateSelection();
}

// -----------------------------
// Selection logic
// -----------------------------
function updateSelection() {
    if (!pdfBytes) return;

    const mode = document.getElementById("mode").value;
    previewPagesList = [];

    if (mode === "auto") {
        const startPage = parseInt(document.getElementById("startPage").value);
        const interval = parseInt(document.getElementById("interval").value);

        for (let i = startPage; i <= totalPages; i += interval) {
            previewPagesList.push(i);
        }

    } else {
        previewPagesList = Array.from(manualSelection);
    }

    // ✅ update visuals
    renderedPages.forEach((el, index) => {
        const pageNum = index + 1;

        if (previewPagesList.includes(pageNum)) {
            el.classList.add("selected");
            el.classList.remove("dimmed");
        } else {
            el.classList.remove("selected");
            el.classList.add("dimmed");
        }
    });
}

// -----------------------------
// Extract pages
// -----------------------------
async function extractPages() {
    if (!pdfBytes || previewPagesList.length === 0) {
        alert("Nothing selected");
        return;
    }

    const srcPdf = await PDFLib.PDFDocument.load(pdfBytes);
    const newPdf = await PDFLib.PDFDocument.create();

    for (let pageNum of previewPagesList) {
        const [copiedPage] = await newPdf.copyPages(srcPdf, [pageNum - 1]);
        newPdf.addPage(copiedPage);
    }

    const newBytes = await newPdf.save();

    const blob = new Blob([newBytes], { type: "application/pdf" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "extracted_pages.pdf";
    a.click();
}

// -----------------------------
// Mode switching (IMPORTANT)
// -----------------------------
document.getElementById("mode").onchange = () => {
    const mode = document.getElementById("mode").value;

    // ✅ toggle auto controls
    document.getElementById("autoControls").style.display =
        mode === "auto" ? "block" : "none";

    updateSelection();
};

// -----------------------------
// LIVE updates
// -----------------------------
document.getElementById("startPage").oninput = updateSelection;
document.getElementById("interval").oninput = updateSelection;