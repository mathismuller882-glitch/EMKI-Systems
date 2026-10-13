#!/usr/bin/env python3
"""Aktualisiert den Live-Stand der Website (aus emki-website-v3.zip) auf v4.
Änderungen: Famulor-Buchung, neues Angebot, Neupatienten-Termine, Favicon-Fix, Datenschutz."""
import pathlib, re, json, datetime

D = pathlib.Path(__file__).parent / 'site'
BOOK = 'https://app.famulor.io/book/emki-systems/kennenlernen'
HEUTE = datetime.date.today().isoformat()


def rep(text, old, new, count=1, name=''):
    n = text.count(old)
    if n < 1:
        raise SystemExit(f'NICHT GEFUNDEN [{name}]: {old[:90]!r}')
    if count and n != count:
        raise SystemExit(f'{n}x statt {count}x [{name}]: {old[:90]!r}')
    return text.replace(old, new)


# ---------- Favicon in allen HTML-Seiten ----------
ICONS = ('<link rel="icon" href="/favicon.ico" sizes="48x48">\n'
         '<link rel="icon" type="image/png" sizes="512x512" href="/favicon.png">\n'
         '<link rel="apple-touch-icon" href="/apple-touch-icon.png">')
for f in D.glob('*.html'):
    t = f.read_text()
    t = t.replace('<link rel="apple-touch-icon" href="favicon.png">\n', '')
    t = rep(t, '<link rel="icon" type="image/png" href="favicon.png">', ICONS, name=f.name + ' favicon')
    f.write_text(t)

# ---------- Startseite ----------
f = D / 'index.html'
t = f.read_text()

# JSON-LD
t = rep(t, '"logo": "https://emki-systems.de/emki-mail-logo.png"', '"logo": "https://emki-systems.de/logo.png"', name='logo')
t = rep(t, '"description": "300 Gesprächsminuten pro Monat, Einrichtung per Video (einmalig 190 €)"',
        '"description": "300 Gesprächsminuten pro Monat, Einrichtung per Video einmalig 190 €, entfällt bei 12 Monaten Laufzeit. 30 Tage Pilot mit Geld-zurück für den ersten Monatsbeitrag."', name='offer1')
t = rep(t, '"description": "500 Gesprächsminuten pro Monat, Einrichtung vor Ort und monatliche Pflege (einmalig 290 €)"',
        '"description": "500 Gesprächsminuten pro Monat, Einrichtung vor Ort und monatliche Pflege, Einrichtung einmalig 290 €, entfällt bei 12 Monaten Laufzeit. 30 Tage Pilot mit Geld-zurück für den ersten Monatsbeitrag."', name='offer2')
t = rep(t, 'Eine kurze Mail ohne Patientendaten meldet jeden Anruf. Keine Tonaufnahme, keine Terminvergabe, keine medizinischen Auskünfte."',
        'Eine kurze Mail ohne Patientendaten meldet jeden Anruf. Auf Wunsch vergibt er Neupatienten-Termine aus festen Terminfenstern, die die Praxis freigibt. Keine Tonaufnahme, keine medizinischen Auskünfte."', name='svc desc')

FAQ1_ALT = 'Termine vergibt sie nicht, das entscheidet Ihr Team.'
FAQ1_NEU = 'Neuen Patienten kann sie auf Wunsch direkt einen Ersttermin aus Zeiten geben, die Sie freigeben.'
t = rep(t, FAQ1_ALT, FAQ1_NEU, count=2, name='faq1')

TERM_Q_ALT = 'Warum vergibt der Assistent keine Termine?'
TERM_Q_NEU = 'Kann der Assistent Termine vergeben, auch in THEORG?'
TERM_A_ALT = 'Weil Ihr Team am besten weiß, welcher Termin zu welchem Patienten und welcher Verordnung passt. Der Assistent nimmt Wunschzeiten auf, Ihr Team entscheidet und ruft zurück. So entstehen keine Doppelbuchungen.'
TERM_A_NEU = ('Neupatienten-Termine ja: Sie legen feste Terminfenster fest, zum Beispiel zwei Erstbefunde am Tag. '
              'Der Assistent nennt dem Anrufer passende freie Zeiten, trägt den Termin erst nach seiner Zusage ein, '
              'und Sie sehen die Buchung sofort in Ihrer Rückrufliste. In THEORG übertragen Sie den Termin selbst, '
              'denn eine offizielle Schnittstelle zum Eintragen von Terminen bietet THEORG derzeit nicht. '
              'Folgetermine, dringliche Rezepte und Hausbesuche nimmt der Assistent als Wunsch auf, Ihr Team entscheidet. '
              'So entstehen keine Doppelbuchungen.')
t = rep(t, TERM_Q_ALT, TERM_Q_NEU, count=2, name='term q')
t = rep(t, TERM_A_ALT, TERM_A_NEU, count=2, name='term a')

PREIS_ALT = ('Das Paket Basis kostet 99 € im Monat mit 300 Gesprächsminuten, die Einrichtung per Video einmalig 190 €. '
             'Das Paket Rundum kostet 179 € im Monat mit 500 Gesprächsminuten, Einrichtung vor Ort und monatlicher Pflege, einmalig 290 €. '
             'Als Kleinunternehmer berechne ich keine Umsatzsteuer (§ 19 UStG). Nach dem Kennenlernen bekommen Sie ein schriftliches Angebot.')
PREIS_NEU = ('Das Paket Basis kostet 99 € im Monat mit 300 Gesprächsminuten, die Einrichtung per Video einmalig 190 €. '
             'Das Paket Rundum kostet 179 € im Monat mit 500 Gesprächsminuten, Einrichtung vor Ort und monatlicher Pflege, einmalig 290 €. '
             'Die ersten 30 Tage sind ein Pilot: Machen Sie danach nicht weiter, bekommen Sie den ersten Monatsbeitrag zurück. '
             'Danach ist der Vertrag monatlich kündbar, oder Sie wählen 12 Monate Laufzeit und sparen die Einrichtungsgebühr. '
             'Als Kleinunternehmer berechne ich keine Umsatzsteuer (§ 19 UStG).')
t = rep(t, PREIS_ALT, PREIS_NEU, count=2, name='preis')

# Neue FAQ "Was, wenn es nicht passt?" (JSON-LD + HTML)
RISIKO_Q = 'Was ist, wenn der Assistent für unsere Praxis nicht passt?'
RISIKO_A = ('Dann hören Sie einfach auf. Die ersten 30 Tage nach dem Start sind ein Pilot: Bis zu seinem Ende genügt eine kurze Mail, '
            'der Vertrag endet, und Sie bekommen den ersten Monatsbeitrag zurück. Das gilt auch, wenn Sie 12 Monate Laufzeit gewählt haben, '
            'denn die Laufzeit beginnt erst nach dem Pilot. Ihre Rufumleitung schalten Sie einfach wieder ab.')
jsonld_q = ('    {\n     "@type": "Question",\n     "name": ' + json.dumps(RISIKO_Q, ensure_ascii=False) +
            ',\n     "acceptedAnswer": {\n      "@type": "Answer",\n      "text": ' + json.dumps(RISIKO_A, ensure_ascii=False) + '\n     }\n    }')
t = rep(t, '\n    }\n   ],\n   "isPartOf": {\n    "@id": "https://emki-systems.de/#page"',
        '\n    },\n' + jsonld_q + '\n   ],\n   "isPartOf": {\n    "@id": "https://emki-systems.de/#page"', name='jsonld risiko')
html_q = ('        <details>\n          <summary>' + RISIKO_Q + '</summary>\n          <p>' + RISIKO_A + '</p>\n        </details>\n      </div>\n      <p class="intro" style="margin-top:28px">Mehr zum Nachlesen:')
t = rep(t, '      </div>\n      <p class="intro" style="margin-top:28px">Mehr zum Nachlesen:', html_q, name='html risiko')

# Buttons: direkt zur Buchung
t = rep(t, '<a class="btn" href="#kontakt">Termin buchen</a>\n  </div>\n</header>',
        '<a class="btn" href="' + BOOK + '" target="_blank" rel="noopener">Termin buchen</a>\n  </div>\n</header>', name='hdr btn')
t = rep(t, '<a class="btn" href="#kontakt">Termin buchen</a>\n        <a class="btn ghost" href="#demo">Live-Demo testen</a>',
        '<a class="btn" href="' + BOOK + '" target="_blank" rel="noopener">Kennenlernen buchen</a>\n        <a class="btn ghost" href="#demo">Live-Demo testen</a>', name='hero btn')
t = rep(t, '<a href="#ablauf">Ablauf</a>', '<a href="#ablauf">Ablauf</a>\n      <a href="#preise">Preise</a>', name='nav')

# Hero
t = rep(t, 'und hinterlässt Ihrem Team eine fertige Telefonnotiz. Termine und medizinische Fragen bleiben bei Ihnen.</p>',
        'und hinterlässt Ihrem Team eine fertige Telefonnotiz. Neuen Patienten gibt er auf Wunsch gleich einen Ersttermin, aus den Zeiten, die Sie freigeben.</p>', name='hero lead')
t = rep(t, '<p class="region">Für Physiotherapiepraxen im Rhein-Sieg-Kreis, persönlich eingerichtet und betreut.</p>',
        '<p class="region">Für Physiotherapiepraxen im Rhein-Sieg-Kreis, persönlich eingerichtet und betreut. 30 Tage Pilot mit Geld-zurück.</p>', name='region')

# Demo
t = rep(t, 'Sprechen Sie so, als wären Sie Patientin oder Patient, zum Beispiel: „Ich muss meinen Termin morgen absagen.“</p>',
        'Sprechen Sie so, als wären Sie Patientin oder Patient, zum Beispiel: „Ich muss meinen Termin morgen absagen.“ '
        'Oder: „Ich war noch nie bei Ihnen und brauche einen Termin für Krankengymnastik.“ Dann trägt er Ihnen einen Termin in der Vorführpraxis ein, so wie später in Ihrer Praxis.</p>', name='demo intro')
t = rep(t, '<li>Ein Testgespräch dauert höchstens vier Minuten.</li>', '<li>Ein Testgespräch dauert höchstens fünf Minuten.</li>', name='demo dauer')

# Leistungen
t = rep(t, '<li>Terminwünsche, Absagen und Rückrufbitten aufnehmen</li>',
        '<li>Terminwünsche, Absagen und Rückrufbitten aufnehmen</li>\n            <li>Neupatienten-Termine aus festen Terminfenstern vergeben, die Sie freigeben (auf Wunsch)</li>', name='leistung +')
t = rep(t, '<li>Termine eintragen oder zusagen</li>',
        '<li>Folgetermine planen oder Termine direkt in Ihre Praxissoftware schreiben</li>', name='leistung -')

# Ablauf
t = rep(t, '<li><h3>Kennenlernen</h3><p>Wir sprechen kurz am Telefon, danach zeige ich Ihnen den Assistenten in Ihrer Praxis. Wir klären, welche Anrufe er übernehmen soll.</p></li>',
        '<li><h3>Kennenlernen</h3><p>30 Minuten am Telefon, per Video oder bei Ihnen in der Praxis. Sie hören den Assistenten live, wir klären, welche Anrufe er übernehmen soll.</p></li>', name='ablauf1')
t = rep(t, '<li><h3>Einrichten</h3><p>Ich stimme den Assistenten auf Ihre Praxis ab: Begrüßung, Öffnungszeiten, Angebote, Ansprechpartner.</p></li>',
        '<li><h3>Einrichten</h3><p>Ich stimme den Assistenten auf Ihre Praxis ab: Begrüßung, Öffnungszeiten, Angebote, Ansprechpartner. Verträge und Datenschutz-Unterlagen bekommen Sie fertig vorbereitet zum Unterschreiben.</p></li>', name='ablauf2')
t = rep(t, '<li><h3>Testen und starten</h3><p>Sie rufen selbst an und hören zu. Erst wenn alles passt, leiten Sie Anrufe um, zum Beispiel nur, wenn niemand abnimmt.</p></li>',
        '<li><h3>Testen und starten</h3><p>Sie rufen selbst an und hören zu. Erst wenn alles passt, leiten Sie Anrufe um, zum Beispiel nur, wenn niemand abnimmt. Ab dann läuft Ihr 30-Tage-Pilot mit Geld-zurück.</p></li>', name='ablauf3')

# Preise-Abschnitt vor den FAQ
PREISE = '''  <section class="band" id="preise">
    <div class="wrap">
      <h2>Preise</h2>
      <p class="intro">Feste Monatspreise, keine Umsatzsteuer (Kleinunternehmer nach § 19 UStG). Nach dem Kennenlernen bekommen Sie ein schriftliches Angebot.</p>
      <div class="plans">
        <div class="card plan">
          <h3>Basis</h3>
          <p class="price"><b>99 €</b> im Monat</p>
          <ul class="ticks">
            <li>300 Gesprächsminuten im Monat</li>
            <li>Fertige Telefonnotizen in Ihrer Rückrufliste, dazu eine kurze Mail ohne Patientendaten</li>
            <li>Neupatienten-Termine auf Wunsch</li>
            <li>Einrichtung per Video: einmalig 190 €</li>
          </ul>
        </div>
        <div class="card plan main">
          <span class="tag">Für die meisten Praxen</span>
          <h3>Rundum</h3>
          <p class="price"><b>179 €</b> im Monat</p>
          <ul class="ticks">
            <li>500 Gesprächsminuten im Monat</li>
            <li>Alles aus Basis</li>
            <li>Einrichtung und Einweisung Ihres Teams bei Ihnen vor Ort</li>
            <li>Monatliche Pflege: neue Kurse, Urlaubszeiten, Anpassungen</li>
            <li>Einrichtung: einmalig 290 €</li>
          </ul>
        </div>
      </div>
      <dl class="facts promise">
        <div><dt>30 Tage Pilot mit Geld zurück</dt><dd>Überzeugt Sie der Assistent in den ersten 30 Tagen nach dem Start nicht, genügt eine kurze Mail. Der Vertrag endet, und Sie bekommen den Monatsbeitrag zurück.</dd></div>
        <div><dt>Einrichtung geschenkt bei 12 Monaten</dt><dd>Mit 12 Monaten Laufzeit entfällt die Einrichtungsgebühr, die Laufzeit beginnt erst nach dem Pilot. Ohne Laufzeit ist der Vertrag monatlich kündbar.</dd></div>
        <div><dt>Datenschutz-Paket inklusive</dt><dd>Auftragsverarbeitungsvertrag, Verschwiegenheitsverpflichtung, Eintrag fürs Verarbeitungsverzeichnis, Entwurf der Folgenabschätzung, Aushang und Einweisung Ihres Teams.</dd></div>
        <div><dt>Persönlich aus der Region</dt><dd>Ein fester Ansprechpartner aus dem Rhein-Sieg-Kreis, der Ihre Praxis kennt. Kein Callcenter, keine Warteschleife.</dd></div>
      </dl>
      <p class="actions" style="margin-top:28px"><a class="btn" href="''' + BOOK + '''" target="_blank" rel="noopener">Kennenlernen buchen</a></p>
    </div>
  </section>

  <section class="band" id="fragen">'''
t = rep(t, '  <section class="band" id="fragen">', PREISE, name='preise section')

CSS = '''  /* Preise */
  .plans { display: grid; gap: 16px; margin-bottom: 24px; }
  @media (min-width: 760px) { .plans { grid-template-columns: 1fr 1fr; } }
  .plan { display: flex; flex-direction: column; }
  .plan.main { border: 2px solid var(--kuli); }
  .plan .price { margin: 0 0 12px; color: var(--ink); font-size: 18px; }
  .plan .price b { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; font-size: 34px; font-weight: 600; }
  .plan .ticks li { font-size: 16px; }
  .promise div:first-child { border: 2px solid var(--kuli); }

  footer {'''
t = rep(t, '  footer {', CSS, name='css')

# Kontakt-Karte
t = rep(t, '<h3>Rückruf-Termin buchen</h3>\n          <p>Sie wählen im Kalender eine passende Uhrzeit, wir sprechen am Telefon oder per Video. Unverbindlich.</p>\n          <a class="btn" href="https://calendar.app.google/F2W2k1DVyd58KJ8C7" target="_blank" rel="noopener">Termin auswählen</a>\n          <p class="fine">Öffnet den Terminkalender von Google in einem neuen Fenster.</p>',
        '<h3>Kennenlerngespräch buchen</h3>\n          <p>30 Minuten, kostenlos und unverbindlich. Sie wählen eine freie Zeit, montags bis freitags zwischen 9 und 17 Uhr, und ob wir telefonieren, per Video sprechen oder ich zu Ihnen in die Praxis komme.</p>\n          <a class="btn" href="' + BOOK + '" target="_blank" rel="noopener">Termin auswählen</a>\n          <p class="fine">Öffnet die Terminbuchung unseres Partners Famulor in einem neuen Fenster. Mehr in der <a href="datenschutz.html#termin">Datenschutzerklärung</a>.</p>', name='kontakt')
f.write_text(t)

# ---------- Datenschutz ----------
f = D / 'datenschutz.html'
t = f.read_text()
alt = re.search(r'<p>Über „Termin auswählen“ gelangen Sie zu unserer Buchungsseite im Google Kalender\..*?</p>', t, re.S)
if not alt:
    raise SystemExit('Datenschutz-Absatz Termin nicht gefunden')
neu = ('<p>Über „Termin auswählen“ oder „Termin buchen“ gelangen Sie zu unserer Buchungsseite. Sie wird erst geöffnet, wenn Sie auf den Link klicken. '
       'Dort geben Sie Ihren Namen, Ihre E-Mail-Adresse, Ihre Telefonnummer, den Namen und Ort Ihrer Praxis und die gewünschte Gesprächsart an, '
       'freiwillig auch die Größe Ihres Teams, Ihre Praxissoftware und Ihr Anliegen. Wir nutzen die Angaben, um das Gespräch vorzubereiten und Sie zum gewählten Zeitpunkt zu erreichen. '
       'Sie bekommen eine Bestätigung und eine Erinnerung per E-Mail mit Links zum Verschieben oder Absagen. '
       'Die Buchungsseite betreibt die BEK Service GmbH, Westendstr. 2A, 87439 Kempten (Plattform Famulor), als unser Auftragsverarbeiter auf Grundlage eines Vertrags nach Art. 28 DSGVO. '
       'Der Termin wird außerdem in unseren Kalender bei Google Workspace (Google Cloud EMEA Ltd., Irland) eingetragen, ebenfalls auf Grundlage eines Vertrags zur Auftragsverarbeitung. '
       'Wünschen Sie ein Videogespräch, schicken wir Ihnen vorher einen Link zu Google Meet. '
       'Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung eines Vertrags). '
       'Wir löschen die Termindaten, sobald sie für die Anfrage nicht mehr erforderlich sind und keine gesetzliche Aufbewahrungspflicht besteht.</p>')
t = t.replace(alt.group(0), neu)
f.write_text(t)

# ---------- Ratgeber-Seiten ----------
f = D / 'rezeptfrist-physiotherapie-praxis.html'
t = f.read_text()
t = rep(t, 'und markiert knappe Fälle ganz oben in der Telefonnotiz. Die Terminvergabe bleibt bei Ihrem Team.</p>',
        'und markiert knappe Fälle ganz oben in der Telefonnotiz. Neuen Patienten kann er auf Wunsch gleich einen Ersttermin aus festen Terminfenstern geben, alle anderen Termine vergibt Ihr Team.</p>', name='rezeptfrist')
f.write_text(t)

# ---------- llms.txt ----------
f = D / 'llms.txt'
t = f.read_text()
t = rep(t, '- Übernimmt: Anrufe annehmen, Terminwünsche, Absagen und Rückrufbitten aufnehmen, kurzfristige Absagen markieren, einfache Fragen zu Öffnungszeiten und Kursen beantworten\n- Übernimmt nicht: Termine eintragen oder zusagen, medizinische Auskünfte, Notfälle (verweist auf 112 und 116 117), Gesprächsaufzeichnung',
        '- Übernimmt: Anrufe annehmen, Terminwünsche, Absagen und Rückrufbitten aufnehmen, kurzfristige Absagen markieren, einfache Fragen zu Öffnungszeiten und Kursen beantworten, auf Wunsch Neupatienten-Termine aus festen Terminfenstern vergeben, die die Praxis freigibt\n- Übernimmt nicht: Folgetermine planen, direkt in die Praxissoftware schreiben (THEORG bietet dafür keine offizielle Schnittstelle; die Praxis überträgt gebuchte Neupatienten-Termine selbst), medizinische Auskünfte, Notfälle (verweist auf 112 und 116 117), Gesprächsaufzeichnung', name='llms leistung')
t = rep(t, 'einmalig 290 €); keine Umsatzsteuer nach § 19 UStG',
        'einmalig 290 €); 30 Tage Pilot ab Start, wer danach nicht weitermacht, bekommt den ersten Monatsbeitrag zurück; danach monatlich kündbar oder 12 Monate Laufzeit ohne Einrichtungsgebühr; keine Umsatzsteuer nach § 19 UStG', name='llms preis')
t = rep(t, '- [Startseite](https://emki-systems.de/): Angebot, Live-Demo, Ablauf, häufige Fragen, Kontakt',
        '- [Startseite](https://emki-systems.de/): Angebot, Live-Demo, Ablauf, Preise, häufige Fragen, Kontakt', name='llms seiten')
t = rep(t, 'Kennenlern-Termin online buchen: https://calendar.app.google/F2W2k1DVyd58KJ8C7',
        'Kennenlerngespräch online buchen (30 Minuten, Mo–Fr 9–17 Uhr): ' + BOOK, name='llms kontakt')
f.write_text(t)

# ---------- Sitemap ----------
f = D / 'sitemap.xml'
t = re.sub(r'<lastmod>[0-9-]+</lastmod>', '<lastmod>' + HEUTE + '</lastmod>', f.read_text())
f.write_text(t)

print('OK')

# ---------- Checkliste ----------
f = D / 'checkliste-ki-telefonassistent-physiotherapie.html'
t = f.read_text()
t = rep(t, '<p>Fragen Sie jeden Anbieter, welches Modell er anbietet und wie er mit Ihrer Praxissoftware zusammenarbeitet.</p>',
        '<p>Es gibt auch einen Mittelweg: Der Assistent vergibt nur Neupatienten-Termine aus festen Terminfenstern, die die Praxis freigibt, und alles andere läuft über die Telefonnotiz. Fragen Sie jeden Anbieter, welches Modell er anbietet und wie er mit Ihrer Praxissoftware zusammenarbeitet, und lassen Sie sich bei einer angeblichen Anbindung an THEORG oder eine andere Software genau zeigen, wie der Termin dort hineinkommt.</p>', name='check mittelweg')
t = rep(t, 'Ich richte KI-Telefonassistenten persönlich für Physiotherapiepraxen im Rhein-Sieg-Kreis ein. Sie können den Assistenten direkt ausprobieren.<br><br>\n    <a class="btn" href="index.html#demo">Live-Demo testen</a>',
        'Ich richte KI-Telefonassistenten persönlich für Physiotherapiepraxen im Rhein-Sieg-Kreis ein: Telefonnotiz für alle Anrufe, auf Wunsch Neupatienten-Termine aus Ihren Terminfenstern, 30 Tage Pilot mit Geld-zurück. Sie können den Assistenten direkt ausprobieren.<br><br>\n    <a class="btn" href="index.html#demo">Live-Demo testen</a> <a class="btn" href="' + BOOK + '" target="_blank" rel="noopener">Kennenlernen buchen</a>', name='check box')
t = t.replace('Stand: 4. Oktober 2026', 'Stand: 5. Oktober 2026')
f.write_text(t)
print('OK Checkliste')
