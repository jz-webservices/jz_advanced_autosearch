/** @odoo-module **/

/**
 * TophygieneSearchBar
 * ---------------------
 * Asynchrones Live-Suchfeld für den Tophygiene eCommerce-Shop.
 * Überschreibt das Standard-Odoo-Suchformular im Frontend.
 *
 * Funktionsweise:
 *  1. User tippt in das Suchfeld
 *  2. Nach 300ms Debounce → JSON-RPC Call an /tophygiene/search/products
 *  3. Dropdown zeigt Produkte + Kategorien
 *  4. Klick auf Kategorie → /shop?category=X&search=Y
 *  5. Klick auf "Alle Ergebnisse" / Enter → /shop?search=Y
 */

import { Component, useState, useRef, onMounted, onWillUnmount } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { rpc } from "@web/core/network/rpc";

export class TophygieneSearchBar extends Component {
    static template = "tophygiene_search.SearchBar";
    static props = {
        placeholder: { type: String, optional: true },
    };

    setup() {
        this.state = useState({
            query: "",
            results: [],
            categories: [],
            totalUrl: "/shop",
            totalCount: 0,
            isOpen: false,
            isLoading: false,
        });

        this.inputRef = useRef("input");
        this.wrapperRef = useRef("wrapper");

        // Debounce-Timer Handle
        this._debounceTimer = null;

        // Klick außerhalb schließt Dropdown
        this._onClickOutside = this._onClickOutside.bind(this);

        onMounted(() => {
            document.addEventListener("click", this._onClickOutside, true);
            // Aktuellen URL-Parameter übernehmen falls vorhanden
            const urlParams = new URLSearchParams(window.location.search);
            const currentSearch = urlParams.get("search") || "";
            if (currentSearch) {
                this.state.query = currentSearch;
            }
        });

        onWillUnmount(() => {
            document.removeEventListener("click", this._onClickOutside, true);
            if (this._debounceTimer) {
                clearTimeout(this._debounceTimer);
            }
        });
    }

    // -------------------------------------------------------------------------
    // Event Handler
    // -------------------------------------------------------------------------

    onInput(ev) {
        const query = ev.target.value;
        this.state.query = query;

        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        if (!query || query.trim().length < 1) {
            this.state.isOpen = false;
            this.state.results = [];
            this.state.categories = [];
            return;
        }

        // Debounce: 300ms warten bevor Request gesendet wird
        this._debounceTimer = setTimeout(() => {
            this._fetchProducts(query.trim());
        }, 300);
    }

    onKeydown(ev) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            this.submitSearch();
        }
        if (ev.key === "Escape") {
            this.state.isOpen = false;
        }
    }

    onFocus() {
        // Dropdown wieder öffnen wenn Ergebnisse vorhanden
        if (this.state.results.length > 0) {
            this.state.isOpen = true;
        }
    }

    submitSearch() {
        const query = this.state.query.trim();
        if (!query) return;
        window.location.href = "/shop?search=" + encodeURIComponent(query);
    }

    // -------------------------------------------------------------------------
    // API Call
    // -------------------------------------------------------------------------

    async _fetchProducts(query) {
        this.state.isLoading = true;
        this.state.isOpen = true;

        try {
            const result = await rpc("/tophygiene/search/products", {
                query: query,
                limit: 8,
            });

            // Nur aktualisieren wenn Query noch gleich ist (Race-Condition vermeiden)
            if (this.state.query.trim() === query) {
                this.state.results = result.products || [];
                this.state.categories = result.categories || [];
                this.state.totalUrl = result.total_url || ("/shop?search=" + encodeURIComponent(query));
                this.state.totalCount = result.total_count || 0;
            }
        } catch (error) {
            console.error("[TophygieneSearch] Fehler beim Laden der Produkte:", error);
            this.state.results = [];
        } finally {
            this.state.isLoading = false;
        }
    }

    // -------------------------------------------------------------------------
    // Hilfsmethoden
    // -------------------------------------------------------------------------

    _onClickOutside(ev) {
        const wrapper = this.wrapperRef.el;
        if (wrapper && !wrapper.contains(ev.target)) {
            this.state.isOpen = false;
        }
    }
}

// -------------------------------------------------------------------------
// Patch: Standard-Odoo-Suchformular im eCommerce überschreiben
// -------------------------------------------------------------------------

/**
 * Wir mounten das OWL-Widget direkt ins native Suchformular der Website.
 * Das native <form> bleibt erhalten (für SEO/Fallback), aber das input
 * wird durch unser Widget ersetzt.
 */
function mountTophygieneSearch() {
    // Standard Odoo eCommerce Suchformular finden
    const searchForms = document.querySelectorAll(
        "form.o_wsale_products_searchbar_form, " +
        ".o_website_search_form, " +
        "form[action='/shop'][method='get'], " +
        "form.oe_search_box, " +
        ".oe_search_form"
    );

    if (!searchForms.length) {
        // Fallback: generische Suche nach Formularen mit name="search"
        const fallback = document.querySelector(
            "form input[name='search']"
        );
        if (fallback) {
            _injectSearchWidget(fallback.closest("form"));
        }
        return;
    }

    searchForms.forEach((form) => {
        _injectSearchWidget(form);
    });
}

function _injectSearchWidget(form) {
    if (!form || form.dataset.tophygieneSearch) return;
    form.dataset.tophygieneSearch = "1"; // Doppeltes Mounten verhindern

    // Placeholder aus originalen input übernehmen
    const originalInput = form.querySelector("input[name='search']");
    const placeholder = originalInput
        ? originalInput.getAttribute("placeholder") || "Produkte suchen..."
        : "Produkte suchen...";

    // Container für OWL-Widget erstellen
    const container = document.createElement("div");
    container.className = "o_tophygiene_search_mount";
    form.innerHTML = ""; // Native Form leeren
    form.appendChild(container);

    // OWL App mounten
    const { App, whenReady } = owl;
    whenReady().then(() => {
        const app = new App(TophygieneSearchBar, {
            templates: odoo.__templates__,
            env: owl.__apps__[0]?.env || {},
            props: { placeholder },
            dev: false,
        });
        app.mount(container);
    });
}

// DOM Ready: Widget initialisieren
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountTophygieneSearch);
} else {
    mountTophygieneSearch();
}
