# -*- coding: utf-8 -*-
{
    'name': 'Tophygiene – Async Product Search',
    'version': '19.0.1.0.0',
    'summary': 'Asynchrone Live-Produktsuche im eCommerce-Shop',
    'author': 'Tophygiene',
    'category': 'Website/eCommerce',
    'depends': [
        'website_sale',
        'website',
    ],
    'data': [
        'views/assets.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'tophygiene_search/static/src/css/product_search.css',
            'tophygiene_search/static/src/xml/search_widget.xml',
            'tophygiene_search/static/src/js/product_search.js',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
