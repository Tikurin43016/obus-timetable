"use strict";
(()=>{
const DATA_REVALIDATE_MS=5*60*1000;
const HOLIDAYS=new Set([
  "2026-01-01","2026-01-12","2026-02-11","2026-02-23","2026-03-20",
  "2026-04-29","2026-05-03","2026-05-04","2026-05-05","2026-05-06",
  "2026-07-20","2026-08-11","2026-09-21","2026-09-22","2026-09-23",
  "2026-10-12","2026-11-03","2026-11-23",
  "2027-01-01","2027-01-11","2027-02-11","2027-02-23","2027-03-21",
  "2027-03-22","2027-04-29","2027-05-03","2027-05-04","2027-05-05",
  "2027-07-19","2027-08-11","2027-09-20","2027-09-23","2027-10-11",
  "2027-11-03","2027-11-23"
]);

const params=new URLSearchParams(location.search);
const roots={
  heading:document.querySelector('#heading'),clock:document.querySelector('#clock'),
  day:document.querySelector('#day-label'),next:document.querySelector('#next-trip'),
  following:document.querySelector('#following-trips'),switch:document.querySelector('#switch-direction'),
  walk:document.querySelector('#walk-note'),full:document.querySelector('#full-timetable')
};
let savedDirection;
try{savedDirection=localStorage.getItem('obus-watch-direction');}catch{}
let direction=(params.get('direction')??savedDirection)==='K2S'?'K2S':'S2K';
let data=null,timer=null,lastRender='';
let lastDataRequestAt=0,dataRequestInFlight=null;
const formatter=new Intl.DateTimeFormat('en-US',{
  timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});

function dateKey(date){return [date.year,String(date.month).padStart(2,'0'),String(date.day).padStart(2,'0')].join('-');}
function addDays(now,offset){
  const date=new Date(Date.UTC(now.year,now.month-1,now.day+offset));
  return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate(),weekday:date.getUTCDay()};
}
function getNow(){
  const now={};
  for(const part of formatter.formatToParts(new Date())){if(part.type!=='literal')now[part.type]=Number(part.value);}
  return now;
}
function minutes(time){const [h,m]=time.split(':').map(Number);return h*60+m;}
function runsOnDate(trip,date){
  const calendar=data.calendars[trip.calendar_id];
  if(!calendar)return false;
  if(!calendar.weekdays.includes(date.weekday===0?7:date.weekday))return false;
  if(calendar.excluded_month_days.includes(dateKey(date).slice(5)))return false;
  return calendar.public_holidays!==false||!HOLIDAYS.has(dateKey(date));
}
function upcoming(now){
  const results=[];
  for(let offset=0;offset<14&&results.length<3;offset++){
    const date=addDays(now,offset);
    if(dateKey(date)<data.effective_from)continue;
    for(const trip of data[direction]){
      if(!runsOnDate(trip,date)||(offset===0&&minutes(trip.display_time)<now.hour*60+now.minute))continue;
      results.push({trip,date,offset});
      if(results.length===3)break;
    }
  }
  return results;
}
function element(tag,className,text){const node=document.createElement(tag);node.className=className;node.textContent=text;return node;}
function tripCard(item,now,compact=false){
  const {trip,date,offset}=item;
  const route=data.routes[trip.route_id],stop=data.stops[trip.college_stop_id];
  const card=element('article',compact?'trip following-trip':'trip','');
  card.dataset.route=trip.route_id;
  const routeLabel=element('p','route-label',route.number+' '+route.name);
  const label=direction==='K2S'?'正門出発目安':'駅発';
  const time=element('time','departure-time',trip.display_time);
  time.dateTime=dateKey(date)+'T'+trip.display_time+':00+09:00';
  const remaining=minutes(trip.display_time)-now.hour*60-now.minute;
  const action=direction==='K2S'?'出発':'発車';
  const countdown=offset>0?(offset===1?'明日':date.month+'/'+date.day):remaining===0?'まもなく'+action:'あと'+remaining+'分で'+action;
  card.append(routeLabel,element('p','time-label',label),time,element('p','countdown',countdown));
  if(direction==='K2S'){
    const boarding=trip.stop_calls.find(call=>call.stop_id===trip.college_stop_id);
    card.append(element('p','boarding',stop.name));
    card.append(element('p','boarding-detail','バス '+boarding.time+'／徒歩'+trip.walk_minutes+'分'));
  }else{
    card.append(element('p','boarding',stop.name+'経由'));
  }
  return card;
}
function syncDirection(){
  roots.heading.textContent=direction==='K2S'?'小山駅方面':'高専方面';
  roots.heading.setAttribute('aria-label',direction==='K2S'?'高専正門から小山駅方面':'小山駅東口から高専方面');
  roots.switch.textContent=direction==='K2S'?'高専方面に切替':'駅方面に切替';
  roots.walk.hidden=direction!=='K2S';
  roots.full.href='../obus_2026_kosen_'+direction.toLowerCase()+'.html';
  document.title=(direction==='K2S'?'駅方面':'高専方面')+'｜時計用 おーバス';
}
function update(){
  const now=getNow(),key=direction+dateKey(now)+now.hour+':'+now.minute;
  const time=String(now.hour).padStart(2,'0')+':'+String(now.minute).padStart(2,'0');
  roots.clock.textContent=time;
  roots.clock.dateTime=dateKey(now)+'T'+time+':00+09:00';
  roots.day.textContent=now.month+'/'+now.day+'('+['日','月','火','水','木','金','土'][addDays(now,0).weekday]+')';
  if(!data||key===lastRender)return;
  lastRender=key;
  const trips=upcoming(now);
  roots.next.replaceChildren(trips.length?tripCard(trips[0],now):element('p','message','運行する便がありません'));
  roots.following.replaceChildren(...trips.slice(1).map(item=>tripCard(item,now,true)));
}
function startTimer(){
  clearInterval(timer);
  update();
  if(!document.hidden)timer=setInterval(update,15000);
}
async function loadData({silent=false}={}){
  if(dataRequestInFlight) return dataRequestInFlight;
  lastDataRequestAt=Date.now();

  const request=(async()=>{
    if(!silent)roots.next.replaceChildren(element('p','message','時刻を読み込み中…'));
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch('../obus_2026_kosen.json',{signal:controller.signal,cache:'no-cache'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const loaded=await response.json();
      if(!Array.isArray(loaded.S2K)||!Array.isArray(loaded.K2S)||!loaded.calendars||!loaded.routes||!loaded.stops)throw Error('Invalid timetable');
      for(const key of ['S2K','K2S'])loaded[key].sort((a,b)=>minutes(a.display_time)-minutes(b.display_time));
      data=loaded;lastRender='';
      document.querySelector('#revision').textContent=data.effective_from.replace(/^(\d+)-(\d+)-(\d+)$/,(_,y,m,d)=>y+'年'+Number(m)+'月'+Number(d)+'日改正');
      startTimer();
    }catch(error){
      console.error(error);
      if(!data){
        const retry=element('button','','再読み込み');retry.type='button';retry.addEventListener('click',()=>loadData());
        roots.next.replaceChildren(element('p','message','時刻を読み込めませんでした'),retry);
      }
    }finally{clearTimeout(timeout);}
  })();

  dataRequestInFlight=request;
  try{
    await request;
  }finally{
    dataRequestInFlight=null;
  }
}
function onResume(){
  startTimer();
  if(!document.hidden&&Date.now()-lastDataRequestAt>=DATA_REVALIDATE_MS){
    loadData({silent:Boolean(data)});
  }
}
roots.switch.addEventListener('click',()=>{
  direction=direction==='S2K'?'K2S':'S2K';
  try{localStorage.setItem('obus-watch-direction',direction);}catch{}
  const url=new URL(location.href);url.searchParams.set('direction',direction);history.replaceState(null,'',url);
  syncDirection();update();
});
document.addEventListener('visibilitychange',onResume);
window.addEventListener('pageshow',onResume);
syncDirection();startTimer();loadData();
})();
