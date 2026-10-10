#!/usr/bin/env node
// Rebuild the static timetable and legend in both published HTML pages.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const data=JSON.parse(readFileSync(join(root,"obus_2026_kosen.json"),"utf8"));
const STOP_LABELS={"gate":"正門","entrance":"入口","nakakuki2":"中二"};
const ROUTE_ORDER=["taka","joto","kuwa"];
const CALENDAR_MARKS={"daily":"","joto_weekday":"※","kuwa_mon_fri":"◆"};
const CALENDAR_DESCRIPTIONS={"joto_weekday":"※ 平日のみ","kuwa_mon_fri":"◆ 月～金運行（土・日・12/29～1/3は運休）"};
function escapeHtml(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function renderTimetable(data,direction){
  const trips=[...data[direction]].sort((a,b)=>a.display_time.localeCompare(b.display_time));
  const groups=new Map();
  for(const trip of trips){const hour=Number(trip.display_time.split(":")[0]);if(!groups.has(hour))groups.set(hour,[]);groups.get(hour).push(trip);}
  const rows=[];
  for(const [hour,list] of groups){
    const hasStopRow=list.some(t=>t.route_id==="kuwa");
    rows.push(`<div class="hour-row${hasStopRow?" has-stop-row":""}">
  <div class="hour" aria-hidden="true">${hour}</div>
  <div class="trips" role="list" aria-label="${hour}時台">`);
    for(const trip of list){
      const stop=data.stops[trip.college_stop_id], label=STOP_LABELS[trip.college_stop_id]??stop?.name??trip.college_stop_id;
      const minute=trip.display_time.split(":")[1], mark=CALENDAR_MARKS[trip.calendar_id]??"";
      const showStop=trip.route_id==="kuwa";
      const aria=[trip.display_time,stop?.name??trip.college_stop_id,CALENDAR_DESCRIPTIONS[trip.calendar_id]??""].filter(Boolean).join("、");
      rows.push(`    <div class="trip${showStop?" has-stop":""}" data-route="${escapeHtml(trip.route_id)}" role="listitem" aria-label="${escapeHtml(aria)}">${showStop?`<span class="trip-stop">${escapeHtml(label)}</span>`:""}<span class="trip-time">${escapeHtml(minute)}${mark?`<sup>${escapeHtml(mark)}</sup>`:""}</span></div>`);
    }
    rows.push("  </div>\n</div>");
  }
  return rows.join("\n");
}
function renderLegend(data,direction){
  const trips=data[direction], present=new Set(trips.map(t=>t.route_id));
  const routeIds=ROUTE_ORDER.filter(id=>present.has(id));
  const stopIds=[...new Set(trips.filter(t=>t.route_id==="kuwa").map(t=>t.college_stop_id))];
  const calendarIds=[...new Set(trips.map(t=>t.calendar_id))].filter(id=>CALENDAR_DESCRIPTIONS[id]);
  const rows=[];
  function addRow(label,items){rows.push(`<div class="legend-row"><span class="legend-title">${escapeHtml(label)}</span><div class="legend-items">${items.join("")}</div></div>`);}
  function item(t){return `<span class="legend-item">${escapeHtml(t)}</span>`;}
  function routeName(id){return `<span class="route-name" data-route="${escapeHtml(id)}">${escapeHtml(data.routes[id]?.name??id)}</span>`;}
  if(routeIds.length) addRow("路線",routeIds.map(id=>`<span class="legend-item route-key" data-route="${escapeHtml(id)}">${escapeHtml(data.routes[id]?.name??id)}</span>`));
  if(stopIds.length) addRow("停留所",stopIds.map(id=>item(`${STOP_LABELS[id]??id}＝${data.stops[id]?.name??id}`)));
  if(direction==="K2S") addRow("補正時分",[item("各時刻は、のりばまでの徒歩時間として高専正門 0分、小山高専入口 6分、中久喜二丁目 9分を差し引いて表示しています。")]);
  if(calendarIds.length) addRow("運行日",calendarIds.map(id=>item(CALENDAR_DESCRIPTIONS[id])));
  addRow("案内",[`<span class="legend-item">${routeName("taka")}は小山高専入口、${routeName("joto")}は高専正門を発着します。${routeName("kuwa")}は各便の停留所表示をご確認ください。</span>`]);
  return rows.join("\n");
}
function updateBlock(html,start,end,body){
  const a=html.indexOf(start),b=html.indexOf(end);
  if(a<0||b<0||b<=a||html.indexOf(start,a+1)>=0||html.indexOf(end,b+1)>=0)throw Error("Missing or duplicated static block markers");
  return html.slice(0,a+start.length)+"\n"+body.split("\n").map(s=>"        "+s).join("\n")+"\n        "+html.slice(b);
}
for(const [direction,name] of [["S2K","obus_2026_kosen_s2k.html"],["K2S","obus_2026_kosen_k2s.html"]]){
  const path=join(root,name);
  let html=readFileSync(path,"utf8");
  html=updateBlock(html,"<!-- STATIC_TIMETABLE_START -->","<!-- STATIC_TIMETABLE_END -->",renderTimetable(data,direction));
  html=updateBlock(html,"<!-- STATIC_LEGEND_START -->","<!-- STATIC_LEGEND_END -->",renderLegend(data,direction));
  writeFileSync(path,html);
  console.log("Generated",name,"with",data[direction].length,"departures");
}
