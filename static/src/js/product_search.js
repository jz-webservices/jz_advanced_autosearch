/** @odoo-module **/

/**
 * JzAdvancedSearch – Vanilla JS Overlay
 * --------------------------------------
 * Verwendet Odoo's eingebauten /web/dataset/call_kw Endpoint —
 * kein custom Python-Route nötig. Funktioniert sofort nach Asset-Reload.
 */

// -------------------------------------------------------------------------
// Produkte suchen: Python-Route (auth=public) mit call_kw Fallback
// -------------------------------------------------------------------------
function rpcBody(params) {
    return JSON.stringify({ jsonrpc: '2.0', method: 'call', id: Math.random() * 1e9 | 0, params });
}

async function searchProducts(query, limit) {
    const n = limit || 8;
    console.log('[JzAS v19.0.1.22] Suche:', query);

    // 1. Custom Python Route (auth=public, sudo)
    try {
        const r = await fetch('/jz_advanced_autosearch/search/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: rpcBody({ query, limit: n }),
        });
        const ct = r.headers.get('content-type') || '';
        if (!r.ok || !ct.includes('json')) throw new Error('HTTP ' + r.status + ' – kein JSON');
        const d = await r.json();
        if (!d.error && Array.isArray(d.result)) {
            console.log('[JzAS] Methode 1 (Python Route) OK:', d.result.length, 'Produkte');
            return d.result;
        }
        console.warn('[JzAS] Methode 1 fehlgeschlagen:', d.error || 'kein Array');
    } catch (e) { console.warn('[JzAS] Methode 1 Exception:', e.message); }

    // 2. Odoo native /website/snippet/autocomplete (auth=public, Odoo 19)
    try {
        const r = await fetch('/website/snippet/autocomplete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: rpcBody({
                search_type: 'all',
                term: query,
                limit: n,
                order: 'name asc',
                options: {
                    displayDescription: false,
                    displayImage: true,
                    displayExtraLink: false,
                    displayDetail: true,
                    displayExtraPrice: false,
                    allowFuzzy: true,
                },
            }),
        });
        console.log('[JzAS] Methode 2 HTTP Status:', r.status);
        const d = await r.json();
        if (!d.error && d.result && Array.isArray(d.result.results)) {
            // Nur Produkte (fa-shopping-cart), keine Kategorien (fa-folder-o)
            const products = d.result.results.filter(r => r._fa === 'fa-shopping-cart');
            console.log('[JzAS] Methode 2 OK:', products.length, 'Produkte');
            return products.map(p => ({
                id: 0,
                name: _stripHtml(p.name || ''),
                list_price: null,
                price_formatted: _stripHtml(p.detail || ''),
                image_url: p.image_url || '',
                website_url: p.website_url || '/shop',
            }));
        }
        console.warn('[JzAS] Methode 2 unbekanntes Format:', d);
    } catch (e) { console.warn('[JzAS] Methode 2 Exception:', e.message); }

    // 3. call_kw Fallback
    try {
        const r = await fetch('/web/dataset/call_kw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: rpcBody({
                model: 'product.template', method: 'search_read', args: [],
                kwargs: {
                    domain: [['name', 'ilike', query], ['sale_ok', '=', true], ['is_published', '=', true]],
                    fields: ['name', 'list_price', 'website_url'],
                    limit: n,
                },
            }),
        });
        const d = await r.json();
        if (!d.error) {
            console.log('[JzAS] Methode 3 (call_kw) OK:', (d.result || []).length, 'Produkte');
            return d.result || [];
        }
        console.warn('[JzAS] Methode 3 Error:', d.error);
    } catch (e) { console.warn('[JzAS] Methode 3 Exception:', e.message); }

    throw new Error('Alle Suchmethoden fehlgeschlagen');
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
        const price = typeof p.list_price === 'number'
            ? p.list_price.toFixed(2) + ' €'
            : (p.price_formatted || '');
        const imgSrc = p.image_url || ('/web/image/product.template/' + p.id + '/image_128');
        return `
        <a class="o_jzas_search_product_item" href="${escHtml(url)}">
            <div class="o_jzas_search_product_img">
                <img src="${escHtml(imgSrc)}" alt="${escHtml(p.name)}" loading="lazy"/>
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

function _stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent.trim();
}

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// -------------------------------------------------------------------------
// Alle passenden Suchfelder sammeln (Header + Shop, aber NICHT Hero-Snippets)
// -------------------------------------------------------------------------
function findSearchInputs() {
    const candidates = document.querySelectorAll(
        '.o_searchbar_form input[name="search"], ' +
        'form.o_wsale_products_searchbar_form input[name="search"], ' +
        'form[action="/website/search"] input[name="search"], ' +
        'form[action="/shop"] input[name="search"]'
    );
    return Array.from(candidates).filter(input => {
        // Hero-Snippets (in <section>) ausschließen
        if (input.closest('section')) return false;
        // Noch nicht initialisiert
        if (input.dataset.jzasSearch) return false;
        return true;
    });
}

// -------------------------------------------------------------------------
// Haupt-Init
// -------------------------------------------------------------------------
function initJzAdvancedSearch() {
    const inputs = findSearchInputs();
    inputs.forEach(input => attachSearch(input));
}

function attachSearch(input) {
    if (input.dataset.jzasSearch) return;
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

    // Capture-Phase: läuft vor OWL's Bubble-Phase onInput-Handler.
    // stopImmediatePropagation verhindert, dass OWL seinen Autocomplete
    // rendert (und dabei nach dem Template sucht) – egal ob das Template
    // in dieser Odoo-Version existiert oder nicht.
    input.addEventListener('input', (e) => {
        e.stopImmediatePropagation();
        const query = e.target.value.trim();
        if (debounceTimer) clearTimeout(debounceTimer);
        if (!query) { closeDropdown(); return; }
        debounceTimer = setTimeout(() => fetchAndRender(query), 300);
    }, true);

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
    if (findSearchInputs().length > 0) initJzAdvancedSearch();
});
_jzasObserver.observe(document.body, { childList: true, subtree: true });
