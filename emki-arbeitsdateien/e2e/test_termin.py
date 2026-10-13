import asyncio, json, datetime, os, subprocess, time
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright
ROOT = os.path.abspath('site')
srv = subprocess.Popen(['python3', '-m', 'http.server', '8765', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
open(os.path.join(ROOT, 'termin', 'test.html'), 'w').write(open('/tmp/termin_test.html').read())

def tage():
    out = []; d = datetime.date(2026, 10, 7)
    while len(out) < 12:
        if d.weekday() < 5:
            out.append({'datum': d.isoformat(), 'slots': ['09:00', '09:30', '10:30', '11:00', '13:00', '14:30', '15:00', '16:00'][: 3 + len(out) % 6]})
        d += datetime.timedelta(days=1)
    return out

BUCHUNG = {'id': 'abc123', 'status': 'bestätigt', 'typ': 'video', 'start': '2026-10-08T07:30:00.000Z', 'ende': '2026-10-08T08:00:00.000Z',
           'name': 'Anja Beispiel', 'praxis': 'Physio am Markt', 'ort': 'Hennef', 'adresse': '', 'email': 'anja@example.de', 'telefon': '02242 123456',
           'meet': 'https://meet.google.com/abc-defg-hij', 'vorbei': False, 'links': {'google': 'https://calendar.google.com/x', 'outlook': 'https://outlook.office.com/x'}}
log = []
async def handle(route, request):
    u = urlparse(request.url); q = parse_qs(u.query)
    if request.method == 'POST':
        body = json.loads(request.post_data); log.append(body)
        if body['a'] == 'buchen':
            b = dict(BUCHUNG); b.update({'typ': body['typ'], 'name': body['name'], 'praxis': body['praxis'], 'email': body['email'], 'adresse': body.get('adresse', '')})
            if body['typ'] != 'video': b['meet'] = ''
            res = {'ok': True, 'buchung': b}
        elif body['a'] == 'verschieben':
            b = dict(BUCHUNG); b['start'] = '2026-10-09T12:00:00.000Z'; b['ende'] = '2026-10-09T12:30:00.000Z'; res = {'ok': True, 'buchung': b}
        else:
            b = dict(BUCHUNG); b['status'] = 'abgesagt'; res = {'ok': True, 'buchung': b}
    elif q.get('a') == ['slots']:
        log.append({'slots': q}); res = {'ok': True, 'typ': q['typ'][0], 'tage': tage()}
    elif q.get('a') == ['buchung']:
        res = {'ok': True, 'buchung': BUCHUNG}
    else:
        res = {'ok': True}
    await asyncio.sleep(0.3)
    await route.fulfill(status=200, content_type='application/json', body=json.dumps(res), headers={'Access-Control-Allow-Origin': '*'})

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, vp in [('d', {'width': 1280, 'height': 900}), ('m', {'width': 390, 'height': 844})]:
            ctx = await b.new_context(viewport=vp)
            pg = await ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            await pg.route('https://api.test/**', handle)
            await pg.goto('http://localhost:8765/termin/test.html?praxis=Physio%20am%20Markt&q=brief')
            await pg.screenshot(path=f'e2e/{name}_1.png', full_page=True)
            await pg.click('[data-typ="praxis"]')
            await pg.wait_for_selector('.zeit')
            await pg.screenshot(path=f'e2e/{name}_2.png', full_page=True)
            await pg.click('.tag >> nth=1')
            await pg.click('.zeit >> nth=1')
            await pg.wait_for_selector('#p3:not([hidden])')
            await pg.click('#senden')  # leere Pflichtfelder
            await pg.screenshot(path=f'e2e/{name}_3_fehler.png', full_page=True)
            await pg.select_option('#f-anrede', 'Frau'); await pg.fill('#f-name', 'Anja Beispiel'); await pg.fill('#f-praxis', 'Physio am Markt'); await pg.fill('#f-ort', 'Hennef'); await pg.fill('#f-adresse', 'Markt 1')
            await pg.fill('#f-email', 'anja@example.de'); await pg.fill('#f-telefon', '02242 123456')
            await pg.select_option('#f-team', '3–5'); await pg.select_option('#f-software', 'THEORG')
            await pg.screenshot(path=f'e2e/{name}_3.png', full_page=True)
            await asyncio.sleep(4.2)
            await pg.click('#senden')
            await pg.wait_for_selector('.haken')
            await pg.screenshot(path=f'e2e/{name}_4.png', full_page=True)
            # Verwalten
            await pg.goto('http://localhost:8765/termin/test.html?b=abc123&t=tok&aktion=absagen')
            await pg.wait_for_selector('#b-abs-ja')
            await pg.screenshot(path=f'e2e/{name}_5_absagen.png', full_page=True)
            await pg.click('#b-abs-nein'); await pg.click('#b-versch')
            await pg.wait_for_selector('.zeit')
            await pg.screenshot(path=f'e2e/{name}_6_verschieben.png', full_page=True)
            await pg.click('.zeit >> nth=0')
            await pg.wait_for_selector('.haken')
            await pg.screenshot(path=f'e2e/{name}_7_verschoben.png', full_page=True)
            sw = await pg.evaluate('document.documentElement.scrollWidth')
            print(name, 'Fehler:', errs, '| scrollWidth', sw)
            await ctx.close()
        await b.close()
    print(json.dumps([l for l in log if 'a' in l][:2], ensure_ascii=False))
try:
    asyncio.run(main())
finally:
    srv.terminate(); os.remove(os.path.join(ROOT, 'termin', 'test.html'))
