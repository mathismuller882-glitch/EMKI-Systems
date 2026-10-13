/**
 * EMKI Systems – Terminbuchung für das Kennenlerngespräch
 * Backend für emki-systems.de/termin. Läuft im Google-Konto mathis@emki-systems.de.
 *
 * Was es macht
 *  - liefert freie Zeiten aus dem Google-Kalender (Mo–Fr 9–17 Uhr, ohne NRW-Feiertage)
 *  - legt gebuchte Termine im Kalender an, bei Video mit Google-Meet-Link, bei Besuch mit Fahrzeit
 *  - schickt gestaltete Mails: Bestätigung mit Kalendereinladung, Erinnerung am Vortag,
 *    Verschiebung, Absage, und eine Info an Mathis
 *  - trägt den Kontakt ins Vertriebs-CRM ein oder aktualisiert ihn
 *  - löscht Buchungsdaten nach zwei Jahren
 *
 * Einrichtung: siehe ANLEITUNG.md. Kurz: Code einfügen, appsscript.json ersetzen,
 * Funktion „einrichten“ ausführen, als Web-App bereitstellen (Ausführen als: Ich, Zugriff: Jeder).
 */

const K = {
  zeitzone: 'Europe/Berlin',
  wochentage: [1, 2, 3, 4, 5],     // Mo–Fr
  von: 9 * 60,                       // 09:00 in Minuten
  bis: 17 * 60,                      // letzter Termin endet spätestens 17:00
  dauer: 30,                         // Minuten
  raster: 30,                        // Abstand der Startzeiten
  pufferNach: 15,                    // Pause nach jedem Termin
  fahrzeit: 45,                      // bei Besuch in der Praxis: vorher und nachher
  vorlaufStunden: 12,
  maxTage: 30,
  sperrtage: ['12-24', '12-31'],     // zusätzlich zu den NRW-Feiertagen (MM-TT)
  erinnerungStunden: 24,
  loeschenNachTagen: 730,
  crmId: '14yUw7vWGwe2rZs-Yp4IN4D6AFNJLsASIt50_pex3-z4',
  crmBlatt: 'Pipeline',
  host: 'mathis@emki-systems.de',
  absender: 'Mathis C. Müller · EMKI Systems',
  telefon: '',                       // optional, z. B. '+49 170 1234567' – erscheint dann in allen Mails
  foto: '',                          // optional: Adresse eines quadratischen Fotos (z. B. https://emki-systems.de/mathis.jpg) für die Signatur
  seite: 'https://emki-systems.de/termin/',
  site: 'https://emki-systems.de',
};

const TYPEN = {
  telefon: { titel: 'Telefonat', kurz: 'Telefon', crm: 'Telefon' },
  video: { titel: 'Videogespräch', kurz: 'Video (Google Meet)', crm: 'Video' },
  praxis: { titel: 'Besuch in Ihrer Praxis', kurz: 'Besuch in der Praxis', crm: 'Besuch' },
};

const SPALTEN = ['id', 'token', 'status', 'typ', 'start', 'ende', 'name', 'praxis', 'ort', 'adresse',
  'email', 'telefon', 'team', 'software', 'anliegen', 'quelle', 'eventId', 'fahrIds', 'meet',
  'erstellt', 'geaendert', 'erinnert', 'sequenz', 'anrede'];

/* ================================================================== */
/* Einrichtung                                                         */
/* ================================================================== */

function einrichten() {
  if (Session.getScriptTimeZone() !== K.zeitzone) {
    throw new Error('Bitte in den Projekteinstellungen die Zeitzone „(GMT+01:00) Berlin“ wählen bzw. appsscript.json ersetzen.');
  }
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('BUCHUNGEN_ID')) {
    const ss = SpreadsheetApp.create('EMKI – Terminbuchungen (automatisch)');
    const sh = ss.getSheets()[0];
    sh.setName('Buchungen');
    sh.getRange(1, 1, 1, SPALTEN.length).setValues([SPALTEN]).setFontWeight('bold');
    sh.setFrozenRows(1);
    props.setProperty('BUCHUNGEN_ID', ss.getId());
  }
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('stuendlich').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('naechtlich').timeBased().atHour(3).everyDays(1).inTimezone(K.zeitzone).create();

  // Rechte für Kalender, Mailversand, Tabellen und Meet einmal abfragen
  CalendarApp.getDefaultCalendar().getName();
  SpreadsheetApp.openById(K.crmId).getName();
  const meet = typeof Calendar !== 'undefined';
  Logger.log('Fertig. Buchungstabelle: https://docs.google.com/spreadsheets/d/' + props.getProperty('BUCHUNGEN_ID'));
  Logger.log(meet ? 'Google Meet: aktiv.' : 'Hinweis: Dienst „Google Calendar API“ fehlt, Videotermine bekommen dann keinen automatischen Meet-Link.');
}

/** Testmail mit Beispieldaten an Mathis, um das Design zu prüfen. */
function testmailSenden() {
  const b = beispielBuchung_();
  const m = mailBestaetigung_(b, 'neu');
  MailApp.sendEmail(K.host, '[Test] ' + m.betreff, m.text, {
    htmlBody: m.html, name: K.absender, attachments: [icsBlob_(b, 'PUBLISH')],
  });
  const h = mailHost_(b, 'neu');
  MailApp.sendEmail(K.host, '[Test] ' + h.betreff, h.text, { htmlBody: h.html, name: 'EMKI Terminbuchung' });
}

/* ================================================================== */
/* Web-App                                                             */
/* ================================================================== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.a === 'slots') {
      const eigen = p.b ? finden_(p.b, p.t) : null;
      const ohne = eigen ? [eigen.eventId].concat(String(eigen.fahrIds).split(',')).filter(String).join(',') : '';
      return json_({ ok: true, typ: typ_(p.typ), tage: freieZeiten_(typ_(p.typ), ohne) });
    }
    if (p.a === 'buchung') return json_(buchungOeffentlich_(p.id, p.t));
    return json_({ ok: true, dienst: 'EMKI Terminbuchung' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, fehler: 'Serverfehler' });
  }
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, fehler: 'Ungültige Anfrage' }); }
  try {
    if (d.a === 'buchen') return json_(buchen_(d));
    if (d.a === 'verschieben') return json_(verschieben_(d));
    if (d.a === 'absagen') return json_(absagen_(d));
    return json_({ ok: false, fehler: 'Unbekannte Aktion' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, fehler: 'Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal oder schreiben Sie an ' + K.host + '.' });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function typ_(t) { return TYPEN[t] ? t : 'telefon'; }

/* ================================================================== */
/* Freie Zeiten                                                        */
/* ================================================================== */

function freieZeiten_(typ, ohneEventId) {
  const jetzt = new Date();
  const erster = new Date(jetzt.getTime() + K.vorlaufStunden * 3600000);
  const start = tagesbeginn_(jetzt);
  const ende = new Date(start.getTime() + (K.maxTage + 1) * 86400000);
  const belegt = belegt_(start, ende, ohneEventId);
  const tage = [];
  for (let d = new Date(start); d < ende; d = new Date(d.getTime() + 86400000)) {
    const tag = tagesbeginn_(d);
    if (!buchbarerTag_(tag)) continue;
    const slots = [];
    for (let m = K.von; m + K.dauer <= K.bis; m += K.raster) {
      const s = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), Math.floor(m / 60), m % 60);
      if (s < erster) continue;
      if (frei_(s, typ, belegt)) slots.push(hhmm_(s));
    }
    if (slots.length) tage.push({ datum: isoTag_(tag), slots: slots });
  }
  return tage;
}

function frei_(s, typ, belegt) {
  const vor = typ === 'praxis' ? K.fahrzeit : 0;
  const nach = typ === 'praxis' ? Math.max(K.fahrzeit, K.pufferNach) : K.pufferNach;
  const a = s.getTime() - vor * 60000;
  const b = s.getTime() + (K.dauer + nach) * 60000;
  for (let i = 0; i < belegt.length; i++) {
    // fremde Termine bekommen ebenfalls die Pause danach
    if (a < belegt[i][1] + K.pufferNach * 60000 && b > belegt[i][0]) return false;
  }
  return true;
}

function belegt_(start, ende, ohneEventId) {
  const ohne = String(ohneEventId || '').split(',').filter(String);
  return events_(CalendarApp.getDefaultCalendar(), start, ende, ohne);
}

function events_(cal, start, ende, ohne) {
  const out = [];
  cal.getEvents(new Date(start.getTime() - 3 * 3600000), new Date(ende.getTime() + 3 * 3600000)).forEach(function (ev) {
    if (ohne.indexOf(ev.getId()) >= 0) return;
    if (ev.getTransparency && String(ev.getTransparency()) === 'TRANSPARENT') return;
    try { if (String(ev.getMyStatus()) === 'NO') return; } catch (err) { /* eigene Termine */ }
    if (ev.isAllDayEvent()) {
      out.push([ev.getAllDayStartDate().getTime(), ev.getAllDayEndDate().getTime()]);
    } else {
      out.push([ev.getStartTime().getTime(), ev.getEndTime().getTime()]);
    }
  });
  return out;
}

function buchbarerTag_(tag) {
  if (K.wochentage.indexOf(tag.getDay()) < 0) return false;
  const mmtt = pad_(tag.getMonth() + 1) + '-' + pad_(tag.getDate());
  if (K.sperrtage.indexOf(mmtt) >= 0) return false;
  return !feiertagNRW_(tag);
}

function feiertagNRW_(tag) {
  const j = tag.getFullYear();
  const o = ostersonntag_(j);
  const nr = tagNr_(tag);
  const liste = [tagNr_(new Date(j, 0, 1)), o - 2, o + 1, tagNr_(new Date(j, 4, 1)), o + 39, o + 50, o + 60,
    tagNr_(new Date(j, 9, 3)), tagNr_(new Date(j, 10, 1)), tagNr_(new Date(j, 11, 25)), tagNr_(new Date(j, 11, 26))];
  return liste.indexOf(nr) >= 0;
}

function ostersonntag_(j) {
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return tagNr_(new Date(j, monat - 1, tag));
}

function tagNr_(d) { return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }

/* ================================================================== */
/* Buchen, verschieben, absagen                                        */
/* ================================================================== */

function buchen_(d) {
  if (d.hp) return { ok: true, id: 'x' };                       // Bot hat das versteckte Feld ausgefüllt
  if (d.ts && Date.now() - Number(d.ts) < 4000) return { ok: false, fehler: 'Bitte einen Moment Geduld und noch einmal absenden.' };
  const typ = typ_(d.typ);
  const f = pruefen_(d, typ);
  if (f) return { ok: false, fehler: f };
  const start = ausIso_(d.datum, d.zeit);
  if (!start) return { ok: false, fehler: 'Bitte wählen Sie eine Uhrzeit.' };

  const sperre = LockService.getScriptLock();
  sperre.waitLock(25000);
  let b;
  try {
    if (!zeitGueltig_(start, typ, '')) return { ok: false, vergeben: true, fehler: 'Diese Zeit wurde gerade vergeben. Bitte wählen Sie eine andere.' };
    const aktiv = buchungen_().filter(function (x) {
      return x.email.toLowerCase() === d.email.trim().toLowerCase() && x.status === 'bestätigt' && new Date(x.start) > new Date();
    });
    if (aktiv.length >= 2) return { ok: false, fehler: 'Für diese E-Mail-Adresse sind schon Termine gebucht. Schreiben Sie mir gern direkt an ' + K.host + '.' };

    b = {
      id: Utilities.getUuid().replace(/-/g, '').slice(0, 12),
      token: Utilities.getUuid().replace(/-/g, ''),
      status: 'bestätigt', typ: typ,
      start: start.toISOString(), ende: new Date(start.getTime() + K.dauer * 60000).toISOString(),
      name: sauber_(d.name, 80), praxis: sauber_(d.praxis, 120), ort: sauber_(d.ort, 80),
      adresse: typ === 'praxis' ? sauber_(d.adresse, 160) : '',
      email: sauber_(d.email, 120).toLowerCase(), telefon: sauber_(d.telefon, 40),
      team: sauber_(d.team, 20), software: sauber_(d.software, 40), anliegen: sauber_(d.anliegen, 1000),
      quelle: sauber_(d.quelle, 30), eventId: '', fahrIds: '', meet: '',
      erstellt: new Date().toISOString(), geaendert: '', erinnert: '', sequenz: 0,
      anrede: ['Frau', 'Herr'].indexOf(d.anrede) >= 0 ? d.anrede : '',
    };
    kalenderAnlegen_(b);
    speichern_(b);
  } finally {
    sperre.releaseLock();
  }
  const m = mailBestaetigung_(b, 'neu');
  senden_(b.email, m, [icsBlob_(b, 'PUBLISH')]);
  senden_(K.host, mailHost_(b, 'neu'), [], true);
  try { crm_(b, 'neu'); } catch (err) { console.error('CRM', err); }
  return { ok: true, buchung: oeffentlich_(b) };
}

function verschieben_(d) {
  const b = finden_(d.id, d.t);
  if (!b || b.status !== 'bestätigt') return { ok: false, fehler: 'Dieser Termin kann nicht mehr verschoben werden.' };
  const start = ausIso_(d.datum, d.zeit);
  if (!start) return { ok: false, fehler: 'Bitte wählen Sie eine Uhrzeit.' };
  const sperre = LockService.getScriptLock();
  sperre.waitLock(25000);
  const alt = Object.assign({}, b);
  try {
    if (!zeitGueltig_(start, b.typ, [b.eventId].concat(String(b.fahrIds).split(',')).filter(String).join(','))) {
      return { ok: false, vergeben: true, fehler: 'Diese Zeit wurde gerade vergeben. Bitte wählen Sie eine andere.' };
    }
    b.start = start.toISOString();
    b.ende = new Date(start.getTime() + K.dauer * 60000).toISOString();
    b.sequenz = Number(b.sequenz || 0) + 1;
    b.erinnert = '';
    b.geaendert = new Date().toISOString();
    kalenderVerschieben_(b);
    speichern_(b);
  } finally {
    sperre.releaseLock();
  }
  const m = mailBestaetigung_(b, 'verschoben', alt);
  senden_(b.email, m, [icsBlob_(b, 'PUBLISH')]);
  senden_(K.host, mailHost_(b, 'verschoben', alt), [], true);
  try { crm_(b, 'verschoben'); } catch (err) { console.error('CRM', err); }
  return { ok: true, buchung: oeffentlich_(b) };
}

function absagen_(d) {
  const b = finden_(d.id, d.t);
  if (!b) return { ok: false, fehler: 'Termin nicht gefunden.' };
  if (b.status !== 'bestätigt') return { ok: true, buchung: oeffentlich_(b) };
  b.status = 'abgesagt';
  b.geaendert = new Date().toISOString();
  b.sequenz = Number(b.sequenz || 0) + 1;
  kalenderLoeschen_(b);
  speichern_(b);
  senden_(b.email, mailAbsage_(b), [icsBlob_(b, 'CANCEL')]);
  senden_(K.host, mailHost_(b, 'abgesagt'), [], true);
  try { crm_(b, 'abgesagt'); } catch (err) { console.error('CRM', err); }
  return { ok: true, buchung: oeffentlich_(b) };
}

function zeitGueltig_(start, typ, ohne) {
  const jetzt = new Date();
  if (start < new Date(jetzt.getTime() + K.vorlaufStunden * 3600000)) return false;
  if (start > new Date(jetzt.getTime() + (K.maxTage + 1) * 86400000)) return false;
  if (!buchbarerTag_(tagesbeginn_(start))) return false;
  const m = start.getHours() * 60 + start.getMinutes();
  if (m < K.von || m + K.dauer > K.bis || (m - K.von) % K.raster !== 0) return false;
  const belegt = belegt_(new Date(start.getTime() - 86400000), new Date(start.getTime() + 86400000), ohne);
  return frei_(start, typ, belegt);
}

function pruefen_(d, typ) {
  if (!d.name || String(d.name).trim().length < 3) return 'Bitte geben Sie Ihren vollständigen Namen an.';
  if (!d.praxis || String(d.praxis).trim().length < 2) return 'Bitte geben Sie den Namen Ihrer Praxis an.';
  if (!d.ort || String(d.ort).trim().length < 2) return 'Bitte geben Sie den Ort Ihrer Praxis an.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.email || '').trim())) return 'Bitte prüfen Sie Ihre E-Mail-Adresse.';
  if (String(d.telefon || '').replace(/\D/g, '').length < 6) return 'Bitte geben Sie eine Telefonnummer an.';
  if (typ === 'praxis' && (!d.adresse || String(d.adresse).trim().length < 5)) return 'Bitte geben Sie die Adresse Ihrer Praxis an.';
  return '';
}

/* ================================================================== */
/* Kalender                                                            */
/* ================================================================== */

function kalenderAnlegen_(b) {
  const start = new Date(b.start), ende = new Date(b.ende);
  const titel = 'Kennenlernen: ' + b.praxis + ' (' + b.name + ')';
  const beschreibung = kalenderText_(b);
  const ort = b.typ === 'praxis' ? b.adresse + ', ' + b.ort : b.typ === 'telefon' ? 'Telefon: ' + b.telefon : '';
  if (b.typ === 'video' && typeof Calendar !== 'undefined') {
    const ev = Calendar.Events.insert({
      summary: titel, description: beschreibung, location: ort,
      start: { dateTime: start.toISOString(), timeZone: K.zeitzone },
      end: { dateTime: ende.toISOString(), timeZone: K.zeitzone },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] },
      conferenceData: { createRequest: { requestId: b.id + '-' + Date.now(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      extendedProperties: { private: { emki: b.id } },
    }, 'primary', { conferenceDataVersion: 1, sendUpdates: 'none' });
    b.eventId = String(ev.id) + '@google.com';
    b.meet = ev.hangoutLink || '';
  } else {
    const ev = CalendarApp.getDefaultCalendar().createEvent(titel, start, ende, { description: beschreibung, location: ort });
    ev.removeAllReminders(); ev.addPopupReminder(10);
    b.eventId = ev.getId();
  }
  if (b.typ === 'praxis') b.fahrIds = fahrzeitAnlegen_(b).join(',');
}

function fahrzeitAnlegen_(b) {
  const cal = CalendarApp.getDefaultCalendar();
  const s = new Date(b.start), e = new Date(b.ende);
  const t = 'Fahrzeit · ' + b.praxis;
  const v = cal.createEvent(t, new Date(s.getTime() - K.fahrzeit * 60000), s, { location: b.adresse + ', ' + b.ort });
  const n = cal.createEvent(t, e, new Date(e.getTime() + K.fahrzeit * 60000));
  [v, n].forEach(function (x) { x.removeAllReminders(); x.setColor(CalendarApp.EventColor.GRAY); });
  return [v.getId(), n.getId()];
}

function kalenderVerschieben_(b) {
  const ev = event_(b.eventId);
  if (ev) {
    ev.setTime(new Date(b.start), new Date(b.ende));
    ev.setDescription(kalenderText_(b));
  } else {
    kalenderAnlegen_(b);
    return;
  }
  String(b.fahrIds).split(',').filter(String).forEach(function (id) { const x = event_(id); if (x) x.deleteEvent(); });
  b.fahrIds = b.typ === 'praxis' ? fahrzeitAnlegen_(b).join(',') : '';
}

function kalenderLoeschen_(b) {
  [b.eventId].concat(String(b.fahrIds).split(',')).filter(String).forEach(function (id) {
    const x = event_(id); if (x) x.deleteEvent();
  });
}

function event_(id) {
  if (!id) return null;
  try { return CalendarApp.getDefaultCalendar().getEventById(id); } catch (err) { return null; }
}

function kalenderText_(b) {
  return [
    'Kennenlerngespräch über emki-systems.de/termin gebucht',
    '',
    'Gesprächsart: ' + TYPEN[b.typ].kurz,
    'Name: ' + kontakt_(b),
    'Praxis: ' + b.praxis + ', ' + b.ort,
    b.adresse ? 'Adresse: ' + b.adresse : '',
    'Telefon: ' + b.telefon,
    'E-Mail: ' + b.email,
    b.team ? 'Therapeutinnen/Therapeuten: ' + b.team : '',
    b.software ? 'Praxissoftware: ' + b.software : '',
    b.anliegen ? 'Anliegen: ' + b.anliegen : '',
    b.quelle ? 'Quelle: ' + b.quelle : '',
    '',
    'Vorbereiten: Website der Praxis ansehen, Telefonzeiten und Software notieren, Live-Demo bereithalten.',
  ].filter(function (x, i, a) { return x !== '' || (a[i - 1] !== ''); }).join('\n');
}

/* ================================================================== */
/* Speicher (Tabelle „EMKI – Terminbuchungen“)                         */
/* ================================================================== */

function blatt_() {
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('BUCHUNGEN_ID')).getSheetByName('Buchungen');
}

function buchungen_() {
  const sh = blatt_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, SPALTEN.length).getDisplayValues().map(function (r, i) {
    const o = { _zeile: i + 2 };
    SPALTEN.forEach(function (k, j) { o[k] = r[j]; });
    return o;
  });
}

function finden_(id, token) {
  if (!id || !token) return null;
  const b = buchungen_().filter(function (x) { return x.id === String(id); })[0];
  return b && b.token === String(token) ? b : null;
}

function speichern_(b) {
  const sh = blatt_();
  const zeile = SPALTEN.map(function (k) { return b[k] === undefined ? '' : String(b[k]); });
  if (b._zeile) sh.getRange(b._zeile, 1, 1, SPALTEN.length).setNumberFormat('@').setValues([zeile]);
  else {
    const r = sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, SPALTEN.length).setNumberFormat('@').setValues([zeile]);
    b._zeile = r;
  }
}

function buchungOeffentlich_(id, token) {
  const b = finden_(id, token);
  if (!b) return { ok: false, fehler: 'Dieser Link ist nicht mehr gültig.' };
  return { ok: true, buchung: oeffentlich_(b) };
}

function oeffentlich_(b) {
  return {
    id: b.id, status: b.status, typ: b.typ, start: b.start, ende: b.ende, name: b.name, praxis: b.praxis,
    ort: b.ort, adresse: b.adresse, email: b.email, telefon: b.telefon, meet: b.meet,
    vorbei: new Date(b.start) < new Date(),
    links: kalenderLinks_(b),
  };
}

/* ================================================================== */
/* Zeitgesteuert                                                       */
/* ================================================================== */

function stuendlich() {
  const jetzt = Date.now();
  buchungen_().forEach(function (b) {
    if (b.status !== 'bestätigt' || b.erinnert) return;
    const s = new Date(b.start).getTime();
    const bis = s - jetzt;
    if (bis <= 0 || bis > K.erinnerungStunden * 3600000) return;
    if (new Date(b.geaendert || b.erstellt).getTime() > s - (K.erinnerungStunden + 2) * 3600000) { b.erinnert = 'nicht nötig'; speichern_(b); return; }
    if (!event_(b.eventId)) { b.status = 'im Kalender gelöscht'; speichern_(b); return; }
    senden_(b.email, mailErinnerung_(b), []);
    b.erinnert = new Date().toISOString();
    speichern_(b);
  });
}

function naechtlich() {
  const grenze = Date.now() - K.loeschenNachTagen * 86400000;
  const sh = blatt_();
  buchungen_().reverse().forEach(function (b) {
    if (new Date(b.start).getTime() < grenze) sh.deleteRow(b._zeile);
  });
}

/* ================================================================== */
/* CRM                                                                 */
/* ================================================================== */

function crm_(b, art) {
  const sh = SpreadsheetApp.openById(K.crmId).getSheetByName(K.crmBlatt);
  const werte = sh.getDataRange().getValues();
  const kopf = werte[0];
  const sp = function (name) { return kopf.indexOf(name); };
  const norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, ''); };
  let zeile = -1;
  for (let i = 1; i < werte.length; i++) {
    if (b.email && norm(werte[i][sp('E-Mail')]) === norm(b.email)) { zeile = i; break; }
  }
  if (zeile < 0) {
    for (let i = 1; i < werte.length; i++) {
      if (norm(werte[i][sp('Praxis / Betrieb')]) === norm(b.praxis) && norm(werte[i][sp('Ort')]) === norm(b.ort)) { zeile = i; break; }
    }
  }
  const wann = datumLang_(new Date(b.start)) + ', ' + hhmm_(new Date(b.start)) + ' Uhr';
  const schritt = art === 'abgesagt'
    ? 'Kennenlernen abgesagt (' + wann + '). In 2–3 Tagen persönlich nachfassen.'
    : 'Kennenlerngespräch (' + TYPEN[b.typ].crm + ') am ' + wann;
  const notiz = new Date().toLocaleDateString('de-DE') + ' Terminbuchung ' + art + ': ' + TYPEN[b.typ].crm + ', ' + wann +
    (b.anliegen ? ' – Anliegen: ' + b.anliegen : '') + (b.team ? ' – Team: ' + b.team : '');
  const heute = Utilities.formatDate(new Date(), K.zeitzone, 'dd.MM.yyyy');
  const termin = Utilities.formatDate(new Date(b.start), K.zeitzone, 'dd.MM.yyyy');
  const quelle = { brief: 'Brief / Flyer', flyer: 'Brief / Flyer', besuch: 'Kaltakquise vor Ort', demo: 'Demo-Anruf', empfehlung: 'Empfehlung', partner: 'Partner' }[b.quelle] || 'Website';

  if (zeile < 0) {
    const neu = kopf.map(function () { return ''; });
    const set = function (k, v) { if (sp(k) >= 0) neu[sp(k)] = v; };
    set('Praxis / Betrieb', b.praxis); set('Status', art === 'abgesagt' ? 'Kontaktiert' : 'Termin vereinbart');
    set('Priorität', 'A'); set('Gebiet', 'Sonstiges'); set('Ort', b.ort); set('Branche', 'Physiotherapie');
    set('Ansprechpartner', kontakt_(b)); set('Telefon', "'" + b.telefon); set('E-Mail', b.email);
    set('Verantwortlich', 'Mathis'); set('Nächster Schritt', schritt); set('Nächster Kontakt', termin);
    set('Quelle', quelle); set('Einwilligung', 'Keine'); set('Praxissoftware', b.software);
    set('Zuletzt geändert', heute); set('Notizen', notiz);
    sh.appendRow(neu);
    return;
  }
  const r = zeile + 1;
  const setze = function (k, v, nurLeer) {
    const c = sp(k);
    if (c < 0) return;
    if (nurLeer && String(werte[zeile][c]).trim()) return;
    sh.getRange(r, c + 1).setValue(v);
  };
  const status = String(werte[zeile][sp('Status')]);
  if (art !== 'abgesagt' && ['Neu', 'Kontaktiert'].indexOf(status) >= 0) setze('Status', 'Termin vereinbart');
  if (art === 'abgesagt' && status === 'Termin vereinbart') setze('Status', 'Kontaktiert');
  setze('Ansprechpartner', kontakt_(b), true); setze('Telefon', "'" + b.telefon, true); setze('E-Mail', b.email, true);
  setze('Praxissoftware', b.software, true);
  setze('Nächster Schritt', schritt); setze('Nächster Kontakt', termin); setze('Zuletzt geändert', heute);
  const alt = String(werte[zeile][sp('Notizen')] || '');
  setze('Notizen', (alt ? alt + '\n' : '') + notiz);
}

/* ================================================================== */
/* Mails senden                                                        */
/* ================================================================== */

function senden_(an, m, anhaenge, intern) {
  MailApp.sendEmail(an, m.betreff, m.text, {
    htmlBody: m.html,
    name: intern ? 'EMKI Terminbuchung' : K.absender,
    replyTo: intern ? (m.replyTo || K.host) : K.host,
    attachments: anhaenge || [],
  });
}

function icsBlob_(b, methode) {
  const s = new Date(b.start), e = new Date(b.ende);
  const z = function (d) { return Utilities.formatDate(d, 'UTC', "yyyyMMdd'T'HHmmss'Z'"); };
  const esc = function (t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); };
  const ort = b.typ === 'video' ? (b.meet || 'Videogespräch, Link folgt per E-Mail') : b.typ === 'praxis' ? b.adresse + ', ' + b.ort : 'Telefon, Mathis ruft Sie an: ' + b.telefon;
  const zeilen = [
    'BEGIN:VCALENDAR', 'PRODID:-//EMKI Systems//Terminbuchung//DE', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'METHOD:' + methode,
    'BEGIN:VEVENT',
    'UID:' + b.id + '@emki-systems.de',
    'SEQUENCE:' + Number(b.sequenz || 0),
    'DTSTAMP:' + z(new Date()),
    'DTSTART:' + z(s), 'DTEND:' + z(e),
    'SUMMARY:' + esc('Kennenlerngespräch mit Mathis C. Müller (EMKI Systems)'),
    'DESCRIPTION:' + esc(TYPEN[b.typ].titel + '\n\nVerschieben oder absagen: ' + verwaltenLink_(b) + '\n\nFragen: ' + K.host),
    'LOCATION:' + esc(ort),
    'ORGANIZER;CN=Mathis C. Müller:mailto:' + K.host,
    'STATUS:' + (methode === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'),
    'TRANSP:OPAQUE',
  ];
  if (b.meet) zeilen.push('URL:' + b.meet);
  if (methode !== 'CANCEL') zeilen.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Kennenlerngespräch EMKI Systems', 'TRIGGER:-PT15M', 'END:VALARM');
  zeilen.push('END:VEVENT', 'END:VCALENDAR');
  const text = zeilen.map(falten_).join('\r\n') + '\r\n';
  return Utilities.newBlob(text, 'text/calendar; charset=utf-8; method=' + methode, methode === 'CANCEL' ? 'absage.ics' : 'termin.ics');
}

function falten_(z) {
  const out = [];
  let rest = z;
  while (Utilities.newBlob(rest).getBytes().length > 74) {
    let n = 74;
    while (Utilities.newBlob(rest.slice(0, n)).getBytes().length > 74) n--;
    out.push(rest.slice(0, n));
    rest = ' ' + rest.slice(n);
  }
  out.push(rest);
  return out.join('\r\n');
}

/* ================================================================== */
/* Hilfen                                                              */
/* ================================================================== */

function verwaltenLink_(b) { return K.seite + '?b=' + b.id + '&t=' + b.token; }
function kontakt_(b) { return (b.anrede ? b.anrede + ' ' : '') + b.name; }

function kalenderLinks_(b) {
  const s = new Date(b.start), e = new Date(b.ende);
  const z = function (d) { return Utilities.formatDate(d, 'UTC', "yyyyMMdd'T'HHmmss'Z'"); };
  const iso = function (d) { return Utilities.formatDate(d, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'"); };
  const titel = 'Kennenlerngespräch mit Mathis C. Müller (EMKI Systems)';
  const ort = b.typ === 'video' ? (b.meet || 'Google Meet') : b.typ === 'praxis' ? b.adresse + ', ' + b.ort : 'Telefon';
  const text = TYPEN[b.typ].titel + (b.meet ? '\n' + b.meet : '') + '\n\nVerschieben oder absagen: ' + verwaltenLink_(b);
  return {
    google: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(titel) +
      '&dates=' + z(s) + '/' + z(e) + '&details=' + encodeURIComponent(text) + '&location=' + encodeURIComponent(ort),
    outlook: 'https://outlook.office.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=' +
      encodeURIComponent(titel) + '&startdt=' + iso(s) + '&enddt=' + iso(e) + '&body=' + encodeURIComponent(text) + '&location=' + encodeURIComponent(ort),
  };
}

function sauber_(s, max) { return String(s || '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function pad_(n) { return (n < 10 ? '0' : '') + n; }
function hhmm_(d) { return pad_(d.getHours()) + ':' + pad_(d.getMinutes()); }
function isoTag_(d) { return d.getFullYear() + '-' + pad_(d.getMonth() + 1) + '-' + pad_(d.getDate()); }
function tagesbeginn_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function ausIso_(datum, zeit) {
  const a = String(datum || '').match(/^(\d{4})-(\d{2})-(\d{2})$/), b = String(zeit || '').match(/^(\d{2}):(\d{2})$/);
  return a && b ? new Date(+a[1], +a[2] - 1, +a[3], +b[1], +b[2]) : null;
}

function beispielBuchung_() {
  const s = new Date(Date.now() + 3 * 86400000); s.setHours(10, 0, 0, 0);
  return {
    id: 'test123', token: 'abc', status: 'bestätigt', typ: 'video', start: s.toISOString(),
    ende: new Date(s.getTime() + 30 * 60000).toISOString(), name: 'Anja Beispiel', praxis: 'Physio am Markt',
    ort: 'Hennef', adresse: '', email: K.host, telefon: '02242 000000', team: '3–5', software: 'THEORG', anrede: 'Frau',
    anliegen: 'Telefon während der Behandlungen', quelle: '', meet: 'https://meet.google.com/abc-defg-hij', sequenz: 0,
  };
}
