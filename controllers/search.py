# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request
import json


class TophygieneProductSearch(http.Controller):

    @http.route(
        '/tophygiene/search/products',
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
        if not query or len(query.strip()) < 2:
            return {'products': [], 'categories': []}

        query = query.strip()
        website = request.website

        # Domain: nur veröffentlichte Produkte der aktuellen Website
        domain = [
            ('website_published', '=', True),
            ('name', 'ilike', query),
            ('sale_ok', '=', True),
        ]

        # Produkte laden
        Product = request.env['product.template'].sudo()
        products = Product.search(domain, limit=limit)

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

            # Preis mit Pricelist
            price = p.list_price
            currency_symbol = website.currency_id.symbol or '€'

            product_list.append({
                'id': p.id,
                'name': p.name,
                'price': '%.2f %s' % (price, currency_symbol),
                'image_url': image_url,
                'product_url': '/shop/%s-%d' % (
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
        }
