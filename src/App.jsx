import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase
const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

// Data
const TESSABAN = [
  "เทศบาลเมืองวารินชำราบ","เทศบาลตำบลห้วยขะยูง","เทศบาลตำบลนาเยีย",
  "เทศบาลตำบลแสนสุข","เทศบาลตำบลเมืองศรีไค","เทศบาลตำบลคำน้ำแซบ",
  "เทศบาลตำบลคำขวาง","เทศบาลตำบลบุ่งไหม","เทศบาลตำบลธาตุ",
  "เทศบาลตำบลบุ่งมะแลง","เทศบาลตำบลท่าช้าง","เทศบาลตำบลสว่าง",
  "เทศบาลตำบลนาเรือง","เทศบาลตำบลนาจาน","เทศบาลตำบลสำโรง",
];
const OBT = [
  "อบต.คูเมือง","อบต.ท่าลาด","อบต.โนนผึ้ง","อบต.โนนโหนน",
  "อบต.บุ่งหวาย","อบต.โพธิ์ใหญ่","อบต.สระสมิง","อบต.หนองกินเพล",
  "อบต.ห้วยขะยุง","อบต.ขามป้อม","อบต.ค้อน้อย","อบต.โคกก่อง",
  "อบต.โคกสว่าง","อบต.โนนกลาง","อบต.โนนกาเล็น","อบต.บอน",
  "อบต.หนองไฮ","อบต.แก่งโดม","อบต.นาดี",
];
const ALL = [...TESSABAN, ...OBT];
const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
               "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

// Helpers
const initM   = () => ({ days:[], table:{}, history:[] });
const eCell   = () => ({ p97:"", p3:"" });
const srtDays = a => [...a].sort((x,y)=>parseInt(x)-parseInt(y));

function addDay(table, day) {
  const t = {...table};
  ALL.forEach(o => { t[o] = {...(t[o]||{}), [day]: t[o]?.[day] || eCell()}; });
  return t;
}
function rmDay(table, day) {
  const t = {...table};
  ALL.forEach(o => { const r={...(t[o]||{})}; delete r[day]; t[o]=r; });
  return t;
}

const n2  = n => { const v=parseFloat(n); if(!v) return ""; return v%1===0?v.toFixed(0):v.toFixed(2); };
const fmt = n => { if(!n&&n!==0) return "-"; const v=parseFloat(n); if(isNaN(v)||v===0) return "-"; return v.toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}); };
const sR  = (tbl,org,days,f) => days.reduce((s,d)=>s+(parseFloat(tbl[org]?.[d]?.[f])||0),0);
const sD  = (tbl,day,lst,f)  => lst.reduce((s,o)=>s+(parseFloat(tbl[o]?.[day]?.[f])||0),0);
const sG  = (tbl,lst,days,f) => lst.reduce((s,o)=>s+sR(tbl,o,days,f),0);

function findOrg(name) {
  if(!name) return null;
  const nm = s => s.replace(/\s+/g,"").replace("เทศบาลตำบล","ตำบล").replace("เทศบาลเมือง","เมือง").replace("อบต.","").replace("อบต","");
  const n=nm(name);
  return ALL.find(o=>{ const m=nm(o); return m===n||m.includes(n)||n.includes(m); })||null;
}

// DB
async function dbLoad() {
  const {data,error}=await sb.from("monthly_data").select("*");
  if(error) throw error;
  const out={};
  (data||[]).forEach(r=>{out[r.month]={days:r.days||[],table:r.table_data||{},history:r.history||[]};});
  return out;
}
async function dbSave(month,data) {
  const {error}=await sb.from("monthly_data").upsert(
    {month,days:data.days,table_data:data.table,history:data.history,updated_at:new Date().toISOString()},
    {onConflict:"month"}
  );
  if(error) throw error;
}

// Colors
const C = {blue:"#0f4c81",green:"#1a7a4a",gold:"#e8a020",red:"#c0392b",bg:"#f2f5f8"};

// ============================================================
export default function App() {
  const [ready,   setReady]   = useState(false);
  const [saving,  setSaving]  = useState("");
  const [mainTab, setMainTab] = useState("monthly");
  const [subTab,  setSubTab]  = useState("import");
  const [mon,     setMon]     = useState("เมษายน");
  const [DB,      setDB]      = useState({});
  const [msg,     setMsg]     = useState(null);
  const [cmp,     setCmp]     = useState(null);
  const [jText,   setJText]   = useState("");
  const [jDay,    setJDay]    = useState("");
  const [jErr,    setJErr]    = useState("");
  const [mDay,    setMDay]    = useState("");
  const dirty = useRef(null);

  const getM    = useCallback(m => DB[m]||initM(), [DB]);
  const hasData = useCallback(m => (DB[m]?.days?.length||0)>0, [DB]);
  const cur     = getM(mon);

  const setM = useCallback((m,fn) => {
    setDB(prev=>{ const c=prev[m]||initM(); return {...prev,[m]:typeof fn==="function"?fn(c):fn}; });
    dirty.current=m;
  },[]);

  // Load
  useEffect(()=>{
    dbLoad()
      .then(d=>{ if(Object.keys(d).length) setDB(d); })
      .catch(e=>console.error(e))
      .finally(()=>setReady(true));
  },[]);

  // Auto-save
  useEffect(()=>{
    if(!ready) return;
    const t=setTimeout(async()=>{
      const m=dirty.current; if(!m) return; dirty.current=null;
      const md=DB[m]; if(!md) return;
      setSaving("saving");
      try{ await dbSave(m,md); setSaving("saved"); setTimeout(()=>setSaving(""),2500); }
      catch(e){ console.error(e); setSaving("error"); }
    },1200);
    return()=>clearTimeout(t);
  },[DB,ready]);

  const pushDay = useCallback((d,mo)=>{
    const n=parseInt(d); if(!n||n<1||n>31) return;
    const s=String(n),month=mo||mon;
    setM(month,c=>{ if(c.days.includes(s)) return c; return {...c,days:srtDays([...c.days,s]),table:addDay({...c.table},s)}; });
  },[mon,setM]);

  const dropDay = useCallback(d=>{
    setM(mon,c=>({...c,days:c.days.filter(x=>x!==d),table:rmDay({...c.table},d),history:c.history.filter(h=>h.day!==d)}));
  },[mon,setM]);

  const setCell = useCallback((org,day,f,v)=>{
    setM(mon,c=>({...c,table:{...c.table,[org]:{...c.table[org],[day]:{...c.table[org]?.[day],[f]:v}}}}));
  },[mon,setM]);

  const doImport = ()=>{
    setJErr("");
    const n=parseInt(jDay); if(!n||n<1||n>31){setJErr("ระบุวันที่ให้ถูกต้อง");return;}
    const ds=String(n);
    let p; try{ p=JSON.parse(jText.replace(/```json|```/g,"").trim()); }catch{ setJErr("JSON ไม่ถูกต้อง");return; }
    if(!Array.isArray(p?.rows)){setJErr("ไม่พบ rows ใน JSON");return;}
    setM(mon,c=>{
      const nd=c.days.includes(ds)?c.days:srtDays([...c.days,ds]);
      const nt=addDay({...c.table},ds);
      p.rows.forEach(r=>{ const f=findOrg(r.matched||r.name); if(f&&(r.p97||r.p3)) nt[f][ds]={p97:r.p97?String(r.p97):"",p3:r.p3?String(r.p3):""}; });
      const nh=[...c.history.filter(h=>h.day!==ds),{day:ds,total_p97:p.total_p97||0,total_p3:p.total_p3||0,total_amount:p.total_amount||0}].sort((a,b)=>parseInt(a.day)-parseInt(b.day));
      return {...c,days:nd,table:nt,history:nh};
    });
    const m=p.rows.filter(r=>findOrg(r.matched||r.name)).length;
    setMsg({ok:true,text:`✅ วันที่ ${ds} เดือน${mon}: จับคู่ได้ ${m}/${p.rows.length} รายการ`});
    setJText(""); setJDay(""); setSubTab("monthtable");
  };

  const doCmp = useCallback(()=>{
    const h=getM(mon).history; if(!h.length) return;
    const last=h[h.length-1], tbl=getM(mon).table, d=last.day;
    const tT97=sD(tbl,d,TESSABAN,"p97"),tT3=sD(tbl,d,TESSABAN,"p3");
    const tO97=sD(tbl,d,OBT,"p97"),tO3=sD(tbl,d,OBT,"p3");
    setCmp({day:d,pdf:last,calc:{p97:tT97+tO97,p3:tT3+tO3,total:tT97+tO97+tT3+tO3},t:{p97:tT97,p3:tT3},o:{p97:tO97,p3:tO3}});
    setSubTab("compare");
  },[mon,getM]);

  const mSum = useCallback(m=>{
    const {days,table}=getM(m);
    return{t97:sG(table,TESSABAN,days,"p97"),t3:sG(table,TESSABAN,days,"p3"),o97:sG(table,OBT,days,"p97"),o3:sG(table,OBT,days,"p3"),days:days.length};
  },[getM]);

  // ── UI ──
  const BtnStyle = (active)=>({padding:"4px 12px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,background:active?C.blue:"#e2e8f0",color:active?"#fff":"#555"});

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Noto Sans Thai','Sarabun',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700;800&display=swap" rel="stylesheet"/>

      {/* Header */}
      <header style={{background:`linear-gradient(135deg,${C.blue},#1a6bb5)`,color:"#fff",padding:"0 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 3px 12px rgba(0,0,0,0.2)",position:"sticky",top:0,zIndex:100,minHeight:54}}>
        <span style={{fontSize:22}}>🏛️</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:14}}>ระบบบันทึกยอดรายวัน เทศบาล / อบต.</div>
          <div style={{fontSize:10,opacity:.75}}>ส่ง PDF ในแชท Claude → คัดลอก JSON → วางที่นี่</div>
        </div>
        {saving&&<div style={{fontSize:11,padding:"3px 10px",borderRadius:12,background:saving==="saved"?"rgba(26,122,74,0.9)":saving==="error"?"rgba(192,57,43,0.9)":"rgba(255,255,255,0.2)",color:"#fff",whiteSpace:"nowrap"}}>{saving==="saving"?"💾 บันทึก...":saving==="saved"?"✅ บันทึกแล้ว":"❌ บันทึกไม่ได้"}</div>}
        <div style={{display:"flex",gap:5}}>
          {[["monthly","📅 รายเดือน"],["summary","📊 รายปี"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setMainTab(id)} style={{...BtnStyle(mainTab===id),background:mainTab===id?C.gold:"rgba(255,255,255,0.15)",color:mainTab===id?"#1a1a1a":"#fff"}}>{lbl}</button>
          ))}
        </div>
      </header>

      {/* Loading */}
      {!ready&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"70vh",gap:16}}><div style={{fontSize:42}}>⏳</div><div style={{fontSize:16,color:"#666",fontWeight:600}}>กำลังโหลดข้อมูล...</div></div>}

      {ready&&<>
        {msg&&<div style={{margin:"10px 16px 0",padding:"9px 14px",borderRadius:8,fontSize:13,fontWeight:500,display:"flex",justifyContent:"space-between",alignItems:"center",background:msg.ok?"#e6f9ee":"#fde8e8",color:msg.ok?"#1a6b38":"#c0392b",border:`1px solid ${msg.ok?"#9de0b6":"#f5b7b1"}`}}><span>{msg.text}</span><button onClick={()=>setMsg(null)} style={{border:"none",background:"none",cursor:"pointer",fontSize:16,opacity:.5}}>×</button></div>}

        {/* ── Monthly ── */}
        {mainTab==="monthly"&&<div style={{padding:"12px 16px"}}>
          {/* Month pills */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
            {MONTHS.map(m=>(
              <button key={m} onClick={()=>{setMon(m);setSubTab("import");setCmp(null);}} style={{...BtnStyle(mon===m),position:"relative",background:mon===m?C.blue:hasData(m)?"#d1fae5":"#e2e8f0",color:mon===m?"#fff":hasData(m)?C.green:"#555"}}>
                {m}{hasData(m)&&mon!==m&&<span style={{position:"absolute",top:-3,right:-3,width:7,height:7,background:C.green,borderRadius:"50%",border:"1.5px solid #fff"}}/>}
              </button>
            ))}
          </div>

          {/* Sub tabs */}
          <div style={{display:"flex",background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.07)",width:"fit-content",marginBottom:14}}>
            {[["import","📋 นำเข้า"],["monthtable","📅 ตารางเดือน"],["compare","🔍 ตรวจสอบ"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>setSubTab(id)} style={{padding:"7px 15px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,background:subTab===id?C.blue:"transparent",color:subTab===id?"#fff":"#555"}}>{lbl}</button>
            ))}
          </div>

          {/* Import tab */}
          {subTab==="import"&&<div style={{maxWidth:640,margin:"0 auto"}}>
            <div style={{background:"linear-gradient(135deg,#e8f4fd,#f0f9ff)",borderRadius:12,padding:"14px 18px",marginBottom:14,border:"1px solid #bee3f8"}}>
              <div style={{fontWeight:800,fontSize:14,color:C.blue,marginBottom:10}}>📖 วิธีนำเข้าข้อมูล</div>
              {[["1️⃣","แนบไฟล์ PDF ในช่องแชท Claude (หน้าต่างนี้)"],["2️⃣","พิมพ์: อ่านข้อมูลจาก PDF นี้ให้เป็น JSON"],["3️⃣","คัดลอก JSON ที่ Claude ตอบกลับ"],["4️⃣","ระบุวันที่ + วาง JSON ด้านล่าง → กด นำเข้า"]].map(([n,t])=>(
                <div key={n} style={{display:"flex",gap:8,marginBottom:6}}><span style={{fontSize:16,flexShrink:0}}>{n}</span><span style={{fontSize:13,color:"#2d5986",lineHeight:1.5}}>{t}</span></div>
              ))}
            </div>
            <div style={{background:"#fff",borderRadius:12,padding:"16px 18px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
              <div style={{fontWeight:800,fontSize:15,color:C.blue,marginBottom:14}}>📥 วาง JSON — เดือน{mon}</div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:600,color:"#555",marginBottom:5}}>วันที่ในเอกสาร</div>
                <input type="text" inputMode="numeric" placeholder="เช่น 1, 15, 30" value={jDay} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");if(v===""||parseInt(v)<=31)setJDay(v);}} style={{width:130,padding:"9px 12px",borderRadius:8,border:`2px solid ${jDay?C.blue:"#d0d5dd"}`,fontFamily:"inherit",fontSize:18,textAlign:"center",boxSizing:"border-box",outline:"none"}}/>
              </div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:600,color:"#555",marginBottom:5}}>JSON จาก Claude</div>
                <textarea value={jText} onChange={e=>{setJText(e.target.value);setJErr("");}} placeholder='วาง JSON ที่ได้จาก Claude...' style={{width:"100%",minHeight:160,padding:"10px 12px",borderRadius:8,border:`2px solid ${jErr?"#f5b7b1":jText?"#90caf9":"#d0d5dd"}`,fontFamily:"monospace",fontSize:12,boxSizing:"border-box",resize:"vertical",outline:"none"}}/>
                {jErr&&<div style={{color:C.red,fontSize:13,marginTop:4}}>⚠️ {jErr}</div>}
              </div>
              <button onClick={doImport} disabled={!jText||!jDay} style={{width:"100%",padding:13,background:jText&&jDay?C.blue:"#ccc",color:"#fff",border:"none",borderRadius:10,cursor:jText&&jDay?"pointer":"default",fontFamily:"inherit",fontSize:15,fontWeight:800}}>📥 นำเข้าวันที่ {jDay||"..."} เดือน{mon}</button>
            </div>
            <div style={{background:"#fff",borderRadius:12,padding:"14px 16px",marginTop:14,boxShadow:"0 1px 6px rgba(0,0,0,0.06)"}}>
              <div style={{fontWeight:700,color:C.blue,marginBottom:8,fontSize:13}}>⚙️ เพิ่มวันเปล่าด้วยตนเอง</div>
              <div style={{display:"flex",gap:8}}>
                <input type="text" inputMode="numeric" placeholder="วันที่ เช่น 5" value={mDay} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");if(v===""||parseInt(v)<=31)setMDay(v);}} onKeyDown={e=>{if(e.key==="Enter"){pushDay(mDay);setMDay("");}}} style={{width:110,padding:"7px 10px",borderRadius:7,border:"1px solid #d0d5dd",fontFamily:"inherit",fontSize:14}}/>
                <button onClick={()=>{pushDay(mDay);setMDay("");}} style={{padding:"7px 14px",background:C.blue,color:"#fff",border:"none",borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:700}}>+ เพิ่ม</button>
              </div>
              {cur.days.length>0&&<div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:6}}>{cur.days.map(d=><span key={d} style={{background:"#e8f0fe",color:C.blue,padding:"3px 10px 3px 12px",borderRadius:20,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>{d}<button onClick={()=>dropDay(d)} style={{border:"none",background:"none",color:C.red,cursor:"pointer",fontSize:14,padding:0,lineHeight:1}}>×</button></span>)}</div>}
            </div>
          </div>}

          {/* Month table tab */}
          {subTab==="monthtable"&&<div>
            <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontWeight:800,fontSize:16,color:C.blue}}>ตารางรวมเดือน {mon}</span>
              <span style={{fontSize:13,color:"#888"}}>| {cur.days.length} วัน</span>
              {cur.history.length>0&&<button onClick={doCmp} style={{marginLeft:"auto",padding:"6px 14px",background:C.green,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700}}>🔍 เทียบ PDF ล่าสุด</button>}
            </div>
            {cur.days.length===0
              ?<div style={{textAlign:"center",padding:60,color:"#ccc",background:"#fff",borderRadius:12}}><div style={{fontSize:44,marginBottom:10}}>📅</div><div>ยังไม่มีข้อมูล — ไปที่แท็บ "📋 นำเข้า"</div></div>
              :<>
                {cur.history.length>0&&<div style={{background:"#fff",borderRadius:10,padding:"12px 16px",marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8}}>📄 นำเข้าแล้ว</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{cur.history.map(h=><div key={h.day} style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,padding:"5px 12px",fontSize:12}}><span style={{fontWeight:700,color:C.green}}>วันที่ {h.day}</span><span style={{color:"#888",marginLeft:8}}>97%: {(h.total_p97||0).toFixed(2)} | 3%: {(h.total_p3||0).toFixed(2)} | รวม: {(h.total_amount||0).toFixed(2)}</span></div>)}</div></div>}
                <MTable title="เทศบาล" list={TESSABAN} days={cur.days} table={cur.table} setCell={setCell} C={C} sR={sR} sD={sD} sG={sG} n2={n2}/>
                <div style={{height:16}}/>
                <MTable title="อบต." list={OBT} days={cur.days} table={cur.table} setCell={setCell} C={C} sR={sR} sD={sD} sG={sG} n2={n2}/>
                <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <SCard label="รวมเทศบาล" p97={sG(cur.table,TESSABAN,cur.days,"p97")} p3={sG(cur.table,TESSABAN,cur.days,"p3")} color={C.blue}/>
                  <SCard label="รวม อบต." p97={sG(cur.table,OBT,cur.days,"p97")} p3={sG(cur.table,OBT,cur.days,"p3")} color={C.green}/>
                  <div style={{background:"#1a1a2e",color:"#fff",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:11,opacity:.7,marginBottom:3}}>ยอดรวมเดือน{mon}</div>
                    <div style={{fontSize:20,fontWeight:900,color:C.gold}}>{(sG(cur.table,ALL,cur.days,"p97")+sG(cur.table,ALL,cur.days,"p3")).toFixed(2)}</div>
                    <div style={{fontSize:10,opacity:.6,marginTop:2}}>97%: {sG(cur.table,ALL,cur.days,"p97").toFixed(2)} | 3%: {sG(cur.table,ALL,cur.days,"p3").toFixed(2)}</div>
                  </div>
                </div>
              </>}
          </div>}

          {/* Compare tab */}
          {subTab==="compare"&&<div style={{maxWidth:660,margin:"0 auto"}}>
            {!cmp
              ?<div style={{textAlign:"center",padding:60,color:"#ccc",background:"#fff",borderRadius:12}}><div style={{fontSize:44,marginBottom:10}}>🔍</div><div>นำเข้าข้อมูลก่อน แล้วกด "เทียบ PDF ล่าสุด"</div></div>
              :<CmpView cmp={cmp} mon={mon} C={C}/>}
          </div>}
        </div>}

        {/* ── Summary ── */}
        {mainTab==="summary"&&<SumView MONTHS={MONTHS} mSum={mSum} hasData={hasData} setMon={setMon} setMainTab={setMainTab} setSubTab={setSubTab} getM={getM} C={C} fmt={fmt} sR={sR}/>}
      </>}
    </div>
  );
}

// ── Month Table ──
function MTable({title,list,days,table,setCell,C,sR,sD,sG,n2}){
  const col=title==="เทศบาล"?C.blue:C.green;
  const NW=160, CW=48;
  return(
    <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
      <div style={{background:col,color:"#fff",padding:"8px 14px",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontWeight:800,fontSize:14}}>{title}</span>
        <span style={{fontSize:11,opacity:.75,background:"rgba(255,255,255,0.2)",padding:"1px 8px",borderRadius:20}}>97% / 3%</span>
        <span style={{marginLeft:"auto",fontSize:11,opacity:.85}}>Σ97%: {sG(table,list,days,"p97").toFixed(2)} | Σ3%: {sG(table,list,days,"p3").toFixed(2)} | รวม: {(sG(table,list,days,"p97")+sG(table,list,days,"p3")).toFixed(2)}</span>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",fontSize:11.5,tableLayout:"fixed",minWidth:NW+days.length*CW*2+190}}>
          <thead>
            <tr style={{background:"#f1f5f9"}}>
              <th style={{width:NW,padding:"6px 8px",textAlign:"left",fontWeight:700,fontSize:12,color:"#4a5568",borderBottom:"1px solid #e2e8f0",borderRight:"2px solid #aac4e0"}}>หน่วยงาน</th>
              {days.map(d=><th key={d} colSpan={2} style={{width:CW*2,padding:"6px 4px",textAlign:"center",fontWeight:700,fontSize:12,color:col,borderBottom:"1px solid #e2e8f0",borderRight:"2px solid #aac4e0"}}>วันที่ {d}</th>)}
              <th colSpan={3} style={{width:190,padding:"6px 4px",textAlign:"center",fontWeight:700,fontSize:12,color:col,background:"#dbeafe",borderBottom:"1px solid #e2e8f0"}}>รวมทั้งเดือน</th>
            </tr>
            <tr style={{borderBottom:"2px solid #cbd5e0"}}>
              <th style={{width:NW,padding:"4px 8px",background:"#edf2f7",borderRight:"2px solid #aac4e0"}}/>
              {days.map(d=><React.Fragment key={d}>
                <th style={{width:CW,padding:"4px 2px",textAlign:"center",fontWeight:700,fontSize:10,color:"#fff",background:col}}>97%</th>
                <th style={{width:CW,padding:"4px 2px",textAlign:"center",fontWeight:700,fontSize:10,color:"#fff",background:"#888",borderRight:"2px solid #aac4e0"}}>3%</th>
              </React.Fragment>)}
              <th style={{width:60,padding:"4px 2px",textAlign:"center",fontWeight:700,fontSize:10,color:"#fff",background:col}}>97%</th>
              <th style={{width:60,padding:"4px 2px",textAlign:"center",fontWeight:700,fontSize:10,color:"#fff",background:"#888"}}>3%</th>
              <th style={{width:70,padding:"4px 2px",textAlign:"center",fontWeight:800,fontSize:10,color:"#1a1a2e",background:"#bfdbfe"}}>รวม</th>
            </tr>
          </thead>
          <tbody>
            {list.map((org,i)=>{
              const r97=sR(table,org,days,"p97"),r3=sR(table,org,days,"p3");
              return(<tr key={org} style={{background:i%2===0?"#fff":"#fafbfc"}}>
                <td style={{padding:"3px 8px",borderBottom:"1px solid #e8ecf0",borderRight:"2px solid #aac4e0",fontWeight:500,color:"#1a2744",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontSize:12}}>{org}</td>
                {days.map(d=><React.Fragment key={d}>
                  <td style={{padding:2,borderBottom:"1px solid #e8ecf0",background:"#f0f6ff"}}>
                    <input type="text" inputMode="decimal" value={table[org]?.[d]?.p97??""} onChange={e=>setCell(org,d,"p97",e.target.value.replace(/[^0-9.]/g,""))} style={{width:"100%",border:"none",background:"transparent",textAlign:"right",padding:"3px 4px",fontFamily:"inherit",fontSize:11.5,outline:"none",color:col,fontWeight:600,boxSizing:"border-box"}}/>
                  </td>
                  <td style={{padding:2,borderBottom:"1px solid #e8ecf0",borderRight:"2px solid #aac4e0",background:"#f9f9f9"}}>
                    <input type="text" inputMode="decimal" value={table[org]?.[d]?.p3??""} onChange={e=>setCell(org,d,"p3",e.target.value.replace(/[^0-9.]/g,""))} style={{width:"100%",border:"none",background:"transparent",textAlign:"right",padding:"3px 4px",fontFamily:"inherit",fontSize:11.5,outline:"none",color:"#888",boxSizing:"border-box"}}/>
                  </td>
                </React.Fragment>)}
                <td style={{padding:"3px 6px",borderBottom:"1px solid #e8ecf0",textAlign:"right",fontWeight:700,color:col,background:"#eff6ff"}}>{n2(r97)}</td>
                <td style={{padding:"3px 6px",borderBottom:"1px solid #e8ecf0",textAlign:"right",fontWeight:600,color:"#666",background:"#f3f3f3"}}>{n2(r3)}</td>
                <td style={{padding:"3px 6px",borderBottom:"1px solid #e8ecf0",textAlign:"right",fontWeight:800,color:"#1a1a2e",background:"#dbeafe",fontSize:12}}>{n2(r97+r3)}</td>
              </tr>);
            })}
            <tr style={{borderTop:"2px solid #94a3b8",background:"#edf2f7"}}>
              <td style={{padding:"5px 8px",fontWeight:800,color:col,borderRight:"2px solid #aac4e0",fontSize:12}}>รวม</td>
              {days.map(d=><React.Fragment key={d}>
                <td style={{padding:"5px 4px",textAlign:"right",fontWeight:700,color:col,background:"#dbeafe",fontSize:12}}>{n2(sD(table,d,list,"p97"))}</td>
                <td style={{padding:"5px 4px",textAlign:"right",fontWeight:600,color:"#555",background:"#e5e5e5",borderRight:"2px solid #aac4e0",fontSize:12}}>{n2(sD(table,d,list,"p3"))}</td>
              </React.Fragment>)}
              <td style={{padding:"5px 6px",textAlign:"right",background:col,color:"#fff",fontWeight:800,fontSize:12}}>{n2(sG(table,list,days,"p97"))}</td>
              <td style={{padding:"5px 6px",textAlign:"right",background:"#555",color:"#fff",fontWeight:700,fontSize:12}}>{n2(sG(table,list,days,"p3"))}</td>
              <td style={{padding:"5px 6px",textAlign:"right",background:"#1a1a2e",color:"#e8a020",fontWeight:900,fontSize:13}}>{n2(sG(table,list,days,"p97")+sG(table,list,days,"p3"))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Compare View ──
function CmpView({cmp,mon,C}){
  return(
    <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,0.08)"}}>
      <div style={{background:C.blue,color:"#fff",padding:"14px 18px"}}><div style={{fontWeight:800,fontSize:17}}>ผลเปรียบเทียบ — วันที่ {cmp.day} เดือน{mon}</div></div>
      <div style={{padding:16}}>
        <div style={{background:"#f8f9fa",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#555",display:"flex",gap:14,flexWrap:"wrap"}}>
          <span>📄 <b>PDF:</b></span><span>97% = <b>{(cmp.pdf.total_p97||0).toFixed(2)}</b></span><span>3% = <b>{(cmp.pdf.total_p3||0).toFixed(2)}</b></span><span>รวม = <b>{(cmp.pdf.total_amount||0).toFixed(2)}</b></span>
        </div>
        {[["97% รวม",cmp.calc.p97,cmp.pdf.total_p97||0],["3% รวม",cmp.calc.p3,cmp.pdf.total_p3||0],["รวมเงิน",cmp.calc.total,cmp.pdf.total_amount||0]].map(([lbl,calc,pdf])=>{
          const ok=Math.abs(calc-pdf)<0.06;
          return(<div key={lbl} style={{marginBottom:10,padding:"12px 14px",borderRadius:9,background:ok?"#f0fdf4":"#fef2f2",border:`1.5px solid ${ok?"#86efac":"#fca5a5"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontWeight:700}}>{lbl}</span><span style={{fontSize:20}}>{ok?"✅":"❌"}</span></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[["คำนวณได้",calc,C.blue],["ใน PDF",pdf,"#276749"],["ผลต่าง",calc-pdf,ok?"#888":C.red]].map(([l,v,co])=>(
                <div key={l} style={{background:"rgba(0,0,0,0.04)",borderRadius:6,padding:"8px 10px"}}><div style={{fontSize:11,color:"#888",marginBottom:2}}>{l}</div><div style={{fontSize:16,fontWeight:800,color:co}}>{(+v).toFixed(2)}</div></div>
              ))}
            </div>
          </div>);
        })}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
          {[{l:"เทศบาล",d:cmp.t,c:C.blue},{l:"อบต.",d:cmp.o,c:C.green}].map(({l,d,c})=>(
            <div key={l} style={{background:c,color:"#fff",borderRadius:10,padding:"12px 14px"}}><div style={{fontWeight:700,marginBottom:6}}>{l}</div><div style={{display:"flex",gap:14}}><div><div style={{fontSize:10,opacity:.75}}>97%</div><div style={{fontSize:16,fontWeight:800}}>{d.p97.toFixed(2)}</div></div><div><div style={{fontSize:10,opacity:.75}}>3%</div><div style={{fontSize:16,fontWeight:800}}>{d.p3.toFixed(2)}</div></div><div><div style={{fontSize:10,opacity:.75}}>รวม</div><div style={{fontSize:16,fontWeight:800}}>{(d.p97+d.p3).toFixed(2)}</div></div></div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Summary View ──
function SumView({MONTHS,mSum,hasData,setMon,setMainTab,setSubTab,getM,C,fmt,sR}){
  const th=(w,l=false,bg)=>({padding:"6px 8px",textAlign:l?"left":"center",fontWeight:700,fontSize:11,color:"#4a5568",borderBottom:"1px solid #e2e8f0",borderRight:"1px solid #e2e8f0",minWidth:w,whiteSpace:"nowrap",...(bg?{background:bg}:{})});
  const td={borderBottom:"1px solid #e8ecf0",borderRight:"1px solid #e8ecf0",verticalAlign:"middle"};
  const yr=MONTHS.reduce((a,m)=>{const s=mSum(m);return{t97:a.t97+s.t97,t3:a.t3+s.t3,o97:a.o97+s.o97,o3:a.o3+s.o3};},{t97:0,t3:0,o97:0,o3:0});
  const go=m=>{setMon(m);setMainTab("monthly");setSubTab("monthtable");};
  return(
    <div style={{padding:"14px 16px"}}>
      <div style={{fontWeight:800,fontSize:17,color:C.blue,marginBottom:14}}>📊 สรุปยอดรายปี</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8,marginBottom:18}}>
        {MONTHS.map(m=>{const s=mSum(m);const tot=s.t97+s.t3+s.o97+s.o3;return(
          <div key={m} onClick={()=>go(m)} style={{background:hasData(m)?"#fff":"#f8f8f8",borderRadius:10,padding:"12px 14px",cursor:"pointer",boxShadow:"0 1px 5px rgba(0,0,0,0.07)",border:`1.5px solid ${hasData(m)?"#bee3f8":"#e8e8e8"}`}}>
            <div style={{fontWeight:800,fontSize:14,color:hasData(m)?C.blue:"#bbb",marginBottom:4}}>{m}</div>
            {hasData(m)?<><div style={{fontSize:11,color:"#aaa",marginBottom:3}}>{s.days} วัน</div><div style={{fontSize:17,fontWeight:900,color:C.blue}}>{fmt(tot)}</div><div style={{fontSize:10,color:"#999",marginTop:3,display:"flex",gap:6}}><span style={{color:C.blue}}>ทบ {fmt(s.t97+s.t3)}</span><span style={{color:C.green}}>อบต {fmt(s.o97+s.o3)}</span></div></>:<div style={{fontSize:12,color:"#ccc"}}>ยังไม่มีข้อมูล</div>}
          </div>
        );})}
      </div>
      <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.07)",marginBottom:18}}>
        <div style={{background:C.blue,color:"#fff",padding:"10px 16px",fontWeight:800,fontSize:14}}>ตารางสรุปยอดแต่ละเดือน</div>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",fontSize:12}}>
            <thead><tr style={{background:"#f1f5f9"}}><th style={th(90,true)}>เดือน</th><th style={th(40)}>วัน</th><th style={th(95)}>ทบ 97%</th><th style={th(85)}>ทบ 3%</th><th style={th(95)}>อบต 97%</th><th style={th(85)}>อบต 3%</th><th style={th(100,false,"#e8f0fe")}>รวมทบ</th><th style={th(100,false,"#e6f4ed")}>รวมอบต</th><th style={th(110,false,"#1a1a2e")}>รวมทั้งหมด</th></tr></thead>
            <tbody>
              {MONTHS.map((m,i)=>{const s=mSum(m);const tT=s.t97+s.t3,oT=s.o97+s.o3;return(
                <tr key={m} style={{background:i%2===0?"#fff":"#fafbfc",cursor:"pointer"}} onClick={()=>go(m)}>
                  <td style={{...td,fontWeight:700,color:hasData(m)?C.blue:"#bbb",padding:"6px 10px"}}>{m}</td>
                  <td style={{...td,textAlign:"center",color:"#888"}}>{s.days||"-"}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px"}}>{fmt(s.t97)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px",color:"#999"}}>{fmt(s.t3)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px"}}>{fmt(s.o97)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px",color:"#999"}}>{fmt(s.o3)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px",fontWeight:700,color:C.blue,background:"#f0f6ff"}}>{fmt(tT)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px",fontWeight:700,color:C.green,background:"#f0faf4"}}>{fmt(oT)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 10px",fontWeight:800,color:"#1a1a2e",background:"#f5f5fa"}}>{fmt(tT+oT)}</td>
                </tr>
              );})}
              <tr style={{background:"#1a1a2e",fontWeight:800}}>
                <td style={{...td,padding:"8px 10px",color:"#ffd84d",borderColor:"#333"}} colSpan={2}>รวมทั้งปี</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#90caf9",borderColor:"#333"}}>{fmt(yr.t97)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#90caf9",borderColor:"#333"}}>{fmt(yr.t3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#a5d6a7",borderColor:"#333"}}>{fmt(yr.o97)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#a5d6a7",borderColor:"#333"}}>{fmt(yr.o3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#90caf9",fontWeight:900,borderColor:"#333"}}>{fmt(yr.t97+yr.t3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#a5d6a7",fontWeight:900,borderColor:"#333"}}>{fmt(yr.o97+yr.o3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 10px",color:"#ffd84d",fontSize:14,fontWeight:900,borderColor:"#333"}}>{fmt(yr.t97+yr.t3+yr.o97+yr.o3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.07)"}}>
        <div style={{background:C.green,color:"#fff",padding:"10px 16px",fontWeight:800,fontSize:14}}>ยอดรวมรายหน่วยงานตลอดปี</div>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",fontSize:12}}>
            <thead><tr style={{background:"#f1f5f9"}}><th style={th(36,true)}>#</th><th style={th(180,true)}>หน่วยงาน</th><th style={th(100)}>97%</th><th style={th(100)}>3%</th><th style={th(110)}>รวม</th></tr></thead>
            <tbody>
              {[["เทศบาล",TESSABAN,C.blue],["อบต.",OBT,C.green]].map(([grp,list,col])=>(
                <React.Fragment key={grp}>
                  <tr style={{background:col}}><td colSpan={5} style={{padding:"5px 12px",color:"#fff",fontWeight:800,fontSize:13}}>{grp}</td></tr>
                  {list.map((org,i)=>{
                    const t97=MONTHS.reduce((s,m)=>s+sR(getM(m).table,org,getM(m).days,"p97"),0);
                    const t3=MONTHS.reduce((s,m)=>s+sR(getM(m).table,org,getM(m).days,"p3"),0);
                    return(<tr key={org} style={{background:i%2===0?"#fff":"#fafbfc"}}><td style={{...td,textAlign:"center",color:"#bbb",padding:"5px 6px"}}>{i+1}</td><td style={{...td,padding:"5px 10px",fontWeight:500,color:"#2d3748",whiteSpace:"nowrap"}}>{org}</td><td style={{...td,textAlign:"right",padding:"5px 8px",color:col}}>{fmt(t97)}</td><td style={{...td,textAlign:"right",padding:"5px 8px",color:"#999"}}>{fmt(t3)}</td><td style={{...td,textAlign:"right",padding:"5px 8px",fontWeight:700,color:"#1a1a2e"}}>{fmt(t97+t3)}</td></tr>);
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SCard({label,p97,p3,color}){
  return(<div style={{background:color,color:"#fff",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:11,opacity:.8,marginBottom:5}}>{label}</div><div style={{display:"flex",gap:10}}><div><div style={{fontSize:10,opacity:.7}}>97%</div><div style={{fontSize:14,fontWeight:800}}>{p97.toFixed(2)}</div></div><div><div style={{fontSize:10,opacity:.7}}>3%</div><div style={{fontSize:14,fontWeight:800}}>{p3.toFixed(2)}</div></div><div><div style={{fontSize:10,opacity:.7}}>รวม</div><div style={{fontSize:14,fontWeight:800,color:"#ffd84d"}}>{(p97+p3).toFixed(2)}</div></div></div></div>);
}
