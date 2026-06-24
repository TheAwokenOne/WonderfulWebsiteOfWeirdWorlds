let chartDataList = [];
let currentIndex = 0;
let currentChart = null;
let masterChartData = [];
// let masterChart = null;
let isMasterView = false;


const taktValueGlobal = 490;

function getExportSize() {
    const val = document.getElementById("resolutionSelect")?.value || "1920x1080";
    const [width, height] = val.split("x").map(Number);
    return { width, height };
}


// ===== helpers =====
function safeFloat(val) {
    return (val === null || val === undefined || val === "") ? 0 : parseFloat(val) || 0;
}

function isSheetEmpty(AV, NAV, W) {
    return [...AV, ...NAV, ...W].every(v => Math.abs(v) === 0);
}

function getCell(ws, addr) {
    return safeFloat(ws[addr]?.v);
}

function getText(ws, addr) {
    const val = ws[addr]?.v;
    return val ? val.toString().trim() : "-";
}

function toggleMasterView() {
    if (isMasterView) {
        backToCharts();
    } else {
        showMasterChart();
    }
}

function buildChartConfig(chartInfo) {
    const { labels, AV, NAV, W, takt, title } = chartInfo;

    const maxHeight = Math.max(
        ...AV.map((v, i) => v + NAV[i] + W[i]),
        takt
    ) * 1.1;

    return {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                { label: "AV", data: AV, backgroundColor: "green", stack: "s" },
                { label: "NAV", data: NAV, backgroundColor: "yellow", stack: "s" },
                { label: "W", data: W, backgroundColor: "red", stack: "s" }
            ]
        },

        options: {
            responsive: false,
            maintainAspectRatio: false,
            devicePixelRatio: 2,

            animation: false,

            layout: {
                padding: { top: 40 }
            },

            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 20,
                        padding: 16
                    }
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
                        maxRotation: 0
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: Math.round(maxHeight)
                }
            }
        },

        // ✅ ✅ THIS WAS MISSING (your plugins go here)
        plugins: [
            {
                id: 'whiteBackground',
                beforeDraw: (chart) => {
                    const ctx = chart.ctx;

                    ctx.save();
                    ctx.globalCompositeOperation = 'destination-over';
                    ctx.fillStyle = 'white';

                    // ✅ FIX: use canvas size (handles DPR correctly)
                    ctx.fillRect(
                        0,
                        0,
                        chart.canvas.width,
                        chart.canvas.height
                    );

                    ctx.restore();
                }
            },
            {
                id: 'chartTitle',
                afterDraw: (chart) => {
                    const ctx = chart.ctx;

                    ctx.save();
                    ctx.fillStyle = "black";
                    ctx.font = "bold 22px Arial";
                    ctx.textAlign = "center";

                    ctx.fillText(title, chart.width / 2, 25);

                    ctx.restore();
                }
            },
            {
                id: 'taktLine',
                afterDraw: (chart) => {
                    const ctx = chart.ctx;
                    const yScale = chart.scales.y;
                    const y = yScale.getPixelForValue(takt);

                    ctx.save();

                    ctx.beginPath();
                    ctx.moveTo(chart.chartArea.left, y);
                    ctx.lineTo(chart.chartArea.right, y);
                    ctx.strokeStyle = "blue";
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.fillStyle = "blue";
                    ctx.font = "14px Arial";

                    ctx.fillText(
                        `TAKT (${takt})`,
                        chart.chartArea.left + 5,
                        y - 5
                    );

                    ctx.restore();
                }
            }
        ]
    };
}

// ===== extraction =====
function extractVariationData(ws) {
    const cols = ["H", "J", "L", "N", "P"];

    let AV = [], NAV = [], W = [], PCT = [];

    cols.forEach(col => {
        AV.push(getCell(ws, `${col}70`));
        NAV.push(getCell(ws, `${col}71`));
        W.push(getCell(ws, `${col}72`));
        PCT.push(getCell(ws, `${col}74`));
    });

    return { AV, NAV, W, PCT };
}

function extractVariationLabels(ws) {
    const cols = ["H", "J", "L", "N", "P"];
    return cols.map(col => getText(ws, `${col}4`));
}

function extractChartTitle(ws) {
    const val = ws["E6"]?.v;
    return val ? val.toString().trim() : "Untitled";
}

function extractTAKT(ws) {
    return getCell(ws, "G3");
}

// ===== WACT =====
function computeWact(AV, NAV, W, PCT) {
    let total = PCT.reduce((a, b) => a + b, 0);

    let percent = (total > 100 && total > 0)
        ? PCT.map(p => p / total)
        : PCT.map(p => p / 100);

    const calc = (arr) => arr.reduce((sum, v, i) => sum + (v * percent[i]), 0);

    return [calc(AV), calc(NAV), calc(W)];
}

// ===== render chart =====
function renderCurrentChart() {
    const canvas = document.getElementById("mainChart");
    const ctx = canvas.getContext("2d");

    const chartInfo = chartDataList[currentIndex];

    // ✅ ✅ Chart X of Y + Title
    document.getElementById("chartTitle").innerHTML =
        `Chart ${currentIndex + 1} of ${chartDataList.length}<br>${chartInfo.title}`;

    const { labels, AV, NAV, W, takt } = chartInfo;

    const totalStack = AV.map((v, i) => v + NAV[i] + W[i]);
    const maxHeight = Math.max(...totalStack, takt) * 1.1;

    if (currentChart) {
        currentChart.destroy();
    }

    currentChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                { label: "AV", data: AV, backgroundColor: "green", stack: "s" },
                { label: "NAV", data: NAV, backgroundColor: "yellow", stack: "s" },
                { label: "W", data: W, backgroundColor: "red", stack: "s" }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: 2,
            layout: {
                padding: {
                    top: 30
                }
            },
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: Math.round(Math.max(...AV.map((v,i)=>v+NAV[i]+W[i]), takt) * 1.1)
                }
            }
        },

        // ✅ ✅ THIS IS THE KEY PART
        plugins: [
            {
                id: 'chartTitle',
                afterDraw: (chart) => {
                    const ctx = chart.ctx;
                    ctx.save();

                    // Draw title at top of canvas with padding
                    ctx.fillStyle = "black";
                    ctx.font = "bold 14px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText(
                        chartInfo.title,
                        chart.width / 2,
                        20
                    );

                    ctx.restore();
                }
            },
            {
                id: 'taktLine',
                afterDraw: (chart) => {
                    const yScale = chart.scales.y;
                    const ctx = chart.ctx;

                    const y = yScale.getPixelForValue(takt);

                    ctx.save();

                    // Draw blue line
                    ctx.beginPath();
                    ctx.moveTo(chart.chartArea.left, y);
                    ctx.lineTo(chart.chartArea.right, y);
                    ctx.strokeStyle = "blue";
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Draw label
                    ctx.fillStyle = "blue";
                    ctx.font = "12px Arial";

                    ctx.fillText(
                        `TAKT (${takt})`,
                        chart.chartArea.left + 5,
                        y - 5
                    );

                    ctx.restore();
                }
            }
        ]
    });
}

function backToCharts() {
    isMasterView = false;

    const btn = document.getElementById("masterToggleBtn");
    btn.innerText = "Show Master Chart";
    btn.classList.remove("active-mode");
    if (chartDataList.length === 0) return;

    // ✅ destroy master chart if it exists
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    renderCurrentChart();
}


// ===== navigation =====
function nextChart() {
    if (isMasterView) return; // prevent navigation in master view
    if (chartDataList.length === 0) return;
    currentIndex = (currentIndex + 1) % chartDataList.length;
    renderCurrentChart();
}

function prevChart() {
    if (isMasterView) return; // prevent navigation in master view
    if (chartDataList.length === 0) return;
    currentIndex = (currentIndex - 1 + chartDataList.length) % chartDataList.length;
    renderCurrentChart();
}

function downloadCurrentChart() {
    if (chartDataList.length === 0) return;

    const lockSize = document.getElementById("lockSizeToggle")?.checked;

    let width, height;

    if (lockSize) {
        const size = getExportSize();
        width = size.width;
        height = size.height;
    } else {
        width = currentChart.canvas.width;
        height = currentChart.canvas.height;
    }

    // ✅ Create new canvas (NO scaling tricks)
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    const chartInfo = chartDataList[currentIndex];
    const config = buildChartConfig(chartInfo);

    const tempChart = new Chart(ctx, config);
    tempChart.resize(width, height);

    setTimeout(() => {
        const link = document.createElement("a");

        const title = chartInfo.title.replace(/[^a-z0-9]/gi, "_");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

        link.download = `${title}_${timestamp}.png`;
        link.href = canvas.toDataURL("image/png");

        link.click();

        tempChart.destroy();
    }, 50);
}


async function downloadAllCharts() {
    if (chartDataList.length === 0) return;

    const lockSize = document.getElementById("lockSizeToggle")?.checked;

    let width, height;

    if (lockSize) {
        const size = getExportSize();
        width = size.width;
        height = size.height;
    }

    for (let i = 0; i < chartDataList.length; i++) {

        const chartInfo = chartDataList[i];

        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");

        if (lockSize) {
            canvas.width = width;
            canvas.height = height;
        } else {
            canvas.width = currentChart.canvas.width;
            canvas.height = currentChart.canvas.height;
        }

        const config = buildChartConfig(chartInfo);

        const tempChart = new Chart(ctx, config);

        await new Promise(resolve => setTimeout(resolve, 50));

        const link = document.createElement("a");

        const name = chartInfo.title.replace(/[^a-z0-9]/gi, "_");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

        link.download = `${name}_${timestamp}.png`;
        link.href = canvas.toDataURL("image/png");

        link.click();

        tempChart.destroy();
    }
}

// ===== MAIN =====
async function process() {
    console.log("RUN CLICKED");
    masterChartData = [];

    if (!document.getElementById("mainChart")) {
        console.error("Canvas not found!");
        return;
    }

    const files = document.getElementById("fileInput").files;
    chartDataList = [];

    if (!files.length) {
        alert("Select a file first");
        return;
    }

    for (let file of files) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);

        const sheets = workbook.SheetNames.slice(0, 10);

        for (let sheetName of sheets) {

            const ws = workbook.Sheets[sheetName];

            const TAKT = extractTAKT(ws);
            const { AV, NAV, W, PCT } = extractVariationData(ws);

            if (isSheetEmpty(AV, NAV, W)) continue;

            const labels = extractVariationLabels(ws);
            const title = extractChartTitle(ws);

            const [wAV, wNAV, wW] = computeWact(AV, NAV, W, PCT);

            chartDataList.push({
                labels: [...labels, "WACT"],
                AV: [...AV, wAV],
                NAV: [...NAV, wNAV],
                W: [...W, wW],
                takt: TAKT,
                title: `${file.name} - ${title}`
            });
            // ✅ store WACT-only for master chart
            masterChartData.push({
                label: title,
                AV: wAV,
                NAV: wNAV,
                W: wW,
                takt: TAKT
            });
        }
    }

    
    if (chartDataList.length > 0) {
        currentIndex = 0;
        renderCurrentChart();
    }
}

function showMasterChart() {
    isMasterView = true;

    const btn = document.getElementById("masterToggleBtn");
    btn.innerText = "Back to Charts";
    btn.classList.add("active-mode");

    if (masterChartData.length === 0) return;
    if (chartDataList.length === 0) return;
    const canvas = document.getElementById("mainChart");
    const ctx = canvas.getContext("2d");

    if (currentChart) {
        currentChart.destroy();
    }

    const labels = masterChartData.map(d => d.label);
    const AV = masterChartData.map(d => d.AV);
    const NAV = masterChartData.map(d => d.NAV);
    const W = masterChartData.map(d => d.W);

    // ✅ use global or first TAKT (or choose max if you want)
    const takt = masterChartData[0].takt;

    const totalStack = AV.map((v, i) => v + NAV[i] + W[i]);
    const maxHeight = Math.max(...totalStack, takt) * 1.1;

    document.getElementById("chartTitle").innerHTML =
        `Master WACT Comparison<br>${labels.length} Charts`;

    currentChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                { label: "AV", data: AV, backgroundColor: "green", stack: "s" },
                { label: "NAV", data: NAV, backgroundColor: "yellow", stack: "s" },
                { label: "W", data: W, backgroundColor: "red", stack: "s" }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 30
                }
            },
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: Math.round(maxHeight)
                }
            }
        },

        // ✅ SAME TAKT LINE
        plugins: [
            {
                id: 'chartTitle',
                afterDraw: (chart) => {
                    const ctx = chart.ctx;
                    ctx.save();

                    // Draw title at top of canvas with padding
                    ctx.fillStyle = "black";
                    ctx.font = "bold 14px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText(
                        `Master WACT Comparison (${labels.length} Charts)`,
                        chart.width / 2,
                        20
                    );

                    ctx.restore();
                }
            },
            {
                id: 'whiteBackground',
                beforeDraw: (chart) => {
                    const ctx = chart.ctx;
                    ctx.save();
                    ctx.globalCompositeOperation = 'destination-over';
                    ctx.fillStyle = 'white';  // ✅ force white background
                    ctx.fillRect(0, 0, chart.width, chart.height);
                    ctx.restore();
                }
            },
            {
                id: 'taktLine',
                afterDraw: (chart) => {
                    const yScale = chart.scales.y;
                    const ctx = chart.ctx;

                    const y = yScale.getPixelForValue(takt);

                    ctx.save();

                    // line
                    ctx.beginPath();
                    ctx.moveTo(chart.chartArea.left, y);
                    ctx.lineTo(chart.chartArea.right, y);
                    ctx.strokeStyle = "blue";
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // label inside chart
                    ctx.fillStyle = "white";
                    ctx.fillRect(chart.chartArea.left + 2, y - 12, 90, 16);

                    ctx.fillStyle = "blue";
                    ctx.fillText(
                        `TAKT (${takt})`,
                        chart.chartArea.left + 5,
                        y
                    );

                    ctx.restore();
                }
            }
        ]
    });
}

// ===== Auto-run on file select =====
document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
        fileInput.addEventListener("change", process);
    }
});