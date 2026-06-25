let DATABASE = null;
let FEATURE_INFO = null;
let JOB_FEATURE_MAP = null;



// ----------------------
// LOAD + DECRYPT
// ----------------------
async function loadData() {
    const password = document.getElementById("password").value;
    const status = document.getElementById("status");

    try {
        status.innerText = "Loading...";

        // Jobs
        const dbResponse = await fetch("./data/data.enc");
        const dbBuffer = await dbResponse.arrayBuffer();
        DATABASE = await decryptFile(password, dbBuffer);

        // Feature descriptions
        const featureResponse = await fetch("./data/features.enc");
        const featureBuffer = await featureResponse.arrayBuffer();
        FEATURE_INFO = await decryptFile(password, featureBuffer);

        // Pre-build map (performance)
        JOB_FEATURE_MAP = buildJobFeatureMap(DATABASE);

        // Render feature list for side panel
        renderFeatureList();

        status.innerText = "Database Loaded";
    } catch (err) {
        console.error(err);
        status.innerText = "Failed to decrypt";
    }
}

// ----------------------
// BASIC SINGLE SEARCH
// ----------------------
function runSearch() {
    const rawInput = document.getElementById("featureInput").value.trim();
    const resultsDiv = document.getElementById("results");

    if (!DATABASE) {
        resultsDiv.innerText = "Load database before searching";
        return;
    }

    const features = rawInput
        .split(",")
        .map(f => f.trim())
        .filter(f => f !== "");

    // ✅ If multiple features → redirect to combo search
    if (features.length > 1) {
        runComboSearch();
        return;
    }

    // ✅ normal single search
    const input = features[0];

    const matches = [];

    for (const job in DATABASE) {
        if (DATABASE[job].includes(input)) {
            matches.push(job);
        }
    }

    const total = Object.keys(DATABASE).length;
    const percent = (matches.length / total) * 100;

    resultsDiv.innerHTML = `
        <div class="result-card">

            <div class="result-left">
                <div class="feature-code">Feature: ${input}</div>
                <div class="feature-desc">${FEATURE_INFO[input] || "Not Found"}</div>

                <div class="result-meta">
                    Matches: ${matches.length}
                </div>
            </div>

            <div class="result-right">
                <div class="percent-value">${percent.toFixed(1)}%</div>
                <div class="percent-label">Percent</div>
            </div>

        </div>
    `;

    }
    // <b>Jobs:</b><br>
    // ${matches.join("<br>")}

// ----------------------
// DATA STRUCTURE
// ----------------------
function buildJobFeatureMap(data) {
    const map = {};

    for (const job in data) {
        map[job] = new Set(data[job]);
    }

    return map;
}

// ----------------------
// HIGH VALUE FEATURE SEARCH (NEW)
// ----------------------
function searchFeatureDescriptions(input) {
    if (!FEATURE_INFO) return [];

    const search = input.toLowerCase();

    return Object.entries(FEATURE_INFO)
        .filter(([code, desc]) =>
            code.toLowerCase().includes(search) ||
            desc.toLowerCase().includes(search)
        )
        .slice(0, 20); // limit results
}

// ----------------------
// OPTIONAL: SHOW SUGGESTIONS
// ----------------------
function showSuggestions() {
    const input = document.getElementById("featureInput").value;
    const list = document.getElementById("suggestions");

    if (!input || !FEATURE_INFO) {
        list.innerHTML = "";
        return;
    }

    const results = searchFeatureDescriptions(input);

    list.innerHTML = results.map(([code, desc]) => `
        <div onclick="selectSuggestion('${code}')"
             style="padding:5px;cursor:pointer;border-bottom:1px solid #ddd;">
            <b>${code}</b> - ${desc}
        </div>
    `).join("");
}

// Click to insert suggestion
function selectSuggestion(code) {
    document.getElementById("featureInput").value = code;
    document.getElementById("suggestions").innerHTML = "";
}

// ----------------------
// RIGHT-SIDE FEATURE LIST
// ----------------------
function renderFeatureList() {
    const list = document.getElementById('featureList');
    if (!list || !FEATURE_INFO) return;

    const entries = Object.entries(FEATURE_INFO).sort((a,b) => a[0].localeCompare(b[0]));

    list.innerHTML = entries.map(([code, desc]) => `
        <div class="feature-item" onclick="addFeatureToInput('${code}')">
            <b class="feature-code">${code} -</b> <span style="color:black">${desc}</span>
        </div>
    `).join('');
}

function filterFeatureList() {
    const q = document.getElementById('featureListSearch').value.trim().toLowerCase();
    const list = document.getElementById('featureList');
    if (!list || !FEATURE_INFO) return;

    const entries = Object.entries(FEATURE_INFO)
        .filter(([code, desc]) => code.toLowerCase().includes(q) || desc.toLowerCase().includes(q))
        .sort((a,b) => a[0].localeCompare(b[0]));

    list.innerHTML = entries.map(([code, desc]) => `
        <div class="feature-item" onclick="addFeatureToInput('${code}')">
            <b class="feature-code">${code} -</b> <span style="color:black">${desc}</span>
        </div>
    `).join('');
}

function addFeatureToInput(code) {
    const input = document.getElementById('featureInput');
    if (!input) return;

    const current = input.value.trim();
    if (!current) input.value = code;
    else {
        // avoid duplicate
        const parts = current.split(',').map(s => s.trim()).filter(s=>s!=="");
        if (!parts.includes(code)) parts.push(code);
        input.value = parts.join(', ');
    }

    input.focus();
}

// ----------------------
// COMBINATIONS
// ----------------------
function getCombinations(array) {
    const result = [];

    for (let i = 1; i <= array.length; i++) {
        combine(array, i);
    }

    function combine(arr, len, start = 0, prev = []) {
        if (prev.length === len) {
            result.push([...prev]);
            return;
        }

        for (let i = start; i < arr.length; i++) {
            prev.push(arr[i]);
            combine(arr, len, i + 1, prev);
            prev.pop();
        }
    }

    return result;
}

// ----------------------
// CORE ANALYSIS
// ----------------------
function runAnalysis(featureList, singlesOnly = false) {
    const totalUnits = Object.keys(JOB_FEATURE_MAP).length;

    let combos = singlesOnly
        ? featureList.map(f => [f])
        : getCombinations(featureList);

    const results = [];

    for (const combo of combos) {
        let count = 0;

        for (const job in JOB_FEATURE_MAP) {
            const features = JOB_FEATURE_MAP[job];

            if (combo.every(f => features.has(f))) {
                count++;
            }
        }

        results.push({
            combo,
            count,
            percent: totalUnits > 0 ? (count / totalUnits) * 100 : 0
        });
    }

    results.sort((a, b) => b.count - a.count);

    return {
        totalUnits,
        top: results.slice(0, 15),
        all: results
    };
}

// ----------------------
// COMBO SEARCH UI
// ----------------------
function runComboSearch() {
    const input = document.getElementById("featureInput").value;
    const resultsDiv = document.getElementById("results");
    const singlesOnly = document.getElementById("singlesOnly").checked;

    if (!DATABASE) {
        resultsDiv.innerText = "Load database before searching";
        return;
    }

    const features = input
        .split(",")
        .map(f => f.trim())
        .filter(f => f !== "");

    if (features.length === 0) {
        resultsDiv.innerText = "Enter at least 1 feature";
        return;
    }

    if (!singlesOnly && features.length > 10) {
        resultsDiv.innerText = "⚠️ Max 10 features for combo search";
        return;
    }

    const analysis = runAnalysis(features, singlesOnly);

    let output = `
        <b>Total Units:</b> ${analysis.totalUnits}<br><br>
    `;

    for (const item of analysis.top) {
        const comboStr = item.combo.join("+");

        output += `
        <div class="result-card">

            <div class="result-left">
                <div class="feature-code">${comboStr}</div>

                <div class="result-meta">
                    ${item.count} units
                </div>
        `;

        for (const code of item.combo) {
            output += `
                <div class="feature-desc">
                    ${FEATURE_INFO[code] || "N/A"}
                </div>
            `;
        }

        output += `
            </div>

            <div class="result-right">
                <div class="percent-value">${item.percent.toFixed(1)}%</div>
                <div class="percent-label">Percent</div>
            </div>

        </div>
        `;

        // for (const code of item.combo) {
        //     output += `
        //         <div class="subtext">
        //             ${FEATURE_INFO[code] || "N/A"}
        //         </div>
        //     `;
        // }

        output += `</div>`;
    }


    resultsDiv.innerHTML = output;
}