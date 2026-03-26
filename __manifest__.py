# -*- coding: utf-8 -*-
{
    'name': 'JZ Advanced Autosearch – Async Product Search',
    'version': '19.0.1.18.0',
    'summary': 'Asynchrone Live-Produktsuche im eCommerce-Shop',
    'author': 'JZWebservices',
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
            'jz_advanced_autosearch/static/src/css/product_search.css',
            'jz_advanced_autosearch/static/src/js/product_search.js',
        ],
        'web.assets_frontend_lazy': [
            'jz_advanced_autosearch/static/src/xml/search_widget.xml',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
