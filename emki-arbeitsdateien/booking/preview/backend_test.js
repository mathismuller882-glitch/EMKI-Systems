const fs=require('fs'); const crypto=require('crypto');
const fmtMock=require('./fmt.js');
global.Utilities={formatDate:fmtMock, newBlob:(t,type,name)=>({getBytes:()=>Buffer.from(t),t,type,name}), getUuid:()=>crypto.randomUUID()};
global.Session={getScriptTimeZone:()=> 'Europe/Berlin'};
global.Logger={log:(...a)=>console.log('LOG',...a)};
// Kalender
let evs=[]; let n=0;
function mkEv(title,s,e,opt={}){const ev={id:'ev'+(++n)+'@google.com',title,s:new Date(s),e:new Date(e),allDay:false,transp:opt.transp||'OPAQUE',
 getId(){return this.id},getTitle(){return this.title},getStartTime(){return this.s},getEndTime(){return this.e},isAllDayEvent(){return this.allDay},
 getTransparency(){return this.transp},getMyStatus(){return 'OWNER'},removeAllReminders(){},addPopupReminder(){},setColor(){},
 setTime(a,b){this.s=a;this.e=b},setDescription(d){this.d=d},deleteEvent(){evs=evs.filter(x=>x!==this)}};evs.push(ev);return ev;}
const cal={getName:()=> 'Mathis',getEvents:(a,b)=>evs.filter(x=>x.e>a&&x.s<b),createEvent:(t,s,e,o)=>mkEv(t,s,e,o),getEventById:id=>evs.find(x=>x.id===id)||null};
global.CalendarApp={getDefaultCalendar:()=>cal,EventColor:{GRAY:'8'}};
global.Calendar={Events:{insert:(r)=>{const ev=mkEv(r.summary,r.start.dateTime,r.end.dateTime);return{id:ev.id.replace('@google.com',''),hangoutLink:'https://meet.google.com/xyz-abcd-efg'}}}};
// Tabellen
function mkSheet(rows){return{rows,getLastRow(){return this.rows.length},getRange(r,c,nr,nc){const sh=this;nr=nr||1;nc=nc||1;return{
 getValues(){return sh.rows.slice(r-1,r-1+nr).map(x=>{const y=x.slice(c-1,c-1+nc);while(y.length<nc)y.push('');return y})},
 getDisplayValues(){return this.getValues().map(x=>x.map(v=>v===undefined?'':String(v)))},
 setValues(v){v.forEach((row,i)=>{while(sh.rows.length<r+i)sh.rows.push([]);row.forEach((val,j)=>{sh.rows[r-1+i][c-1+j]=val})});return this},
 setValue(v){while(sh.rows.length<r)sh.rows.push([]);sh.rows[r-1][c-1]=v;return this},setNumberFormat(){return this},setFontWeight(){return this}}},
 deleteRow(r){this.rows.splice(r-1,1)},appendRow(a){this.rows.push(a)},getDataRange(){const sh=this;return{getValues(){return sh.rows.map(x=>x.slice())}}}}}
const SPALTEN_K=['id','token','status','typ','start','ende','name','praxis','ort','adresse','email','telefon','team','software','anliegen','quelle','eventId','fahrIds','meet','erstellt','geaendert','erinnert','sequenz'];
const buch=mkSheet([SPALTEN_K]);
const crmKopf=["Praxis / Betrieb","Status","Priorität","Gebiet","Ort","Branche","Ansprechpartner","Telefon","E-Mail","Verantwortlich","Nächster Schritt","Nächster Kontakt","Quelle","Einwilligung","Einwilligung Nachweis (Datum, wer, wie)","Praxissoftware","Wettbewerber","Wert pro Monat (€)","Verlustgrund","Zuletzt geändert","Notizen"];
const crm=mkSheet([crmKopf,["Physio Dynamik","Neu","A","Bonn / Siebengebirge","Königswinter","Physiotherapie","Anja Steenken","02244 8766100","","Mathis","Besuch","13.10.2026","Kaltakquise vor Ort","Keine","","","","","","","Alt-Notiz"]]);
global.SpreadsheetApp={openById:id=>({getName:()=> 'x',getSheetByName:name=>id==='BUCH'?buch:crm})};
global.PropertiesService={getScriptProperties:()=>({getProperty:k=>k==='BUCHUNGEN_ID'?'BUCH':null,setProperty(){}})};
global.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
const mails=[]; global.MailApp={sendEmail:(to,s,t,o)=>mails.push({to,s,att:(o.attachments||[]).map(a=>a.name),replyTo:o.replyTo,name:o.name})};
global.ContentService={createTextOutput:s=>({s,setMimeType(){return JSON.parse(s)}}),MimeType:{JSON:'json'}};
let src=fs.readFileSync('Code.gs','utf8')+'\n'+fs.readFileSync('Mails.gs','utf8'); src=src.replace(/^const /gm,'var '); eval(src);

// feste "Jetzt"-Zeit: Mo 5.10.2026 21:00
const REAL=Date; const JETZT=new REAL('2026-10-05T19:00:00Z').getTime();
global.Date=class extends REAL{constructor(...a){if(a.length===0)super(JETZT);else super(...a)} static now(){return JETZT}};
// belegte Termine: Mi 7.10. 10:00-11:00, ganztägig transparent Do
mkEv('Uni',new Date('2026-10-07T08:00:00Z'),new Date('2026-10-07T09:00:00Z'));
const t=mkEv('Geburtstag',new Date('2026-10-08T00:00:00+02:00'),new Date('2026-10-09T00:00:00+02:00'),{transp:'TRANSPARENT'}); t.allDay=true; t.getAllDayStartDate=()=>t.s; t.getAllDayEndDate=()=>t.e;

const s1=doGet({parameter:{a:'slots',typ:'video'}});
console.log('slots ok',s1.ok,'tage',s1.tage.length,'erster',s1.tage[0].datum,s1.tage[0].slots.join(' '));
const mi=s1.tage.find(x=>x.datum==='2026-10-07'); console.log('Mi 7.10 video:',mi&&mi.slots.join(' '));
const s2=doGet({parameter:{a:'slots',typ:'praxis'}}); const mi2=s2.tage.find(x=>x.datum==='2026-10-07'); console.log('Mi 7.10 praxis:',mi2&&mi2.slots.join(' '));
console.log('Tage enthalten Sa/So/Feiertag?', s1.tage.some(x=>[0,6].includes(new REAL(x.datum+'T12:00:00').getDay())));
const body={a:'buchen',typ:'video',datum:'2026-10-07',zeit:'11:30',anrede:'Frau',name:'Dr. Anja Steenken',praxis:'Physio Dynamik',ort:'Königswinter',email:'Anja@Example.de',telefon:'02244 8766100',team:'3–5',software:'THEORG',anliegen:'Test',quelle:'brief',ts:JETZT-10000,hp:''};
const r1=doPost({postData:{contents:JSON.stringify(body)}}); console.log('buchen',r1.ok,r1.fehler||'',r1.buchung&&r1.buchung.meet);
const r2=doPost({postData:{contents:JSON.stringify(body)}}); console.log('doppelt',r2.ok,r2.vergeben,r2.fehler);
const r3=doPost({postData:{contents:JSON.stringify(Object.assign({},body,{zeit:'11:45'}))}}); console.log('ungueltige zeit',r3.ok,r3.fehler);
const r4=doPost({postData:{contents:JSON.stringify(Object.assign({},body,{datum:'2026-10-05',zeit:'15:00'}))}}); console.log('zu kurzfristig',r4.ok,r4.fehler);
const b=buchungen_()[0];
const s3=doGet({parameter:{a:'slots',typ:'video',b:b.id,t:b.token}}); console.log('slots verschieben Mi enthalten 11:30?', s3.tage.find(x=>x.datum==='2026-10-07').slots.includes('11:30'));
const r5=doPost({postData:{contents:JSON.stringify({a:'verschieben',id:b.id,t:b.token,datum:'2026-10-09',zeit:'14:00'})}}); console.log('verschieben',r5.ok,r5.fehler||'',r5.buchung&&r5.buchung.start);
const r6=doPost({postData:{contents:JSON.stringify({a:'absagen',id:b.id,t:'falsch'})}}); console.log('absagen falscher token',r6.ok,r6.fehler);
// Praxisbesuch buchen
const r7=doPost({postData:{contents:JSON.stringify(Object.assign({},body,{typ:'praxis',datum:'2026-10-12',zeit:'10:00',email:'neu@praxis.de',praxis:'Neue Praxis',ort:'Hennef',adresse:'Markt 1',quelle:''}))}}); console.log('praxis buchen',r7.ok,r7.fehler||'','Kalendereinträge',evs.length);
const r8=doPost({postData:{contents:JSON.stringify({a:'absagen',id:b.id,t:b.token})}}); console.log('absagen',r8.ok,r8.buchung.status);
console.log('Mails:'); mails.forEach(m=>console.log('  ',m.to,'|',m.s,'|',m.att.join(','),'| replyTo',m.replyTo));
console.log('CRM:'); crm.rows.forEach(r=>console.log('  ',r.slice(0,2).join(' | '),'|',r[8],'|',r[10],'|',r[11],'|',r[12],'|',String(r[20]).replace(/\n/g,' // ')));
console.log('Buchungen:'); buch.rows.slice(1).forEach(r=>console.log('  ',r[0],r[2],r[3],r[4],r[10],'event',r[16],'fahr',r[17]));
// Erinnerung: Zeit auf 20h vor der Praxis-Buchung setzen
const pb=buchungen_().find(x=>x.typ==='praxis');
const vorher=new REAL(new REAL(pb.start).getTime()-20*3600000).getTime();
global.Date=class extends REAL{constructor(...a){if(a.length===0)super(vorher);else super(...a)} static now(){return vorher}};
const anz=mails.length; stuendlich(); console.log('Erinnerung gesendet:', mails.length-anz, mails.slice(anz).map(m=>m.s).join(' / '));
stuendlich(); console.log('keine doppelte Erinnerung:', mails.length-anz===1);
