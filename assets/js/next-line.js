const line=document.querySelector("#next-line");
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

if(line){
  showNext().catch(()=>{});
}

async function showNext(){
  const response=await fetch("./obus_2026_kosen.json",{cache:"no-store"});
  if(!response.ok) return;
  const data=await response.json();
  const now=tokyoNow();
  const trip=(data.S2K??[])
    .filter(item=>runs(item,now,data.calendars))
    .filter(item=>toMin(item.display_time)>=now.minutes)
    .sort((a,b)=>toMin(a.display_time)-toMin(b.display_time))[0];
  if(!trip) return;

  const route=data.routes?.[trip.route_id]?.name??"";
  const anchor=document.createElement("a");
  anchor.href="./departure/";
  anchor.textContent=`次 ${trip.display_time} ${route}`;
  line.replaceChildren(anchor);
  line.hidden=false;
}

function tokyoNow(){
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Tokyo",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    weekday:"short",
    hour:"2-digit",
    minute:"2-digit",
    hourCycle:"h23"
  }).formatToParts(new Date());
  const get=type=>parts.find(part=>part.type===type)?.value;
  const weekdays={Sun:7,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const year=get("year");
  const month=get("month");
  const day=get("day");
  return {
    key:`${year}-${month}-${day}`,
    monthDay:`${month}-${day}`,
    weekday:weekdays[get("weekday")]??1,
    minutes:Number(get("hour"))*60+Number(get("minute"))
  };
}

function runs(trip,date,calendars){
  const calendar=calendars?.[trip.calendar_id];
  if(!calendar) return true;
  if(Array.isArray(calendar.weekdays)&&!calendar.weekdays.includes(date.weekday)) return false;
  if(Array.isArray(calendar.excluded_month_days)&&calendar.excluded_month_days.includes(date.monthDay)) return false;
  if(calendar.public_holidays===false&&HOLIDAYS.has(date.key)) return false;
  return true;
}

function toMin(value){
  const [hour,minute]=String(value).split(":").map(Number);
  return hour*60+minute;
}
