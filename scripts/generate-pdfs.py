#!/usr/bin/env python3
"""Generate printable A4 NITOCバスナビ timetables from obus_2026_kosen.json."""
import base64
import html
import io
import json
from collections import defaultdict
from pathlib import Path

import qrcode
from weasyprint import HTML

ROUTES = {
    "taka": (3, "高岳線", "#d71932"),
    "joto": (4, "城東中久喜線", "#24267b"),
    "kuwa": (16, "桑東部絹路線", "#087eae"),
}
STOPS = {"gate": "正門", "entrance": "入口", "nakakuki2": "中二"}
PAGES = {
    "S2K": ("小山駅東口 → 小山高専", "小山駅東口 のりば 発車時刻",
            "小山駅東口 発", "obus_2026_kosen_s2k"),
    "K2S": ("小山高専 → 小山駅東口", "高専正門 出発目安時刻",
            "高専正門 出発目安", "obus_2026_kosen_k2s"),
}
CSS = """
@page { size:A4 portrait; margin:12mm 13mm 11mm; }
* {box-sizing:border-box}
html,body {font-family:'Noto Sans CJK JP','Noto Sans JP',sans-serif;color:#17222e;margin:0;background:#fff}
.brand-row {display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #222679;padding-bottom:9px}
.brand {font-size:19px;color:#202374;font-weight:900;letter-spacing:-.035em;white-space:nowrap;flex:0 0 auto}
.nonofficial {font-size:8px;letter-spacing:.04em;color:#66717e;border:1px solid #dbe1e5;border-radius:10px;padding:4px 8px;white-space:nowrap;flex:0 0 auto}
.headline {position:relative;margin:12px 0 7px}
h1 {font-size:20px;line-height:1.4;margin:0;letter-spacing:-.025em;font-weight:850;white-space:nowrap}
.rev {white-space:nowrap;color:#56606c;font-size:9.5px;position:absolute;right:0;top:6px}
.tagline {font-size:12px;color:#202374;font-weight:700;margin-bottom:11px}
.table-head {display:flex;justify-content:space-between;align-items:center;background:#f2f3fa;border-radius:5px;padding:8px 11px;font-size:10px;margin-bottom:3px}
.table-head .label {font-weight:800;color:#252778}
.table-head .explain {font-size:8px;color:#626b77}
.hour-row {display:flex;min-height:10.6mm;align-items:stretch;border-bottom:1px solid #e3e8ed}
.hour {flex:none;width:37px;display:flex;align-items:center;justify-content:center;gap:2px;background:#f6f7f9;color:#313c4b;font-size:19px;font-weight:800}
.hour small {font-size:8px;font-weight:600;margin-top:5px}
.trip-grid {flex:1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:stretch}
.trip {padding:5px 3px 3px 7px;position:relative;border-left:3px solid transparent;min-width:0}
.trip.taka {border-left-color:#d71932}
.trip.joto {border-left-color:#24267b}
.trip.kuwa {border-left-color:#087eae}
.trip-top {display:flex;align-items:baseline;gap:2px;white-space:nowrap;height:20px}
.minute {font-size:19.5px;font-weight:800;line-height:1.05;letter-spacing:-1px}
.mark {font-size:8px;font-weight:750;line-height:1;align-self:flex-start;padding-top:2px}
.route-number {font-size:9px;font-weight:800;color:#fff;background:#747f8e;border-radius:2px;padding:1px 3px;margin-left:auto;align-self:center}
.taka .route-number {background:#bf1d31}
.joto .route-number {background:#252778}
.kuwa .route-number {background:#087ca5}
.trip-bottom {font-size:8.4px;white-space:nowrap;line-height:1.15;color:#495566;letter-spacing:-.015em}
.trip-bottom span {color:#6c7581;font-size:7px}
.legend {display:flex;justify-content:space-between;align-items:center;margin:11px 0 4px;gap:10px}
.legend-route {display:flex;align-items:center;gap:5px;white-space:nowrap;font-size:9px}
.legend-route b {font-size:10px;color:#17222e}
.legend-color {width:12px;height:4px;border-radius:2px}
.notes {border-top:1px solid #d6dce2;margin-top:8px;padding-top:7px;display:flex;gap:12px;justify-content:space-between}
.notes-text {flex:1;min-width:0}
.notes-text p {font-size:8.6px;line-height:1.62;margin:0 0 4px}
.notes-text p.strong {font-weight:750}
.notes-text .subtle {font-size:7.6px;color:#5f6a76}
.qr {width:58px;height:58px;object-fit:contain}
.footer {border-top:1px solid #dde2e7;display:flex;justify-content:space-between;align-items:center;margin-top:5px;padding-top:6px;color:#606d7a;font-size:7.5px}
.url {font-weight:700;color:#242778}
"""

def qr_uri(url):
    qr = qrcode.QRCode(border=1, box_size=5, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(url)
    qr.make(fit=True)
    buf = io.BytesIO()
    qr.make_image(fill_color="#15202b", back_color="white").convert("RGB").save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

def stop_time(trip):
    for call in trip["stop_calls"]:
        if call["stop_id"] == trip["college_stop_id"]:
            return call["time"]
    raise ValueError("Missing official boarding stop time: " + trip["segment_id"])

def tile(trip, direction):
    key = trip["route_id"]
    num = ROUTES[key][0]
    suffix = {"kuwa_mon_fri": "◆", "joto_weekday": "※"}.get(trip["calendar_id"], "")
    display = html.escape(trip["display_time"][3:])
    stop = STOPS[trip["college_stop_id"]]
    if direction == "K2S" and trip["walk_minutes"]:
        detail = "乗 " + stop_time(trip)
        more = "｜" + stop
    else:
        detail, more = stop, ""
    return f'''<div class="trip {key}"><div class="trip-top"><span class="minute">{display}</span><span class="mark">{suffix}</span><span class="route-number">{num}</span></div><div class="trip-bottom">{detail}<span>{more}</span></div></div>'''

def page_html(data, direction):
    heading, subtitle, label, basename = PAGES[direction]
    services = sorted(data[direction], key=lambda t:t["display_time"])
    buckets = defaultdict(list)
    for trip in services:
        buckets[trip["display_time"][:2]].append(trip)
    rows = "".join(
        f'<div class="hour-row"><div class="hour">{int(hour)}<small>時</small></div><div class="trip-grid">{"".join(tile(t, direction) for t in trips)}</div></div>'
        for hour, trips in sorted(buckets.items())
    )
    legend = "".join(
        f'<div class="legend-route"><span class="legend-color" style="background:{color}"></span><b>{num}</b><span>{name}</span></div>'
        for num,name,color in ROUTES.values()
    )
    if direction == "S2K":
        note = "時刻は小山駅東口の発車時刻。『入口』『正門』『中二』は高専側の降車停留所を示します。"
        details = "高岳線：小山高専入口（徒歩約6分）／城東中久喜線：高専正門／桑東部絹路線：高専正門または中久喜二丁目（徒歩約9分）"
    else:
        note = "表示時刻は高専正門から徒歩で向かう際の出発目安です。下段の『乗』は各停留所の公式発車時刻です。"
        details = "徒歩補正：小山高専入口 −6分／中久喜二丁目 −9分／高専正門 ±0分（公式停留所時刻との比較）"
    qr = qr_uri("https://nitocbus.pages.dev/" + basename)
    return f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>NITOCバスナビ｜{heading}</title><style>{CSS}</style></head><body>
    <div class="brand-row"><div class="brand">NITOCバスナビ</div><div class="nonofficial">非公式・個人制作</div></div>
    <div class="headline"><h1>{heading}</h1><span class="rev">2026年10月1日改正</span></div>
    <div class="tagline">{subtitle}</div>
    <div class="table-head"><span class="label">{label}</span><span class="explain">時｜分・路線番号・高専側の停留所</span></div>
    <div class="timetable">{rows}</div><div class="legend">{legend}</div>
    <div class="notes"><div class="notes-text"><p class="strong">{note}</p><p>{details}</p>
      <p>◆ 月〜金運行（土・日・12/29〜1/3は運休。祝日は運行）　※ 平日のみ（祝日は運休）</p>
      <p class="subtle">運休・変更・運賃・路線全体の時刻は小山市公式情報をご確認ください。臨時運行情報は反映されません。</p>
      </div><img class="qr" src="{qr}" alt="ウェブ版へのQRコード"></div>
    <div class="footer"><span>出典：小山市公式時刻表（高岳線／城東中久喜線／桑東部絹路線）</span><span class="url">nitocbus.pages.dev</span></div>
    </body></html>'''

def main():
    root = Path(__file__).resolve().parent.parent
    data = json.loads((root / "obus_2026_kosen.json").read_text(encoding="utf-8"))
    assert (len(data["S2K"]), len(data["K2S"])) == (52, 51), "Unexpected timetable counts"
    for direction, (_, _, _, name) in PAGES.items():
        destination = root / (name + ".pdf")
        HTML(string=page_html(data, direction), base_url=str(root)).write_pdf(str(destination))
        print(f"Created {destination.name}: {destination.stat().st_size} bytes")

if __name__ == "__main__":
    main()
