# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class JzAdvancedSearchProductSearch(http.Controller):

    @http.route(
        '/jz_advanced_autosearch/search/products',
        type='json',
        auth='public',
        methods=['POST'],
        website=True,
        csrf=False,
    )
    def search_products(self, query='', limit=8, **kwargs):
        """
        Asynchrone Produktsuche für den eCommerce-Shop.
        Gibt Produkte zurück, die 'query' im Namen enthalten,
        gruppiert nach Kategorie.
        """
        if not query or len(query.strip()) < 1:
            return {'products': [], 'categories': [], 'total_count': 0}

        query = query.strip()
        website = request.website

        # Domain: veröffentlichte Produkte der aktuellen Website oder global
        domain = [
            ('is_published', '=', True),
            '|',
            ('website_id', '=', False),
            ('website_id', '=', website.id),
            ('name', 'ilike', query),
            ('sale_ok', '=', True),
        ]

        # Produkte laden + Gesamtanzahl ermitteln
        Product = request.env['product.template'].sudo()
        total_count = Product.search_count(domain)
        products = Product.search(domain, limit=limit)

        currency = website.currency_id
        currency_symbol = currency.symbol or '€'

        # Kategorien extrahieren (für die Kategorieseiten-Navigation)
        categories_seen = {}
        product_list = []

        for p in products:
            # Kategorie-URL aufbauen
            categ = p.categ_id
            categ_website = None

            # Versuche public category zu finden (website_sale)
            if hasattr(p, 'public_categ_ids') and p.public_categ_ids:
                categ_website = p.public_categ_ids[0]

            categ_id = categ_website.id if categ_website else None
            categ_name = categ_website.name if categ_website else categ.name

            # Bild-URL aufbauen (thumbnail aus bestehenden Produktbildern)
            image_url = '/web/image/product.template/%d/image_128' % p.id

            # Preis exkl. und inkl. MwSt. berechnen
            # taxes_id (Odoo <17) oder tax_ids (Odoo 17+) — beide abfangen
            price_excl = p.list_price
            try:
                raw_taxes = getattr(p, 'taxes_id', None) or getattr(p, 'tax_ids', None)
                taxes = raw_taxes.filtered(lambda t: t.company_id == request.env.company) if raw_taxes else None
                if taxes:
                    tax_res = taxes.compute_all(price_excl, currency, 1, product=p)
                    price_incl = tax_res['total_included']
                else:
                    price_incl = price_excl
            except Exception:
                price_incl = price_excl

            product_list.append({
                'id': p.id,
                'name': p.name,
                'price_excl': '%.2f %s' % (price_excl, currency_symbol),
                'price_incl': '%.2f %s' % (price_incl, currency_symbol),
                'image_url': image_url,
                'product_url': getattr(p, 'website_url', None) or '/shop/%s-%d' % (
                    p.name.lower().replace(' ', '-').replace('/', '-'),
                    p.id
                ),
                'categ_id': categ_id,
                'categ_name': categ_name,
            })

            # Kategorie für Schnellfilter sammeln
            if categ_id and categ_id not in categories_seen:
                categories_seen[categ_id] = {
                    'id': categ_id,
                    'name': categ_name,
                    'url': '/shop?category=%d&search=%s' % (categ_id, query),
                }

        # Kategorie "Alle Ergebnisse" immer als erste Option
        all_results_url = '/shop?search=%s' % query
        categories = [
            {'id': 0, 'name': 'Alle Ergebnisse', 'url': all_results_url}
        ] + list(categories_seen.values())

        return {
            'products': product_list,
            'categories': categories,
            'total_url': all_results_url,
            'total_count': total_count,
        }
