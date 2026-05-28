(function() {
    'use strict';
    const url = window.location.href;

    // Constants
    const MENUBAR_STYLE_ID = 'bc-colorator-menubar-style';
    const DARK_MODE_STYLE_ID = 'dark-mode-style';
    const DEFAULT_MENUBAR_COLOR = '#282828';
    const TABLE_ID_SELECTOR = '[role="textbox"][tabindex="0"]';

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
        return `#product-menu-bar, #O365_NavHeader, #product-menu-bar *, #O365_NavHeader * {
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
            applyMenuBarColor(DEFAULT_MENUBAR_COLOR);
            applyDarkMode(false);
        }
    }

    function getTableIdElement() {
        return document.querySelectorAll(TABLE_ID_SELECTOR)[1];
    }

    function extractTableId(el) {
        if (!el) return null;
        const match = el.textContent.match(/\(([^)]+)\)/);
        return match ? match[1] : null;
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
        } else if (message.action === 'openTableExternally') {
            const tableId = extractTableId(getTableIdElement());
            if (tableId) {
                const baseURL = window.location.href.split('?')[0];
                window.open(`${baseURL}?table=${tableId}`, '_blank');
            }
        } else if (message.action === 'checkTableIdPresent') {
            sendResponse({ found: !!extractTableId(getTableIdElement()) });
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