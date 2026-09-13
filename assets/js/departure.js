const DATA_URL="../obus_2026_kosen.json";
const MAX_ROWS=5;
const REFRESH_MS=1000;

const DESTINATION_DISPLAY={
  taka:{
    primary:"東光高岳北行",
    secondary:"小山高専入口経由"
  },
  joto:{
    primary:"小山運動公園行",
    secondary:"高専正門経由"
  }
};

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

const clockRoot=document.querySelector("#clock");
const todayRoot=document.querySelector("#today");
const departuresRoot=document.querySelector("#departures");
const noticeRoot=document.querySelector("#notice-text");
const noticeCopy=document.querySelector("#notice-text-copy");
const noticeTrack=document.querySelector("#notice-track");
const revisionRoot=document.querySelector("#revision");
const debugPanel=document.querySelector("#debug-panel");
const debugDatetime=document.querySelector("#debug-datetime");
const debugApply=document.querySelector("#debug-apply");
const debugMinus=document.querySelector("#debug-minus");
const debugPlus=document.querySelector("#debug-plus");
const debugNow=document.querySelector("#debug-now");

const params=new URLSearchParams(window.location.search);
const debugEnabled=params.get("debug")==="1";
let debugNowParts=null;
let timetableData=null;
let sortedTrips=[];

main().catch(error=>{
  console.error(error);
  renderError("発車時刻を読み込めませんでした。再読み込みしてください。");
});

async function main(){
  timetableData=await loadData();
  if(!Array.isArray(timetableData.S2K)) throw new Error("Invalid timetable data");

  sortedTrips=timetableData.S2K
    .slice()
    .sort((a,b)=>toMinutes(a.display_time)-toMinutes(b.display_time));

  if(timetableData.effective_from){
    revisionRoot.textContent=formatRevision(timetableData.effective_from);
  }

  setupDebug();
  update();
  window.setInterval(update,REFRESH_MS);
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden) update();
  });
  window.addEventListener("resize",updateNoticeSpeed);
  updateNoticeSpeed();
}

async function loadData(){
  const controller=new AbortController();
  const timeout=window.setTimeout(()=>controller.abort(),8000);

  try{
    const response=await fetch(DATA_URL,{cache:"no-store",signal:controller.signal});
    if(!response.ok) throw new Error(String(response.status));
    return await response.json();
  }finally{
    window.clearTimeout(timeout);
  }
}

function update(){
  const now=getNowParts();
  renderClock(now);
  renderNotice(now);
  renderDepartures(now);
}

function getNowParts(){
  return debugNowParts ? {...debugNowParts} : getJstParts(new Date());
}

function setupDebug(){
  if(!debugEnabled) return;

  debugPanel.hidden=false;

  const requested=parseDebugValue(params.get("time"));
  debugNowParts=requested??getJstParts(new Date());
  debugDatetime.value=toDebugValue(debugNowParts);

  debugApply.addEventListener("click",()=>{
    const value=parseDebugValue(debugDatetime.value);
    if(!value) return;
    debugNowParts=value;
    syncDebugUrl();
    update();
  });

  debugMinus.addEventListener("click",()=>shiftDebugMinutes(-1));
  debugPlus.addEventListener("click",()=>shiftDebugMinutes(1));

  debugNow.addEventListener("click",()=>{
    debugNowParts=getJstParts(new Date());
    debugDatetime.value=toDebugValue(debugNowParts);
    syncDebugUrl();
    update();
  });
}

function shiftDebugMinutes(amount){
  if(!debugNowParts) return;
  const date=new Date(Date.UTC(
    debugNowParts.year,
    debugNowParts.month-1,
    debugNowParts.day,
    debugNowParts.hour,
    debugNowParts.minute+amount,
    debugNowParts.second??0
  ));
  debugNowParts={
    year:date.getUTCFullYear(),
    month:date.getUTCMonth()+1,
    day:date.getUTCDate(),
    hour:date.getUTCHours(),
    minute:date.getUTCMinutes(),
    second:date.getUTCSeconds()
  };
  debugDatetime.value=toDebugValue(debugNowParts);
  syncDebugUrl();
  update();
}

function parseDebugValue(value){
  if(!value) return null;
  const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if(!match) return null;

  const parts={
    year:Number(match[1]),
    month:Number(match[2]),
    day:Number(match[3]),
    hour:Number(match[4]),
    minute:Number(match[5]),
    second:Number(match[6]??0)
  };

  const check=new Date(Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second));
  if(
    check.getUTCFullYear()!==parts.year||
    check.getUTCMonth()+1!==parts.month||
    check.getUTCDate()!==parts.day||
    check.getUTCHours()!==parts.hour||
    check.getUTCMinutes()!==parts.minute
  ) return null;

  return parts;
}

function toDebugValue(parts){
  return [
    String(parts.year).padStart(4,"0"),
    "-",
    String(parts.month).padStart(2,"0"),
    "-",
    String(parts.day).padStart(2,"0"),
    "T",
    String(parts.hour).padStart(2,"0"),
    ":",
    String(parts.minute).padStart(2,"0")
  ].join("");
}

function syncDebugUrl(){
  if(!debugEnabled||!debugNowParts) return;
  const next=new URL(window.location.href);
  next.searchParams.set("debug","1");
  next.searchParams.set("time",toDebugValue(debugNowParts));
  window.history.replaceState(null,"",next);
}

function getJstParts(date){
  const formatter=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Tokyo",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    hour:"2-digit",
    minute:"2-digit",
    second:"2-digit",
    hourCycle:"h23"
  });

  const parts={};
  for(const part of formatter.formatToParts(date)){
    if(part.type!=="literal") parts[part.type]=part.value;
  }

  return {
    year:Number(parts.year),
    month:Number(parts.month),
    day:Number(parts.day),
    hour:Number(parts.hour),
    minute:Number(parts.minute),
    second:Number(parts.second)
  };
}

function addDays(base,offset){
  const date=new Date(Date.UTC(base.year,base.month-1,base.day+offset));
  return {
    year:date.getUTCFullYear(),
    month:date.getUTCMonth()+1,
    day:date.getUTCDate(),
    weekday:date.getUTCDay()
  };
}

function dateKey(date){
  return [
    String(date.year).padStart(4,"0"),
    String(date.month).padStart(2,"0"),
    String(date.day).padStart(2,"0")
  ].join("-");
}

function renderClock(now){
  const hh=String(now.hour).padStart(2,"0");
  const mm=String(now.minute).padStart(2,"0");
  const ss=String(now.second).padStart(2,"0");
  const currentDate=addDays(now,0);
  const weekday=["日","月","火","水","木","金","土"][currentDate.weekday];

  clockRoot.textContent=hh+":"+mm+":"+ss;
  clockRoot.dateTime=dateKey(currentDate)+"T"+hh+":"+mm+":"+ss+"+09:00";
  todayRoot.textContent=now.year+"/"+String(now.month).padStart(2,"0")+"/"+String(now.day).padStart(2,"0")+" ("+weekday+")";
}

function renderNotice(now){
  const current=dateKey(addDays(now,0));
  const effective=timetableData?.effective_from;
  const isPreview=Boolean(effective&&current<effective);

  const text=isPreview
    ?"プレビュー表示：この発車標は"+formatRevision(effective)+"の時刻表に基づきます。　Preview: This departure board is based on the timetable revised on "+formatRevisionEnglish(effective)+"."
    :"この発車標は時刻表上の発車時刻に基づく案内です。実際の運行位置や遅延は反映していません。　This departure board is based on scheduled departure times. Real-time vehicle locations and delays are not shown.";

  noticeTrack.classList.toggle("preview",isPreview);

  if(noticeRoot.textContent!==text){
    noticeRoot.textContent=text;
    noticeCopy.textContent=text;
    updateNoticeSpeed();
  }
}

function updateNoticeSpeed(){
  window.requestAnimationFrame(()=>{
    const copyWidth=noticeRoot.getBoundingClientRect().width;
    const styles=getComputedStyle(noticeTrack);
    const gap=parseFloat(styles.columnGap)||48;
    const pixelsPerSecond=42;
    const duration=Math.max(12,(copyWidth+gap)/pixelsPerSecond);
    noticeTrack.style.setProperty("--notice-duration",duration.toFixed(2)+"s");
  });
}

function renderDepartures(now){
  const upcoming=findUpcoming(now);

  if(!upcoming.length){
    renderError("案内できる便がありません。");
    return;
  }

  const fragment=document.createDocumentFragment();
  for(const item of upcoming){
    fragment.append(createDepartureRow(item,now));
  }
  departuresRoot.replaceChildren(fragment);
}

function findUpcoming(now){
  const results=[];
  const currentMinutes=now.hour*60+now.minute;

  for(let offset=0;offset<14&&results.length<MAX_ROWS;offset++){
    const serviceDate=addDays(now,offset);

    for(const trip of sortedTrips){
      if(!runsOnDate(trip,serviceDate)) continue;

      const departureMinutes=toMinutes(trip.display_time);
      if(offset===0&&departureMinutes<currentMinutes) continue;

      results.push({
        trip,
        serviceDate,
        dayOffset:offset,
        departureMinutes
      });

      if(results.length>=MAX_ROWS) break;
    }
  }

  return results;
}

function runsOnDate(trip,date){
  const calendar=timetableData.calendars?.[trip.calendar_id];
  if(!calendar) return true;

  const weekday=date.weekday===0?7:date.weekday;
  if(Array.isArray(calendar.weekdays)&&!calendar.weekdays.includes(weekday)) return false;

  const monthDay=String(date.month).padStart(2,"0")+"-"+String(date.day).padStart(2,"0");
  if(Array.isArray(calendar.excluded_month_days)&&calendar.excluded_month_days.includes(monthDay)) return false;

  if(calendar.public_holidays===false&&HOLIDAYS.has(dateKey(date))) return false;

  return true;
}

function createDepartureRow(item,now){
  const {trip,serviceDate,dayOffset,departureMinutes}=item;
  const route=timetableData.routes?.[trip.route_id]??{};
  const stop=timetableData.stops?.[trip.college_stop_id]??{};

  const row=document.createElement("article");
  row.className="departure-row";
  row.setAttribute("aria-label",[
    route.name??trip.route_id,
    stop.name??trip.college_stop_id,
    trip.display_time
  ].join("、"));

  const routeCell=document.createElement("div");
  routeCell.className="departure-cell route-cell";

  const badge=document.createElement("div");
  badge.className="route-badge";
  badge.dataset.route=trip.route_id;

  const number=document.createElement("span");
  number.className="route-number";
  number.textContent=route.number??"";

  const name=document.createElement("span");
  name.className="route-name";
  name.textContent=route.name??trip.route_id;

  badge.append(number,name);
  routeCell.append(badge);

  const destination=getDestinationDisplay(trip,stop);

  const stopCell=document.createElement("div");
  stopCell.className="departure-cell stop-cell";

  const stopName=document.createElement("span");
  stopName.className="stop-name";
  stopName.textContent=destination.primary;
  stopCell.append(stopName);

  if(destination.secondary){
    const stopNote=document.createElement("span");
    stopNote.className="stop-note";
    stopNote.textContent=destination.secondary;
    stopCell.append(stopNote);
  }

  const timeCell=document.createElement("div");
  timeCell.className="departure-cell time-cell";

  if(dayOffset>0){
    const dayMark=document.createElement("span");
    dayMark.className="next-day-mark";
    dayMark.textContent=dayOffset===1?"明日":serviceDate.month+"/"+serviceDate.day;
    timeCell.append(dayMark);
  }

  const time=document.createElement("time");
  time.dateTime=dateKey(serviceDate)+"T"+trip.display_time+":00+09:00";
  time.textContent=trip.display_time;
  timeCell.append(time);

  row.append(routeCell,stopCell,timeCell);
  return row;
}

function getDestinationDisplay(trip,stop){
  if(trip.route_id==="kuwa"){
    const direction=trip.loop_direction==="right"?"右回り":"左回り";
    return {
      primary:direction,
      secondary:"高専正門経由"
    };
  }

  return DESTINATION_DISPLAY[trip.route_id]??{
    primary:stop.name??trip.college_stop_id,
    secondary:""
  };
}

function toMinutes(value){
  const [hour,minute]=String(value).split(":").map(Number);
  return hour*60+minute;
}

function formatRevision(value){
  const [year,month,day]=String(value).split("-").map(Number);
  return year+"年"+month+"月"+day+"日改正";
}

function formatRevisionEnglish(value){
  const [year,month,day]=String(value).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Tokyo",
    year:"numeric",
    month:"long",
    day:"numeric"
  }).format(new Date(Date.UTC(year,month-1,day)));
}

function renderError(message){
  const paragraph=document.createElement("div");
  paragraph.className="empty-message";
  paragraph.textContent=message;
  departuresRoot.replaceChildren(paragraph);
}
