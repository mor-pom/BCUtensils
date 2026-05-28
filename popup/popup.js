// Define constants and variables
const urlInput = document.getElementById('url');
const colorInput = document.getElementById('color');
const addUrlColorButton = document.getElementById('addUrlColor');
const urlList = document.getElementById('urlList');
const helpButton = document.getElementById('helpButton');
const helpWindow = document.getElementById('helpWindow');

// Utility functions
function updateUrlList(url_dict) {
    urlList.innerHTML = '';
    for (const [url, [color, darkMode]] of Object.entries(url_dict)) {
        const li = document.createElement('li');
        li.innerHTML = `
            <button class="mode-btn" data-url="${url}">${darkMode ? '&#x1F312;' : '&#x1F314;'}</button>
            <span class="url-label" style="color:${color};">${url}</span>
            <button class="delete-btn" data-url="${url}">x</button>
        `;
        urlList.appendChild(li);
    }

    attachEventListeners();
}

function attachEventListeners() {
    // Add event listeners to the delete buttons
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const urlToDelete = event.target.getAttribute('data-url');
            removeUrlColorPair(urlToDelete);
        });
    });

    // Add event listeners to the mode buttons
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const urlToToggle = event.target.getAttribute('data-url');
            toggleDarkMode(urlToToggle);
        });
    });
}

// Storage-related functions
function removeUrlColorPair(urlToDelete) {
    chrome.storage.sync.get('url_dict', (data) => {
        const url_dict = data.url_dict || {};
        if (url_dict[urlToDelete]) {
            delete url_dict[urlToDelete];
            chrome.storage.sync.set({ url_dict }, () => {
                updateUrlList(url_dict);
                refreshStyles();
            });
        }
    });
}

function toggleDarkMode(urlToToggle) {
    chrome.storage.sync.get('url_dict', (data) => {
        const url_dict = data.url_dict || {};
        if (url_dict[urlToToggle]) {
            url_dict[urlToToggle][1] = !url_dict[urlToToggle][1];
            chrome.storage.sync.set({ url_dict }, () => {
                updateUrlList(url_dict);
                refreshStyles();
            });
        }
    });
}

function refreshStyles() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'refreshStyles' });
    });
}

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    loadStoredData();
    setupHelpButton();
    setupAddUrlColorButton();
    checkTableIdAndToggleButton();
    setupopenTableButton();
    setupImportExport();
});

// Show/hide OpenTableButton based on table ID presence
function checkTableIdAndToggleButton() {
    const openTableButton = document.getElementById('openTableButton');
    if (!openTableButton) return;
    openTableButton.textContent = '↗';
    openTableButton.style.display = 'inline-flex';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'checkTableIdPresent' }, (response) => {
                if (response && response.found) {
                    openTableButton.disabled = false;
                    openTableButton.title = chrome.i18n.getMessage('openTableLbl');
                } else {
                    openTableButton.disabled = true;
                    openTableButton.title = chrome.i18n.getMessage('openTableHelpLbl');
                }
            });
        }
    });
}

function initializeUI() {
    document.querySelector('h3').textContent = chrome.i18n.getMessage('extensionNameLbl');
    urlInput.placeholder = chrome.i18n.getMessage('EnterURLLbl');
    addUrlColorButton.textContent = chrome.i18n.getMessage('AddURLLbl');
    document.querySelector('label[for="url"]').textContent = chrome.i18n.getMessage('baseURLLbl') || 'Base URL';
    document.querySelector('label[for="color"]').textContent = chrome.i18n.getMessage('ColorLbl');
    document.querySelector('.list-title').textContent = chrome.i18n.getMessage('URLListLbl');
    helpButton.title = chrome.i18n.getMessage('helpLbl') || 'Help';

    document.getElementById('importExportTitle').textContent = chrome.i18n.getMessage('importExportTitleLbl') || 'Import / Export';
    document.getElementById('exportButton').textContent = chrome.i18n.getMessage('exportButtonLbl') || 'Export JSON';
    document.getElementById('dropZoneText').textContent = chrome.i18n.getMessage('dropZoneTextLbl') || 'Drop JSON file here or click to import';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            let currentUrl = tabs[0].url.split('?')[0];
            urlInput.value = currentUrl;
            chrome.storage.sync.get('url_dict', (data) => {
                const url_dict = data.url_dict || {};
                colorInput.value = url_dict[currentUrl]?.[0] || '#282828';
            });
        }
    });
}

function loadStoredData() {
    chrome.storage.sync.get('url_dict', (data) => {
        const url_dict = data.url_dict || {};
        updateUrlList(url_dict);
    });
}

function setupHelpButton() {
    helpButton.addEventListener('click', () => {
        if (helpWindow.style.display === 'none' || helpWindow.style.display === '') {
            helpWindow.style.display = 'block';
            helpWindow.innerHTML = chrome.i18n.getMessage('helpTextLbl').replace(/\n/g, '<br>');
        } else {
            helpWindow.style.display = 'none';
        }
    });

    document.addEventListener('click', (event) => {
        if (!helpWindow.contains(event.target) && !helpButton.contains(event.target)) {
            helpWindow.style.display = 'none';
        }
    });
}

function setupAddUrlColorButton() {
    addUrlColorButton.addEventListener('click', () => {
        const url = urlInput.value;
        const color = colorInput.value;

        if (url && color) {
            chrome.storage.sync.get('url_dict', (data) => {
                const url_dict = data.url_dict || {};
                const darkMode = url_dict[url]?.[1] || false; // Preserve dark mode state
                url_dict[url] = [color, darkMode];
                chrome.storage.sync.set({ url_dict }, () => {
                    updateUrlList(url_dict);
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'updateColor', color, darkMode });
                    });
                });
            });
        }
    });
}

function setupopenTableButton() {
    const openTableButton = document.getElementById('openTableButton');
    if (openTableButton) {
        openTableButton.addEventListener('click', (e) => {
            if (openTableButton.disabled) {
                alert('Open Table in new Tab is currently not possible. Please open Page Inspection first.');
                e.preventDefault();
                return;
            }
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'openTableExternally' });
                }
            });
        });
    }
}

function setupImportExport() {
    const exportButton = document.getElementById('exportButton');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    // Export
    exportButton.addEventListener('click', () => {
        chrome.storage.sync.get('url_dict', (data) => {
            const url_dict = data.url_dict || {};
            const json = JSON.stringify(url_dict, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bcutensils-urls.json';
            a.click();
            URL.revokeObjectURL(url);
        });
    });

    // Import via click
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleImportFile(e.target.files[0]);
            fileInput.value = '';
        }
    });

    // Import via drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleImportFile(e.dataTransfer.files[0]);
        }
    });
}

function handleImportFile(file) {
    if (!file.name.endsWith('.json')) {
        alert('Please provide a .json file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (typeof imported !== 'object' || Array.isArray(imported)) {
                alert('Invalid format: expected a JSON object.');
                return;
            }
            // Validate structure
            for (const [key, value] of Object.entries(imported)) {
                if (!Array.isArray(value) || value.length < 2 ||
                    typeof value[0] !== 'string' || typeof value[1] !== 'boolean') {
                    alert(`Invalid entry for "${key}". Expected [colorString, boolean].`);
                    return;
                }
            }
            chrome.storage.sync.get('url_dict', (data) => {
                const url_dict = data.url_dict || {};
                Object.assign(url_dict, imported);
                chrome.storage.sync.set({ url_dict }, () => {
                    updateUrlList(url_dict);
                    refreshStyles();
                });
            });
        } catch {
            alert('Failed to parse JSON file.');
        }
    };
    reader.readAsText(file);
}