/** @odoo-module **/

/**
 * JzAdvancedSearch – Vanilla JS Overlay
 * --------------------------------------
 * Verwendet Odoo's eingebauten /web/dataset/call_kw Endpoint —
 * kein custom Python-Route nötig. Funktioniert sofort nach Asset-Reload.
 */

// -------------------------------------------------------------------------
// Produkte via Odoo call_kw suchen (kein custom Route nötig)
// -------------------------------------------------------------------------
async function searchProducts(query, limit) {
    const response = await fetch('/web/dataset/call_kw', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            id: Math.floor(Math.random() * 1e9),
            params: {
                model: 'product.template',
                method: 'search_read',
                args: [],
                kwargs: {
                    domain: [
                        ['name', 'ilike', query],
                        ['sale_ok', '=', true],
                        ['is_published', '=', true],
                    ],
                    fields: ['name', 'list_price', 'website_url', 'categ_id'],
                    limit: limit || 8,
                },
            },
        }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.data && data.error.data.message || data.error.message);
    return data.result || [];
}

// -------------------------------------------------------------------------
// Dropdown HTML aufbauen
// -------------------------------------------------------------------------
function buildDropdown(records, query, totalUrl) {
    if (!records.length) {
        return `<div class="o_jzas_search_empty">
            Keine Produkte gefunden für „<strong>${escHtml(query)}</strong>"
        </div>`;
    }

    const productsHtml = records.map(p => {
        const url = p.website_url || ('/shop/' + p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + p.id);
        const price = typeof p.list_price === 'number' ? p.list_price.toFixed(2) + ' €' : '';
        return `
        <a class="o_jzas_search_product_item" href="${escHtml(url)}">
            <div class="o_jzas_search_product_img">
                <img src="/web/image/product.template/${p.id}/image_128" alt="${escHtml(p.name)}" loading="lazy"/>
            </div>
            <div class="o_jzas_search_product_info">
                <span class="o_jzas_search_product_name">${escHtml(p.name)}</span>
                <div class="o_jzas_search_product_prices">
                    <span class="o_jzas_search_product_price_excl">${escHtml(price)} exkl. MwSt.</span>
                </div>
            </div>
            <svg class="o_jzas_search_arrow" xmlns="http://www.w3.org/2000/svg"
                 width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18l6-6-6-6"/>
            </svg>
        </a>`;
    }).join('');

    const footerHtml = `<a class="o_jzas_search_footer" href="${escHtml(totalUrl)}">
        ALLE ANZEIGEN
    </a>`;

    return `<div class="o_jzas_search_products">${productsHtml}</div>` + footerHtml;
}

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// -------------------------------------------------------------------------
// Haupt-Init
// -------------------------------------------------------------------------
function initJzAdvancedSearch() {
    // Nur im Header suchen
    const headerRoot = document.querySelector('header, #top, .o_header_standard') || document;
    const selectors = [
        '.o_searchbar_form input.o_searchbar_input',
        '.o_searchbar_form input[name="search"]',
        'form.o_wsale_products_searchbar_form input[name="search"]',
        'form[action="/website/search"] input[name="search"]',
        'form[action="/shop"] input[name="search"]',
        'form input[name="search"]',
    ];

    let input = null;
    for (const sel of selectors) {
        input = headerRoot.querySelector(sel);
        if (input) break;
    }
    if (!input || input.dataset.jzasSearch) return;
    input.dataset.jzasSearch = '1';

    const anchor = input.closest('form') || input.parentElement;
    if (anchor && getComputedStyle(anchor).position === 'static') {
        anchor.style.position = 'relative';
    }

    // Dropdown-Container
    const dropdown = document.createElement('div');
    dropdown.className = 'o_jzas_search_dropdown';
    dropdown.style.display = 'none';
    anchor.appendChild(dropdown);

    // Native Odoo Autocomplete unterdrücken
    function suppressNativeDropdown() {
        anchor.querySelectorAll(
            '.dropdown-menu, [class*="autocomplete"], [class*="Autocomplete"], [class*="o_search_result"]'
        ).forEach(el => {
            if (!el.classList.contains('o_jzas_search_dropdown') && !el.closest('.o_jzas_search_dropdown')) {
                el.style.setProperty('display', 'none', 'important');
            }
        });
        anchor.querySelectorAll('a.dropdown-item').forEach(el => {
            const parent = el.parentElement;
            if (parent && !parent.classList.contains('o_jzas_search_dropdown')) {
                parent.style.setProperty('display', 'none', 'important');
            }
        });
    }
    suppressNativeDropdown();
    new MutationObserver(suppressNativeDropdown).observe(anchor, { childList: true, subtree: true });

    // Suchbutton / Form-Submit → /shop?search= statt /website/search
    anchor.addEventListener('submit', (e) => {
        const q = input.value.trim();
        if (q) {
            e.preventDefault();
            window.location.href = '/shop?search=' + encodeURIComponent(q);
        }
    });

    let debounceTimer = null;

    function closeDropdown() {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
    }

    function showLoading() {
        dropdown.style.display = 'block';
        dropdown.innerHTML = `<div class="o_jzas_search_loading">
            <span class="o_jzas_spinner"></span>
            <span>Suche läuft...</span>
        </div>`;
    }

    async function fetchAndRender(query) {
        showLoading();
        const totalUrl = '/shop?search=' + encodeURIComponent(query);
        try {
            const records = await searchProducts(query, 8);
            if (input.value.trim() === query) {
                dropdown.style.display = 'block';
                dropdown.innerHTML = buildDropdown(records, query, totalUrl);
            }
        } catch (e) {
            console.error('[JzAdvancedSearch] Fehler:', e);
            if (input.value.trim() === query) {
                dropdown.style.display = 'block';
                dropdown.innerHTML = `<div class="o_jzas_search_empty">
                    Suche momentan nicht verfügbar —
                    <a href="${escHtml(totalUrl)}">Alle Ergebnisse anzeigen</a>
                </div>`;
            }
        }
    }

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (debounceTimer) clearTimeout(debounceTimer);
        if (!query) { closeDropdown(); return; }
        debounceTimer = setTimeout(() => fetchAndRender(query), 300);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDropdown();
    });

    document.addEventListener('click', (e) => {
        if (!anchor.contains(e.target)) closeDropdown();
    }, true);
}

// DOM Ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJzAdvancedSearch);
} else {
    initJzAdvancedSearch();
}

// MutationObserver: falls OWL das Input erst später rendert
const _jzasObserver = new MutationObserver(() => {
    const headerRoot = document.querySelector('header, #top, .o_header_standard') || document;
    const input = headerRoot.querySelector(
        '.o_searchbar_form input[name="search"], ' +
        'form[action="/website/search"] input[name="search"], ' +
        'form input[name="search"]'
    );
    if (input && !input.dataset.jzasSearch) initJzAdvancedSearch();
});
_jzasObserver.observe(document.body, { childList: true, subtree: true });
