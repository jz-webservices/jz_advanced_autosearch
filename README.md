# jz_advanced_autosearch

Odoo 19.0 Modul — Asynchrone Live-Produktsuche im eCommerce-Shop.

## Funktion

- JSON-Route `/jz_advanced_autosearch/search/products` liefert Produkte + Kategorien als JSON zurück
- Filtert nur `website_published = True` Produkte
- Suche mit `ilike` (case-insensitive)
- Kategorie-URLs werden direkt mit `?category=X&search=Y` aufgebaut → User landet auf gefilterter Shopseite mit nativen Odoo-Produktkarten
- OWL-Component mountet sich in das bestehende `<form>` im Website-Header
- Debounce 300ms, Race-Condition-Schutz, Dropdown schließt bei Klick außerhalb

## Abhängigkeiten

```
'depends': ['website_sale', 'website']
```

## Installation

Modul in den Odoo Addons-Pfad legen und über **Apps → Installieren** aktivieren.

## Anpassungsbedarf

### Theme-spezifischer CSS-Selector

Das JS sucht das native Suchformular über mehrere Varianten:

```javascript
"form.o_wsale_products_searchbar_form, "
".o_website_search_form, "
"form[action='/shop'][method='get'], "
"form.oe_search_box, "
".oe_search_form"
```

Falls das Theme einen anderen Selector verwendet: im Browser **F12 → Element** nachschauen wie das Formular heißt und in `static/src/js/product_search.js` (Zeile 163–169) anpassen.

Als letzter Fallback greift: `form input[name='search']`

### eCommerce-Kategorien (`public_categ_ids`)

Falls keine eCommerce-Kategorien angelegt sind, ist `public_categ_ids` leer. Der Controller fällt dann automatisch auf die interne `categ_id` zurück — die Suche funktioniert, aber die Kategorie-Filter-URLs werden zu `/shop?search=X` ohne Kategorie-Parameter.

**Lösung:** eCommerce-Kategorien unter *Website → eCommerce → Kategorien* anlegen und den Produkten zuweisen.

## Dateistruktur

```
jz_advanced_autosearch/
├── __manifest__.py
├── __init__.py
├── controllers/
│   ├── __init__.py
│   └── search.py              # JSON-Route /jz_advanced_autosearch/search/products
├── static/src/
│   ├── js/
│   │   └── product_search.js  # OWL-Component + Form-Mount-Logik
│   ├── xml/
│   │   └── search_widget.xml  # QWeb-Template für Dropdown
│   └── css/
│       └── product_search.css # Styling
└── views/
    └── assets.xml             # Asset-Bundle-Registrierung
```
