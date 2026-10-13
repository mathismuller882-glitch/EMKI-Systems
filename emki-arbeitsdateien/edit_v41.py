# Website v4.1: eigene Buchungsadresse /termin, Famulor-Nennungen reduziert, Datenschutz und Impressum vervollständigt.
# Läuft nach edit_site.py auf dem Ordner site/.
import pathlib, re, sys

D = pathlib.Path(__file__).parent / 'site'

# ---- Schalter -------------------------------------------------------------
PROVIDER = 'eigen'     # 'eigen' = eigene Buchungsseite /termin/ (Apps Script), 'famulor' = Übergang per Weiterleitung
FAMULOR_URL = 'https://app.famulor.io/book/emki-systems/kennenlernen'
PHONE = None           # z. B. '+49 170 1234567' -> erscheint im Impressum und in der Datenschutzerklärung
WIDNR = None           # Wirtschafts-Identifikationsnummer, falls vom BZSt zugeteilt
STAND = 'Oktober 2026'
TERMIN = 'https://emki-systems.de/termin'
# ---------------------------------------------------------------------------



def rep(text, old, new, count=1, name=''):
    n = text.count(old)
    if n != count:
        sys.exit(f'[{name}] erwartet {count}x, gefunden {n}x: {old[:80]!r}')
    return text.replace(old, new)


# 1) Alle Buchungslinks auf die eigene Adresse
for f in D.glob('*.html'):
    t = f.read_text(encoding='utf-8')
    t = t.replace(FAMULOR_URL, TERMIN)
    f.write_text(t, encoding='utf-8')
f = D / 'llms.txt'
f.write_text(f.read_text(encoding='utf-8').replace(FAMULOR_URL, TERMIN), encoding='utf-8')

# 2) Weiterleitung nur im Übergang; mit eigener Seite liefert Netlify /termin/ direkt aus
if PROVIDER == 'famulor':
    (D / '_redirects').write_text(f'/termin   {FAMULOR_URL}   302\n/termin/  {FAMULOR_URL}   302\n', encoding='utf-8')
elif (D / '_redirects').exists():
    (D / '_redirects').unlink()

# 2b) Eigene Seite: Links öffnen im selben Fenster
if PROVIDER == 'eigen':
    for f in D.glob('*.html'):
        t = f.read_text(encoding='utf-8')
        t = t.replace('href="' + TERMIN + '" target="_blank" rel="noopener"', 'href="/termin/"')
        f.write_text(t, encoding='utf-8')

# 3) Startseite: Hinweistexte ohne Markennamen, aber mit Anbieter
f = D / 'index.html'
t = f.read_text(encoding='utf-8')
t = rep(t, 'Erst mit dem Klick auf „Demo starten“ wird der Sprachdienst unseres Partners Famulor geladen. Vorher werden keine Daten übertragen.',
        'Erst mit dem Klick auf „Demo starten“ wird der Sprachdienst unseres Dienstleisters (BEK Service GmbH, Kempten) geladen. Vorher werden keine Daten übertragen.', name='demo fine')
hinweis = 'Freie Zeiten direkt aus meinem Kalender, Bestätigung sofort per E-Mail.' if PROVIDER == 'eigen' else 'Öffnet unsere Terminbuchung in einem neuen Fenster.'
t = rep(t, 'Öffnet die Terminbuchung unseres Partners Famulor in einem neuen Fenster.', hinweis, name='kontakt fine')
f.write_text(t, encoding='utf-8')

# 4) Datenschutzerklärung
f = D / 'datenschutz.html'
t = f.read_text(encoding='utf-8')

kontakt_tel = f'<br>Telefon: <a href="tel:{PHONE.replace(" ", "")}">{PHONE}</a>' if PHONE else ''
t = rep(t, 'E-Mail: <a href="mailto:mathis@emki-systems.de">mathis@emki-systems.de</a></p>',
        'E-Mail: <a href="mailto:mathis@emki-systems.de">mathis@emki-systems.de</a>' + kontakt_tel + '</p>', name='verantwortlicher')

t = rep(t, 'Anbieter ist die BEK Service GmbH (Famulor), Westendstr. 2A, 87439 Kempten. Mit dem Klick werden technische Daten wie IP-Adresse und Browser an Famulor übertragen.',
        'Anbieter des Sprachdienstes ist die BEK Service GmbH, Westendstr. 2A, 87439 Kempten (Plattform Famulor), die für uns als Auftragsverarbeiter tätig ist. Mit dem Klick werden technische Daten wie IP-Adresse und Browser an diesen Dienst übertragen. Die Sprachverarbeitung findet laut Vertrag in Rechenzentren in der EU statt. Das Demo-Fenster setzt keine Cookies.', name='demo anbieter')
t = rep(t, 'Aus dem Gespräch entsteht eine schriftliche Gesprächsnotiz, die wir per E-Mail erhalten und intern ablegen, um auf Ihr Interesse eingehen zu können. Gesprächsdaten bei Famulor werden nach einem Monat gelöscht.',
        'Aus dem Gespräch entsteht eine schriftliche Gesprächsnotiz, die wir per E-Mail erhalten und intern ablegen, um auf Ihr Interesse eingehen zu können. Die Gesprächsdaten beim Dienstleister werden nach einem Monat automatisch gelöscht, die Notiz bei uns, sobald sie nicht mehr gebraucht wird, spätestens zwei Jahre nach dem letzten Kontakt.', name='demo notiz')
t = rep(t, 'Weitere Informationen: <a href="https://www.famulor.io/privacy">Datenschutzerklärung von Famulor</a>.',
        'Weitere Informationen: <a href="https://www.famulor.io/privacy">Datenschutzerklärung des Dienstleisters</a>.', name='demo link')

t = rep(t, 'Für E-Mails nutzen wir Google Workspace (Google Cloud EMEA Ltd., Irland) auf Grundlage eines Vertrags zur Auftragsverarbeitung.',
        'Für E-Mails, Kalender und Dokumente nutzen wir Google Workspace (Google Cloud EMEA Ltd., Gordon House, Barrow Street, Dublin 4, Irland) auf Grundlage eines Vertrags zur Auftragsverarbeitung. Google kann Daten auch außerhalb der EU verarbeiten, insbesondere in den USA. Die Google LLC ist nach dem EU-US Data Privacy Framework zertifiziert, zusätzlich gelten die EU-Standardvertragsklauseln.', name='google')

alt_termin = t[t.index('<h2 id="termin">'):t.index('<h2>Cookies, Schriften und Tracking</h2>')]
if PROVIDER == 'eigen':
    neu_termin = '''<h2 id="termin">Online-Terminbuchung</h2>
  <p>Unter emki-systems.de/termin können Sie ein Kennenlerngespräch buchen. Die Seite zeigt freie Zeiten aus unserem Kalender. Dafür ruft Ihr Browser beim Öffnen der Seite und bei der Buchung einen Dienst von Google auf (Google Apps Script, Teil von Google Workspace, siehe „Kontaktaufnahme“). Dabei werden technisch notwendige Daten wie Ihre IP-Adresse übertragen. Cookies werden dabei nicht gesetzt.</p>
  <p>Bei der Buchung geben Sie Ihren Namen, den Namen und Ort Ihrer Praxis, Ihre E-Mail-Adresse und Ihre Telefonnummer an, bei einem Besuch in der Praxis auch deren Adresse, freiwillig außerdem Anrede, Teamgröße, Praxissoftware und Ihr Anliegen. Kommen Sie über einen Link aus einem Brief oder Flyer, speichern wir außerdem diese Quelle, ohne Cookies oder Tracking. Wir nutzen die Angaben, um das Gespräch vorzubereiten und zu führen: Der Termin wird in unseren Google-Kalender eingetragen, bei einem Videogespräch mit einem Link zu Google Meet. Sie erhalten eine Bestätigung, eine Erinnerung am Vortag und Nachrichten zu Änderungen per E-Mail, jeweils mit Links zum Verschieben oder Absagen. Außerdem speichern wir die Angaben in unserer Kundenverwaltung in Google Workspace, um das Gespräch und eine mögliche Zusammenarbeit zu begleiten. Werbung per E-Mail erhalten Sie dadurch nicht.</p>
  <p>Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung eines Vertrags). Die Buchungsdaten werden spätestens zwei Jahre nach dem Termin automatisch gelöscht, die Angaben in der Kundenverwaltung spätestens zwei Jahre nach dem letzten Kontakt, soweit keine gesetzliche Aufbewahrungspflicht besteht.</p>

  '''
else:
    neu_termin = '''<h2 id="termin">Online-Terminbuchung</h2>
  <p>Über „Termin auswählen“ oder „Termin buchen“ gelangen Sie über die Adresse emki-systems.de/termin zu unserer Buchungsseite. Sie wird erst geöffnet, wenn Sie auf den Link klicken. Dort geben Sie Ihren Namen, Ihre E-Mail-Adresse, Ihre Telefonnummer, den Namen und Ort Ihrer Praxis und die gewünschte Gesprächsart an, freiwillig auch die Größe Ihres Teams, Ihre Praxissoftware und Ihr Anliegen. Wir nutzen die Angaben, um das Gespräch vorzubereiten und Sie zum gewählten Zeitpunkt zu erreichen. Sie bekommen eine Bestätigung und eine Erinnerung per E-Mail mit Links zum Verschieben oder Absagen.</p>
  <p>Die Buchungsseite betreibt die BEK Service GmbH, Westendstr. 2A, 87439 Kempten (Plattform Famulor), als unser Auftragsverarbeiter auf Grundlage eines Vertrags nach Art. 28 DSGVO. Auf der Buchungsseite zeigt der Anbieter einen eigenen Cookie-Hinweis und setzt eigene Cookies und Analysedienste ein, für die er selbst verantwortlich ist. Einzelheiten finden Sie im Cookie-Hinweis und in der <a href="https://www.famulor.io/privacy">Datenschutzerklärung des Anbieters</a>. Der Termin wird in unseren Kalender bei Google Workspace eingetragen (siehe „Kontaktaufnahme“). Wünschen Sie ein Videogespräch, schicken wir Ihnen vorher einen Link zu Google Meet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung eines Vertrags). Wir löschen die Termindaten, sobald sie für die Anfrage nicht mehr erforderlich sind und keine gesetzliche Aufbewahrungspflicht besteht, spätestens zwei Jahre nach dem letzten Kontakt.</p>

  '''
t = t.replace(alt_termin, neu_termin)

t = rep(t, 'Die Angaben liegen in Google Workspace (Google Cloud EMEA Ltd., Irland) auf Grundlage eines Vertrags zur Auftragsverarbeitung.',
        'Die Angaben liegen in Google Workspace (siehe „Kontaktaufnahme“).', name='geschaeft google')

alt_rechte = t[t.index('<h2>Ihre Rechte</h2>'):t.index('</main>')]
neu_rechte = '''<h2>Pflicht zur Angabe und automatisierte Entscheidungen</h2>
  <p>Sie sind weder gesetzlich noch vertraglich verpflichtet, uns personenbezogene Daten zu geben. Ohne Name und Kontaktdaten können wir eine Anfrage oder einen Termin aber nicht bearbeiten. Eine automatisierte Entscheidung oder ein Profiling nach Art. 22 DSGVO findet nicht statt.</p>

  <h2>Ihre Rechte</h2>
  <p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Eine Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3). Eine formlose Nachricht an <a href="mailto:mathis@emki-systems.de">mathis@emki-systems.de</a> genügt.</p>

  <h2 id="widerspruch">Widerspruchsrecht</h2>
  <p><strong>Verarbeiten wir Daten auf Grundlage unseres berechtigten Interesses (Art. 6 Abs. 1 lit. f DSGVO), können Sie aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit widersprechen. Der Nutzung Ihrer Daten für Direktwerbung können Sie jederzeit ohne Angabe von Gründen widersprechen (Art. 21 DSGVO). Dann nutzen wir Ihre Daten dafür nicht mehr.</strong></p>

  <h2>Beschwerde bei der Aufsichtsbehörde</h2>
  <p>Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren. Für uns zuständig ist die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen, Kavalleriestraße 2–4, 40213 Düsseldorf, <a href="https://www.ldi.nrw.de">www.ldi.nrw.de</a>.</p>

  <p class="fine">Stand: ''' + STAND + '''</p>
'''
t = t.replace(alt_rechte, neu_rechte)
f.write_text(t, encoding='utf-8')

# 5) Impressum
f = D / 'impressum.html'
t = f.read_text(encoding='utf-8')
if PHONE:
    t = rep(t, 'E-Mail: <a href="mailto:mathis@emki-systems.de">mathis@emki-systems.de</a>',
            f'Telefon: <a href="tel:{PHONE.replace(" ", "")}">{PHONE}</a><br>\n  E-Mail: <a href="mailto:mathis@emki-systems.de">mathis@emki-systems.de</a>', name='imp tel')
if WIDNR:
    t = rep(t, 'Kein Ausweis der Umsatzsteuer aufgrund der Kleinunternehmerregelung gemäß § 19 UStG.',
            f'Wirtschafts-Identifikationsnummer gemäß § 139c AO: {WIDNR}<br>\n  Kein Ausweis der Umsatzsteuer aufgrund der Kleinunternehmerregelung gemäß § 19 UStG.', name='imp widnr')
f.write_text(t, encoding='utf-8')

# 6) Sitemap: Datum der Rechtstexte (falls gelistet)
f = D / 'sitemap.xml'
s = f.read_text(encoding='utf-8')
s = re.sub(r'(<loc>https://emki-systems.de/(datenschutz|impressum)\.html</loc><lastmod>)[^<]+', r'\g<1>2026-10-05', s)
f.write_text(s, encoding='utf-8')

# Kontrolle
rest = [p.name for p in D.glob('*.html') if FAMULOR_URL in p.read_text(encoding='utf-8')]
assert not rest, rest
if PROVIDER == 'eigen':
    import subprocess
    subprocess.run([sys.executable, str(pathlib.Path(__file__).parent / 'booking' / 'build_termin.py')], check=True)
print('v4.1 fertig, Anbieter:', PROVIDER, '| Telefon:', bool(PHONE))
