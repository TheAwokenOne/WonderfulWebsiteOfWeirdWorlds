let chartDataList = [];
let currentIndex = 0;
let currentChart = null;
let masterChartData = [];
let isMasterView = false;

const MAX_SHEETS_PER_WORKBOOK = 10;
const TARGET_CELL = "E5";
const TARGET_TEXT = "Position Description";

const VALUE_COLS = ["H", "J", "L", "N", "P"];

const COLOR_AV = "green";
const COLOR_NAV = "yellow";
const COLOR_W = "red";
const COLOR_TAKT = "blue";

// =========================
// STATUS / SETTINGS
// =========================

function setStatus(message) {
    const status = document.getElementById("statusText");
    if (status) {
        status.textContent = message;
    }
}

function getExportSize() {
    const val = document.getElementById("resolutionSelect")?.value || "1920x1080";
    const [width, height] = val.split("x").map(Number);
    return { width, height };
}

// =========================
// BASIC HELPERS
// =========================

function safeFloat(val) {
    if (val === null || val === undefined || val === "") {
        return 0;
    }

    if (typeof val === "string") {
        val = val.trim().replace(/,/g, "");
        if (val === "") {
            return 0;
        }
    }

    const parsed = parseFloat(val);
    return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(val, defaultValue = "-") {
    if (val === null || val === undefined) {
        return defaultValue;
    }

    const text = String(val).trim();
    return text ? text : defaultValue;
}

function normalizeText(value) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function cleanSheetTitle(text) {
    return safeText(text, "Untitled").replace(/\s+/g, " ").trim();
}

function isSheetEmpty(AV, NAV, W) {
    return [...AV, ...NAV, ...W].every(v => Math.abs(v) === 0);
}

function getCell(ws, addr) {
    return safeFloat(ws[addr]?.v);
}

function getText(ws, addr) {
    return safeText(ws[addr]?.v);
}

function colToIndex(colLetter) {
    return XLSX.utils.decode_col(colLetter);
}

function cellValueByRowCol(ws, rowIndexZeroBased, colIndexZeroBased) {
    const addr = XLSX.utils.encode_cell({
        r: rowIndexZeroBased,
        c: colIndexZeroBased
    });

    return ws[addr]?.v;
}

function getNumberFromRowAndCol(ws, rowIndexZeroBased, colLetter) {
    const colIndex = colToIndex(colLetter);
    return safeFloat(cellValueByRowCol(ws, rowIndexZeroBased, colIndex));
}

function getNumbersFromRow(ws, rowIndexZeroBased) {
    return VALUE_COLS.map(col => getNumberFromRowAndCol(ws, rowIndexZeroBased, col));
}

function getWorksheetRange(ws) {
    if (!ws["!ref"]) {
        return null;
    }

    return XLSX.utils.decode_range(ws["!ref"]);
}

// =========================
// DYNAMIC SHEET SEARCH HELPERS
// =========================

function findCellContainingText(ws, searchText, startRow = null, endRow = null) {
    const range = getWorksheetRange(ws);

    if (!range) {
        return null;
    }

    const target = normalizeText(searchText);

    const firstRow = startRow ?? range.s.r;
    const lastRow = endRow ?? range.e.r;

    for (let r = firstRow; r <= lastRow; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const value = cellValueByRowCol(ws, r, c);
            const text = normalizeText(value);

            if (text.includes(target)) {
                return { row: r, col: c, value };
            }
        }
    }

    return null;
}

function findRowWithExactText(ws, searchText, startRow = null, endRow = null) {
    const range = getWorksheetRange(ws);

    if (!range) {
        return null;
    }

    const target = normalizeText(searchText);

    const firstRow = startRow ?? range.s.r;
    const lastRow = endRow ?? range.e.r;

    for (let r = firstRow; r <= lastRow; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const value = cellValueByRowCol(ws, r, c);
            const text = normalizeText(value);

            if (text === target) {
                return r;
            }
        }
    }

    return null;
}

function findConfigurationPercentRow(ws, startRow = null, endRow = null) {
    const configCell =
        findCellContainingText(ws, "Configuration", startRow, endRow) ||
        findCellContainingText(ws, "Configuration (%)", startRow, endRow) ||
        findCellContainingText(ws, "Configuration  (%):", startRow, endRow);

    if (!configCell) {
        return null;
    }

    const range = getWorksheetRange(ws);

    if (!range) {
        return null;
    }

    const maxRow = Math.min(range.e.r, configCell.row + 5);

    for (let r = configCell.row; r <= maxRow; r++) {
        const values = getNumbersFromRow(ws, r);
        const hasAnyPercentValue = values.some(v => Math.abs(v) > 0);

        if (hasAnyPercentValue) {
            return r;
        }
    }

    return null;
}

function isBalanceChartSheet(ws) {
    const value = ws[TARGET_CELL]?.v;

    if (value !== null && value !== undefined) {
        return String(value).toLowerCase().includes(TARGET_TEXT.toLowerCase());
    }

    // Backup check in case rows were inserted above E5
    const found = findCellContainingText(ws, TARGET_TEXT);
    return found !== null;
}

// =========================
// DYNAMIC DATA EXTRACTION
// =========================

function extractVariationData(ws) {
    const range = getWorksheetRange(ws);

    if (!range) {
        return emptyVariationData();
    }

    const ppeCell = findCellContainingText(ws, "PPE required");

    if (!ppeCell) {
        console.warn("Could not find PPE required section. Falling back to fixed-row extraction.");
        return extractVariationDataFallback(ws);
    }

    const searchStart = ppeCell.row;
    const searchEnd = Math.min(range.e.r, ppeCell.row + 35);

    const avRow = findRowWithExactText(ws, "AV", searchStart, searchEnd);
    const navRow = findRowWithExactText(ws, "NAV", searchStart, searchEnd);
    const wRow = findRowWithExactText(ws, "W", searchStart, searchEnd);

    const pctRow = findConfigurationPercentRow(
        ws,
        searchStart,
        Math.min(range.e.r, ppeCell.row + 60)
    );

    if (avRow === null || navRow === null || wRow === null || pctRow === null) {
        console.warn("Could not find one or more dynamic summary rows. Falling back to fixed-row extraction.", {
            avRow,
            navRow,
            wRow,
            pctRow
        });

        return extractVariationDataFallback(ws);
    }

    return {
        AV: getNumbersFromRow(ws, avRow),
        NAV: getNumbersFromRow(ws, navRow),
        W: getNumbersFromRow(ws, wRow),
        PCT: getNumbersFromRow(ws, pctRow)
    };
}

function extractVariationDataFallback(ws) {
    const AV = [];
    const NAV = [];
    const W = [];
    const PCT = [];

    VALUE_COLS.forEach(col => {
        AV.push(getCell(ws, `${col}70`));
        NAV.push(getCell(ws, `${col}71`));
        W.push(getCell(ws, `${col}72`));
        PCT.push(getCell(ws, `${col}74`));
    });

    return { AV, NAV, W, PCT };
}

function emptyVariationData() {
    return {
        AV: [0, 0, 0, 0, 0],
        NAV: [0, 0, 0, 0, 0],
        W: [0, 0, 0, 0, 0],
        PCT: [0, 0, 0, 0, 0]
    };
}

function extractVariationLabels(ws) {
    const range = getWorksheetRange(ws);

    if (!range) {
        return VALUE_COLS.map(col => getText(ws, `${col}4`));
    }

    const relevantConfigCell = findCellContainingText(ws, "Relevant Configuration");

    if (!relevantConfigCell) {
        return VALUE_COLS.map(col => getText(ws, `${col}4`));
    }

    /*
        The actual configuration labels are usually one row BELOW
        the "Relevant Configuration" label.

        This searches a few rows below that label and picks the first row
        where the H/J/L/N/P cells contain real text labels.
    */

    const startRow = relevantConfigCell.row + 1;
    const endRow = Math.min(range.e.r, relevantConfigCell.row + 8);

    let bestLabels = null;
    let bestScore = -1;

    for (let r = startRow; r <= endRow; r++) {
        const labels = VALUE_COLS.map(col => {
            const colIndex = colToIndex(col);
            const value = cellValueByRowCol(ws, r, colIndex);
            return safeText(value, "");
        });

        /*
            Score the row based on how many cells look like real labels.

            We avoid rows that are mostly numbers, blanks, or header words.
        */
        const score = labels.reduce((count, label) => {
            const text = normalizeText(label);

            if (!text) {
                return count;
            }

            if (text === "-") {
                return count;
            }

            if (text.includes("relevant configuration")) {
                return count;
            }

            if (text.includes("task time")) {
                return count;
            }

            if (text.includes("total time")) {
                return count;
            }

            // Skip cells that are only numbers
            if (/^\d+(\.\d+)?$/.test(text)) {
                return count;
            }

            return count + 1;
        }, 0);

        if (score > bestScore) {
            bestScore = score;
            bestLabels = labels;
        }

        // If we found a strong row, stop early
        if (score >= 2) {
            break;
        }
    }

    if (bestLabels && bestScore > 0) {
        return bestLabels.map(label => label || "-");
    }

    // Final fallback
    return VALUE_COLS.map(col => getText(ws, `${col}4`));
}

function extractChartTitle(ws) {

    const positionDescriptionCell =
        findCellContainingText(ws, "Position Description");

    if (positionDescriptionCell) {

        // Try the row immediately below
        const belowValue = cellValueByRowCol(
            ws,
            positionDescriptionCell.row + 1,
            positionDescriptionCell.col
        );

        if (belowValue) {
            return cleanSheetTitle(belowValue);
        }
    }

    // Fallback to original template location
    return cleanSheetTitle(ws["E6"]?.v);
}

function extractTAKT(ws) {
    const taktCell = findCellContainingText(ws, "Takt time");

    if (!taktCell) {
        return getCell(ws, "G3");
    }

    const range = getWorksheetRange(ws);

    if (!range) {
        return getCell(ws, "G3");
    }

    for (let r = taktCell.row; r <= Math.min(range.e.r, taktCell.row + 4); r++) {
        for (let c = taktCell.col; c <= Math.min(range.e.c, taktCell.col + 8); c++) {
            const rawValue = cellValueByRowCol(ws, r, c);
            const value = safeFloat(rawValue);

            if (value > 0) {
                return value;
            }
        }
    }

    return getCell(ws, "G3");
}

// =========================
// WACT
// =========================

function computeWact(AV, NAV, W, PCT) {
    const total = PCT.reduce((a, b) => a + b, 0);

    const percent = total > 100 && total > 0
        ? PCT.map(p => p / total)
        : PCT.map(p => p / 100);

    const calc = arr => arr.reduce((sum, v, i) => sum + v * percent[i], 0);

    return [calc(AV), calc(NAV), calc(W)];
}

// =========================
// CHART PLUGINS
// =========================

function getYMax(AV, NAV, W, takt) {
    const totalStack = AV.map((v, i) => v + NAV[i] + W[i]);
    const maxValue = Math.max(...totalStack, safeFloat(takt), 1);
    return Math.ceil(maxValue * 1.1);
}

function whiteBackgroundPlugin() {
    return {
        id: "whiteBackground",
        beforeDraw: chart => {
            const ctx = chart.ctx;

            ctx.save();
            ctx.globalCompositeOperation = "destination-over";
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, chart.canvas.width, chart.canvas.height);
            ctx.restore();
        }
    };
}

function titlePlugin(title, fontSize = 22) {
    return {
        id: "chartTitle",
        afterDraw: chart => {
            const ctx = chart.ctx;

            ctx.save();
            ctx.fillStyle = "black";
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";

            wrapCanvasText(
                ctx,
                title,
                chart.width / 2,
                12,
                chart.width - 80,
                fontSize + 4
            );

            ctx.restore();
        }
    };
}

function taktLinePlugin(takt) {
    return {
        id: "taktLine",
        afterDraw: chart => {
            if (!takt || takt === 0) {
                return;
            }

            const ctx = chart.ctx;
            const yScale = chart.scales.y;
            const y = yScale.getPixelForValue(takt);

            if (!Number.isFinite(y)) {
                return;
            }

            ctx.save();

            ctx.beginPath();
            ctx.moveTo(chart.chartArea.left, y);
            ctx.lineTo(chart.chartArea.right, y);
            ctx.strokeStyle = COLOR_TAKT;
            ctx.lineWidth = 2;
            ctx.stroke();

            const label = `TAKT (${formatNumber(takt)})`;
            ctx.font = "14px Arial";

            const textWidth = ctx.measureText(label).width;
            const boxX = chart.chartArea.left + 4;
            const boxY = y - 21;

            ctx.fillStyle = "white";
            ctx.fillRect(boxX - 2, boxY, textWidth + 8, 18);

            ctx.fillStyle = COLOR_TAKT;
            ctx.textBaseline = "middle";
            ctx.fillText(label, boxX + 2, boxY + 9);

            ctx.restore();
        }
    };
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(" ");
    let line = "";
    let currentY = y;

    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + " ";
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line.trim(), x, currentY);
            line = words[i] + " ";
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }

    ctx.fillText(line.trim(), x, currentY);
}

function formatNumber(value) {
    const num = safeFloat(value);

    if (Number.isInteger(num)) {
        return String(num);
    }

    return String(Math.round(num * 100) / 100);
}

// =========================
// CHART CONFIG
// =========================

function buildChartConfig(chartInfo, exportMode = false) {
    const { labels, AV, NAV, W, takt, title } = chartInfo;

    const yMax = getYMax(AV, NAV, W, takt);

    return {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "AV",
                    data: AV,
                    backgroundColor: COLOR_AV,
                    stack: "s"
                },
                {
                    label: "NAV",
                    data: NAV,
                    backgroundColor: COLOR_NAV,
                    borderColor: "black",
                    borderWidth: 0.25,
                    stack: "s"
                },
                {
                    label: "W",
                    data: W,
                    backgroundColor: COLOR_W,
                    stack: "s"
                }
            ]
        },
        options: {
            responsive: !exportMode,
            maintainAspectRatio: false,
            devicePixelRatio: exportMode ? 1 : 2,
            animation: false,
            layout: {
                padding: {
                    top: exportMode ? 70 : 45,
                    bottom: 10,
                    left: 10,
                    right: 10
                }
            },
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        boxWidth: 20,
                        padding: 16,
                        color: "black"
                    }
                },
                tooltip: {
                    enabled: !exportMode
                }
            },
            datasets: {
                bar: {
                    categoryPercentage: 0.7,
                    barPercentage: 0.9
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        autoSkip: false,
                        maxRotation: labels.length > 8 ? 45 : 0,
                        minRotation: labels.length > 8 ? 45 : 0,
                        color: "black"
                    },
                    grid: {
                        color: "rgba(0,0,0,0.08)"
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: yMax,
                    ticks: {
                        color: "black"
                    },
                    title: {
                        display: true,
                        text: "Time",
                        color: "black"
                    },
                    grid: {
                        color: "rgba(0,0,0,0.18)"
                    }
                }
            }
        },
        plugins: [
            whiteBackgroundPlugin(),
            titlePlugin(title, exportMode ? 24 : 14),
            taktLinePlugin(takt)
        ]
    };
}

// =========================
// RENDERING
// =========================

function renderCurrentChart() {
    if (chartDataList.length === 0) {
        return;
    }

    isMasterView = false;

    const canvas = document.getElementById("mainChart");
    const ctx = canvas.getContext("2d");

    const chartInfo = chartDataList[currentIndex];

    document.getElementById("chartTitle").innerHTML =
        `Chart ${currentIndex + 1} of ${chartDataList.length}<br>${chartInfo.title}`;

    if (currentChart) {
        currentChart.destroy();
    }

    currentChart = new Chart(ctx, buildChartConfig(chartInfo, false));
}

function backToCharts() {
    isMasterView = false;

    const btn = document.getElementById("masterToggleBtn");
    if (btn) {
        btn.innerText = "Show Master Chart";
        btn.classList.remove("active-mode");
    }

    if (chartDataList.length === 0) {
        return;
    }

    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    renderCurrentChart();
}

function showMasterChart() {
    if (masterChartData.length === 0 || chartDataList.length === 0) {
        alert("No master chart data available.");
        return;
    }

    isMasterView = true;

    const btn = document.getElementById("masterToggleBtn");
    if (btn) {
        btn.innerText = "Back to Charts";
        btn.classList.add("active-mode");
    }

    const canvas = document.getElementById("mainChart");
    const ctx = canvas.getContext("2d");

    if (currentChart) {
        currentChart.destroy();
    }

    const masterInfo = buildMasterChartInfo();

    document.getElementById("chartTitle").innerHTML =
        `Master WACT Comparison<br>${masterInfo.labels.length} Charts`;

    currentChart = new Chart(ctx, buildChartConfig(masterInfo, false));
}

// =========================
// NAVIGATION
// =========================

function nextChart() {
    if (isMasterView) {
        return;
    }

    if (chartDataList.length === 0) {
        return;
    }

    currentIndex = (currentIndex + 1) % chartDataList.length;
    renderCurrentChart();
}

function prevChart() {
    if (isMasterView) {
        return;
    }

    if (chartDataList.length === 0) {
        return;
    }

    currentIndex = (currentIndex - 1 + chartDataList.length) % chartDataList.length;
    renderCurrentChart();
}

function toggleMasterView() {
    if (isMasterView) {
        backToCharts();
    } else {
        showMasterChart();
    }
}

// =========================
// EXPORT
// =========================

async function renderChartToCanvas(chartInfo, width, height) {
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.position = "fixed";
    canvas.style.left = "-99999px";
    canvas.style.top = "-99999px";

    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const config = buildChartConfig(chartInfo, true);

    const tempChart = new Chart(ctx, config);

    tempChart.resize(width, height);
    tempChart.update();

    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => setTimeout(resolve, 75));

    const imageData = canvas.toDataURL("image/png", 1.0);

    tempChart.destroy();
    canvas.remove();

    return imageData;
}

async function downloadCurrentChart() {
    if (chartDataList.length === 0 && !isMasterView) {
        alert("No chart loaded.");
        return;
    }

    const lockSize = document.getElementById("lockSizeToggle")?.checked;

    let width;
    let height;

    if (lockSize) {
        const size = getExportSize();
        width = size.width;
        height = size.height;
    } else if (currentChart) {
        width = currentChart.canvas.width || 1920;
        height = currentChart.canvas.height || 1080;
    } else {
        width = 1920;
        height = 1080;
    }

    const chartInfo = isMasterView
        ? buildMasterChartInfo()
        : chartDataList[currentIndex];

    const imageData = await renderChartToCanvas(chartInfo, width, height);

    const link = document.createElement("a");
    const title = chartInfo.title.replace(/[^a-z0-9]/gi, "_");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

    link.download = `${title}_${timestamp}.png`;
    link.href = imageData;
    link.click();
}

async function downloadAllChartsPdf() {
    if (chartDataList.length === 0) {
        alert("No charts loaded.");
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("jsPDF is not loaded. Check your script tag in index.html.");
        return;
    }

    const lockSize = document.getElementById("lockSizeToggle")?.checked;

    let width;
    let height;

    if (lockSize) {
        const size = getExportSize();
        width = size.width;
        height = size.height;
    } else if (currentChart) {
        width = currentChart.canvas.width || 1920;
        height = currentChart.canvas.height || 1080;
    } else {
        width = 1920;
        height = 1080;
    }

    const { jsPDF } = window.jspdf;
    const orientation = width >= height ? "landscape" : "portrait";

    const pdf = new jsPDF({
        orientation: orientation,
        unit: "px",
        format: [width, height],
        compress: true
    });

    const chartsToExport = [...chartDataList];

    if (masterChartData.length > 0) {
        chartsToExport.push(buildMasterChartInfo());
    }

    setStatus(`Creating PDF...\n0 of ${chartsToExport.length} pages complete.`);

    for (let i = 0; i < chartsToExport.length; i++) {
        const chartInfo = chartsToExport[i];

        if (i > 0) {
            pdf.addPage([width, height], orientation);
        }

        const imageData = await renderChartToCanvas(chartInfo, width, height);

        pdf.addImage(
            imageData,
            "PNG",
            0,
            0,
            width,
            height
        );

        setStatus(`Creating PDF...\n${i + 1} of ${chartsToExport.length} pages complete.`);
    }

    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);

    pdf.save(`Combined_Balance_Charts_${timestamp}.pdf`);

    setStatus(
        `PDF created.\n` +
        `${chartDataList.length} chart page(s).\n` +
        `${masterChartData.length > 0 ? "Master chart included." : "No master chart included."}`
    );
}

function buildMasterChartInfo() {
    const labels = masterChartData.map(d => d.label);
    const AV = masterChartData.map(d => d.AV);
    const NAV = masterChartData.map(d => d.NAV);
    const W = masterChartData.map(d => d.W);

    const taktValues = masterChartData
        .map(d => d.takt)
        .filter(v => v !== null && v !== undefined && v !== 0);

    const takt = taktValues.length > 0 ? taktValues[0] : 0;

    return {
        labels: labels,
        AV: AV,
        NAV: NAV,
        W: W,
        takt: takt,
        title: "Combined Master WACT Comparison"
    };
}

// =========================
// MAIN PROCESS
// =========================

async function process() {
    console.log("RUN CLICKED");

    const canvas = document.getElementById("mainChart");
    if (!canvas) {
        console.error("Canvas not found.");
        return;
    }

    const files = document.getElementById("fileInput").files;

    chartDataList = [];
    masterChartData = [];
    currentIndex = 0;
    isMasterView = false;

    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    const btn = document.getElementById("masterToggleBtn");
    if (btn) {
        btn.innerText = "Show Master Chart";
        btn.classList.remove("active-mode");
    }

    if (!files.length) {
        alert("Select a file first.");
        setStatus("No files selected.");
        return;
    }

    let totalSheetsChecked = 0;
    let skippedNotBalanceChart = 0;
    let skippedEmpty = 0;
    let filesProcessed = 0;
    const errors = [];

    setStatus(`Processing ${files.length} file(s)...`);

    for (const file of files) {
        try {
            const data = await file.arrayBuffer();

            const workbook = XLSX.read(data, {
                type: "array",
                cellDates: true,
                cellFormula: false,
                cellNF: false,
                cellStyles: false
            });

            const sheets = workbook.SheetNames.slice(0, MAX_SHEETS_PER_WORKBOOK);

            for (const sheetName of sheets) {
                totalSheetsChecked++;

                const ws = workbook.Sheets[sheetName];

                if (!isBalanceChartSheet(ws)) {
                    skippedNotBalanceChart++;
                    continue;
                }

                const TAKT = extractTAKT(ws);
                const { AV, NAV, W, PCT } = extractVariationData(ws);

                if (isSheetEmpty(AV, NAV, W)) {
                    skippedEmpty++;
                    continue;
                }

                const labels = extractVariationLabels(ws);
                const title = extractChartTitle(ws);

                const [wAV, wNAV, wW] = computeWact(AV, NAV, W, PCT);

                chartDataList.push({
                    labels: [...labels, "WACT"],
                    AV: [...AV, wAV],
                    NAV: [...NAV, wNAV],
                    W: [...W, wW],
                    takt: TAKT,
                    title: `${file.name} - ${title}`,
                    fileName: file.name,
                    sheetName: sheetName,
                    sheetTitle: title
                });

                masterChartData.push({
                    label: `${file.name} - ${title}`,
                    AV: wAV,
                    NAV: wNAV,
                    W: wW,
                    takt: TAKT
                });
            }

            filesProcessed++;
        } catch (err) {
            console.error(`Error processing ${file.name}`, err);
            errors.push(`${file.name}: ${err.message || err}`);
        }
    }

    if (chartDataList.length > 0) {
        currentIndex = 0;
        renderCurrentChart();
    } else {
        document.getElementById("chartTitle").innerHTML = "No chart data found";

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    let statusMessage =
        `Processed ${filesProcessed} file(s).\n` +
        `Sheets checked: ${totalSheetsChecked}\n` +
        `Charts found: ${chartDataList.length}\n` +
        `Skipped non-balance sheets: ${skippedNotBalanceChart}\n` +
        `Skipped empty sheets: ${skippedEmpty}`;

    if (errors.length > 0) {
        statusMessage += `\n\nErrors:\n${errors.join("\n")}`;
    }

    setStatus(statusMessage);
}

// =========================
// AUTO-RUN ON FILE SELECT
// =========================

document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("fileInput");

    if (fileInput) {
        fileInput.addEventListener("change", process);
    }
});