/** @odoo-module **/

/**
 * TophygieneSearch – Vanilla JS Overlay
 * --------------------------------------
 * Hört auf das BESTEHENDE native Odoo-Suchfeld und zeigt
 * ein eigenes Dropdown darunter — ohne Odoo's OWL-Komponente
 * zu ersetzen oder zu stören.
 */

// -------------------------------------------------------------------------
// JSON-RPC Helper (kein OWL-Import nötig)
// -------------------------------------------------------------------------
async function jsonRpc(url, params) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            id: Math.floor(Math.random() * 1e9),
            params: params,
        }),
    });
    const data = await response.json();
    return data.result;
}

// -------------------------------------------------------------------------
// Dropdown HTML aufbauen
// -------------------------------------------------------------------------
function buildDropdown(result, query) {
    const { products = [], categories = [], total_count = 0, total_url = "/shop" } = result;

    if (!products.length) {
        return `<div class="o_tophygiene_search_empty">
            Keine Produkte gefunden für „<strong>${escHtml(query)}</strong>"
        </div>`;
    }

    // Kategorie-Badges (ohne "Alle Ergebnisse")
    const cats = categories.filter(c => c.id !== 0);
    const catHtml = cats.length ? `
        <div class="o_tophygiene_search_categories">
            <span class="o_tophygiene_search_label">In Kategorie:</span>
            ${cats.map(c => `<a class="o_tophygiene_search_cat_badge" href="${escHtml(c.url)}">${escHtml(c.name)}</a>`).join("")}
        </div>` : "";

    // Produktliste
    const productsHtml = products.map(p => `
        <a class="o_tophygiene_search_product_item" href="${escHtml(p.product_url)}">
            <div class="o_tophygiene_search_product_img">
                <img src="${escHtml(p.image_url)}" alt="${escHtml(p.name)}" loading="lazy"/>
            </div>
            <div class="o_tophygiene_search_product_info">
                <span class="o_tophygiene_search_product_name">${escHtml(p.name)}</span>
                <span class="o_tophygiene_search_product_categ">${escHtml(p.categ_name || "")}</span>
                <div class="o_tophygiene_search_product_prices">
                    <span class="o_tophygiene_search_product_price_excl">${escHtml(p.price_excl)} exkl. MwSt.</span>
                    <span class="o_tophygiene_search_product_price_incl">${escHtml(p.price_incl)} inkl. MwSt.</span>
                </div>
            </div>
            <svg class="o_tophygiene_search_arrow" xmlns="http://www.w3.org/2000/svg"
                 width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18l6-6-6-6"/>
            </svg>
        </a>`).join("");

    // Footer
    const footerHtml = `<a class="o_tophygiene_search_footer" href="${escHtml(total_url)}">
        ALLE ANZEIGEN (${total_count})
    </a>`;

    return catHtml +
        `<div class="o_tophygiene_search_products">${productsHtml}</div>` +
        footerHtml;
}

function escHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// -------------------------------------------------------------------------
// Haupt-Init: hört auf bestehendes Native-Input, zeigt eigenes Dropdown
// -------------------------------------------------------------------------
function initTophygieneSearch() {
    // Alle möglichen Odoo eCommerce Suchfelder
    const selectors = [
        "form.o_wsale_products_searchbar_form input[name='search']",
        ".o_website_search_form input[name='search']",
        "form[action='/shop'] input[name='search']",
        "form input[name='search']",
    ];

    let input = null;
    for (const sel of selectors) {
        input = document.querySelector(sel);
        if (input) break;
    }

    if (!input || input.dataset.tophygieneSearch) return;
    input.dataset.tophygieneSearch = "1";

    // Wrapper für relatives Positioning
    const anchor = input.closest("form") || input.parentElement;
    if (anchor && getComputedStyle(anchor).position === "static") {
        anchor.style.position = "relative";
    }

    // Dropdown-Container erstellen und anhängen
    const dropdown = document.createElement("div");
    dropdown.className = "o_tophygiene_search_dropdown";
    dropdown.style.display = "none";
    anchor.appendChild(dropdown);

    let debounceTimer = null;
    let lastQuery = "";

    function closeDropdown() {
        dropdown.style.display = "none";
        dropdown.innerHTML = "";
    }

    function showLoading() {
        dropdown.style.display = "block";
        dropdown.innerHTML = `<div class="o_tophygiene_search_loading">
            <span class="o_tophygiene_spinner"></span>
            <span>Suche läuft...</span>
        </div>`;
    }

    async function fetchAndRender(query) {
        showLoading();
        try {
            const result = await jsonRpc("/tophygiene/search/products", {
                query: query,
                limit: 8,
            });
            // Race-Condition: nur anzeigen wenn Query noch aktuell
            if (input.value.trim() === query) {
                dropdown.style.display = "block";
                dropdown.innerHTML = buildDropdown(result, query);
            }
        } catch (e) {
            console.error("[TophygieneSearch] Fehler:", e);
            closeDropdown();
        }
    }

    // Input-Event
    input.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        if (debounceTimer) clearTimeout(debounceTimer);
        if (!query) {
            closeDropdown();
            return;
        }
        lastQuery = query;
        debounceTimer = setTimeout(() => fetchAndRender(query), 300);
    });

    // Escape schließt Dropdown
    input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDropdown();
    });

    // Klick außerhalb schließt Dropdown
    document.addEventListener("click", (e) => {
        if (!anchor.contains(e.target)) closeDropdown();
    }, true);
}

// DOM Ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTophygieneSearch);
} else {
    initTophygieneSearch();
}
