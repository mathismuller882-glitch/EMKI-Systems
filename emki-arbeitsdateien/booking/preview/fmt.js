module.exports=function(d,tz,pat){
  const o=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',weekday:'short',hour12:false}).formatToParts(d);
  const g=k=>o.find(x=>x.type===k).value; const wd={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[g('weekday')];
  let s=pat.replace(/'([^']*)'/g,(m,a)=>'\u0001'+a+'\u0002');
  s=s.replace('yyyy',g('year')).replace('MM',g('month')).replace('dd',g('day')).replace('HH',g('hour')==='24'?'00':g('hour')).replace('mm',g('minute')).replace('ss',g('second')).replace(/\bu\b/,String(wd));
  return s.replace(/\u0001([^\u0002]*)\u0002/g,'$1');
};
