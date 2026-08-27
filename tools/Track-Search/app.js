"use strict";

/*
    Expected CSV headers:

    Frame
    DisplayLength
    Plus9Location
    LightConfiguration
    SpeakerConfiguration
    Side
    Track
    TrackLength
    OperationCode
    Station
    OperationType
    Status
    unique unit config id

    The column name "unique unit config id" may contain spaces.
*/

let trackDatabase = [];

const CSV_FILE = "master_record.csv";

document.addEventListener("DOMContentLoaded", initializeApp);

/*
    Start the application.
*/
async function initializeApp() {
    attachDropdownEvents();

    try {
        setStatus(
            "Loading track database...",
            "info"
        );

        const response = await fetch(CSV_FILE, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Could not load ${CSV_FILE}. HTTP ${response.status}`
            );
        }

        const csvText = await response.text();

        trackDatabase = parseCSV(csvText)
            .map(normalizeRecord)
            .filter(record => {
                return record.DisplayLength &&
                    record.Plus9Location &&
                    record.LightConfiguration &&
                    record.SpeakerConfiguration &&
                    record.Side &&
                    record.Track;
            });

        if (trackDatabase.length === 0) {
            throw new Error(
                "The CSV loaded, but no valid operation rows were found."
            );
        }

        populateUnitLengths();

        setStatus(
            `Database loaded: ${trackDatabase.length} operation rows.`,
            "success"
        );

        selectPrototypeDefaults();
    }
    catch (error) {
        console.error(error);

        setStatus(
            error.message,
            "error"
        );

        showEmptyResults(
            "The track database could not be loaded. " +
            "Make sure master_record.csv is in the same " +
            "folder as index.html and app.js."
        );
    }
}

/*
    Add cascading dropdown behavior.
*/
function attachDropdownEvents() {
    document
        .getElementById("unitLength")
        .addEventListener("change", () => {
            populatePlus9Locations();
            clearResults();
        });

    document
        .getElementById("plus9Location")
        .addEventListener("change", () => {
            populateLightConfigurations();
            clearResults();
        });

    document
        .getElementById("lightConfiguration")
        .addEventListener("change", () => {
            populateSpeakerConfigurations();
            clearResults();
        });

    document
        .getElementById("speakerConfiguration")
        .addEventListener("change", () => {
            clearResults();
        });
}

/*
    Normalize spacing and support alternate CSV header spellings.
*/
function normalizeRecord(record) {
    return {
        Frame: cleanValue(
            getColumn(record, [
                "Frame",
                "frame"
            ])
        ),

        DisplayLength: cleanValue(
            getColumn(record, [
                "DisplayLength",
                "Display Length",
                "UnitLength",
                "Unit Length"
            ])
        ),

        Plus9Location: cleanValue(
            getColumn(record, [
                "Plus9Location",
                "Plus9 Location",
                "Plus 9 Location",
                "Plus9"
            ])
        ),

        LightConfiguration: cleanValue(
            getColumn(record, [
                "LightConfiguration",
                "Light Configuration",
                "LightConfig"
            ])
        ),

        SpeakerConfiguration: cleanValue(
            getColumn(record, [
                "SpeakerConfiguration",
                "Speaker Configuration",
                "SpeakerConfig"
            ])
        ),

        Side: cleanValue(
            getColumn(record, [
                "Side"
            ])
        ),

        Track: cleanValue(
            getColumn(record, [
                "Track",
                "TrackNumber",
                "Track Number"
            ])
        ),

        TrackLength: cleanValue(
            getColumn(record, [
                "TrackLength",
                "Track Length"
            ])
        ),

        OperationCode: cleanValue(
            getColumn(record, [
                "OperationCode",
                "Operation Code",
                "Operation"
            ])
        ),

        Station: cleanValue(
            getColumn(record, [
                "Station",
                "StationNumber",
                "Station Number"
            ])
        ),

        OperationType: cleanValue(
            getColumn(record, [
                "OperationType",
                "Operation Type",
                "Type"
            ])
        ),

        Status: cleanValue(
            getColumn(record, [
                "Status"
            ])
        ),

        UniqueUnitConfigId: cleanValue(
            getColumn(record, [
                "unique unit config id",
                "UniqueUnitConfigId",
                "Unique Unit Config ID",
                "UnitConfigId"
            ])
        )
    };
}

/*
    Find a value using any supported column heading.
*/
function getColumn(record, possibleNames) {
    const recordKeys = Object.keys(record);

    for (const possibleName of possibleNames) {
        const exactKey = recordKeys.find(key => {
            return key.trim().toLowerCase() ===
                possibleName.trim().toLowerCase();
        });

        if (exactKey !== undefined) {
            return record[exactKey];
        }
    }

    return "";
}

function cleanValue(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}

/*
    Fill the first dropdown with available unit lengths.
*/
function populateUnitLengths() {
    const values = uniqueSortedValues(
        trackDatabase.map(record => record.DisplayLength)
    );

    fillSelect(
        "unitLength",
        values,
        "Select unit length"
    );

    populatePlus9Locations();
}

/*
    Plus 9 options are restricted by unit length.
*/
function populatePlus9Locations() {
    const unitLength = getSelectedValue("unitLength");

    const matchingRows = trackDatabase.filter(record => {
        return valuesMatch(
            record.DisplayLength,
            unitLength
        );
    });

    const values = uniqueSortedValues(
        matchingRows.map(record => record.Plus9Location)
    );

    fillSelect(
        "plus9Location",
        values,
        "Select Plus 9 location"
    );

    populateLightConfigurations();
}

/*
    Light options are restricted by unit length and Plus 9.
*/
function populateLightConfigurations() {
    const unitLength = getSelectedValue("unitLength");
    const plus9Location = getSelectedValue("plus9Location");

    const matchingRows = trackDatabase.filter(record => {
        return valuesMatch(record.DisplayLength, unitLength) &&
            valuesMatch(record.Plus9Location, plus9Location);
    });

    const values = uniqueSortedValues(
        matchingRows.map(record => record.LightConfiguration)
    );

    fillSelect(
        "lightConfiguration",
        values,
        "Select light configuration"
    );

    populateSpeakerConfigurations();
}

/*
    Speaker options are restricted by the first three selections.
*/
function populateSpeakerConfigurations() {
    const unitLength = getSelectedValue("unitLength");
    const plus9Location = getSelectedValue("plus9Location");
    const lightConfiguration =
        getSelectedValue("lightConfiguration");

    const matchingRows = trackDatabase.filter(record => {
        return valuesMatch(record.DisplayLength, unitLength) &&
            valuesMatch(record.Plus9Location, plus9Location) &&
            valuesMatch(
                record.LightConfiguration,
                lightConfiguration
            );
    });

    const values = uniqueSortedValues(
        matchingRows.map(record => record.SpeakerConfiguration)
    );

    fillSelect(
        "speakerConfiguration",
        values,
        "Select speaker configuration"
    );
}

/*
    Run the exact configuration search.
*/
function runSearch() {
    const criteria = {
        unitLength: getSelectedValue("unitLength"),
        plus9Location: getSelectedValue("plus9Location"),
        lightConfiguration:
            getSelectedValue("lightConfiguration"),
        speakerConfiguration:
            getSelectedValue("speakerConfiguration")
    };

    const missingSelections = [];

    if (!criteria.unitLength) {
        missingSelections.push("unit length");
    }

    if (!criteria.plus9Location) {
        missingSelections.push("Plus 9 location");
    }

    if (!criteria.lightConfiguration) {
        missingSelections.push("light configuration");
    }

    if (!criteria.speakerConfiguration) {
        missingSelections.push("speaker configuration");
    }

    if (missingSelections.length > 0) {
        setStatus(
            `Select: ${missingSelections.join(", ")}.`,
            "error"
        );

        showEmptyResults(
            "Complete all four selections before searching."
        );

        return;
    }

    const matches = trackDatabase.filter(record => {
        return valuesMatch(
            record.DisplayLength,
            criteria.unitLength
        ) &&
        valuesMatch(
            record.Plus9Location,
            criteria.plus9Location
        ) &&
        valuesMatch(
            record.LightConfiguration,
            criteria.lightConfiguration
        ) &&
        valuesMatch(
            record.SpeakerConfiguration,
            criteria.speakerConfiguration
        );
    });

    matches.sort(compareOperations);

    renderSelectionSummary(criteria);
    renderResults(matches);

    if (matches.length > 0) {
        const configurationId =
            matches[0].UniqueUnitConfigId || "No ID";

        setStatus(
            `${matches.length} operations found. ` +
            `Configuration ID: ${configurationId}`,
            "success"
        );
    }
    else {
        setStatus(
            "No matching configuration was found.",
            "error"
        );
    }
}

/*
    Sort by side, then track, then station, then operation code.

    This produces sequences such as:
    L1, SP1, L2, SP2, L3, SP3, L4

    Track remains the primary grouping.
*/
function compareOperations(a, b) {
    const sideComparison =
        getSideSortOrder(a.Side) -
        getSideSortOrder(b.Side);

    if (sideComparison !== 0) {
        return sideComparison;
    }

    const trackComparison =
        toSortableNumber(a.Track) -
        toSortableNumber(b.Track);

    if (trackComparison !== 0) {
        return trackComparison;
    }

    const stationComparison =
        toSortableNumber(a.Station) -
        toSortableNumber(b.Station);

    if (stationComparison !== 0) {
        return stationComparison;
    }

    const typeComparison =
        getOperationTypeOrder(a.OperationType) -
        getOperationTypeOrder(b.OperationType);

    if (typeComparison !== 0) {
        return typeComparison;
    }

    return a.OperationCode.localeCompare(
        b.OperationCode,
        undefined,
        {
            numeric: true,
            sensitivity: "base"
        }
    );
}

function getSideSortOrder(side) {
    const normalizedSide = normalizeComparisonValue(side);

    if (normalizedSide === "driver") {
        return 1;
    }

    if (normalizedSide === "passenger") {
        return 2;
    }

    return 99;
}

function getOperationTypeOrder(type) {
    const normalizedType = normalizeComparisonValue(type);

    if (normalizedType === "light") {
        return 1;
    }

    if (normalizedType === "speaker") {
        return 2;
    }

    return 99;
}

function toSortableNumber(value) {
    const parsed = Number.parseFloat(value);

    return Number.isNaN(parsed) ? 999999 : parsed;
}

/*
    Display the four selected criteria above the results.
*/
function renderSelectionSummary(criteria) {
    const container =
        document.getElementById("selectionSummary");

    container.innerHTML = `
        <div class="selection-summary">
            ${createSummaryItem(
                "Unit Length",
                criteria.unitLength
            )}

            ${createSummaryItem(
                "Plus 9 Location",
                formatPlus9Location(criteria.plus9Location)
            )}

            ${createSummaryItem(
                "Light Configuration",
                criteria.lightConfiguration
            )}

            ${createSummaryItem(
                "Speaker Configuration",
                criteria.speakerConfiguration
            )}
        </div>
    `;
}

function createSummaryItem(label, value) {
    return `
        <div class="summary-item">
            <span class="summary-label">
                ${escapeHTML(label)}
            </span>

            <span class="summary-value">
                ${escapeHTML(value)}
            </span>
        </div>
    `;
}

/*
    Group matching operations as:

    Side
        Track
            Operations
*/
function renderResults(matches) {
    const results = document.getElementById("results");

    if (matches.length === 0) {
        showEmptyResults(
            "No tracks or operations were found for this configuration."
        );

        return;
    }

    const groupedData = groupBySideAndTrack(matches);

    let html = `
        <div class="operation-count">
            ${matches.length} total operations found
        </div>
    `;

    const sides = Object.keys(groupedData).sort((a, b) => {
        return getSideSortOrder(a) - getSideSortOrder(b);
    });

    sides.forEach(side => {
        html += `
            <section class="side-section">
                <h3 class="side-title">
                    ${escapeHTML(side)} Side
                </h3>

                <div class="tracks-grid">
        `;

        const trackNumbers =
            Object.keys(groupedData[side]).sort((a, b) => {
                return toSortableNumber(a) -
                    toSortableNumber(b);
            });

        trackNumbers.forEach(trackNumber => {
            const operations =
                groupedData[side][trackNumber];

            const trackLength =
                getCombinedTrackLength(operations);

            html += createTrackCard(
                trackNumber,
                trackLength,
                operations
            );
        });

        html += `
                </div>
            </section>
        `;
    });

    results.innerHTML = html;
}

/*
    Group rows without losing their operation order.
*/
function groupBySideAndTrack(records) {
    const grouped = {};

    records.forEach(record => {
        const side = record.Side || "Unknown";
        const track = record.Track || "Unknown";

        if (!grouped[side]) {
            grouped[side] = {};
        }

        if (!grouped[side][track]) {
            grouped[side][track] = [];
        }

        grouped[side][track].push(record);
    });

    return grouped;
}

/*
    Track length should normally be the same for all operations
    on one track. If it is not, display every unique value.
*/
function getCombinedTrackLength(operations) {
    const lengths = uniqueSortedValues(
        operations.map(operation => operation.TrackLength)
    );

    return lengths.join(" / ");
}

function createTrackCard(
    trackNumber,
    trackLength,
    operations
) {
    const operationRows = operations
        .map(createOperationRow)
        .join("");

    return `
        <div class="track-card">

            <div class="track-header">
                <span class="track-number">
                    Track ${escapeHTML(trackNumber)}
                </span>

                <span class="track-length">
                    ${escapeHTML(trackLength)}
                </span>
            </div>

            <div class="operation-list">
                ${operationRows}
            </div>

        </div>
    `;
}

function createOperationRow(operation) {
    const typeClass = normalizeComparisonValue(
        operation.OperationType
    );

    return `
        <div class="operation-row">

            <div
                class="mark-badge"
                title="Mark ${escapeHTML(operation.Station)}"
            >
                Mark ${escapeHTML(operation.Station)}
            </div>

            <div>
                <div class="operation-code">
                    ${escapeHTML(operation.OperationCode)}
                </div>

                <div class="operation-description">
                    Station ${escapeHTML(operation.Station)}
                </div>
            </div>

            <div class="operation-type ${escapeHTML(typeClass)}">
                ${escapeHTML(operation.OperationType)}
            </div>

        </div>
    `;
}

/*
    Try to automatically select the prototype configuration
    visible in the provided spreadsheet:

    35'8"
    FrontAndRear
    Double
    4SP
*/
function selectPrototypeDefaults() {
    selectMatchingOption(
        "unitLength",
        [
            "35'8\"",
            "35'8",
            "35-8"
        ]
    );

    populatePlus9Locations();

    selectMatchingOption(
        "plus9Location",
        [
            "FrontAndRear",
            "Front and Rear",
            "FR"
        ]
    );

    populateLightConfigurations();

    selectMatchingOption(
        "lightConfiguration",
        [
            "Double"
        ]
    );

    populateSpeakerConfigurations();

    selectMatchingOption(
        "speakerConfiguration",
        [
            "4SP",
            "4 Speaker",
            "4Speaker"
        ]
    );

    if (
        getSelectedValue("unitLength") &&
        getSelectedValue("plus9Location") &&
        getSelectedValue("lightConfiguration") &&
        getSelectedValue("speakerConfiguration")
    ) {
        runSearch();
    }
}

function selectMatchingOption(selectId, possibleValues) {
    const select = document.getElementById(selectId);

    const matchingOption = Array.from(select.options).find(
        option => {
            return possibleValues.some(possibleValue => {
                return valuesMatch(
                    option.value,
                    possibleValue
                );
            });
        }
    );

    if (matchingOption) {
        select.value = matchingOption.value;
    }
}

/*
    General dropdown functions.
*/
function fillSelect(selectId, values, placeholder) {
    const select = document.getElementById(selectId);
    const previousValue = select.value;

    select.innerHTML = "";

    const placeholderOption =
        document.createElement("option");

    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;

    select.appendChild(placeholderOption);

    values.forEach(value => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = formatDropdownValue(
            selectId,
            value
        );

        select.appendChild(option);
    });

    const previousOptionStillExists =
        Array.from(select.options).some(option => {
            return valuesMatch(
                option.value,
                previousValue
            );
        });

    if (previousOptionStillExists) {
        select.value = previousValue;
    }
    else if (values.length === 1) {
        select.value = values[0];
    }
}

function formatDropdownValue(selectId, value) {
    if (selectId === "plus9Location") {
        return formatPlus9Location(value);
    }

    return value;
}

function formatPlus9Location(value) {
    const normalized = normalizeComparisonValue(value);

    if (
        normalized === "frontandrear" ||
        normalized === "fr"
    ) {
        return "Front and Rear";
    }

    if (normalized === "front") {
        return "Front";
    }

    if (normalized === "rear") {
        return "Rear";
    }

    if (
        normalized === "none" ||
        normalized === "0" ||
        normalized === "no+9" ||
        normalized === "no9"
    ) {
        return "No +9";
    }

    return value;
}

function getSelectedValue(selectId) {
    return document.getElementById(selectId).value.trim();
}

function uniqueSortedValues(values) {
    const valueMap = new Map();

    values.forEach(value => {
        const cleanedValue = cleanValue(value);

        if (!cleanedValue) {
            return;
        }

        const normalizedValue =
            normalizeComparisonValue(cleanedValue);

        if (!valueMap.has(normalizedValue)) {
            valueMap.set(
                normalizedValue,
                cleanedValue
            );
        }
    });

    return Array.from(valueMap.values()).sort(
        (a, b) => {
            return a.localeCompare(
                b,
                undefined,
                {
                    numeric: true,
                    sensitivity: "base"
                }
            );
        }
    );
}

function valuesMatch(firstValue, secondValue) {
    return normalizeComparisonValue(firstValue) ===
        normalizeComparisonValue(secondValue);
}

function normalizeComparisonValue(value) {
    return cleanValue(value)
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/_/g, "")
        .replace(/-/g, "");
}

/*
    Status and result helpers.
*/
function setStatus(message, type) {
    const status = document.getElementById("status");

    status.textContent = message;
    status.className = `status ${type}`;
}

function clearResults() {
    document.getElementById("selectionSummary").innerHTML = "";

    showEmptyResults(
        "Select a complete configuration, then click " +
        "\"Get Tracks and Operations.\""
    );
}

function showEmptyResults(message) {
    document.getElementById("results").innerHTML = `
        <div class="empty-results">
            ${escapeHTML(message)}
        </div>
    `;
}

/*
    Small CSV parser supporting commas inside quoted values.

    This avoids needing an external JavaScript library for
    the prototype.
*/
function parseCSV(csvText) {
    const rows = [];
    let currentRow = [];
    let currentValue = "";
    let insideQuotes = false;

    const normalizedText = csvText
        .replace(/^\uFEFF/, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");

    for (let index = 0; index < normalizedText.length; index++) {
        const character = normalizedText[index];
        const nextCharacter = normalizedText[index + 1];

        if (character === "\"") {
            if (insideQuotes && nextCharacter === "\"") {
                currentValue += "\"";
                index++;
            }
            else {
                insideQuotes = !insideQuotes;
            }

            continue;
        }

        if (character === "," && !insideQuotes) {
            currentRow.push(currentValue);
            currentValue = "";
            continue;
        }

        if (character === "\n" && !insideQuotes) {
            currentRow.push(currentValue);

            if (
                currentRow.some(value => value.trim() !== "")
            ) {
                rows.push(currentRow);
            }

            currentRow = [];
            currentValue = "";
            continue;
        }

        currentValue += character;
    }

    currentRow.push(currentValue);

    if (currentRow.some(value => value.trim() !== "")) {
        rows.push(currentRow);
    }

    if (rows.length < 2) {
        return [];
    }

    const headers = rows[0].map(header => header.trim());

    return rows.slice(1).map(row => {
        const record = {};

        headers.forEach((header, index) => {
            record[header] =
                row[index] !== undefined
                    ? row[index].trim()
                    : "";
        });

        return record;
    });
}

/*
    Prevent CSV text from being interpreted as HTML.
*/
function escapeHTML(value) {
    return cleanValue(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}