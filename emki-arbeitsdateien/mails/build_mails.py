#!/usr/bin/env python3
"""EMKI-Mailvorlagen v2: HTML (600 px, Tabellenlayout, Gmail/Outlook-fest) + Textfassung.
Platzhalter in {{doppelten Klammern}} werden pro Kunde ersetzt. Aufruf: python3 build_mails.py"""
import html, json, pathlib, zipfile

OUT = pathlib.Path(__file__).parent / 'out'
OUT.mkdir(exist_ok=True)

INK, MUTED, KULI, HELL, RULE, BG = '#1b2330', '#586172', '#2a46b8', '#eef1fb', '#d8dde5', '#f5f6f8'
FONT = "Arial,Helvetica,sans-serif"
LOGO = 'https://emki-systems.de/emki-mail-logo.png'
SITE = 'https://emki-systems.de'
BOOK = 'https://emki-systems.de/termin/'


# ---------- Bausteine: jeder liefert (html, text) ----------
def p(t):
    return (f'<p style="margin:0 0 16px;font:15px/1.6 {FONT};color:{INK}">{t}</p>', strip(t) + '\n\n')

def klein(t):
    return (f'<p style="margin:0 0 16px;font:13px/1.55 {FONT};color:{MUTED}">{t}</p>', strip(t) + '\n\n')

def h1(t):
    return (f'<h1 style="margin:0 0 18px;font:bold 23px/1.25 Georgia,\'Times New Roman\',serif;color:{INK}">{t}</h1>', strip(t).upper() + '\n\n')

def h2(t):
    return (f'<h2 style="margin:26px 0 10px;font:bold 17px/1.3 {FONT};color:{INK}">{t}</h2>', strip(t) + '\n' + '-' * len(strip(t)) + '\n')

def fakten(rows):
    tr = ''.join(
        f'<tr><td style="padding:7px 0;font:13px/1.4 {FONT};color:{MUTED};width:38%;vertical-align:top;border-bottom:1px solid #dfe4f3">{k}</td>'
        f'<td style="padding:7px 0;font:bold 14px/1.4 {FONT};color:{INK};vertical-align:top;border-bottom:1px solid #dfe4f3">{v}</td></tr>'
        for k, v in rows)
    h = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{HELL};border-radius:8px;margin:0 0 20px">'
         f'<tr><td style="padding:12px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">{tr}</table></td></tr></table>')
    t = ''.join(f'  {strip(k)}: {strip(v)}\n' for k, v in rows) + '\n'
    return (h, t)

def knopf(label, url):
    h = (f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px"><tr>'
         f'<td style="background:{KULI};border-radius:8px">'
         f'<a href="{url}" style="display:inline-block;padding:13px 22px;font:bold 15px/1 {FONT};color:#ffffff;text-decoration:none;border-radius:8px">{label}</a>'
         f'</td></tr></table>')
    return (h, f'{strip(label)}: {url}\n\n')

def schritte(items):
    tr = ''
    for i, (titel, text) in enumerate(items, 1):
        tr += (f'<tr><td style="width:34px;vertical-align:top;padding:0 0 14px">'
               f'<div style="width:24px;height:24px;border-radius:12px;border:2px solid {KULI};color:{KULI};font:bold 13px/24px {FONT};text-align:center">{i}</div></td>'
               f'<td style="vertical-align:top;padding:2px 0 14px;font:15px/1.5 {FONT};color:{INK}"><b>{titel}</b><br><span style="color:{MUTED}">{text}</span></td></tr>')
    h = f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px">{tr}</table>'
    t = ''.join(f'{i}. {strip(a)}: {strip(b)}\n' for i, (a, b) in enumerate(items, 1)) + '\n'
    return (h, t)

def liste(items):
    li = ''.join(f'<tr><td style="width:20px;vertical-align:top;font:15px/1.55 {FONT};color:{KULI}">&#10003;</td>'
                 f'<td style="vertical-align:top;padding:0 0 8px;font:15px/1.55 {FONT};color:{INK}">{x}</td></tr>' for x in items)
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px">{li}</table>',
            ''.join(f'- {strip(x)}\n' for x in items) + '\n')

def hinweis(t):
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>'
            f'<td style="border-left:3px solid {KULI};padding:4px 0 4px 14px;font:14px/1.55 {FONT};color:{INK}">{t}</td></tr></table>',
            strip(t) + '\n\n')

def gruss():
    return (f'<p style="margin:8px 0 0;font:15px/1.6 {FONT};color:{INK}">Viele Grüße<br><b>Mathis C. Müller</b><br>'
            f'<span style="color:{MUTED}">EMKI Systems · KI-Telefonassistent für Physiotherapiepraxen</span></p>',
            'Viele Grüße\nMathis C. Müller\nEMKI Systems · KI-Telefonassistent für Physiotherapiepraxen\n')

def strip(s):
    import re
    s = re.sub(r'<br\s*/?>', '\n', s)
    s = re.sub(r'<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', lambda m: m.group(2) if m.group(2).startswith('http') else f'{m.group(2)} ({m.group(1)})', s)
    s = re.sub(r'<[^>]+>', '', s)
    return html.unescape(s)


def rahmen(betreff, vorschau, bloecke):
    inhalt = ''.join(b[0] for b in bloecke)
    text = ''.join(b[1] for b in bloecke)
    fuss = (f'EMKI Systems – Mathis C. Müller · Im Johannesgarten 26 · 53809 Ruppichteroth<br>'
            f'<a href="mailto:mathis@emki-systems.de" style="color:{MUTED}">mathis@emki-systems.de</a> · '
            f'<a href="{SITE}" style="color:{MUTED}">emki-systems.de</a> · '
            f'<a href="{SITE}/impressum.html" style="color:{MUTED}">Impressum</a> · '
            f'<a href="{SITE}/datenschutz.html" style="color:{MUTED}">Datenschutz</a>')
    h = f'''<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>{html.escape(betreff)}</title></head>
<body style="margin:0;padding:0;background:{BG}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{html.escape(vorschau)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid {RULE};border-radius:12px">
<tr><td style="padding:24px 32px 18px;border-bottom:3px solid {KULI}"><a href="{SITE}"><img src="{LOGO}" width="114" height="40" alt="EMKI Systems" style="display:block;border:0;width:114px;height:40px"></a></td></tr>
<tr><td style="padding:28px 32px 26px">
{inhalt}
</td></tr>
<tr><td style="padding:16px 32px 22px;border-top:1px solid {RULE};font:12px/1.6 {FONT};color:{MUTED}">{fuss}</td></tr>
</table></td></tr></table></body></html>'''
    t = (text + '\n--\nEMKI Systems – Mathis C. Müller · Im Johannesgarten 26 · 53809 Ruppichteroth\n'
         'mathis@emki-systems.de · https://emki-systems.de\nImpressum: https://emki-systems.de/impressum.html · '
         'Datenschutz: https://emki-systems.de/datenschutz.html\n')
    return h, t


V = {}  # name -> (betreff, vorschau, bloecke)

V['01_angebot'] = (
    'Ihr Angebot: KI-Telefonassistent für {{praxis}}',
    'Ihr persönliches Angebot mit 30 Tagen Pilot und Geld-zurück.',
    [h1('Ihr Angebot für den KI-Telefonassistenten'),
     p('{{anrede}}'),
     p('vielen Dank für das Gespräch am {{gespraech_datum}}. Wie besprochen schicke ich Ihnen Ihr Angebot. Das PDF hängt an, die wichtigsten Punkte stehen hier:'),
     fakten([('Paket', '{{paket}}'), ('Monatlich', '{{preis_monat}}, {{minuten}} Gesprächsminuten'),
             ('Einrichtung', '{{einrichtung}}'), ('Laufzeit', '{{laufzeit}}'), ('Start', 'gewünscht ab {{starttermin}}')]),
     h2('Ohne Risiko starten'),
     liste(['<b>30 Tage Pilot:</b> Überzeugt Sie der Assistent nicht, genügt bis zum Ende des Pilots eine kurze Mail. Der Vertrag endet, und Sie bekommen den Monatsbeitrag zurück.',
            '<b>Einrichtung geschenkt</b> bei 12 Monaten Laufzeit. Die Laufzeit beginnt erst nach dem Pilot.',
            '<b>Datenschutz fertig mitgeliefert:</b> Auftragsverarbeitungsvertrag, Verschwiegenheit nach § 203 StGB, Eintrag fürs Verarbeitungsverzeichnis, Entwurf der Folgenabschätzung, Aushang und Einweisung Ihres Teams.',
            '<b>Ihre Nummer bleibt.</b> Sie schalten nur eine Rufumleitung ein, zuerst gern nur außerhalb der Öffnungszeiten.']),
     h2('So geht es weiter'),
     schritte([('Antworten', 'Eine kurze Antwort auf diese Mail genügt, zum Beispiel „Passt, wir starten“.'),
               ('Online unterschreiben', 'Sie bekommen einen Link und unterschreiben Vertrag und Datenschutz-Unterlagen am Bildschirm, ohne Drucker.'),
               ('Einrichten und testen', 'Ich richte den Assistenten mit Ihrem Praxiswissen ein. Sie rufen selbst an, erst dann schalten Sie um.')]),
     klein('Das Angebot gilt bis zum {{gueltig_bis}}. Alle Preise sind Endpreise, als Kleinunternehmer berechne ich keine Umsatzsteuer (§ 19 UStG).'),
     gruss()])

V['02_unterschrift'] = (
    'Bitte unterschreiben: Unterlagen für den KI-Telefonassistenten',
    'Vertrag, Auftragsverarbeitung und Verschwiegenheit online unterschreiben, etwa 5 Minuten.',
    [h1('Ihre Unterlagen zum Unterschreiben'),
     p('{{anrede}}'),
     p('schön, dass wir starten. Damit der Assistent echte Anrufe annehmen darf, brauchen wir drei Unterschriften. Das dauert etwa fünf Minuten und geht direkt am Bildschirm.'),
     knopf('Jetzt online unterschreiben', '{{signatur_link}}'),
     fakten([('Dienstleistungsvertrag', 'Leistungen, Preise, 30 Tage Pilot'),
             ('Auftragsverarbeitung', 'nach Art. 28 DSGVO'),
             ('Verschwiegenheit', 'nach § 203 StGB, unterschreibe ich für EMKI')]),
     hinweis('{{hinweis_gbr}}'),
     p('Zum Lesen und Aufbewahren hängt ein zweites PDF an: Verzeichnis der Verarbeitungstätigkeiten, Folgenabschätzung, Patienteninformation und Einweisung für Ihr Team. Dort müssen Sie nichts unterschreiben.'),
     klein('Die Unterschrift läuft über DocuSeal, einen Dienst mit Servern in der EU. Sie bekommen danach automatisch eine Kopie aller Dokumente per Mail.'),
     gruss()])

V['03_erinnerung_unterschrift'] = (
    'Kurze Erinnerung: Unterschrift für den KI-Telefonassistenten',
    'Es fehlt nur noch die Unterschrift, dann richte ich alles ein.',
    [p('{{anrede}}'),
     p('kurze Erinnerung: Für den Start fehlt nur noch Ihre Unterschrift. Danach richte ich den Assistenten ein, und wir können wie geplant am {{starttermin}} testen.'),
     knopf('Zu den Unterlagen', '{{signatur_link}}'),
     p('Gibt es noch Fragen zum Vertrag oder zum Datenschutz? Antworten Sie einfach auf diese Mail oder rufen Sie mich an, dann klären wir das in fünf Minuten.'),
     gruss()])

V['04_willkommen'] = (
    'Willkommen: So geht es mit Ihrem KI-Telefonassistenten weiter',
    'Alles unterschrieben. Das sind die nächsten Schritte bis zum Start.',
    [h1('Willkommen bei EMKI Systems'),
     p('{{anrede}}'),
     p('vielen Dank, alles ist unterschrieben. Ab jetzt kümmere ich mich um die Einrichtung. Das sind die nächsten Schritte:'),
     schritte([('Ihr Praxiswissen', 'Öffnungszeiten, Leistungen, Team, Kurse und Anfahrt. Was noch fehlt: {{offene_punkte}}'),
               ('Einrichtung', 'Ich stimme Begrüßung und Fragen auf Ihre Praxis ab und lege Ihre geschützte Rückrufliste an.'),
               ('Testanrufe', 'Am {{starttermin}} rufen Sie selbst an und hören zu. Was nicht passt, ändere ich sofort.'),
               ('Einweisung', 'Etwa 20 Minuten für Ihr Team, mit Nachweis für Ihre Unterlagen.'),
               ('Rufumleitung', 'Erst wenn alles passt, schalten Sie um. Ab dann läuft Ihr 30-Tage-Pilot.')]),
     hinweis('Bitte noch keine echten Patientinnen und Patienten auf den Assistenten umleiten, bevor wir gemeinsam getestet haben.'),
     gruss()])

V['05_golive'] = (
    'Ihr KI-Telefonassistent ist live',
    'Ab heute nimmt der Assistent Anrufe an. So nutzen Sie die Rückrufliste.',
    [h1('Ihr Assistent ist live'),
     p('{{anrede}}'),
     p('ab heute nimmt der Assistent Anrufe für {{praxis}} an, wenn am Empfang niemand frei ist. So arbeiten Sie damit:'),
     knopf('Rückrufliste öffnen', '{{rueckrufliste_link}}'),
     liste(['Nach jedem Anruf steht eine fertige Telefonnotiz in der Rückrufliste, die dringendsten oben.',
            'Eine kurze Mail meldet jeden Anruf. Namen und Gesundheitsangaben stehen bewusst nur in der Rückrufliste.',
            'Erledigt? Einfach in der Liste abhaken.',
            '{{neupatienten_termine}}']),
     fakten([('Pilot bis', '{{pilot_ende}}'), ('Ihre Rufumleitung', '{{rufumleitung}}'), ('Ansprechpartner', 'Mathis C. Müller, mathis@emki-systems.de')]),
     p('In den ersten Tagen schaue ich täglich in die Gespräche und verbessere, was auffällt. Wenn Ihnen etwas komisch vorkommt, schreiben Sie mir einfach.'),
     gruss()])

V['06_monat1'] = (
    'Ihr erster Monat mit dem KI-Telefonassistenten',
    'Die Zahlen aus den ersten Wochen und was jetzt passiert.',
    [h1('Ihr erster Monat'),
     p('{{anrede}}'),
     p('der Assistent ist seit gut drei Wochen für {{praxis}} im Einsatz. Ein kurzer Überblick:'),
     fakten([('Angenommene Anrufe', '{{anrufe}}'), ('Davon außerhalb der Öffnungszeiten', '{{anrufe_abends}}'),
             ('Gesprächsminuten', '{{minuten_verbraucht}} von {{minuten}}'), ('Neupatienten-Termine gebucht', '{{termine_gebucht}}')]),
     p('Was ich in dieser Zeit verbessert habe: {{verbesserungen}}'),
     h2('Wie geht es weiter?'),
     p('Ihr Pilot endet am {{pilot_ende}}. Wenn alles passt, müssen Sie nichts tun, der Assistent läuft einfach weiter. Möchten Sie nicht weitermachen, genügt bis dahin eine kurze Antwort auf diese Mail, und Sie bekommen den Monatsbeitrag zurück.'),
     p('Gern komme ich für zehn Minuten vorbei oder wir telefonieren kurz, um Ihre Erfahrungen zu besprechen.'),
     gruss()])

# ---------- Ausgabe ----------
for name, (betreff, vorschau, bloecke) in V.items():
    h, t = rahmen(betreff, vorschau, bloecke)
    (OUT / f'{name}.html').write_text(h)
    (OUT / f'{name}.txt').write_text(f'Betreff: {betreff}\n\n' + t)

frames = ''.join(
    f'<section><h2>{n} · {html.escape(b)}</h2><iframe srcdoc="{html.escape((OUT / (n + ".html")).read_text())}"></iframe></section>'
    for n, (b, _, _) in V.items())
(OUT / 'vorschau.html').write_text(
    '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>EMKI Mailvorlagen</title>'
    '<style>body{margin:0;background:#e9ecf1;font:14px Arial,sans-serif;color:#1b2330}main{max-width:700px;margin:0 auto;padding:24px 16px}'
    'h1{font:bold 24px Georgia,serif}h2{font-size:15px;margin:28px 0 8px}iframe{width:100%;height:1150px;border:0;background:#f5f6f8;border-radius:8px}</style></head>'
    '<body><main><h1>EMKI Mailvorlagen</h1><p>Platzhalter in {{doppelten Klammern}} werden pro Kunde ersetzt.</p>' + frames + '</main></body></html>')

(OUT / 'platzhalter.json').write_text(json.dumps({
    'anrede': 'Guten Tag Frau Stohrer,', 'praxis': 'Gesundheitszentrum Winterscheid', 'gespraech_datum': 'TT.MM.',
    'paket': 'Rundum', 'preis_monat': '179 €', 'minuten': '500', 'einrichtung': '290 € einmalig, entfällt bei 12 Monaten Laufzeit',
    'laufzeit': 'monatlich kündbar oder 12 Monate', 'starttermin': 'TT.MM.', 'gueltig_bis': 'TT.MM.JJJJ',
    'signatur_link': 'https://docuseal.eu/…', 'hinweis_gbr': 'Bei einer GbR unterschreiben bitte beide Gesellschafter, außer Ihr Gesellschaftsvertrag sieht vor, dass eine Person allein vertreten darf.',
    'offene_punkte': '…', 'rueckrufliste_link': 'https://docs.google.com/…', 'pilot_ende': 'TT.MM.JJJJ', 'rufumleitung': 'bei besetzt und nach 20 Sekunden',
    'neupatienten_termine': 'Neupatienten-Termine aus Ihren Terminfenstern stehen mit Uhrzeit in der Rückrufliste. Bitte in THEORG übertragen.',
    'anrufe': '…', 'anrufe_abends': '…', 'minuten_verbraucht': '…', 'termine_gebucht': '…', 'verbesserungen': '…'}, ensure_ascii=False, indent=1))

with zipfile.ZipFile(pathlib.Path(__file__).parent / 'emki-mailvorlagen-v3.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(OUT.iterdir()):
        z.write(f, f'emki-mailvorlagen/{f.name}')
    z.write(__file__, 'emki-mailvorlagen/build_mails.py')
print('ok', len(V))
