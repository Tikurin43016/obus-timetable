const DATA_URL="./obus_2026_kosen.json";
const DIRECTION_CONFIG={
  S2K:{stopLabels:{gate:"正門",entrance:"入口",nakakuki2:"中二"}},
  K2S:{stopLabels:{gate:"正門",entrance:"入口",nakakuki2:"中二"}}
};
const CALENDAR_MARKS={daily:"",joto_weekday:"※",kuwa_mon_fri:"◆"};
const CALENDAR_DESCRIPTIONS={
  joto_weekday:"※ 平日のみ",
  kuwa_mon_fri:"◆ 月～金運行（土・日・12/29～1/3は運休）"
};
const timetableRoot=document.querySelector("#timetable");
const legendRoot=document.querySelector("#legend");
const direction=document.body.dataset.direction;

main().catch(error=>{
  console.error(error);
  renderError("時刻表を読み込めませんでした。しばらくしてから再読み込みしてください。");
});

async function main(){
  if(!DIRECTION_CONFIG[direction]) throw new Error("Unknown direction");
  const data=await loadData();
  if(!Array.isArray(data.S2K)||!Array.isArray(data.K2S)) throw new Error("Invalid timetable data");
  const trips=data[direction].slice().sort((a,b)=>toMin(a.display_time)-toMin(b.display_time));
  renderTimetable(data,trips);
  renderLegend(data,trips);
}

async function loadData(){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(DATA_URL,{cache:"no-store",signal:controller.signal});
    if(!response.ok) throw new Error(String(response.status));
    return await response.json();
  }finally{
    clearTimeout(timeout);
  }
}

function toMin(value){
  const [hour,minute]=String(value).split(":").map(Number);
  return hour*60+minute;
}

function renderTimetable(data,trips){
  const fragment=document.createDocumentFragment();
  const groups=new Map();

  for(const trip of trips){
    const hour=Number(trip.display_time.split(":")[0]);
    if(!groups.has(hour)) groups.set(hour,[]);
    groups.get(hour).push(trip);
  }

  for(const [hour,list] of groups){
    const row=document.createElement("div");
    row.className="hour-row";

    const hourCell=document.createElement("div");
    hourCell.className="hour";
    hourCell.textContent=hour;
    hourCell.setAttribute("aria-hidden","true");

    const tripList=document.createElement("div");
    tripList.className="trips";
    tripList.setAttribute("role","list");
    tripList.setAttribute("aria-label",hour+"時台");

    for(const trip of list) tripList.append(createTrip(data,trip));
    row.append(hourCell,tripList);
    fragment.append(row);
  }

  timetableRoot.replaceChildren(fragment);
}

function createTrip(data,trip){
  const stop=data.stops[trip.college_stop_id];
  const label=DIRECTION_CONFIG[direction].stopLabels[trip.college_stop_id]??stop?.name??trip.college_stop_id;
  const [,minute]=trip.display_time.split(":");
  const mark=CALENDAR_MARKS[trip.calendar_id]??"";

  const item=document.createElement("div");
  item.className="trip";
  item.dataset.route=trip.route_id;
  item.dataset.stop=trip.college_stop_id;
  item.setAttribute("role","listitem");
  item.setAttribute(
    "aria-label",
    [trip.display_time,stop?.name??trip.college_stop_id,CALENDAR_DESCRIPTIONS[trip.calendar_id]??""]
      .filter(Boolean)
      .join("、")
  );

  const destination=document.createElement("span");
  destination.className="trip-stop";
  destination.textContent=label;

  const time=document.createElement("span");
  time.className="trip-time";
  time.textContent=minute;

  if(mark){
    const sup=document.createElement("sup");
    sup.textContent=mark;
    time.append(sup);
  }

  item.append(destination,time);
  return item;
}

function renderLegend(data,trips){
  const stopIds=[...new Set(trips.map(trip=>trip.college_stop_id))];
  const calendarIds=[...new Set(trips.map(trip=>trip.calendar_id))]
    .filter(id=>CALENDAR_DESCRIPTIONS[id]);

  const rows=[
    legendRow(
      "停留所",
      stopIds.map(id=>legendItem((DIRECTION_CONFIG[direction].stopLabels[id]??id)+" ＝ "+(data.stops[id]?.name??id)))
    )
  ];

  if(calendarIds.length){
    rows.push(
      legendRow(
        "運行日",
        calendarIds.map(id=>legendItem(CALENDAR_DESCRIPTIONS[id]))
      )
    );
  }

  const note=legendRow(
    "時刻の見方",
    [legendItem(
      direction==="K2S"
        ?"表示時刻は高専正門を基準に、各乗車停留所までの徒歩時間を差し引いた出発目安です。"
        :"高専側の発着停留所は、各時刻の上に表示しています。"
    )]
  );
  note.classList.add("legend-wide");
  rows.push(note);

  legendRoot.replaceChildren(...rows);
}

function legendRow(title,items){
  const row=document.createElement("div");
  row.className="legend-row";

  const heading=document.createElement("span");
  heading.className="legend-title";
  heading.textContent=title;

  const list=document.createElement("div");
  list.className="legend-items";
  list.append(...items);

  row.append(heading,list);
  return row;
}

function legendItem(text){
  const item=document.createElement("span");
  item.className="legend-item";
  item.textContent=text;
  return item;
}

function renderError(message){
  const paragraph=document.createElement("p");
  paragraph.className="status-message error";
  paragraph.textContent=message;
  timetableRoot.replaceChildren(paragraph);
  legendRoot.replaceChildren();
}
