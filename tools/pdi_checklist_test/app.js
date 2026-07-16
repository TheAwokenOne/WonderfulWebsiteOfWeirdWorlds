const checklistDiv =
    document.getElementById("checklist");

const progressDiv =
    document.getElementById("progress");

const tabsDiv =
    document.getElementById("tabs");

let checklist = [];

let activeTab =
    "Exterior Body";

const TAB_CONFIG = {

    "Exterior Body": [
        "Exterior Body"
    ],

    "Exterior Features": [
        "Front Cap",
        "Roof",
        "FED",
        "SED",
        "RED",
        "Stop arm",
        "Mudflap",
        "Fuel door",
        "DEF door",
        "Webasto"
    ],

    "Interior": [
        "Interior Body",
        "Driver seat",
        "Child Checkmate",
        "Crash barrier",
        "Stepwell",
        "Rear Bulkhead",
        "Driver Area"
    ],

    "Under Hood": [
        "Engine"
    ],

    "Chassis": [
        "Under Chassis"
    ],

    "Quality": [
        "Paint FFL"
    ]
};

loadChecklist();

async function loadChecklist(){

    try{

        const response =
            await fetch(
                "./checklist_data/pdi_master_checklist.xlsx"
            );

        const data =
            await response.arrayBuffer();

        const workbook =
            XLSX.read(
                data,
                {type:"array"}
            );

        const sheet =
            workbook.Sheets[
                workbook.SheetNames[0]
            ];

        const rows =
            XLSX.utils.sheet_to_json(
                sheet,
                {
                    header:1,
                    blankrows:false
                }
            );

        parseRows(rows);

    }
    catch(error){

        console.error(error);

    }

}

function getTab(area){

    for(const [tab, keywords]
        of Object.entries(TAB_CONFIG)){

        for(const keyword of keywords){

            if(
                area
                .toLowerCase()
                .includes(
                    keyword.toLowerCase()
                )
            ){
                return tab;
            }

        }

    }

    return "Unassigned";

}

function parseRows(rows){

    checklist = [];

    for(let i=1;i<rows.length;i++){

        const row = rows[i];

        if(!row[0]) continue;
        if(!row[2]) continue;
        if(!row[3]) continue;

        checklist.push({

            id: row[0],

            area: row[2],

            task: row[3],

            tab: getTab(row[2]),

            checked: false

        });

    }

    renderTabs();

    renderChecklist();

}

function renderTabs(){

    tabsDiv.innerHTML = "";

    const tabNames = [
        ...Object.keys(TAB_CONFIG),
        "Unassigned"
    ];

    tabNames.forEach(tab => {

        const btn =
            document.createElement("button");

        btn.className =
            activeTab === tab
            ? "tab-btn active"
            : "tab-btn";

        const count =
            checklist.filter(
                x => x.tab === tab
            ).length;

        btn.textContent =
            `${tab} (${count})`;

        btn.addEventListener(
            "click",
            () => {

                activeTab = tab;

                renderTabs();

                renderChecklist();

            }
        );

        tabsDiv.appendChild(btn);

    });

}

function renderChecklist(){

    checklistDiv.innerHTML = "";

    const visibleItems =
        checklist.filter(
            x => x.tab === activeTab
        );

    visibleItems.forEach(item => {

        const card =
            document.createElement("div");

        card.className =
            "card checklist-card";

        card.innerHTML = `
            <div class="checklist-main">

                <div class="checklist-title">
                    ${item.area}
                </div>

                <div class="checklist-description">
                    ${item.task}
                </div>

                <div class="tutorial-panel">
                    ${item.task}
                </div>

            </div>

            <div class="checklist-buttons">

                <button
                    class="tutorial-btn button-secondary">
                    Tutorial
                </button>

                <button
                    class="confirm-btn">
                    Check
                </button>

            </div>
        `;
        const tutorialBtn =
            card.querySelector(
                ".tutorial-btn"
            );

        const confirmBtn =
            card.querySelector(
                ".confirm-btn"
            );

        const tutorialPanel =
            card.querySelector(
                ".tutorial-panel"
            );


        // const tutorialPanel =
        //     card.querySelector(
        //         ".tutorial-panel"
        //     );

        tutorialBtn.addEventListener(
            "click",
            () => {

                tutorialPanel.classList.toggle(
                    "open"
                );

            }
        );

        confirmBtn.addEventListener(
            "click",
            () => {

                item.checked =
                    !item.checked;

                card.classList.toggle(
                    "complete",
                    item.checked
                );

                confirmBtn.textContent =
                    item.checked
                    ? "Done"
                    : "Check";

                updateProgress();

            }
        );

        checklistDiv.appendChild(card);

    });

    updateProgress();

}

function updateProgress(){

    const complete =
        checklist.filter(
            x => x.checked
        ).length;

    progressDiv.textContent =
        `${complete} / ${checklist.length} Complete`;

}