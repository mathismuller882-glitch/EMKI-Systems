/**
 * EMKI Systems – Rückrufliste
 * Morgenübersicht, Wochenbericht, automatische Löschung und Eingang für neue Anrufe.
 *
 * EINRICHTUNG (einmalig, ca. 5 Minuten)
 *  1. Rückrufliste öffnen > Erweiterungen > Apps Script.
 *  2. Den vorhandenen Inhalt von „Code.gs“ löschen und diese Datei komplett einfügen.
 *  3. Unten in EINSTELLUNGEN die Empfänger-Adresse und die Löschfrist prüfen.
 *  4. Oben im Menü die Funktion „einrichten“ auswählen und auf „Ausführen“ klicken.
 *     Google fragt nach Berechtigungen: mit dem EMKI-Konto erlauben.
 *  5. Für den Eingang neuer Anrufe: Bereitstellen > Neue Bereitstellung > Typ „Web-App“,
 *     Ausführen als „Ich“, Zugriff „Jeder“. Die angezeigte Web-App-URL an EMKI schicken.
 *     Den Schlüssel dafür zeigt die Funktion „eingangsAdresseAnzeigen“ im Ausführungsprotokoll.
 *
 * DATENSCHUTZ
 *  - Die Mails enthalten nur Zahlen, keine Namen, Telefonnummern oder Gesundheitsangaben.
 *  - Zeilen im Blatt „Anrufe“ werden nach der Löschfrist automatisch gelöscht.
 *    Das Löschprotokoll enthält nur Datum und Anzahl.
 */

const EINSTELLUNGEN = {
  praxis: 'Gesundheitszentrum Winterscheid',
  // Vor dem Start auf die Praxis-Adresse umstellen. Mehrere Adressen mit Komma trennen.
  empfaenger: 'mathis@emki-systems.de',
  absenderName: 'KI-Telefonassistent Winterscheid',
  // Muss zur Frist im Vertrag zur Auftragsverarbeitung (Anlage 1) passen.
  loeschenNachTagen: 90,
  // Öffnungszeiten für die Auswertung „außerhalb der Öffnungszeiten“ (Mo–Fr).
  oeffnungVon: 8,
  oeffnungBis: 20,
  // Morgenübersicht auch schicken, wenn nichts offen ist (als Lebenszeichen).
  auchOhneOffene: true,
  blattAnrufe: 'Anrufe',
  blattProtokoll: 'Löschprotokoll',
};

// Spalten im Blatt „Anrufe“ (A = 0)
const SP = {
  datum: 0, uhrzeit: 1, prio: 2, anliegen: 3, name: 4, patient: 5, rueckrufAn: 6,
  anrufernummer: 7, rueckrufPasst: 8, rueckrufGewuenscht: 9, kurzfristig: 10,
  rezeptDringlich: 11, neupatient: 12, kurzAnliegen: 13, status: 14,
  zurueckgerufenAm: 15, notiz: 16, details: 17,
};
const ANZAHL_SPALTEN = 18;
const WERBUNG = 'Werbung oder Lieferant';

/* ------------------------------------------------------------------ */
/* Einrichtung                                                         */
/* ------------------------------------------------------------------ */

function einrichten() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('morgenuebersicht').timeBased().atHour(7).nearMinute(45).everyDays(1)
    .inTimezone('Europe/Berlin').create();
  ScriptApp.newTrigger('wochenbericht').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7)
    .nearMinute(30).inTimezone('Europe/Berlin').create();
  ScriptApp.newTrigger('loeschen').timeBased().atHour(3).everyDays(1)
    .inTimezone('Europe/Berlin').create();

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('EINGANG_SCHLUESSEL')) {
    props.setProperty('EINGANG_SCHLUESSEL', Utilities.getUuid().replace(/-/g, ''));
  }
  protokollBlatt_();
  Logger.log('Fertig: Morgenübersicht Mo–Fr ca. 7:45, Wochenbericht montags ca. 7:30, Löschung täglich ca. 3 Uhr.');
}

function eingangsAdresseAnzeigen() {
  const schluessel = PropertiesService.getScriptProperties().getProperty('EINGANG_SCHLUESSEL');
  Logger.log('Schlüssel: ' + schluessel);
  Logger.log('Die Web-App-URL lautet dann: <Web-App-URL>?k=' + schluessel);
}

/* ------------------------------------------------------------------ */
/* Morgenübersicht                                                     */
/* ------------------------------------------------------------------ */

function morgenuebersicht() {
  const heute = new Date();
  const wt = heute.getDay();
  if (wt === 0 || wt === 6) return; // nur Mo–Fr

  const zeilen = anrufe_();
  const props = PropertiesService.getScriptProperties();
  const letzte = Number(props.getProperty('LETZTE_UEBERSICHT')) || (heute.getTime() - 24 * 3600 * 1000);

  let offen = 0, p1 = 0, p2 = 0, p3 = 0, nichtErreicht = 0, dringlich = 0, neu = 0;
  let aeltester = null;
  zeilen.forEach(function (z) {
    if (z[SP.anliegen] === WERBUNG) return;
    const zeit = zeitpunkt_(z);
    if (zeit && zeit.getTime() > letzte) neu++;
    const status = String(z[SP.status] || '').trim().toLowerCase();
    if (status === 'erledigt') return;
    offen++;
    const prio = String(z[SP.prio] || '');
    if (prio.indexOf('1') === 0) p1++; else if (prio.indexOf('2') === 0) p2++; else p3++;
    if (status === 'nicht erreicht') nichtErreicht++;
    if (String(z[SP.rezeptDringlich]).toLowerCase() === 'ja') dringlich++;
    if (zeit && (!aeltester || zeit < aeltester)) aeltester = zeit;
  });
  props.setProperty('LETZTE_UEBERSICHT', String(heute.getTime()));

  if (offen === 0 && !EINSTELLUNGEN.auchOhneOffene) return;

  const betreff = offen === 0
    ? 'Rückrufe heute: alles erledigt'
    : 'Rückrufe heute: ' + offen + ' offen' + (p1 ? ' (' + p1 + ' sofort)' : '');

  const zeilenText = [
    'Guten Morgen,',
    '',
    offen === 0
      ? 'es sind keine Rückrufe offen.'
      : 'hier der Stand der Rückrufliste für heute:',
    '',
  ];
  if (offen > 0) {
    zeilenText.push(
      '  Offen insgesamt: ' + offen,
      '  davon Priorität 1 (sofort): ' + p1,
      '  davon Priorität 2 (heute): ' + p2,
      '  davon Priorität 3 (normal): ' + p3,
      '  davon schon versucht, nicht erreicht: ' + nichtErreicht,
      '  mit dringlichem Rezept: ' + dringlich,
      '  ältester offener Anruf: ' + (aeltester ? datumText_(aeltester) : '–'),
      ''
    );
  }
  zeilenText.push(
    'Neue Anrufe seit der letzten Übersicht: ' + neu,
    '',
    'Zur Rückrufliste (Blatt „Offen“, sortiert nach Dringlichkeit):',
    SpreadsheetApp.getActive().getUrl(),
    '',
    'Bitte nach jedem Rückruf den Status im Blatt „Anrufe“ auf „erledigt“ oder „nicht erreicht“ setzen.',
    '',
    'Aus Datenschutzgründen enthält diese Mail keine Namen, Telefonnummern oder Gesundheitsangaben.',
    '',
    '—',
    'Automatisch erstellt vom KI-Telefonassistenten.',
    'Fragen oder Fehler: mathis@emki-systems.de'
  );
  senden_(betreff, zeilenText.join('\n'));
}

/* ------------------------------------------------------------------ */
/* Wochenbericht                                                       */
/* ------------------------------------------------------------------ */

function wochenbericht() {
  const ende = new Date();
  ende.setHours(0, 0, 0, 0);
  // auf den Montag dieser Woche zurückrechnen
  while (ende.getDay() !== 1) ende.setDate(ende.getDate() - 1);
  const start = new Date(ende);
  start.setDate(start.getDate() - 7);

  const zeilen = anrufe_().filter(function (z) {
    const t = zeitpunkt_(z);
    return t && t >= start && t < ende;
  });

  let gesamt = 0, werbung = 0, ausserhalb = 0, neupatienten = 0, dringlich = 0, kurzfristig = 0;
  let erledigt = 0, offen = 0, nichtErreicht = 0;
  const nachAnliegen = {};
  zeilen.forEach(function (z) {
    gesamt++;
    const anliegen = String(z[SP.anliegen] || 'sonstiges');
    if (anliegen === WERBUNG) { werbung++; return; }
    nachAnliegen[anliegen] = (nachAnliegen[anliegen] || 0) + 1;
    const t = zeitpunkt_(z);
    const tag = t.getDay();
    const std = t.getHours();
    if (tag === 0 || tag === 6 || std < EINSTELLUNGEN.oeffnungVon || std >= EINSTELLUNGEN.oeffnungBis) ausserhalb++;
    if (String(z[SP.neupatient]).toLowerCase() === 'ja') neupatienten++;
    if (String(z[SP.rezeptDringlich]).toLowerCase() === 'ja') dringlich++;
    if (z[SP.kurzfristig] === true || String(z[SP.kurzfristig]).toLowerCase() === 'true') kurzfristig++;
    const status = String(z[SP.status] || '').trim().toLowerCase();
    if (status === 'erledigt') erledigt++;
    else if (status === 'nicht erreicht') nichtErreicht++;
    else offen++;
  });

  const ohneWerbung = gesamt - werbung;
  const bis = new Date(ende); bis.setDate(bis.getDate() - 1);
  const liste = Object.keys(nachAnliegen)
    .sort(function (a, b) { return nachAnliegen[b] - nachAnliegen[a]; })
    .map(function (k) { return '  ' + k + ': ' + nachAnliegen[k]; });

  const text = [
    'Guten Morgen,',
    '',
    'hier der Wochenbericht des KI-Telefonassistenten für ' + datumText_(start) + ' bis ' + datumText_(bis) + ':',
    '',
    '  Anrufe mit Anliegen: ' + ohneWerbung,
    '  davon außerhalb der Öffnungszeiten (Mo–Fr ' + EINSTELLUNGEN.oeffnungVon + '–' + EINSTELLUNGEN.oeffnungBis + ' Uhr): ' + ausserhalb,
    '  Anfragen von Neupatienten: ' + neupatienten,
    '  Rezepte mit dringlichem Behandlungsbedarf: ' + dringlich,
    '  kurzfristige Absagen (Platz neu vergeben): ' + kurzfristig,
    '  Werbe- und Lieferantenanrufe abgefangen: ' + werbung,
    '',
    'Nach Anliegen:',
    liste.length ? liste.join('\n') : '  –',
    '',
    'Stand der Rückrufe aus dieser Woche:',
    '  erledigt: ' + erledigt,
    '  nicht erreicht: ' + nichtErreicht,
    '  noch offen: ' + offen,
    '',
    'Monats- und Gesamtzahlen stehen im Blatt „Statistik“:',
    SpreadsheetApp.getActive().getUrl(),
    '',
    'Aus Datenschutzgründen enthält diese Mail keine Namen, Telefonnummern oder Gesundheitsangaben.',
    '',
    '—',
    'Automatisch erstellt vom KI-Telefonassistenten.',
    'Fragen oder Fehler: mathis@emki-systems.de',
  ].join('\n');

  senden_('Wochenbericht: ' + ohneWerbung + ' Anrufe, ' + ausserhalb + ' außerhalb der Öffnungszeiten', text);
}

/* ------------------------------------------------------------------ */
/* Automatische Löschung                                               */
/* ------------------------------------------------------------------ */

function loeschen() {
  const blatt = SpreadsheetApp.getActive().getSheetByName(EINSTELLUNGEN.blattAnrufe);
  const letzteZeile = blatt.getLastRow();
  if (letzteZeile < 2) return protokoll_(0);

  const grenze = new Date();
  grenze.setHours(0, 0, 0, 0);
  grenze.setDate(grenze.getDate() - EINSTELLUNGEN.loeschenNachTagen);

  const daten = blatt.getRange(2, 1, letzteZeile - 1, 1).getValues();
  const zuLoeschen = [];
  daten.forEach(function (z, i) {
    const d = alsDatum_(z[0]);
    if (d && d < grenze) zuLoeschen.push(i + 2);
  });

  // von unten nach oben in zusammenhängenden Blöcken löschen
  let anzahl = 0;
  for (let i = zuLoeschen.length - 1; i >= 0;) {
    let ende = zuLoeschen[i], anfang = ende;
    while (i - 1 >= 0 && zuLoeschen[i - 1] === anfang - 1) { anfang--; i--; }
    blatt.deleteRows(anfang, ende - anfang + 1);
    anzahl += ende - anfang + 1;
    i--;
  }
  protokoll_(anzahl);
}

/* ------------------------------------------------------------------ */
/* Eingang neuer Anrufe (ersetzt die Verbindung über den App-Connector) */
/* ------------------------------------------------------------------ */

function doPost(e) {
  const erwartet = PropertiesService.getScriptProperties().getProperty('EINGANG_SCHLUESSEL');
  const k = e && e.parameter ? e.parameter.k : '';
  if (!erwartet || k !== erwartet) return antwort_({ ok: false, fehler: 'nicht berechtigt' });

  let daten;
  try {
    daten = JSON.parse(e.postData.contents);
  } catch (err) {
    return antwort_({ ok: false, fehler: 'kein gültiges JSON' });
  }
  const werte = Array.isArray(daten.row) ? daten.row : null;
  if (!werte || werte.length < 14) return antwort_({ ok: false, fehler: 'Feld row fehlt' });

  const zeile = [];
  for (let i = 0; i < ANZAHL_SPALTEN; i++) {
    let v = werte[i] === undefined || werte[i] === null ? '' : String(werte[i]);
    if (v === 'null' || v === 'undefined') v = '';
    zeile.push(sicher_(v, i));
  }
  if (!zeile[SP.status]) zeile[SP.status] = 'offen';

  const sperre = LockService.getScriptLock();
  sperre.waitLock(20000);
  try {
    const blatt = SpreadsheetApp.getActive().getSheetByName(EINSTELLUNGEN.blattAnrufe);
    blatt.getRange(blatt.getLastRow() + 1, 1, 1, ANZAHL_SPALTEN).setValues([zeile]);
  } finally {
    sperre.releaseLock();
  }
  return antwort_({ ok: true });
}

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen                                                     */
/* ------------------------------------------------------------------ */

function anrufe_() {
  const blatt = SpreadsheetApp.getActive().getSheetByName(EINSTELLUNGEN.blattAnrufe);
  const n = blatt.getLastRow() - 1;
  if (n < 1) return [];
  return blatt.getRange(2, 1, n, ANZAHL_SPALTEN).getValues().filter(function (z) { return z[SP.datum] !== ''; });
}

function alsDatum_(v) {
  if (v instanceof Date) return v;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})|^(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  return m[1] ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(+m[6], +m[5] - 1, +m[4]);
}

function zeitpunkt_(z) {
  const d = alsDatum_(z[SP.datum]);
  if (!d) return null;
  const t = new Date(d);
  const u = z[SP.uhrzeit];
  if (u instanceof Date) t.setHours(u.getHours(), u.getMinutes(), 0, 0);
  else {
    const m = String(u).match(/(\d{1,2}):(\d{2})/);
    if (m) t.setHours(+m[1], +m[2], 0, 0);
  }
  return t;
}

function datumText_(d) {
  return Utilities.formatDate(d, 'Europe/Berlin', 'dd.MM.yyyy');
}

// Verhindert, dass Text als Formel ausgeführt wird. Datum und Uhrzeit bleiben auswertbar.
function sicher_(v, spalte) {
  if (spalte === SP.datum || spalte === SP.uhrzeit) return v;
  if (spalte === SP.kurzfristig) return v === 'true' ? true : v === 'false' ? false : v;
  if (spalte === SP.rueckrufAn || spalte === SP.anrufernummer) return v ? "'" + v.replace(/^'/, '') : '';
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function senden_(betreff, text) {
  MailApp.sendEmail({
    to: EINSTELLUNGEN.empfaenger,
    subject: betreff,
    body: text,
    name: EINSTELLUNGEN.absenderName,
  });
}

function protokollBlatt_() {
  const ss = SpreadsheetApp.getActive();
  let blatt = ss.getSheetByName(EINSTELLUNGEN.blattProtokoll);
  if (!blatt) {
    blatt = ss.insertSheet(EINSTELLUNGEN.blattProtokoll);
    blatt.getRange(1, 1, 1, 3).setValues([['Gelaufen am', 'Gelöschte Anrufe', 'Löschfrist (Tage)']])
      .setFontWeight('bold');
    blatt.setFrozenRows(1);
    blatt.hideSheet();
  }
  return blatt;
}

function protokoll_(anzahl) {
  protokollBlatt_().appendRow([new Date(), anzahl, EINSTELLUNGEN.loeschenNachTagen]);
}

function antwort_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
