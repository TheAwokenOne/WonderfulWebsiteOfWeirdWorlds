"use strict";

const DEFAULT_CSV_FILE = "master_record.csv";

const state = {
    rows: [],
    operations: [],
    currentIndex: 0,
    loaded: false,
    awaitingNewTrack: false
};

const elements = {};

const indicatorDefinitions = {
    driverPlus9: [
        { id: "driver-sp3-plus9", label: "DSP3 +9" },
        { id: "driver-sp2-plus9", label: "DSP2 +9" },
        { id: "driver-sp1-plus9", label: "DSP1 +9" }
    ],
    driverRegular: [
        { id: "driver-sp4-regular", label: "DSP4" },
        { id: "driver-sp3-regular", label: "DSP3" },
        { id: "driver-sp2-regular", label: "DSP2" },
        { id: "driver-sp1-regular", label: "DSP1" }
    ],
    mainPlus9: [
        { id: "main-sp1-plus9", label: "SP1 +9" },
        { id: "main-l1-plus9", label: "L1 +9" },
        { id: "main-sp2-plus9", label: "SP2 +9" },
        { id: "main-l2-plus9", label: "L2 +9" },
        { id: "main-sp3-plus9", label: "SP3 +9" },
        { id: "main-l3-plus9", label: "L3 +9" }
    ],
    mainRegular: [
        { id: "main-sp1-regular", label: "SP1" },
        { id: "main-l1-regular", label: "L1" },
        { id: "main-sp2-regular", label: "SP2" },
        { id: "main-l2-regular", label: "L2" },
        { id: "main-sp3-regular", label: "SP3" },
        { id: "main-l3-regular", label: "L3" },
        { id: "main-sp4-regular", label: "SP4" },
        { id: "main-l4-regular", label: "L4" }
    ]
};

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
    cacheElements();
    buildIndicators();
    bindEvents();
    renderEmptySummary();
    tryAutoLoadCsv();
}

function cacheElements() {
    const ids = [
        "csvFile", "unitLength", "plus9Location", "lightConfiguration",
        "speakerConfiguration", "loadUnitButton", "resetButton", "backButton",
        "status", "selectionSummary", "currentSide", "currentTrack",
        "currentTrackLength", "currentOperation", "progressText", "progressFill",
        "lightPunchButton", "speakerPunchButton", "newTrackButton",
        "trackCompletionNotice", "queueContainer", "operationQueue"
    ];

    ids.forEach(id => {
        elements[id] = document.getElementById(id);
    });
}

function bindEvents() {
    elements.csvFile.addEventListener("change", loadCsvFromFilePicker);
    elements.unitLength.addEventListener("change", handleUnitLengthChange);
    elements.plus9Location.addEventListener("change", handlePlus9Change);
    elements.lightConfiguration.addEventListener("change", handleLightChange);
    elements.loadUnitButton.addEventListener("click", loadSelectedUnit);
    elements.resetButton.addEventListener("click", resetSimulation);
    elements.backButton.addEventListener("click", undoLastPunch);
    elements.newTrackButton.addEventListener("click", grabNewTrack);
    elements.lightPunchButton.addEventListener("click", () => performPunch("Light"));
    elements.speakerPunchButton.addEventListener("click", () => performPunch("Speaker"));
}

function buildIndicators() {
    Object.entries(indicatorDefinitions).forEach(([containerId, definitions]) => {
        const container = document.getElementById(containerId);
        container.replaceChildren();

        definitions.forEach(definition => {
            const indicator = document.createElement("div");
            indicator.className = "indicator";
            indicator.id = definition.id;
            indicator.innerHTML = `
                <div class="indicator-bulb" aria-hidden="true"></div>
                <div class="indicator-label">${escapeHtml(definition.label)}</div>
            `;
            container.appendChild(indicator);
        });
    });
}

async function tryAutoLoadCsv() {
    try {
        const response = await fetch(DEFAULT_CSV_FILE, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        loadCsvText(text, DEFAULT_CSV_FILE);
    } catch (error) {
        setStatus(
            `Automatic CSV loading was blocked. Choose ${DEFAULT_CSV_FILE} with the file selector above.`,
            "info"
        );
        setSelectPlaceholder(elements.unitLength, "Choose the master CSV first");
    }
}

function loadCsvFromFilePicker(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => loadCsvText(reader.result, file.name);
    reader.onerror = () => setStatus("The selected CSV could not be read.", "error");
    reader.readAsText(file);
}

function loadCsvText(text, sourceName) {
    try {
        const parsedRows = parseCsv(text);
        const cleanedRows = normalizeRows(parsedRows);

        if (cleanedRows.length === 0) {
            throw new Error("No usable operation rows were found in the CSV.");
        }

        state.rows = cleanedRows;
        state.loaded = false;
        state.operations = [];
        state.currentIndex = 0;
        state.awaitingNewTrack = false;

        populateSelect(
            elements.unitLength,
            uniqueSorted(cleanedRows.map(row => row.DisplayLength)),
            "Select unit length"
        );
        resetDependentSelects("unit");
        resetSimulationDisplay();
        showTrackCompletionNotice("");
        setStatus(`Loaded ${cleanedRows.length} operations from ${sourceName}.`, "success");
    } catch (error) {
        state.rows = [];
        setSelectPlaceholder(elements.unitLength, "CSV could not be loaded");
        setStatus(`CSV error: ${error.message}`, "error");
    }
}

function normalizeRows(parsedRows) {
    return parsedRows
        .map((raw, sourceRow) => ({
            UnitKey: clean(raw.free || raw.UnitLength || raw["Unit Length"]),
            DisplayLength: clean(raw.DisplayLength),
            Plus9Location: clean(raw.Plus9Location),
            LightConfiguration: clean(raw["Light Configuration"]),
            SpeakerConfiguration: clean(raw["Speaker Configuration"]),
            Side: clean(raw.Side),
            Track: toNumber(raw.Track),
            TrackLength: clean(raw.TrackLength),
            OperationCode: clean(raw.OperationCode).toUpperCase(),
            Station: toNumber(raw.Station),
            OperationType: normalizeOperationType(raw.OperationType),
            UnitConfigId: clean(raw["unique unit config id"]),
            sourceRow
        }))
        .filter(row =>
            row.DisplayLength &&
            row.Plus9Location &&
            row.LightConfiguration &&
            row.SpeakerConfiguration &&
            row.Side &&
            Number.isFinite(row.Track) &&
            row.TrackLength &&
            /^(L|SP)[1-4]$/.test(row.OperationCode) &&
            Number.isFinite(row.Station) &&
            ["Light", "Speaker"].includes(row.OperationType)
        );
}

function normalizeOperationType(value) {
    const normalized = clean(value).toLowerCase();
    if (normalized === "light") return "Light";
    if (normalized === "speaker") return "Speaker";
    return "";
}

function handleUnitLengthChange() {
    resetSimulationDisplay();
    const unitLength = elements.unitLength.value;
    const values = uniqueSorted(
        state.rows
            .filter(row => row.DisplayLength === unitLength)
            .map(row => row.Plus9Location)
    );
    populateSelect(elements.plus9Location, values, "Select Plus 9 location");
    resetDependentSelects("plus9");
}

function handlePlus9Change() {
    resetSimulationDisplay();
    const rows = filterByCurrentSelections("plus9");
    populateSelect(
        elements.lightConfiguration,
        uniqueSorted(rows.map(row => row.LightConfiguration)),
        "Select light configuration"
    );
    resetDependentSelects("light");
}

function handleLightChange() {
    resetSimulationDisplay();
    const rows = filterByCurrentSelections("light");
    populateSelect(
        elements.speakerConfiguration,
        uniqueSorted(rows.map(row => row.SpeakerConfiguration)),
        "Select speaker configuration"
    );
}

function filterByCurrentSelections(level) {
    return state.rows.filter(row => {
        if (row.DisplayLength !== elements.unitLength.value) return false;
        if (["plus9", "light"].includes(level) && row.Plus9Location !== elements.plus9Location.value) return false;
        if (level === "light" && row.LightConfiguration !== elements.lightConfiguration.value) return false;
        return true;
    });
}

function resetDependentSelects(level) {
    if (level === "unit") {
        setSelectPlaceholder(elements.plus9Location, "Select unit length first");
        setSelectPlaceholder(elements.lightConfiguration, "Select Plus 9 location first");
        setSelectPlaceholder(elements.speakerConfiguration, "Select light configuration first");
    }
    if (level === "plus9") {
        setSelectPlaceholder(elements.lightConfiguration, "Select Plus 9 location first");
        setSelectPlaceholder(elements.speakerConfiguration, "Select light configuration first");
    }
    if (level === "light") {
        setSelectPlaceholder(elements.speakerConfiguration, "Select light configuration first");
    }
}

function loadSelectedUnit() {
    const selection = getSelection();

    if (Object.values(selection).some(value => !value)) {
        setStatus("Select all four unit configuration fields first.", "error");
        return;
    }

    const matchingRows = state.rows.filter(row =>
        row.DisplayLength === selection.unitLength &&
        row.Plus9Location === selection.plus9Location &&
        row.LightConfiguration === selection.lightConfiguration &&
        row.SpeakerConfiguration === selection.speakerConfiguration
    );

    if (matchingRows.length === 0) {
        setStatus("No operations match the selected configuration.", "error");
        return;
    }

    state.operations = [...matchingRows]
        .sort(compareOperations)
        .map((operation, index) => ({ ...operation, sequence: index + 1, complete: false }));

    state.currentIndex = 0;
    state.loaded = true;
    state.awaitingNewTrack = false;
    showTrackCompletionNotice("");
    renderSelectionSummary(selection);
    renderSimulation();
    setStatus(
        `Unit loaded with ${state.operations.length} required punches. Perform the illuminated operation.`,
        "success"
    );
}

function compareOperations(a, b) {
    const sideOrder = { Driver: 0, Passenger: 1 };

    if (isDriverSpeaker(a) && isDriverSpeaker(b)) {
        return getSpeakerNumber(a.OperationCode) - getSpeakerNumber(b.OperationCode) ||
            a.Track - b.Track ||
            a.Station - b.Station ||
            a.sourceRow - b.sourceRow;
    }

    return (sideOrder[a.Side] ?? 99) - (sideOrder[b.Side] ?? 99) ||
        a.Track - b.Track ||
        a.Station - b.Station ||
        a.sourceRow - b.sourceRow;
}

function isDriverSpeaker(operation) {
    return operation.Side === "Driver" && operation.OperationType === "Speaker";
}

function getSpeakerNumber(operationCode) {
    return Number.parseInt(operationCode.replace("SP", ""), 10);
}

function performPunch(punchType) {
    if (!state.loaded || state.awaitingNewTrack || state.currentIndex >= state.operations.length) return;

    const current = state.operations[state.currentIndex];

    if (current.OperationType !== punchType) {
        setStatus(
            `Incorrect punch type. Expected ${current.OperationType.toUpperCase()} PUNCH at ${current.OperationCode}.`,
            "error"
        );
        flashWrongButton(punchType);
        return;
    }

    const completedSide = current.Side;
    const completedTrack = current.Track;
    current.complete = true;
    state.currentIndex += 1;

    if (state.currentIndex >= state.operations.length) {
        renderSimulation();
        showTrackCompletionNotice("UNIT COMPLETE. All required punches have been performed.", "complete");
        setStatus("UNIT COMPLETE. All required punches have been performed.", "success");
        return;
    }

    const next = state.operations[state.currentIndex];

    if (next.Track !== completedTrack || next.Side !== completedSide) {
        state.awaitingNewTrack = true;
        renderSimulation();
        showTrackCompletionNotice(
            `Track ${completedTrack} complete. Click Grab New Track to continue.`,
            "complete"
        );
        setStatus(
            `${completedSide} Track ${completedTrack} complete. Grab the next track to continue.`,
            "info"
        );
        return;
    }

    renderSimulation();

    setStatus(
        `${current.OperationCode} complete. Next operation: ${next.OperationCode} ${next.OperationType} punch.`,
        "success"
    );
}

function grabNewTrack() {
    if (!state.loaded || !state.awaitingNewTrack) return;

    state.awaitingNewTrack = false;
    showTrackCompletionNotice("");
    renderSimulation();

    const next = state.operations[state.currentIndex];
    setStatus(
        `Track ${next.Track} ready. Perform the illuminated ${next.OperationType.toLowerCase()} punch.`,
        "success"
    );
}

function undoLastPunch() {
    if (!state.loaded) {
        setStatus("Load a unit before using Back One Punch.", "info");
        return;
    }

    if (state.currentIndex === 0) {
        setStatus("No completed punch is available to undo.", "info");
        return;
    }

    state.currentIndex -= 1;
    state.operations[state.currentIndex].complete = false;
    state.awaitingNewTrack = false;
    renderSimulation();
    setStatus(`Returned to ${state.operations[state.currentIndex].OperationCode}.`, "info");
}

function resetSimulation() {
    state.operations.forEach(operation => { operation.complete = false; });
    state.currentIndex = 0;
    state.loaded = state.operations.length > 0;
    state.awaitingNewTrack = false;
    showTrackCompletionNotice("");
    renderSimulation();

    if (state.loaded) {
        setStatus("Simulation reset to the first required punch.", "info");
    } else if (state.rows.length > 0) {
        setStatus("Select a configuration and load the unit.", "info");
    }
}

function resetSimulationDisplay() {
    state.operations = [];
    state.currentIndex = 0;
    state.loaded = false;
    state.awaitingNewTrack = false;
    showTrackCompletionNotice("");
    renderEmptySummary();
    renderSimulation();
}

function renderSimulation() {
    clearIndicatorStates();

    const current = state.operations[state.currentIndex];
    const complete = state.loaded && state.currentIndex >= state.operations.length;

    if (!state.loaded || state.operations.length === 0) {
        setCurrentOperationDisplay(null);
        elements.lightPunchButton.disabled = true;
        elements.speakerPunchButton.disabled = true;
        elements.newTrackButton.disabled = true;
        elements.queueContainer.hidden = true;
        return;
    }

    markCompletedIndicators();

    if (complete) {
        setCurrentOperationDisplay(null, true);
        elements.lightPunchButton.disabled = true;
        elements.speakerPunchButton.disabled = true;
        elements.newTrackButton.disabled = true;
    } else if (state.awaitingNewTrack) {
        setCurrentOperationDisplay(current);
        elements.lightPunchButton.disabled = true;
        elements.speakerPunchButton.disabled = true;
        elements.newTrackButton.disabled = false;
        elements.newTrackButton.classList.add("ready");
    } else {
        setCurrentOperationDisplay(current);
        activateIndicator(current);
        elements.lightPunchButton.disabled = false;
        elements.speakerPunchButton.disabled = false;
        elements.newTrackButton.disabled = true;
    }

    if (!state.awaitingNewTrack) {
        elements.newTrackButton.classList.remove("ready");
    }

    renderQueue();
}

function showTrackCompletionNotice(message, type = "info") {
    elements.trackCompletionNotice.textContent = message;
    elements.trackCompletionNotice.className = `track-completion-notice ${type} ${message ? "visible" : ""}`;
}

function activateIndicator(operation) {
    const indicatorId = getIndicatorId(operation);
    const indicator = document.getElementById(indicatorId);

    if (!indicator) {
        setStatus(
            `No physical indicator is mapped for ${operation.Side} ${operation.OperationCode} on track length ${operation.TrackLength}.`,
            "error"
        );
        return;
    }

    indicator.classList.remove("complete");
    indicator.classList.add(operation.OperationType === "Speaker" ? "active-speaker" : "active-light");
}

function markCompletedIndicators() {
    const activeIndicatorId = state.operations[state.currentIndex]
        ? getIndicatorId(state.operations[state.currentIndex])
        : null;

    const completedIndicatorIds = new Set(
        state.operations
            .filter(operation => operation.complete)
            .map(getIndicatorId)
            .filter(Boolean)
    );

    completedIndicatorIds.forEach(id => {
        if (id === activeIndicatorId) return;
        const indicator = document.getElementById(id);
        if (indicator) indicator.classList.add("complete");
    });
}

function getIndicatorId(operation) {
    const position = operation.TrackLength.includes("+9") ? "plus9" : "regular";
    const code = operation.OperationCode.toLowerCase();

    if (operation.OperationType === "Speaker" && operation.Side === "Driver") {
        return `driver-${code}-${position}`;
    }

    return `main-${code}-${position}`;
}

function clearIndicatorStates() {
    document.querySelectorAll(".indicator").forEach(indicator => {
        indicator.classList.remove("active-speaker", "active-light", "complete");
    });
}

function setCurrentOperationDisplay(operation, unitComplete = false) {
    if (unitComplete) {
        elements.currentSide.textContent = "Complete";
        elements.currentTrack.textContent = "-";
        elements.currentTrackLength.textContent = "-";
        elements.currentOperation.textContent = "DONE";
    } else if (operation) {
        elements.currentSide.textContent = operation.Side;
        elements.currentTrack.textContent = operation.Track;
        elements.currentTrackLength.textContent = operation.TrackLength;
        elements.currentOperation.textContent = `${operation.OperationCode} ${operation.OperationType}`;
    } else {
        elements.currentSide.textContent = "-";
        elements.currentTrack.textContent = "-";
        elements.currentTrackLength.textContent = "-";
        elements.currentOperation.textContent = "-";
    }

    const completed = state.operations.filter(operationItem => operationItem.complete).length;
    const total = state.operations.length;
    elements.progressText.textContent = `Progress: ${completed} of ${total}`;
    elements.progressFill.style.width = total ? `${(completed / total) * 100}%` : "0%";
}

function renderQueue() {
    elements.queueContainer.hidden = false;
    elements.operationQueue.replaceChildren();

    state.operations.forEach((operation, index) => {
        const row = document.createElement("div");
        row.className = `queue-row ${operation.complete ? "done" : index === state.currentIndex ? "current" : "upcoming"}`;

        const statusText = operation.complete
            ? "Complete"
            : index === state.currentIndex
                ? "Current"
                : "Waiting";

        row.innerHTML = `
            <span>${operation.sequence}</span>
            <span>${escapeHtml(operation.Side)}</span>
            <span>${operation.Track}</span>
            <span>${escapeHtml(operation.TrackLength)}</span>
            <span><span class="type-badge ${operation.OperationType.toLowerCase()}">${escapeHtml(operation.OperationCode)} ${escapeHtml(operation.OperationType)}</span></span>
            <span>${statusText}</span>
        `;
        elements.operationQueue.appendChild(row);
    });
}

function renderSelectionSummary(selection) {
    elements.selectionSummary.innerHTML = [
        ["Unit Length", selection.unitLength],
        ["Plus 9 Location", selection.plus9Location],
        ["Light Configuration", selection.lightConfiguration],
        ["Speaker Configuration", selection.speakerConfiguration]
    ].map(([label, value]) => `
        <div class="summary-item">
            <span class="summary-label">${escapeHtml(label)}</span>
            <span class="summary-value">${escapeHtml(value)}</span>
        </div>
    `).join("");
}

function renderEmptySummary() {
    elements.selectionSummary.innerHTML = [
        ["Unit Length", "-"],
        ["Plus 9 Location", "-"],
        ["Light Configuration", "-"],
        ["Speaker Configuration", "-"]
    ].map(([label, value]) => `
        <div class="summary-item">
            <span class="summary-label">${label}</span>
            <span class="summary-value">${value}</span>
        </div>
    `).join("");
}

function getSelection() {
    return {
        unitLength: elements.unitLength.value,
        plus9Location: elements.plus9Location.value,
        lightConfiguration: elements.lightConfiguration.value,
        speakerConfiguration: elements.speakerConfiguration.value
    };
}

function populateSelect(select, values, placeholder) {
    select.replaceChildren();
    select.appendChild(new Option(placeholder, ""));
    values.forEach(value => select.appendChild(new Option(value, value)));
    select.disabled = values.length === 0;
}

function setSelectPlaceholder(select, text) {
    select.replaceChildren(new Option(text, ""));
    select.disabled = true;
}

function setStatus(message, type = "info") {
    elements.status.textContent = message;
    elements.status.className = `status ${type}`;
}

function flashWrongButton(punchType) {
    const button = punchType === "Light" ? elements.lightPunchButton : elements.speakerPunchButton;
    button.animate(
        [
            { transform: "translateX(0)" },
            { transform: "translateX(-7px)" },
            { transform: "translateX(7px)" },
            { transform: "translateX(0)" }
        ],
        { duration: 260 }
    );
}

function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
}

function clean(value) {
    return value == null ? "" : String(value).trim();
}

function toNumber(value) {
    const number = Number(clean(value));
    return Number.isFinite(number) ? number : NaN;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    const normalizedText = String(text).replace(/^\uFEFF/, "");

    for (let i = 0; i < normalizedText.length; i += 1) {
        const char = normalizedText[i];
        const next = normalizedText[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                field += '"';
                i += 1;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ",") {
            row.push(field);
            field = "";
        } else if (char === "\n") {
            row.push(field.replace(/\r$/, ""));
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += char;
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field.replace(/\r$/, ""));
        rows.push(row);
    }

    if (inQuotes) {
        throw new Error("The CSV contains an unclosed quoted field.");
    }

    const nonEmptyRows = rows.filter(csvRow => csvRow.some(cell => clean(cell) !== ""));
    if (nonEmptyRows.length < 2) return [];

    const headers = nonEmptyRows[0].map(header => clean(header));
    return nonEmptyRows.slice(1).map(csvRow => {
        const object = {};
        headers.forEach((header, index) => {
            if (header) object[header] = csvRow[index] ?? "";
        });
        return object;
    });
}
