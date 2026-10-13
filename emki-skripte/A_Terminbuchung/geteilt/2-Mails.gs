/**
 * EMKI Systems – Mailvorlagen der Terminbuchung
 * Tabellenlayout mit Inline-Styles, damit die Mails in Gmail, Outlook und Apple Mail gleich aussehen.
 */

const F = {
  ink: '#1b2330', grau: '#586172', hell: '#8a93a3', kuli: '#2a46b8', kuliDunkel: '#1d3290', kuliSoft: '#e8ecfb',
  linie: '#dfe3ea', papier: '#f3f4f7', weiss: '#ffffff', notiz: '#fff8d9', notizLinie: '#e9dfa8', notizDruck: '#7b7451',
  gruen: '#0f7b4f', gruenSoft: '#e5f3eb', rot: '#9b2c2c', rotSoft: '#f7e8e8',
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  serif: "'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif",
  logo: 'https://emki-systems.de/emki-mail-logo.png',
};

const WT_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WT_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MON_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function teileBerlin_(d) {
  const s = Utilities.formatDate(d, 'Europe/Berlin', 'yyyy-MM-dd-HH-mm-u').split('-');
  return { j: +s[0], m: +s[1], t: +s[2], h: s[3], min: s[4], wt: (+s[5]) % 7 };
}
function datumLang_(d) { const p = teileBerlin_(d); return WT_LANG[p.wt] + ', ' + p.t + '. ' + MON_LANG[p.m - 1] + ' ' + p.j; }
function datumMittel_(d) { const p = teileBerlin_(d); return WT_KURZ[p.wt] + '., ' + p.t + '. ' + MON_LANG[p.m - 1]; }
function zeitText_(d) { const p = teileBerlin_(d); return p.h + ':' + p.min; }

/** „Guten Tag Frau Dr. Steenken“ – mit Anrede, sonst mit vollem Namen. */
function gruss_(b) {
  const name = String(b.name || '').trim();
  if (!b.anrede) return 'Guten Tag ' + name;
  const teile = name.split(/\s+/);
  const nach = teile[teile.length - 1];
  const titel = /(^|\s)Prof\.?(\s|$)/i.test(name) ? 'Prof. ' : '';
  const dr = /(^|\s)Dr\.?(\s|$)/i.test(name) ? 'Dr. ' : '';
  return 'Guten Tag ' + b.anrede + ' ' + titel + dr + nach;
}

function e_(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

function pill_(text, art) {
  const c = { ok: [F.gruen, F.gruenSoft], info: [F.kuli, F.kuliSoft], aus: [F.rot, F.rotSoft] }[art || 'ok'];
  const zeichen = art === 'aus' ? '&#10005;' : art === 'info' ? '&#9679;' : '&#10003;';
  return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr>' +
    '<td style="background:' + c[1] + ';border-radius:999px;padding:6px 12px;font:600 12px/1 ' + F.sans + ';color:' + c[0] + ';letter-spacing:.02em">' +
    zeichen + '&nbsp;&nbsp;' + e_(text) + '</td></tr></table>';
}

function h1_(text) {
  return '<h1 class="h1" style="margin:0 0 14px;font:600 30px/1.2 ' + F.serif + ';color:' + F.ink + ';letter-spacing:-.01em">' + text + '</h1>';
}

function p_(text, extra) {
  return '<p style="margin:0 0 16px;font:16px/1.6 ' + F.sans + ';color:' + F.ink + ';' + (extra || '') + '">' + text + '</p>';
}

function klein_(text) {
  return '<p style="margin:0 0 14px;font:13px/1.55 ' + F.sans + ';color:' + F.grau + '">' + text + '</p>';
}

function h2_(text) {
  return '<h2 style="margin:34px 0 14px;font:600 19px/1.3 ' + F.serif + ';color:' + F.ink + '">' + text + '</h2>';
}

function trenner_() {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:1px;line-height:1px;font-size:0;background:' + F.linie + '">&nbsp;</td></tr></table>';
}

function knopf_(label, url, art) {
  const voll = art !== 'rand';
  return '<td class="knopf" style="padding:0 10px 10px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="border-radius:10px;background:' + (voll ? F.kuli : F.weiss) + ';border:2px solid ' + F.kuli + '">' +
    '<a href="' + e_(url) + '" style="display:inline-block;padding:14px 24px;font:600 15px/1 ' + F.sans + ';white-space:nowrap;color:' + (voll ? F.weiss : F.kuli) +
    ';text-decoration:none;border-radius:10px">' + label + '</a></td></tr></table></td>';
}

function knoepfe_(liste) {
  return '<table class="knoepfe" role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tr>' + liste.join('') + '</tr></table>';
}

function ticket_(b, durch) {
  const s = new Date(b.start), en = new Date(b.ende), p = teileBerlin_(s);
  const art = {
    telefon: ['Telefonat', 'Ich rufe Sie unter <b>' + e_(b.telefon) + '</b> an.'],
    video: ['Videogespräch über Google Meet', b.meet
      ? '<a href="' + e_(b.meet) + '" style="color:' + F.kuli + ';text-decoration:none;font-weight:600">' + e_(b.meet.replace('https://', '')) + '</a>'
      : 'Den Link schicke ich Ihnen rechtzeitig vorab.'],
    praxis: ['Besuch in Ihrer Praxis', e_(b.adresse) + ', ' + e_(b.ort)],
  }[b.typ];
  if (durch) art[1] = '<span style="color:' + F.grau + '">Entfällt</span>';
  const deko = durch ? 'text-decoration:line-through;' : '';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;border:1px solid ' + F.linie + ';border-radius:14px;border-collapse:separate">' +
    '<tr>' +
    '<td class="kachel" width="104" align="center" valign="middle" style="width:104px;background:' + (durch ? F.hell : F.kuli) + ';border-radius:13px 0 0 13px;padding:18px 8px">' +
    '<div style="font:600 12px/1 ' + F.sans + ';color:#c9d2f6;letter-spacing:.12em;text-transform:uppercase">' + WT_KURZ[p.wt] + '</div>' +
    '<div style="font:700 40px/1.1 ' + F.serif + ';color:#ffffff;padding:6px 0 4px;' + deko + '">' + p.t + '</div>' +
    '<div style="font:600 12px/1 ' + F.sans + ';color:#c9d2f6;letter-spacing:.12em;text-transform:uppercase">' + MON_KURZ[p.m - 1] + '</div>' +
    '</td>' +
    '<td valign="middle" style="padding:18px 22px">' +
    '<div style="font:600 17px/1.35 ' + F.sans + ';color:' + F.ink + ';' + deko + '">' + datumLang_(s) + '</div>' +
    '<div style="font:16px/1.5 ' + F.sans + ';color:' + F.ink + ';' + deko + '">' + zeitText_(s) + ' – ' + zeitText_(en) + ' Uhr <span style="color:' + F.grau + '">· 30 Minuten</span></div>' +
    '<div style="height:12px;line-height:12px;font-size:0">&nbsp;</div>' +
    '<div style="font:600 12px/1.4 ' + F.sans + ';color:' + F.grau + ';letter-spacing:.06em;text-transform:uppercase">' + art[0] + '</div>' +
    '<div style="font:15px/1.5 ' + F.sans + ';color:' + F.ink + '">' + art[1] + '</div>' +
    '<div style="font:14px/1.5 ' + F.sans + ';color:' + F.grau + ';padding-top:4px">mit Mathis C. Müller, EMKI Systems</div>' +
    '</td></tr></table>';
}

function schritte_(liste) {
  let tr = '';
  liste.forEach(function (x, i) {
    tr += '<tr><td width="40" valign="top" style="width:40px;padding:0 0 16px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:28px;height:28px;border-radius:14px;background:' + F.kuliSoft +
      ';font:700 13px/28px ' + F.sans + ';color:' + F.kuli + '">' + (i + 1) + '</td></tr></table></td>' +
      '<td valign="top" style="padding:3px 0 16px;font:15px/1.55 ' + F.sans + ';color:' + F.ink + '"><b>' + x[0] + '</b><br>' +
      '<span style="color:' + F.grau + '">' + x[1] + '</span></td></tr>';
  });
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + tr + '</table>';
}

function notiz_(titel, text) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 8px;background:' + F.notiz +
    ';border:1px solid ' + F.notizLinie + ';border-top:4px dotted ' + F.notizLinie + ';border-radius:12px;border-collapse:separate"><tr><td style="padding:18px 22px">' +
    '<div style="font:600 18px/1.3 ' + F.serif + ';color:' + F.notizDruck + ';padding-bottom:6px">' + titel + '</div>' +
    '<div style="font:15px/1.6 ' + F.sans + ';color:' + F.ink + '">' + text + '</div></td></tr></table>';
}

function angaben_(b) {
  const zeilen = [
    ['Praxis', b.praxis + ', ' + b.ort],
    ['Ansprechpartner', b.name],
    ['Telefon', b.telefon],
    ['Praxissoftware', b.software],
    ['Therapeuten', b.team],
    ['Ihr Anliegen', b.anliegen],
  ].filter(function (z) { return z[1]; });
  const tr = zeilen.map(function (z, i) {
    const linie = i < zeilen.length - 1 ? 'border-bottom:1px solid ' + F.linie + ';' : '';
    return '<tr><td width="38%" valign="top" style="width:38%;padding:9px 12px 9px 0;' + linie + 'font:13px/1.45 ' + F.sans + ';color:' + F.grau + '">' + z[0] + '</td>' +
      '<td valign="top" style="padding:9px 0;' + linie + 'font:14px/1.45 ' + F.sans + ';color:' + F.ink + '">' + e_(z[1]) + '</td></tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px">' + tr + '</table>';
}

function verwalten_(b) {
  const link = verwaltenLink_(b);
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;background:' + F.papier + ';border-radius:12px"><tr>' +
    '<td style="padding:16px 20px;font:14px/1.55 ' + F.sans + ';color:' + F.grau + '">Passt der Termin nicht mehr? ' +
    '<a href="' + e_(link) + '&amp;aktion=verschieben" style="color:' + F.kuli + ';font-weight:600;text-decoration:none">Termin verschieben</a>' +
    '&nbsp;&nbsp;·&nbsp;&nbsp;<a href="' + e_(link) + '&amp;aktion=absagen" style="color:' + F.kuli + ';font-weight:600;text-decoration:none">Termin absagen</a></td></tr></table>';
}

function signatur_() {
  const tel = K.telefon ? '<a href="tel:' + K.telefon.replace(/\s/g, '') + '" style="color:' + F.grau + ';text-decoration:none">' + e_(K.telefon) + '</a> · ' : '';
  const bild = K.foto
    ? '<img src="' + e_(K.foto) + '" width="52" height="52" alt="Mathis C. Müller" style="display:block;width:52px;height:52px;border-radius:26px;border:0">'
    : '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:52px;height:52px;border-radius:26px;background:' + F.kuliSoft + ';font:700 18px/52px ' + F.serif + ';color:' + F.kuli + '">MM</td></tr></table>';
  return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 0"><tr>' +
    '<td width="66" valign="top" style="width:66px">' + bild + '</td>' +
    '<td valign="top" style="font:15px/1.45 ' + F.sans + ';color:' + F.ink + '">Ich freue mich auf unser Gespräch.<br>' +
    '<b>Mathis C. Müller</b><br><span style="font-size:14px;color:' + F.grau + '">Gründer · EMKI Systems<br>KI-Telefonassistent für Physiotherapiepraxen<br>' + tel +
    '<a href="mailto:' + K.host + '" style="color:' + F.grau + ';text-decoration:none">' + K.host + '</a></span></td></tr></table>';
}

function ps_(html) {
  return '<p style="margin:22px 0 0;padding-top:18px;border-top:1px solid ' + F.linie + ';font:15px/1.6 ' + F.sans + ';color:' + F.ink + '"><b>P.S.</b> ' + html + '</p>';
}

function vertrauen_() {
  const p = function (t) {
    return '<span style="display:inline-block;margin:4px 18px 4px 0;white-space:nowrap"><span style="color:' + F.gruen + ';font-weight:700">&#10003;</span>&nbsp;' + t + '</span>';
  };
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;border-top:1px solid ' + F.linie + ';border-bottom:1px solid ' + F.linie + '"><tr>' +
    '<td style="padding:12px 0;font:13px/1.5 ' + F.sans + ';color:' + F.ink + '">' +
    p('Kostenlos und unverbindlich') + p('Datenschutz-Vertrag und Schweigepflicht') + p('Ihre Telefonnummer bleibt') +
    '</td></tr></table>';
}

function rahmen_(o) {
  const html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>' + e_(o.betreff) + '</title>' +
    '<style>@media (max-width:620px){.karte{padding:30px 22px 26px!important}.h1{font-size:25px!important}.kachel{width:84px!important}' +
    '.knoepfe{width:100%!important}.knopf{display:block!important;width:100%!important;padding:0 0 10px!important}.knopf table,.knopf a{width:100%!important;text-align:center!important;box-sizing:border-box}}</style></head>' +
    '<body style="margin:0;padding:0;background:' + F.papier + ';-webkit-text-size-adjust:100%">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + e_(o.vorschau) + '&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + F.papier + '"><tr><td align="center" style="padding:28px 12px 36px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">' +
    '<tr><td style="padding:0 6px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td><a href="' + K.site + '"><img src="' + F.logo + '" width="114" height="40" alt="EMKI Systems" style="display:block;border:0;width:114px;height:40px"></a></td>' +
    '<td align="right" style="font:600 11px/1 ' + F.sans + ';color:' + F.hell + ';letter-spacing:.14em;text-transform:uppercase">' + e_(o.etikett) + '</td>' +
    '</tr></table></td></tr>' +
    '<tr><td class="karte" style="background:#ffffff;border:1px solid ' + F.linie + ';border-top:4px solid ' + F.kuli + ';border-radius:16px;padding:40px 44px 34px">' +
    o.inhalt + '</td></tr>' +
    '<tr><td style="padding:22px 10px 0;font:12px/1.65 ' + F.sans + ';color:' + F.hell + ';text-align:center">' +
    'EMKI Systems – Mathis C. Müller · Im Johannesgarten 26 · 53809 Ruppichteroth<br>' +
    '<a href="' + K.site + '" style="color:' + F.hell + '">emki-systems.de</a> · ' +
    '<a href="' + K.site + '/impressum.html" style="color:' + F.hell + '">Impressum</a> · ' +
    '<a href="' + K.site + '/datenschutz.html#termin" style="color:' + F.hell + '">Datenschutz</a><br>' +
    (o.grund || 'Sie erhalten diese E-Mail, weil mit Ihrer Adresse auf emki-systems.de ein Termin gebucht wurde.') +
    '</td></tr></table></td></tr></table></body></html>';
  const text = o.text + '\n\n--\nMathis C. Müller · EMKI Systems\n' + (K.telefon ? K.telefon + ' · ' : '') + K.host + '\n' +
    'EMKI Systems – Mathis C. Müller · Im Johannesgarten 26 · 53809 Ruppichteroth\n' +
    'Impressum: ' + K.site + '/impressum.html · Datenschutz: ' + K.site + '/datenschutz.html\n';
  return { betreff: o.betreff, html: html, text: text, replyTo: o.replyTo };
}

function textTermin_(b) {
  const s = new Date(b.start), en = new Date(b.ende);
  const art = { telefon: 'Telefonat, ich rufe Sie unter ' + b.telefon + ' an', video: 'Videogespräch über Google Meet' + (b.meet ? ': ' + b.meet : ''), praxis: 'Besuch in Ihrer Praxis: ' + b.adresse + ', ' + b.ort }[b.typ];
  return '  ' + datumLang_(s) + '\n  ' + zeitText_(s) + ' – ' + zeitText_(en) + ' Uhr (30 Minuten)\n  ' + art + '\n  mit Mathis C. Müller, EMKI Systems';
}

function kalenderKnoepfe_(b) {
  const l = kalenderLinks_(b);
  const link = function (t, u) { return '<a href="' + e_(u) + '" style="color:' + F.kuli + ';font-weight:600;text-decoration:none">' + t + '</a>'; };
  const knopf = b.typ === 'video' && b.meet ? knopf_('Google Meet öffnen', b.meet) : knopf_('In Google Kalender eintragen', l.google);
  return knoepfe_([knopf]) +
    '<p style="margin:4px 0 0;font:14px/1.6 ' + F.sans + ';color:' + F.grau + '">' +
    (b.typ === 'video' && b.meet ? 'Zum Kalender hinzufügen: ' + link('Google', l.google) + '&nbsp;·&nbsp;' : 'Oder: ') +
    link('Outlook', l.outlook) + '&nbsp;·&nbsp;Apple und andere über die angehängte Datei <b>termin.ics</b></p>';
}

/* ------------------------------------------------------------------ */
/* Mails                                                               */
/* ------------------------------------------------------------------ */

function mailBestaetigung_(b, art, alt) {
  const s = new Date(b.start);
  const verschoben = art === 'verschoben';
  const betreff = (verschoben ? 'Verschoben: Kennenlerngespräch jetzt am ' : 'Bestätigt: Kennenlerngespräch am ') + datumMittel_(s) + ', ' + zeitText_(s) + ' Uhr';
  const intro = verschoben
    ? 'wie gewünscht habe ich unser Gespräch verlegt. Der bisherige Termin am ' + datumLang_(new Date(alt.start)) + ' um ' + zeitText_(new Date(alt.start)) + ' Uhr entfällt damit.'
    : 'vielen Dank für Ihre Buchung. Ich freue mich darauf, Sie und ' + e_(b.praxis) + ' kennenzulernen. Hier sind alle Details auf einen Blick.';
  const inhalt =
    pill_(verschoben ? 'Termin verschoben' : 'Termin bestätigt', verschoben ? 'info' : 'ok') +
    h1_(verschoben ? 'Ihr neuer Termin steht.' : 'Ihr Kennenlerngespräch steht.') +
    p_(e_(gruss_(b)) + ',') +
    p_(intro) +
    ticket_(b) +
    kalenderKnoepfe_(b) +
    h2_('So nutzen wir die 30 Minuten') +
    schritte_([
      ['Ihre Situation', 'Wann bei Ihnen Anrufe ins Leere gehen und wie viele es ungefähr sind.'],
      ['Live erleben', 'Sie hören den Assistenten am Telefon, so wie Ihre Patienten ihn erleben würden.'],
      ['Klarheit zu Aufwand und Kosten', 'Einrichtung, Datenschutz und Preis. Danach entscheiden Sie in Ruhe, ohne Verpflichtung.'],
    ]) +
    notiz_('Zur Vorbereitung', 'Eine grobe Schätzung reicht: Wie oft klingelt das Telefon an einem normalen Tag, wenn am Empfang niemand frei ist? ' +
      'Mehr brauchen Sie nicht, den Rest rechnen wir gemeinsam.') +
    h2_('Ihre Angaben') +
    angaben_(b) +
    klein_('Stimmt etwas nicht? Antworten Sie einfach auf diese E-Mail.') +
    verwalten_(b) +
    vertrauen_() +
    signatur_() +
    ps_('Wenn Sie vorher schon hineinhören möchten: In der <a href="' + K.site + '/#demo" style="color:' + F.kuli + ';font-weight:600;text-decoration:none">Live-Demo</a> ' +
      'sprechen Sie zwei Minuten mit dem Assistenten einer Musterpraxis, direkt im Browser.');
  const text = gruss_(b) + ',\n\n' + (verschoben ? intro : 'vielen Dank für Ihre Buchung. Ich freue mich darauf, Sie und ' + b.praxis + ' kennenzulernen.') + '\n\n' +
    (verschoben ? 'IHR NEUER TERMIN\n' : 'IHR TERMIN\n') + textTermin_(b) + '\n\n' +
    'In Google Kalender: ' + kalenderLinks_(b).google + '\nFür andere Kalender: angehängte Datei termin.ics öffnen.\n\n' +
    'SO NUTZEN WIR DIE 30 MINUTEN\n1. Ihre Situation: Wann bei Ihnen Anrufe ins Leere gehen.\n2. Live erleben: Sie hören den Assistenten am Telefon.\n3. Klarheit zu Aufwand und Kosten. Danach entscheiden Sie in Ruhe.\n\n' +
    'ZUR VORBEREITUNG\nEine grobe Schätzung reicht: Wie oft klingelt das Telefon an einem normalen Tag, wenn am Empfang niemand frei ist?\nLive-Demo vorab: ' + K.site + '/#demo\n\n' +
    'Termin verschieben oder absagen: ' + verwaltenLink_(b) + '\n\nIch freue mich auf unser Gespräch.\nMathis C. Müller\n\n' +
    'P.S. Vorab hineinhören: Live-Demo im Browser unter ' + K.site + '/#demo';
  return rahmen_({
    betreff: betreff, etikett: verschoben ? 'Terminänderung' : 'Terminbestätigung',
    vorschau: (verschoben ? 'Neuer Termin: ' : 'Ihr Termin mit Mathis C. Müller: ') + datumLang_(s) + ', ' + zeitText_(s) + ' Uhr. Alle Details und Kalendereintrag.',
    inhalt: inhalt, text: text,
  });
}

function mailErinnerung_(b) {
  const s = new Date(b.start);
  const aktion = b.typ === 'video' && b.meet ? knoepfe_([knopf_('Google Meet öffnen', b.meet)])
    : b.typ === 'telefon' ? p_('Ich rufe Sie pünktlich unter <b>' + e_(b.telefon) + '</b> an. Ist eine andere Nummer besser? Antworten Sie kurz auf diese Mail.')
    : p_('Ich komme zu Ihnen in die Praxis: <b>' + e_(b.adresse) + ', ' + e_(b.ort) + '</b>.');
  const inhalt =
    pill_('Erinnerung', 'info') +
    h1_('Morgen sprechen wir.') +
    p_(e_(gruss_(b)) + ',') +
    p_('kurz zur Erinnerung an unser Kennenlerngespräch:') +
    ticket_(b) + aktion +
    notiz_('Kleiner Tipp', 'Halten Sie eine grobe Zahl bereit: Wie viele Anrufe am Tag gehen bei Ihnen ungefähr ins Leere? Mehr Vorbereitung braucht es nicht.') +
    verwalten_(b) + signatur_() +
    ps_('Noch nicht reingehört? Die <a href="' + K.site + '/#demo" style="color:' + F.kuli + ';font-weight:600;text-decoration:none">Live-Demo</a> dauert zwei Minuten.');
  const text = gruss_(b) + ',\n\nkurz zur Erinnerung an unser Kennenlerngespräch:\n\n' + textTermin_(b) + '\n\n' +
    'Termin verschieben oder absagen: ' + verwaltenLink_(b) + '\n\nBis morgen!\nMathis C. Müller';
  return rahmen_({
    betreff: 'Erinnerung: morgen um ' + zeitText_(s) + ' Uhr unser Kennenlerngespräch', etikett: 'Erinnerung',
    vorschau: 'Morgen, ' + datumLang_(s) + ', ' + zeitText_(s) + ' Uhr. Alle Details in dieser Mail.', inhalt: inhalt, text: text,
  });
}

function mailAbsage_(b) {
  const s = new Date(b.start);
  const inhalt =
    pill_('Termin abgesagt', 'aus') +
    h1_('Ihr Termin ist abgesagt.') +
    p_(e_(gruss_(b)) + ',') +
    p_('Ihr Kennenlerngespräch ist wie gewünscht abgesagt. Mit der angehängten Datei verschwindet der Eintrag auch aus Ihrem Kalender.') +
    ticket_(b, true) +
    p_('Wenn Sie zu einem anderen Zeitpunkt sprechen möchten, wählen Sie einfach einen neuen Termin. Oder antworten Sie auf diese Mail, dann melde ich mich bei Ihnen.') +
    knoepfe_([knopf_('Neuen Termin wählen', K.seite)]) +
    signatur_().replace('Ich freue mich auf unser Gespräch.', 'Viele Grüße');
  const text = gruss_(b) + ',\n\nIhr Kennenlerngespräch am ' + datumLang_(s) + ' um ' + zeitText_(s) + ' Uhr ist wie gewünscht abgesagt.\n\n' +
    'Neuen Termin wählen: ' + K.seite + '\nOder antworten Sie auf diese Mail, dann melde ich mich.\n\nViele Grüße\nMathis C. Müller';
  return rahmen_({
    betreff: 'Abgesagt: Kennenlerngespräch am ' + datumMittel_(s) + ', ' + zeitText_(s) + ' Uhr', etikett: 'Terminabsage',
    vorschau: 'Ihr Termin am ' + datumLang_(s) + ' ist abgesagt. Ein neuer Termin ist jederzeit möglich.', inhalt: inhalt, text: text,
  });
}

function mailHost_(b, art, alt) {
  const s = new Date(b.start);
  const wann = datumMittel_(s) + ', ' + zeitText_(s) + ' Uhr';
  const kopf = { neu: 'Neue Buchung', verschoben: 'Verschoben', abgesagt: 'Abgesagt' }[art];
  const pill = { neu: ['Neue Buchung', 'ok'], verschoben: ['Verschoben', 'info'], abgesagt: ['Abgesagt', 'aus'] }[art];
  const t = teileBerlin_(s);
  const zeilen = [
    ['Wann', datumLang_(s) + ', ' + zeitText_(s) + ' Uhr' + (alt ? ' (vorher ' + datumMittel_(new Date(alt.start)) + ', ' + zeitText_(new Date(alt.start)) + ' Uhr)' : '')],
    ['Gesprächsart', TYPEN[b.typ].kurz + (b.meet ? ' · ' + b.meet : '')],
    ['Name', kontakt_(b)], ['Praxis', b.praxis + ', ' + b.ort], ['Adresse', b.adresse],
    ['Telefon', b.telefon], ['E-Mail', b.email], ['Therapeuten', b.team], ['Software', b.software],
    ['Anliegen', b.anliegen], ['Quelle', { brief: 'Brief / Flyer', flyer: 'Brief / Flyer', besuch: 'Kaltakquise vor Ort', demo: 'Demo-Anruf', empfehlung: 'Empfehlung', partner: 'Partner' }[b.quelle] || 'Website'],
  ].filter(function (z) { return z[1]; });
  const tabelle = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px">' + zeilen.map(function (z) {
    return '<tr><td width="30%" valign="top" style="width:30%;padding:8px 10px 8px 0;border-bottom:1px solid ' + F.linie + ';font:13px/1.45 ' + F.sans + ';color:' + F.grau + '">' + z[0] + '</td>' +
      '<td valign="top" style="padding:8px 0;border-bottom:1px solid ' + F.linie + ';font:14px/1.45 ' + F.sans + ';color:' + F.ink + '">' + e_(z[1]) + '</td></tr>';
  }).join('') + '</table>';
  const suche = 'https://www.google.com/search?q=' + encodeURIComponent(b.praxis + ' ' + b.ort);
  const inhalt = pill_(pill[0], pill[1]) +
    h1_(e_(b.praxis)) +
    p_(e_(b.name) + ' · ' + e_(b.ort)) + tabelle +
    knoepfe_([
      knopf_('Anrufen', 'tel:' + String(b.telefon).replace(/[^\d+]/g, '')),
      knopf_('Kalender', 'https://calendar.google.com/calendar/r/day/' + t.j + '/' + t.m + '/' + t.t, 'rand'),
      knopf_('CRM', 'https://docs.google.com/spreadsheets/d/' + K.crmId + '/edit', 'rand'),
    ]) +
    (art === 'abgesagt'
      ? notiz_('Nächster Schritt', 'In 2–3 Tagen kurz persönlich nachfassen, wenn die Praxis passt. Antworten auf diese Mail gehen direkt an ' + e_(b.email) + '.')
      : notiz_('Vorbereitung', 'Website der Praxis ansehen (<a href="' + suche + '" style="color:' + F.kuli + '">suchen</a>), Telefonzeiten und Software notieren, Live-Demo bereithalten. ' +
        'Im CRM ist der Kontakt schon eingetragen. Antworten auf diese Mail gehen direkt an ' + e_(b.email) + '.'));
  const text = kopf + ': ' + b.praxis + ' (' + b.ort + ')\n\n' + zeilen.map(function (z) { return z[0] + ': ' + z[1]; }).join('\n');
  return rahmen_({
    betreff: kopf + ': ' + b.praxis + ' (' + b.ort + ') – ' + wann + ' · ' + TYPEN[b.typ].crm,
    etikett: 'Intern', vorschau: b.name + ', ' + b.praxis + ' – ' + wann, inhalt: inhalt, text: text,
    grund: 'Interne Benachrichtigung der Terminbuchung.', replyTo: b.email,
  });
}
