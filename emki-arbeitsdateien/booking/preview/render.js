const fs=require('fs');
global.Utilities={
  formatDate(d,tz,pat){
    const o=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',weekday:'short',hour12:false}).formatToParts(d);
    const g=k=>o.find(x=>x.type===k).value;
    const wd={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[g('weekday')];
    let s=pat.replace(/'([^']*)'/g,(m,a)=>'\u0001'+a+'\u0002');
    s=s.replace('yyyy',g('year')).replace('MM',g('month')).replace('dd',g('day')).replace('HH',g('hour')==='24'?'00':g('hour')).replace('mm',g('minute')).replace('ss',g('second')).replace(/\bu\b/,String(wd));
    return s.replace(/\u0001([^\u0002]*)\u0002/g,'$1');
  },
  newBlob(t){return{getBytes:()=>Buffer.from(t),t}},
  getUuid(){return require('crypto').randomUUID()}
};
let src=fs.readFileSync('Code.gs','utf8')+'\n'+fs.readFileSync('Mails.gs','utf8');
src=src.replace(/^const /gm,'var ');
eval(src);
const base={id:'a1b2c3d4e5f6',token:'tok',status:'bestätigt',start:'2026-10-14T08:00:00.000Z',ende:'2026-10-14T08:30:00.000Z',anrede:'Frau',name:'Dr. Anja Steenken',praxis:'Physio Dynamik',ort:'Königswinter',adresse:'',email:'anja@example.de',telefon:'02244 8766100',team:'3–5',software:'THEORG',anliegen:'Telefon während der Behandlungen und Anrufe nach Feierabend',quelle:'brief',meet:'https://meet.google.com/abc-defg-hij',sequenz:0};
const out={
  '1_bestaetigung_video':mailBestaetigung_(Object.assign({},base,{typ:'video'}),'neu'),
  '2_bestaetigung_praxis':mailBestaetigung_(Object.assign({},base,{typ:'praxis',adresse:'Siebengebirgsstr. 70',meet:''}),'neu'),
  '3_verschoben_telefon':mailBestaetigung_(Object.assign({},base,{typ:'telefon',meet:'',start:'2026-10-15T09:00:00.000Z',ende:'2026-10-15T09:30:00.000Z'}),'verschoben',base),
  '4_erinnerung_video':mailErinnerung_(Object.assign({},base,{typ:'video'})),
  '5_absage':mailAbsage_(Object.assign({},base,{typ:'video'})),
  '6_intern':mailHost_(Object.assign({},base,{typ:'video'}),'neu'),
};
for(const [k,m] of Object.entries(out)){
  fs.writeFileSync('preview/'+k+'.html',m.html.replace('https://emki-systems.de/emki-mail-logo.png','emki-mail-logo.png'));
  fs.writeFileSync('preview/'+k+'.txt',m.betreff+'\n\n'+m.text);
  console.log(k,'|',m.betreff,'|',Buffer.byteLength(m.html),'bytes');
}
const ics=icsBlob_(Object.assign({},base,{typ:'video'}),'PUBLISH');
console.log(ics.t||'');
