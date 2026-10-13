# Baut site/termin/index.html aus termin.src.html (Kopf mit Logo aus impressum.html, API-Adresse).
import pathlib, re, sys

HIER = pathlib.Path(__file__).parent
SITE = HIER.parent / 'site'
API = (HIER / 'API_URL.txt').read_text().strip() if (HIER / 'API_URL.txt').exists() else ''

imp = (SITE / 'impressum.html').read_text(encoding='utf-8')
kopf = re.search(r'<header>.*?</header>', imp, re.S).group(0)
kopf = kopf.replace('href="index.html"', 'href="/"')
kopf = kopf.replace('</a></div></header>', '</a><a class="back" href="/">&larr; Zur Startseite</a></div></header>')
assert 'class="back"' in kopf, 'Kopfzeile nicht gefunden'

src = (HIER / 'termin.src.html').read_text(encoding='utf-8')
html = src.replace('{{HEADER}}', kopf).replace('{{API}}', API)
assert '{{' not in html
ziel = SITE / 'termin'
ziel.mkdir(exist_ok=True)
(ziel / 'index.html').write_text(html, encoding='utf-8')
(SITE / 'emki-mail-logo.png').write_bytes((HIER / 'emki-mail-logo.png').read_bytes())
print('termin/index.html gebaut, API:', API or '(noch nicht gesetzt)')
