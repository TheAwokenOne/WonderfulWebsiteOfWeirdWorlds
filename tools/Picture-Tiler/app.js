
let image = null;
let generatedTiles = [];
let imageTitle = "image";

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("mainPreview");
const ctx = canvas.getContext("2d");

const borderSlider = document.getElementById("borderSize");
const borderValue = document.getElementById("borderValue");



// ✅ NEW: base layer + animation state
let baseCanvas = document.createElement("canvas");
let baseCtx = baseCanvas.getContext("2d");

let dashOffset = 0;
let currentLayout = null;


// -----------------------------
// Upload handling
// -----------------------------
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", e => e.preventDefault());

dropZone.addEventListener("drop", e => {
    e.preventDefault();
    loadFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener("change", e => {
    loadFile(e.target.files[0]);
});

function loadFile(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = e => {
        const img = new Image();

        img.onload = () => {
            image = img;
            dropZone.innerText = file.name;

            generatePreview(); // builds base once
        };

        img.src = e.target.result;
    };

    reader.readAsDataURL(file);
}


// -----------------------------
// BUILD BASE (NO LINES HERE)
// -----------------------------
function generatePreview() {
    if (!image) return;

    const parts = parseInt(document.getElementById("parts").value);
    const border = parseInt(borderSlider.value);
    const borderColor = document.getElementById("borderColor").value;

    borderValue.innerText = border;

    let cols = 2, rows = 2;
    if (parts === 2) rows = 1;
    if (parts === 6) rows = 3;

    const bw = image.width + border * 2;
    const bh = image.height + border * 2;

    // ✅ draw base ONCE
    baseCanvas.width = bw;
    baseCanvas.height = bh;

    baseCtx.clearRect(0, 0, bw, bh);

    // border
    baseCtx.fillStyle = borderColor;
    baseCtx.fillRect(0, 0, bw, bh);

    // image
    baseCtx.drawImage(image, border, border);

    // ✅ setup display canvas
    const displayWidth = canvas.parentElement.clientWidth;
    const scale = displayWidth / bw;

    canvas.width = bw;
    canvas.height = bh;
    canvas.style.height = (bh * scale) + "px";

    // ✅ save layout
    currentLayout = { cols, rows, bw, bh };

    // ✅ generate tiles (unchanged behavior)
    generateTiles(cols, rows, border, borderColor);
}


// -----------------------------
// RENDER FRAME (LINES ONLY)
// -----------------------------
function renderFrame() {
    if (!image || !currentLayout) return;

    const { cols, rows, bw, bh } = currentLayout;

    const tileW = bw / cols;
    const tileH = bh / rows;

    // ✅ restore base (FAST)
    ctx.drawImage(baseCanvas, 0, 0);

    ctx.setLineDash([10, 6]);
    ctx.lineDashOffset = dashOffset;

    // ---------- OUTER ----------
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 5;

    for (let c = 1; c < cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * tileW, 0);
        ctx.lineTo(c * tileW, bh);
        ctx.stroke();
    }
    for (let r = 1; r < rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * tileH);
        ctx.lineTo(bw, r * tileH);
        ctx.stroke();
    }

    // ---------- INNER ----------
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = 2;

    for (let c = 1; c < cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * tileW, 0);
        ctx.lineTo(c * tileW, bh);
        ctx.stroke();
    }
    for (let r = 1; r < rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * tileH);
        ctx.lineTo(bw, r * tileH);
        ctx.stroke();
    }

    ctx.setLineDash([]);
}


// -----------------------------
// TILE GENERATION (UNCHANGED)
// -----------------------------
function generateTiles(cols, rows, border, borderColor) {
    generatedTiles = [];

    const borderedCanvas = document.createElement("canvas");
    borderedCanvas.width = image.width + border * 2;
    borderedCanvas.height = image.height + border * 2;

    const bctx = borderedCanvas.getContext("2d");

    bctx.fillStyle = borderColor;
    bctx.fillRect(0, 0, borderedCanvas.width, borderedCanvas.height);
    bctx.drawImage(image, border, border);

    const tileW = Math.floor(borderedCanvas.width / cols);
    const tileH = Math.floor(borderedCanvas.height / rows);

    const aspectW = 4;
    const aspectH = 3;
    const scale = Math.max(tileW / aspectW, tileH / aspectH);

    const finalW = Math.floor(aspectW * scale);
    const finalH = Math.floor(aspectH * scale);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {

            const canvas = document.createElement("canvas");
            canvas.width = finalW;
            canvas.height = finalH;

            const ctx = canvas.getContext("2d");

            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, finalW, finalH);

            let offsetX = (c < cols / 2) ? (finalW - tileW) : 0;
            let offsetY = (r < rows / 2) ? (finalH - tileH) : 0;

            ctx.drawImage(
                borderedCanvas,
                c * tileW, r * tileH, tileW, tileH,
                offsetX, offsetY, tileW, tileH
            );

            generatedTiles.push(canvas);
        }
    }
}


// -----------------------------
// DOWNLOAD
// -----------------------------
async function downloadAll() {
    if (generatedTiles.length === 0) {
        alert("Load an image first");
        return;
    }

    const zip = new JSZip();

    const folder = zip.folder("tiles");

    // convert each canvas to blob and add to zip
    const promises = generatedTiles.map((canvas, index) => {
        return new Promise(resolve => {
            canvas.toBlob(blob => {
                folder.file(`tile_${index + 1}.png`, blob);
                resolve();
            });
        });
    });

    await Promise.all(promises);

    // generate zip file
    const zipBlob = await zip.generateAsync({ type: "blob" });

    // trigger download
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = `${imageTitle}_tiles.zip`;
    a.click();
}



// -----------------------------
// ANIMATION LOOP (SMOOTH NOW)
// -----------------------------
function animate() {
    dashOffset -= 1; // adjust speed

    renderFrame(); // ✅ ONLY LINES

    requestAnimationFrame(animate);
}

animate();


// -----------------------------
// LIVE UPDATES
// -----------------------------
document.getElementById("parts").onchange = generatePreview;
borderSlider.oninput = generatePreview;
document.getElementById("borderColor").oninput = generatePreview;
