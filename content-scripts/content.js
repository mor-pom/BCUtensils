(function() {
    'use strict';
    const url = window.location.href;

    // Constants
    const MENUBAR_STYLE_ID = 'bc-colorator-menubar-style';
    const DARK_MODE_STYLE_ID = 'dark-mode-style';

    function isLightColor(hex) {
        const c = hex.replace('#', '');
        const r = parseInt(c.substring(0, 2), 16);
        const g = parseInt(c.substring(2, 4), 16);
        const b = parseInt(c.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5;
    }

    const MENUBAR_CSS = (color) => {
        const textColor = isLightColor(color) ? '#000000' : '';
        const colorRule = textColor ? `color: ${textColor} !important;` : '';
        const badgeGuard = ':not([class*="badge-coin-root"]):not([class*="badge-coin-root"] *)';
        return `#product-menu-bar, #O365_NavHeader,
            #product-menu-bar *${badgeGuard}, #O365_NavHeader *${badgeGuard} {
            background-color: ${color} !important;
            border-color: transparent !important;
            outline-color: transparent !important;
            box-shadow: none !important;
            ${colorRule}
        }`;
    };

    const DARK_MODE_CSS = `
        html {
            filter: invert(1) hue-rotate(180deg) contrast(0.75) brightness(1.1);
        }
        img,
        video,
        canvas,
        [style*="background-image"] {
            filter: invert(1) hue-rotate(180deg) contrast(1.0) brightness(1.0) !important;
        }
    `;

    // Core functions
    function applyMenuBarColor(color) {
        let style = document.getElementById(MENUBAR_STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = MENUBAR_STYLE_ID;
            document.head.appendChild(style);
        }
        style.textContent = color ? MENUBAR_CSS(color) : '';
        if (!color) {
            document.querySelectorAll('#product-menu-bar *, #O365_NavHeader *').forEach(el => {
                el.style.color = '';
            });
        }
    }

    function applyDarkMode(darkModeOn) {
        const iframe = document.querySelector('iframe');

        if (!iframe || !iframe.contentDocument) {
            return;
        }

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

        if (darkModeOn) {
            if (iframeDoc.getElementById(DARK_MODE_STYLE_ID)) {
                return;
            }
            const style = iframeDoc.createElement('style');
            style.id = DARK_MODE_STYLE_ID;
            style.textContent = DARK_MODE_CSS;
            iframeDoc.documentElement.appendChild(style);
        } else {
            const style = iframeDoc.getElementById(DARK_MODE_STYLE_ID);
            if (style) {
                style.remove();
            }
        }
    }

    function findLongestMatchingUrl(url_dict) {
        let longestKey = null;
        for (const key of Object.keys(url_dict)) {
            if (url.startsWith(key)) {
                if (!longestKey || key.length > longestKey.length) {
                    longestKey = key;
                }
            }
        }
        return longestKey;
    }

    function applyStyles(url_dict) {
        const matchedKey = findLongestMatchingUrl(url_dict);
        if (matchedKey) {
            const [color, darkMode] = url_dict[matchedKey];
            applyMenuBarColor(color);
            applyDarkMode(darkMode);
        } else {
            applyMenuBarColor(null);
            applyDarkMode(false);
        }
    }

    // Expand / collapse all FastTabs and their "Show more" sections
    const FASTTAB_HEADER_SELECTOR = '.ms-nav-band .ms-nav-columns-caption[role="button"][aria-expanded]';
    const TOGGLE_SELECTOR = 'button, a, [role="button"]';
    const SHOW_MORE_LABELS = ['show more', 'mehr anzeigen', 'afficher plus', 'mostrar más'];
    const SHOW_LESS_LABELS = ['show less', 'weniger anzeigen', 'afficher moins', 'mostrar menos'];
    const MAX_PASSES = 5;
    const PASS_DELAY_MS = 300;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function getBCDocuments() {
        const docs = [document];
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                if (iframe.contentDocument) docs.push(iframe.contentDocument);
            } catch {
                // Cross-origin iframe, not the BC client
            }
        });
        return docs;
    }

    function queryAllDocs(selector) {
        return getBCDocuments().flatMap(doc => [...doc.querySelectorAll(selector)])
            .filter(el => el.getClientRects().length > 0);
    }

    function labelOf(el) {
        return el.textContent.trim().toLowerCase();
    }

    function isShowMoreLess(el) {
        const label = labelOf(el);
        return SHOW_MORE_LABELS.includes(label) || SHOW_LESS_LABELS.includes(label);
    }

    function findFastTabHeaders(expanded) {
        return queryAllDocs(FASTTAB_HEADER_SELECTOR)
            .filter(el => el.getAttribute('aria-expanded') === String(expanded) && !isShowMoreLess(el));
    }

    function findShowToggles(labels) {
        return queryAllDocs(TOGGLE_SELECTOR).filter(el => labels.includes(labelOf(el)));
    }

    // Expanding a FastTab renders its "Show more" button asynchronously, so we run
    // several passes. Each element is clicked at most once to avoid toggling it back.
    async function toggleAll(findToggles) {
        const clicked = new Set();
        for (let pass = 0; pass < MAX_PASSES; pass++) {
            const toggles = findToggles().filter(el => !clicked.has(el));
            if (!toggles.length) break;
            toggles.forEach(el => {
                clicked.add(el);
                el.click();
            });
            await sleep(PASS_DELAY_MS);
        }
        return clicked.size;
    }

    function expandAll() {
        return toggleAll(() => [...findFastTabHeaders(false), ...findShowToggles(SHOW_MORE_LABELS)]);
    }

    function collapseAll() {
        return toggleAll(() => [...findShowToggles(SHOW_LESS_LABELS), ...findFastTabHeaders(true)]);
    }

    // Message listeners
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'updateColor') {
            applyDarkMode(message.darkMode);
            applyMenuBarColor(message.color);
        } else if (message.action === 'refreshStyles') {
            chrome.storage.sync.get('url_dict', (data) => {
                applyStyles(data.url_dict || {});
            });
        } else if (message.action === 'expandAll' || message.action === 'collapseAll') {
            const run = message.action === 'expandAll' ? expandAll : collapseAll;
            run().then(count => sendResponse({ count }));
            return true;
        }
    });

    // DOM observer (debounced to avoid excessive storage reads)
    let debounceTimer;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            chrome.storage.sync.get('url_dict', (data) => {
                applyStyles(data.url_dict || {});
            });
        }, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial setup
    chrome.storage.sync.get('url_dict', (data) => {
        applyStyles(data.url_dict || {});
    });
})();