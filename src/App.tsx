import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

import type { DBState, MonthData, ExtractResponse, Msg } from './types';
import { TESSABAN, OBT, ALL, MONTHS } from './data/orgs';
import { mkTheme } from './utils/theme';
import {
  n2, fmt, sR, sD, sG, findOrg,
  initM, srtDays, addDayTbl, rmDayTbl,
  exportCSV, exportBackup,
  extractDayFromFilename, sanitizeNum,
} from './utils/helpers';
import MTable   from './components/MTable';
import ChartView from './components/ChartView';
import SumView  from './components/SumView';
import SCard    from './components/SCard';

// ─── Supabase ─────────────────────────────────────────────────────────────────

const _supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const _supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
if (!_supabaseUrl || !_supabaseKey) throw new Error('❌ ขาด VITE_SUPABASE_URL หรือ VITE_SUPABASE_KEY ใน .env');
const sb = createClient(_supabaseUrl, _supabaseKey);

// ─── DB helpers ───────────────────────────────────────────────────────────────

const currentFiscalYear = (): string => {
  const now = new Date(); const m = now.getMonth()+1; const y = now.getFullYear()+543;
  return m >= 10 ? String(y+1) : String(y);
};

async function dbLoad(fy: string): Promise<DBState> {
  const {data,error} = await sb.from("monthly_data").select("*").like("month", `${fy}_%`);
  if(error) throw error;
  const out: DBState = {};
  (data||[]).forEach((r: { month: string; days: string[]; table_data: any; history: any[] }) => {
    const mon = r.month.includes("_") ? r.month.split("_")[1] : r.month;
    out[mon] = { days: r.days||[], table: r.table_data||{}, history: r.history||[] };
  });
  return out;
}

async function dbSave(month: string, data: MonthData, fy: string): Promise<void> {
  const key = `${fy}_${month}`;
  const {error} = await sb.from("monthly_data").upsert(
    {month:key, days:data.days, table_data:data.table, history:data.history, updated_at:new Date().toISOString()},
    {onConflict:"month"}
  );
  if(error) throw error;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useIsMobile(): boolean {
  const [m, setM] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return m;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [isDark,      setIsDark]      = useState(() => localStorage.getItem("theme") === "dark");
  const [ready,       setReady]       = useState(false);
  const [saving,      setSaving]      = useState("");
  const [fiscalYear,  setFiscalYear]  = useState(currentFiscalYear);
  const [mainTab,     setMainTab]     = useState("monthly");
  const [subTab,      setSubTab]      = useState("import");
  const [mon,         setMon]         = useState("ตุลาคม");
  const [DB,          setDB]          = useState<DBState>({});
  const [msg,         setMsg]         = useState<Msg | null>(null);
  const [mDay,        setMDay]        = useState("");

  // PDF flow
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [showDayModal,  setShowDayModal]  = useState(false);
  const [pendingPdf,    setPendingPdf]    = useState<File | null>(null);
  const [pdfDay,        setPdfDay]        = useState("");
  // Item 9: batch queue
  const [pdfQueue,      setPdfQueue]      = useState<File[]>([]);
  // Item 6: pre-loaded result from background API call
  const [pendingResult, setPendingResult] = useState<ExtractResponse | null>(null);

  const [undoAvail,     setUndoAvail]     = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string; onConfirm: () => void; onCancel?: () => void;
  } | null>(null);
  const [reviewData, setReviewData] = useState<{ parsed: ExtractResponse; dayStr: string; activeMon: string } | null>(null);

  const fileRef         = useRef<HTMLInputElement>(null);
  const importBackupRef = useRef<HTMLInputElement>(null);
  const dirty           = useRef<Set<string>>(new Set());
  const undoRef         = useRef<{ mon: string; day: string; data: MonthData } | null>(null);
  const undoTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef    = useRef<boolean>(false);
  const isMobile        = useIsMobile();

  const T = useMemo(() => mkTheme(isDark), [isDark]);

  const toggleDark = () => setIsDark(d => { localStorage.setItem("theme", d?"light":"dark"); return !d; });

  const getM    = useCallback((m: string): MonthData => DB[m]||initM(), [DB]);
  const hasData = useCallback((m: string): boolean => (DB[m]?.days?.length||0)>0, [DB]);
  const cur     = getM(mon);

  const setM = useCallback((m: string, fn: (c: MonthData) => MonthData) => {
    setDB(prev => { const c=prev[m]||initM(); return {...prev,[m]:fn(c)}; });
    dirty.current.add(m);
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  }, []);

  // Load DB on fiscal year change
  useEffect(() => {
    setReady(false); setDB({}); dirty.current.clear();
    dbLoad(fiscalYear).then(d=>{ if(Object.keys(d).length) setDB(d); }).catch(console.error).finally(()=>setReady(true));
  }, [fiscalYear]);

  // Sync DB to ref for save snapshot
  const DBRef = useRef<DBState>(DB);
  useEffect(() => { DBRef.current = DB; }, [DB]);

  // Item 7: auto-save with retry on error
  useEffect(() => {
    if(!ready) return;
    const t = setTimeout(async () => {
      const months = [...dirty.current];
      if(!months.length) return;
      setSaving("saving");
      try {
        const snapshot = DBRef.current;
        await Promise.all(months.map(m => {
          const md = snapshot[m];
          if(!md) return Promise.resolve();
          return dbSave(m, md, fiscalYear);
        }));
        months.forEach(m => dirty.current.delete(m));
        setSaving("saved"); setTimeout(() => setSaving(""), 2500);
      } catch(e) {
        console.error(e);
        setSaving("error");
        // Show retry option in msg
        setMsg({ ok: false, text: `❌ บันทึกไม่สำเร็จ — แก้ internet แล้วกด retry` });
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [DB, ready, fiscalYear]);

  const pushDay = useCallback((d: string, mo?: string) => {
    const n=parseInt(d); if(isNaN(n)||n<1||n>31) return;
    const s=String(n), month=mo||mon;
    setM(month, c => { if(c.days.includes(s)) return c; return {...c, days:srtDays([...c.days,s]), table:addDayTbl({...c.table},s)}; });
  }, [mon, setM]);

  const dropDay = useCallback((d: string) => {
    setDB(prev => {
      const snapshot = prev[mon];
      if(snapshot) {
        undoRef.current = { mon, day:d, data: JSON.parse(JSON.stringify(snapshot)) };
        setUndoAvail(true);
        if(undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => { undoRef.current = null; setUndoAvail(false); }, 8000);
      }
      const updated = {...prev};
      const c = prev[mon];
      if(c) updated[mon] = { ...c, days:c.days.filter((x:string)=>x!==d), table:rmDayTbl({...c.table},d), history:c.history.filter((h:any)=>h.day!==d) };
      return updated;
    });
    dirty.current.add(mon);
    setMsg({ ok:true, text:`🗑️ ลบวันที่ ${d} แล้ว` });
  }, [mon]);

  const setCell = useCallback((org: string, day: string, f: 'p97'|'p3', v: string) => {
    setM(mon, c => ({...c, table:{...c.table,[org]:{...c.table[org],[day]:{...c.table[org]?.[day],[f]:v}}}}));
  }, [mon, setM]);

  // Item 6 + 9: handle file pick — starts API call in background, shows day modal
  const startExtract = useCallback(async (file: File) => {
    cancelledRef.current = false;
    setPendingPdf(file);
    setPendingResult(null);
    // Pre-fill day from filename
    const autoDay = extractDayFromFilename(file.name);
    setPdfDay(autoDay || "");
    setShowDayModal(true);

    // Fire off API call in background while user types/checks the day
    setPdfLoading(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: b64, mimeType: file.type }),
      });
      let parsed: ExtractResponse;
      try { parsed = await resp.json(); } catch { throw new Error('API ไม่ตอบสนอง — ตรวจสอบว่า API server รันอยู่'); }
      if(!resp.ok || parsed.error) throw new Error(parsed.error || 'เกิดข้อผิดพลาด');
      if(!Array.isArray(parsed?.rows)) throw new Error('ไม่พบข้อมูลในเอกสาร');
      if(cancelledRef.current) return;
      setPendingResult(parsed);
      // Item 6: if Claude detected the day, override only if field is still empty
      const docDay = parsed.document_day;
      if(docDay != null && docDay >= 1 && docDay <= 31) {
        setPdfDay(prev => prev === "" ? String(docDay) : prev);
      }
    } catch(e) {
      setPendingResult(null);
      setMsg({ ok:false, text:`❌ ${(e as Error).message}` });
      setShowDayModal(false);
      setPendingPdf(null);
    } finally {
      setPdfLoading(false);
    }
  }, []);

  const handlePdfPick = useCallback((file: File | undefined | null) => {
    if(!file) return;
    if(!file.type.match(/^(application\/pdf|image\/)/)) { setMsg({ok:false,text:"รองรับเฉพาะ PDF และรูปภาพ"}); return; }
    startExtract(file);
  }, [startExtract]);

  // Item 9: handle multiple files → queue
  const handleFilesSelected = useCallback((files: FileList | null) => {
    if(!files || files.length === 0) return;
    const arr = Array.from(files).filter(f => f.type.match(/^(application\/pdf|image\/)/));
    if(!arr.length) { setMsg({ok:false,text:"รองรับเฉพาะ PDF และรูปภาพ"}); return; }
    if(arr.length === 1) { startExtract(arr[0]); return; }
    // Multiple files: process first, queue the rest
    setPdfQueue(arr.slice(1));
    startExtract(arr[0]);
  }, [startExtract]);

  // Submit day modal — uses pre-loaded result if available, else error
  const handleDaySubmit = useCallback((dayStr: string) => {
    const activeMon = mon;
    setShowDayModal(false);

    if(!pendingResult) {
      setMsg({ ok:false, text:"❌ API ยังไม่พร้อม — รอสักครู่แล้วลองใหม่" });
      return;
    }

    const captured = pendingResult;
    const proceed = () => {
      setMsg({ ok:true, text:`✅ Claude อ่านสำเร็จ! กรุณาตรวจสอบข้อมูลก่อนบันทึก` });
      setReviewData({ parsed: captured, dayStr, activeMon });
      setPendingResult(null);
      setPendingPdf(null);
    };

    if(getM(activeMon).history.find(h => h.day === dayStr)) {
      setConfirmDialog({
        message: `⚠️ วันที่ ${dayStr} เดือน${activeMon} มีข้อมูลอยู่แล้ว\nต้องการแทนที่มั้ย?`,
        onConfirm: proceed,
        onCancel: () => { setPendingResult(null); setPendingPdf(null); },
      });
      return;
    }

    proceed();
  }, [mon, pendingResult, getM]);

  // Item 8: validate numbers + save
  const confirmReview = useCallback(() => {
    if(!reviewData) return;
    const { parsed, dayStr, activeMon } = reviewData;
    setM(activeMon, c => {
      const nd = c.days.includes(dayStr) ? c.days : srtDays([...c.days, dayStr]);
      const nt = addDayTbl({...c.table}, dayStr);
      parsed.rows.forEach(r => {
        const f = findOrg(r.matched || r.name);
        if(f) {
          // Item 8: sanitize — reject negative/non-numeric values from Claude
          const p97 = sanitizeNum(r.p97);
          const p3  = sanitizeNum(r.p3);
          if(p97 !== "" || p3 !== "") nt[f][dayStr] = { p97, p3 };
        }
      });
      const nh = [...c.history.filter(h => h.day !== dayStr),
        { day:dayStr, total_p97:parsed.total_p97||0, total_p3:parsed.total_p3||0, total_amount:parsed.total_amount||0 }
      ].sort((a,b) => parseInt(a.day)-parseInt(b.day));
      return {...c, days:nd, table:nt, history:nh};
    });
    const matched = parsed.rows.filter(r => findOrg(r.matched||r.name)).length;
    setMsg({ ok:true, text:`✅ บันทึกแล้ว! วันที่ ${dayStr}: จับคู่ได้ ${matched}/${parsed.rows.length} รายการ` });
    setSubTab("monthtable");
    setReviewData(null);

    // Item 9: process next file in queue
    if(pdfQueue.length > 0) {
      const [next, ...rest] = pdfQueue;
      setPdfQueue(rest);
      setTimeout(() => startExtract(next), 300);
    }
  }, [reviewData, setM, pdfQueue, startExtract]);

  const handleImportBackup = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.replace(/^﻿/, '').split('\n').filter(l => l.trim());
      const rows = lines.slice(1).map(line => {
        const cols = line.match(/"([^"]*)"/g)?.map(c => c.slice(1,-1)) || [];
        return { fy:cols[0], mon:cols[1], day:cols[2], org:cols[3], p97:cols[4]||'', p3:cols[5]||'' };
      }).filter(r => r.mon && r.day && r.org);
      if(!rows.length) { setMsg({ ok:false, text:'❌ ไม่พบข้อมูลในไฟล์' }); return; }
      const restoredFy = rows[0].fy || fiscalYear;
      if(restoredFy !== fiscalYear) {
        setMsg({ok:false, text:`❌ Backup ปี ${restoredFy} ไม่ตรงกับปีปัจจุบัน ${fiscalYear}`});
        return;
      }
      setDB(prev => {
        const next: DBState = {...prev};
        rows.forEach(({ mon:rowMon, day, org, p97, p3 }) => {
          const dayNum = parseInt(day);
          if(!dayNum || dayNum < 1 || dayNum > 31) return; // skip invalid rows
          if(!next[rowMon]) next[rowMon] = { days:[], table:{}, history:[] };
          const c = next[rowMon];
          if(!c.days.includes(day)) c.days = [...c.days, day].sort((a,b)=>parseInt(a)-parseInt(b));
          ALL.forEach(o => { if(!c.table[o]) c.table[o]={}; if(!c.table[o][day]) c.table[o][day]={p97:'',p3:''}; });
          if(c.table[org]?.[day] !== undefined) c.table[org][day] = { p97, p3 };
          dirty.current.add(rowMon);
        });
        return next;
      });
      setMsg({ ok:true, text:`✅ Restore สำเร็จ! ${rows.length} แถว (ปี ${restoredFy})` });
    } catch(e) {
      setMsg({ ok:false, text:`❌ อ่านไฟล์ไม่ได้: ${(e as Error).message}` });
    }
  }, [fiscalYear]);

  const mSum = useCallback((m: string) => {
    const {days,table} = getM(m);
    return { t97:sG(table,TESSABAN,days,"p97"), t3:sG(table,TESSABAN,days,"p3"), o97:sG(table,OBT,days,"p97"), o3:sG(table,OBT,days,"p3"), days:days.length };
  }, [getM]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if(e.key === 'Escape') {
        if(showDayModal) { cancelledRef.current = true; setShowDayModal(false); setPendingPdf(null); setPendingResult(null); setPdfQueue([]); }
        if(confirmDialog) { confirmDialog.onCancel?.(); setConfirmDialog(null); }
        if(reviewData) setReviewData(null);
        if(msg) setMsg(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showDayModal, confirmDialog, reviewData, msg]);

  const tSum97 = sG(cur.table, TESSABAN, cur.days, "p97");
  const tSum3  = sG(cur.table, TESSABAN, cur.days, "p3");
  const oSum97 = sG(cur.table, OBT,      cur.days, "p97");
  const oSum3  = sG(cur.table, OBT,      cur.days, "p3");
  const aSum97 = tSum97 + oSum97;
  const aSum3  = tSum3  + oSum3;

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Noto Sans Thai','Sarabun',sans-serif",transition:"background .15s",paddingBottom:isMobile?64:0}}>
      <style>{`
        @media print { .no-print{display:none!important;} .print-only{display:block!important;} body{background:#fff!important;margin:0;} *{-webkit-print-color-adjust:exact;print-color-adjust:exact;} @page{size:A4 landscape;margin:10mm;} }
        .print-only{display:none;}
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${isDark?"#334155":"#CBD5E1"};border-radius:3px;}
        input[type=text]:focus{outline:2px solid ${T.blue};outline-offset:0;}
        button:hover:not(:disabled){opacity:0.8;transition:opacity .12s;}
        button:disabled{cursor:default;}
      `}</style>

      {/* Header */}
      <header className="no-print" style={{background:isDark?"#0D1B3E":"linear-gradient(to right, #1565C0, #1976D2)",color:"#fff",padding:"0 16px",display:"flex",alignItems:"center",gap:0,borderBottom:isDark?"1px solid #1E3256":"none",position:"sticky",top:0,zIndex:100,minHeight:52}}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingRight:20,borderRight:`1px solid rgba(255,255,255,0.1)`}}>
          <span style={{fontSize:18,lineHeight:1}}>🏛️</span>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:600,fontSize:isMobile?12:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:"#FFFFFF"}}>เทศบาล / อบต. วารินชำราบ</div>
            {!isMobile&&<div style={{fontSize:12,fontWeight:400,color:"#BBDEFB",marginTop:1}}>ปีงบประมาณ {fiscalYear}</div>}
          </div>
        </div>
        {!isMobile&&<div style={{display:"flex",alignItems:"center",flex:1,marginLeft:12,gap:6}}>
          {[["monthly","รายเดือน"],["summary","รายปี"],["chart","กราฟ"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setMainTab(id)} style={{padding:"5px 14px",borderRadius:20,border:mainTab===id?"none":"1px solid rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:mainTab===id?700:500,background:mainTab===id?T.gold:(isDark?"rgba(255,255,255,0.08)":"#1E88E5"),color:"#fff",transition:"all .15s"}}>{lbl}</button>
          ))}
        </div>}
        <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
          {saving&&<div onClick={saving==="error"?()=>{setSaving(""); dirty.current = new Set(Object.keys(DB)); setDB(d=>({...d}));}:undefined} style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:saving==="saved"?"rgba(74,222,128,0.15)":saving==="error"?"rgba(248,113,113,0.15)":"rgba(255,255,255,0.1)",color:saving==="saved"?"#4ADE80":saving==="error"?"#F87171":"rgba(255,255,255,0.6)",border:`1px solid ${saving==="saved"?"rgba(74,222,128,0.3)":saving==="error"?"rgba(248,113,113,0.3)":"rgba(255,255,255,0.15)"}`,whiteSpace:"nowrap",cursor:saving==="error"?"pointer":"default"}}>{saving==="saving"?"บันทึก...":saving==="saved"?"บันทึกแล้ว":"⚠ บันทึกไม่ได้ (แตะเพื่อลองใหม่)"}</div>}
          {!isMobile&&<button onClick={()=>exportBackup(DB,fiscalYear)} style={{padding:"4px 10px",height:32,border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontSize:11,background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.6)"}} title="Backup">💾 สำรอง</button>}
          <select value={fiscalYear} onChange={e=>{setFiscalYear(e.target.value);setMon("ตุลาคม");}}
            style={{padding:"4px 6px",height:32,borderRadius:4,border:"1px solid rgba(255,255,255,0.15)",fontFamily:"inherit",fontSize:11,fontWeight:600,background:"rgba(255,255,255,0.07)",color:"#fff",cursor:"pointer"}}>
            {Array.from({length:6},(_,i)=>parseInt(fiscalYear)-3+i).map(y=><option key={y} value={String(y)} style={{color:"#000",background:"#1e293b"}}>ปี {y}</option>)}
          </select>
          <button onClick={toggleDark} style={{width:32,height:32,borderRadius:4,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",fontFamily:"inherit",fontSize:13,background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.7)"}} title={isDark?"Light mode":"Dark mode"}>{isDark?"☀":"🌙"}</button>
        </div>
      </header>

      {!ready&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"70vh",gap:16}}><div style={{fontSize:42}}>⏳</div><div style={{fontSize:16,color:T.textMute,fontWeight:600}}>กำลังโหลดข้อมูล...</div></div>}

      {ready&&<>
        {/* Msg bar */}
        {msg&&<div className="no-print" style={{margin:"10px 16px 0",padding:"9px 14px",borderRadius:8,fontSize:13,fontWeight:500,display:"flex",justifyContent:"space-between",alignItems:"center",background:msg.ok?T.msgOkBg:T.msgErrBg,color:msg.ok?T.msgOkTxt:T.msgErrTxt,border:`1px solid ${msg.ok?T.msgOkBdr:T.msgErrBdr}`}}>
          <span>{msg.text}</span>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {undoAvail&&(
              <button onClick={()=>{
                const u=undoRef.current; if(!u) return;
                setDB(prev=>({...prev,[u.mon]:u.data}));
                dirty.current.add(u.mon); undoRef.current=null;
                setUndoAvail(false);
                if(undoTimerRef.current) clearTimeout(undoTimerRef.current);
                setMsg({ok:true,text:`↩️ คืนข้อมูลวันที่ ${u.day} แล้ว`});
              }} style={{padding:'2px 10px',background:T.blue,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700}}>↩️ Undo</button>
            )}
            {/* Item 7: retry save button */}
            {!msg.ok&&saving==="error"&&(
              <button onClick={()=>{setSaving(""); dirty.current = new Set(Object.keys(DB)); setDB(d=>({...d}));}} style={{padding:'2px 10px',background:T.blue,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700}}>🔄 retry</button>
            )}
            <button onClick={()=>setMsg(null)} style={{border:"none",background:"none",cursor:"pointer",fontSize:16,opacity:.5,color:msg.ok?T.msgOkTxt:T.msgErrTxt}}>×</button>
          </div>
        </div>}

        {/* MONTHLY */}
        {mainTab==="monthly"&&<div style={{padding:isMobile?"8px 10px":"12px 16px"}}>
          <div className="no-print" style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {MONTHS.map(m=>(
              <button key={m} onClick={()=>{setMon(m);setSubTab("import");}} style={{padding:"5px 13px",borderRadius:6,border:`1px solid ${mon===m?(isDark?"#1E3A6E":T.blue):hasData(m)?(isDark?"rgba(74,143,232,0.3)":"rgba(21,101,192,0.3)"):T.border}`,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:mon===m?700:500,position:"relative",background:mon===m?(isDark?"#1E3A6E":T.blue):hasData(m)?T.p97Bg:"transparent",color:mon===m?"#fff":(isDark?T.textMute:T.blue),transition:"all .12s"}}>
                {m}{hasData(m)&&mon!==m&&<span style={{position:"absolute",top:-3,right:-3,width:6,height:6,background:isDark?"#4A8FE8":"#1E88E5",borderRadius:"50%",border:`1.5px solid ${T.bg}`}}/>}
              </button>
            ))}
          </div>

          <div className="no-print" style={{display:"flex",marginBottom:16,gap:8}}>
            {[["import","นำเข้า"],["monthtable","ตารางเดือน"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>setSubTab(id)} style={{padding:"6px 18px",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:subTab===id?700:500,transition:"all .12s",
                border: isDark?"1px solid transparent":`1px solid #1565C0`,
                background: isDark?(subTab===id?"#1E3A6E":"#1A3060"):(subTab===id?"#1565C0":"#FFFFFF"),
                color: isDark?(subTab===id?"#FFFFFF":"#A0B4D0"):(subTab===id?"#FFFFFF":"#1565C0"),
              }}>{lbl}</button>
            ))}
          </div>

          {/* IMPORT */}
          {subTab==="import"&&<div style={{maxWidth:640,margin:"0 auto"}}>

            {/* Day modal */}
            {showDayModal&&(
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
                <div style={{background:T.card,borderRadius:10,padding:"24px",width:"100%",maxWidth:340,boxShadow:`0 8px 48px ${T.shadow2}`,border:`1px solid ${T.border}`}}>
                  <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:4,letterSpacing:"0.01em"}}>วันที่ในเอกสาร</div>
                  <div style={{fontSize:13,color:T.textMute,marginBottom:4}}>เดือน {mon} — วันที่เท่าไร?</div>
                  {pdfQueue.length>0&&<div style={{fontSize:11,color:T.gold,marginBottom:10,fontWeight:600}}>📂 คิว: เหลืออีก {pdfQueue.length} ไฟล์</div>}
                  {pdfLoading
                    ?<div style={{textAlign:'center',padding:'12px 0',color:T.textMute,fontSize:13}}>⏳ Claude กำลังอ่าน...</div>
                    :pendingResult
                      ?<div style={{fontSize:11,color:T.msgOkTxt,background:T.msgOkBg,border:`1px solid ${T.msgOkBdr}`,borderRadius:6,padding:'6px 10px',marginBottom:10}}>✅ Claude อ่านสำเร็จ — กรอกวันที่แล้วกดยืนยัน</div>
                      :<div style={{fontSize:11,color:T.gold,marginBottom:10}}>⏳ รอ Claude อ่าน...</div>
                  }
                  <input type="text" inputMode="numeric" placeholder="เช่น 1, 15, 30" value={pdfDay}
                    onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");if(v===""||( parseInt(v)>=1 && parseInt(v)<=31))setPdfDay(v);}}
                    onKeyDown={e=>{if(e.key==="Enter"&&pdfDay&&pendingResult)handleDaySubmit(String(parseInt(pdfDay)));}}
                    autoFocus
                    style={{width:"100%",padding:"12px",borderRadius:10,border:`2px solid ${pdfDay?T.blue:T.border2}`,background:T.card2,color:T.text,fontFamily:"inherit",fontSize:22,textAlign:"center",boxSizing:"border-box",marginBottom:16,outline:"none"}}/>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={()=>{ cancelledRef.current = true; setShowDayModal(false); setPendingPdf(null); setPendingResult(null); setPdfQueue([]); setPdfDay(""); }} style={{flex:1,padding:"9px 0",border:`1px solid ${T.border}`,borderRadius:6,background:"transparent",color:T.textMed,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>ยกเลิก</button>
                      <button onClick={()=>{if(pdfDay&&pendingResult&&!pdfLoading)handleDaySubmit(String(parseInt(pdfDay)));}} disabled={!pdfDay||!pendingResult||pdfLoading}
                      style={{flex:2,padding:"9px 0",background:pdfDay&&pendingResult&&!pdfLoading?T.blue:T.border2,color:"#fff",border:"none",borderRadius:6,cursor:pdfDay&&pendingResult&&!pdfLoading?"pointer":"default",fontFamily:"inherit",fontSize:14,fontWeight:700}}>
                      ยืนยัน
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PDF Drop Zone */}
            <div
              onDrop={e=>{e.preventDefault();handleFilesSelected(e.dataTransfer.files);}}
              onDragOver={e=>e.preventDefault()}
              onClick={()=>!pdfLoading&&fileRef.current?.click()}
              style={{border:`1.5px dashed ${pdfLoading?T.textFaint:(isDark?"#2A4A8A":"#7BA7E8")}`,borderRadius:8,padding:"32px 24px",textAlign:"center",background:isDark?"#111E38":"#F5F8FF",cursor:pdfLoading?"default":"pointer",marginBottom:14}}>
              <div style={{fontSize:36,marginBottom:10,color:isDark?"#4A6FA5":"#90A4AE",opacity:pdfLoading?0.4:1}}>{pdfLoading?"⏳":"📄"}</div>
              <div style={{fontSize:14,fontWeight:600,color:pdfLoading?T.textFaint:(isDark?"#5B9BD5":T.blue),marginBottom:5,letterSpacing:"0.01em"}}>
                {pdfLoading?"Claude กำลังอ่าน PDF...":`วาง PDF หรือรูปภาพที่นี่ — เดือน${mon}`}
              </div>
              <div style={{fontSize:11,color:isDark?"#6B7F99":"#757575"}}>PDF · PNG · JPG · เลือกหลายไฟล์พร้อมกันได้</div>
              <input ref={fileRef} type="file" accept=".pdf,image/*" multiple style={{display:"none"}} onChange={e=>handleFilesSelected(e.target.files)}/>
            </div>

            {/* Manual day add */}
            <div style={{background:T.card,borderRadius:8,padding:"14px 16px",marginTop:14,border:`1px solid ${T.border}`}}>
              <div style={{fontWeight:600,color:T.textMed,marginBottom:8,fontSize:12,textTransform:"uppercase",letterSpacing:"0.06em"}}>เพิ่มวันด้วยตนเอง</div>
              <div style={{display:"flex",gap:8}}>
                <input type="text" inputMode="numeric" placeholder="เช่น 5" value={mDay} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");if(v===""||( parseInt(v)>=1 && parseInt(v)<=31))setMDay(v);}} onKeyDown={e=>{if(e.key==="Enter"){pushDay(mDay);setMDay("");}}} style={{width:90,padding:"6px 10px",borderRadius:6,border:`1px solid ${isDark?"#2A3F6A":T.border2}`,background:isDark?"#0D1B3E":"#FFFFFF",color:isDark?"#8BA4C4":T.text,fontFamily:"inherit",fontSize:13}}/>
                <button onClick={()=>{pushDay(mDay);setMDay("");}} style={{padding:"6px 14px",background:isDark?"#1E5FA8":"#1565C0",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>เพิ่ม</button>
              </div>
              {cur.days.length>0&&<div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:5}}>{cur.days.map(d=><span key={d} style={{background:isDark?"#1A2F55":"#E8F0FE",color:isDark?"#7EB3E8":"#1A237E",padding:"3px 8px 3px 10px",borderRadius:4,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4,border:`1px solid ${isDark?"#2A4070":"#BFCCF4"}`}}>{d}<button onClick={()=>dropDay(d)} style={{border:"none",background:"none",color:isDark?"#E05A3A":"#5C6BC0",cursor:"pointer",fontSize:13,padding:0,lineHeight:1,marginTop:-1}}>×</button></span>)}</div>}
            </div>

            {/* Restore from CSV Backup */}
            <div style={{background:T.card,borderRadius:8,padding:"14px 16px",marginTop:10,border:`1px solid ${T.border}`}}>
              <div style={{fontWeight:600,color:T.textMed,marginBottom:8,fontSize:12,textTransform:"uppercase",letterSpacing:"0.06em"}}>🔥 Restore จาก Backup</div>
              <button onClick={()=>importBackupRef.current?.click()} style={{padding:'6px 14px',background:isDark?"#2A4A7A":"#37474F",color:"#FFFFFF",border:"none",borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:500}}>📁 เลือกไฟล์ backup CSV</button>
              <input ref={importBackupRef} type="file" accept=".csv" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleImportBackup(f);e.target.value='';}}/>
            </div>
          </div>}

          {/* MONTH TABLE */}
          {subTab==="monthtable"&&<div>
            <div className="no-print" style={{display:"flex",gap:10,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontWeight:700,fontSize:14,color:T.text,letterSpacing:"0.01em"}}>เดือน{mon}</span>
              <span style={{fontSize:12,color:T.textFaint,marginLeft:6}}>{cur.days.length} วัน</span>
              <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                {cur.days.length>0&&<>
                  <button onClick={()=>exportCSV(mon,cur.days,cur.table)} style={{padding:"5px 12px",background:"transparent",color:T.textMed,border:`1px solid ${T.border}`,borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Export CSV</button>
                  <button onClick={()=>window.print()} style={{padding:"5px 12px",background:"transparent",color:T.textMed,border:`1px solid ${T.border}`,borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>พิมพ์</button>
                </>}
              </div>
            </div>

            {cur.days.length===0
              ?<div style={{textAlign:"center",padding:60,color:T.textFaint,background:T.card,borderRadius:8,border:`1px solid ${T.border}`}}><div style={{fontSize:36,marginBottom:12,opacity:0.4}}>📅</div><div style={{fontSize:13}}>ยังไม่มีข้อมูล — ไปที่แท็บ นำเข้า</div></div>
              :<>
                {cur.history.length>0&&<div className="no-print" style={{background:T.card,borderRadius:8,padding:"12px 16px",marginBottom:14,border:`1px solid ${T.border}`}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.textFaint,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>นำเข้าแล้ว</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {cur.history.map(h=>(
                      <div key={h.day} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 12px",fontSize:12,display:"flex",alignItems:"center",gap:10}}>
                        <div><span style={{fontWeight:700,color:T.blue}}>วันที่ {h.day}</span><span style={{color:T.textMute,marginLeft:8}}>97%: {(h.total_p97||0).toFixed(2)} | 3%: {(h.total_p3||0).toFixed(2)} | รวม: {(h.total_amount||0).toFixed(2)}</span></div>
                        <button onClick={()=>showConfirm(`ลบข้อมูลวันที่ ${h.day} เดือน${mon}?`,()=>dropDay(h.day))} style={{border:"none",background:"transparent",color:T.textMute,cursor:"pointer",borderRadius:4,padding:"2px 6px",fontSize:12}}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>}

                <div className="print-only" style={{marginBottom:20,borderBottom:`2px solid ${T.blue}`,paddingBottom:12}}>
                  <div style={{textAlign:"center",fontSize:16,fontWeight:800,color:T.blue,marginBottom:4}}>รายงานยอดเงินอุดหนุนรายวัน</div>
                  <div style={{textAlign:"center",fontSize:13,fontWeight:700,marginBottom:2}}>เทศบาล / องค์การบริหารส่วนตำบล</div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:8,color:"#333"}}>
                    <span>ปีงบประมาณ พ.ศ. {fiscalYear}</span>
                    <span style={{fontWeight:700,fontSize:14}}>เดือน{mon} ({cur.days.length} วัน)</span>
                    <span>พิมพ์วันที่ {new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}</span>
                  </div>
                </div>

                <MTable title="เทศบาล" list={TESSABAN} days={cur.days} table={cur.table} setCell={setCell} T={T} sR={sR} sD={sD} sG={sG} n2={n2}/>
                <div style={{height:16}}/>
                <MTable title="อบต." list={OBT} days={cur.days} table={cur.table} setCell={setCell} T={T} sR={sR} sD={sD} sG={sG} n2={n2}/>
                <div style={{marginTop:12,display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:10}}>
                  <SCard label="รวมเทศบาล" p97={tSum97} p3={tSum3} color={T.blue} gold={T.totGold}/>
                  <SCard label="รวม อบต." p97={oSum97} p3={oSum3} color={T.green} gold={T.totGold}/>
                  <div style={{background:isDark?"#0D1117":T.card3,borderRadius:8,padding:"12px 14px"}}>
                    <div style={{fontSize:10,color:T.textFaint,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>ยอดรวมเดือน{mon}</div>
                    <div style={{fontSize:22,fontWeight:800,color:T.gold,letterSpacing:"-0.02em"}}>{(aSum97+aSum3).toFixed(2)}</div>
                    <div style={{fontSize:10,color:T.textMute,marginTop:3}}>97%: {aSum97.toFixed(2)} · 3%: {aSum3.toFixed(2)}</div>
                  </div>
                </div>
              </>}
          </div>}
        </div>}

        {mainTab==="summary"&&<SumView MONTHS={MONTHS} mSum={mSum} hasData={hasData} setMon={setMon} setMainTab={setMainTab} setSubTab={setSubTab} getM={getM} T={T} fmt={fmt} sR={sR} isMobile={isMobile}/>}
        {mainTab==="chart"&&<ChartView MONTHS={MONTHS} mSum={mSum} getM={getM} T={T} fmt={fmt} sR={sR} sG={sG} isMobile={isMobile}/>}
      </>}

      {/* Confirm Modal */}
      {confirmDialog&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:T.card,borderRadius:10,padding:'24px',width:'100%',maxWidth:360,boxShadow:`0 8px 48px ${T.shadow2}`,border:`1px solid ${T.border}`}}>
            <div style={{fontSize:14,fontWeight:500,color:T.text,marginBottom:20,lineHeight:1.7,whiteSpace:'pre-line'}}>{confirmDialog.message}</div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{confirmDialog.onCancel?.();setConfirmDialog(null);}} style={{flex:1,padding:'8px 0',border:`1px solid ${T.border}`,borderRadius:6,background:'transparent',color:T.textMed,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>ยกเลิก</button>
              <button onClick={()=>{confirmDialog.onConfirm();setConfirmDialog(null);}} style={{flex:2,padding:'8px 0',background:T.red,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700}}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewData&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16,overflowY:'auto'}}>
          <div style={{background:T.card,borderRadius:10,padding:'24px',width:'100%',maxWidth:600,boxShadow:`0 8px 48px ${T.shadow2}`,maxHeight:'90vh',display:'flex',flexDirection:'column',border:`1px solid ${T.border}`}}>
            <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:3,letterSpacing:"0.01em"}}>ตรวจสอบข้อมูลที่ Claude อ่าน</div>
            <div style={{fontSize:12,color:T.textMute,marginBottom:14}}>วันที่ {reviewData.dayStr} เดือน{reviewData.activeMon} — กรุณาตรวจสอบก่อนบันทึก</div>
            <div style={{overflowY:'auto',flex:1,marginBottom:16}}>
              <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                <thead>
                  <tr style={{background:T.card3}}>
                    <th style={{padding:'6px 10px',textAlign:'left',fontWeight:700,color:T.tblHeadTxt,borderBottom:`1px solid ${T.border}`}}>ชื่อในเอกสาร</th>
                    <th style={{padding:'6px 10px',textAlign:'left',fontWeight:700,color:T.tblHeadTxt,borderBottom:`1px solid ${T.border}`}}>จับคู่กับ</th>
                    <th style={{padding:'6px 8px',textAlign:'right',fontWeight:700,color:T.tblHeadTxt,borderBottom:`1px solid ${T.border}`}}>97%</th>
                    <th style={{padding:'6px 8px',textAlign:'right',fontWeight:700,color:T.tblHeadTxt,borderBottom:`1px solid ${T.border}`}}>3%</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewData.parsed.rows.map((r,i)=>{
                    const matched=findOrg(r.matched||r.name);
                    const isUnmatched=!matched;
                    return(
                      <tr key={i} style={{background:isUnmatched?T.msgErrBg:i%2===0?T.card:T.rowAlt}}>
                        <td style={{padding:'5px 10px',borderBottom:`1px solid ${T.border}`,color:isUnmatched?T.red:T.text,fontWeight:isUnmatched?700:400}}>{r.name}</td>
                        <td style={{padding:'5px 10px',borderBottom:`1px solid ${T.border}`,color:isUnmatched?T.red:T.textMed,fontSize:11}}>{matched||'— ไม่พบ —'}</td>
                        <td style={{padding:'5px 8px',borderBottom:`1px solid ${T.border}`,textAlign:'right',color:T.blue,fontWeight:600}}>{r.p97!=null?String(r.p97):''}</td>
                        <td style={{padding:'5px 8px',borderBottom:`1px solid ${T.border}`,textAlign:'right',color:T.textMute}}>{r.p3!=null?String(r.p3):''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{fontSize:12,color:T.textMute,marginBottom:14}}>
              จับคู่ได้ {reviewData.parsed.rows.filter(r=>findOrg(r.matched||r.name)).length}/{reviewData.parsed.rows.length} รายการ
              {reviewData.parsed.rows.some(r=>!findOrg(r.matched||r.name))&&<span style={{color:T.red,fontWeight:700}}> · แถวสีแดง = ไม่พบในระบบ (จะไม่ถูกบันทึก)</span>}
              {pdfQueue.length>0&&<span style={{color:T.gold,fontWeight:700,marginLeft:8}}>📂 คิวต่อไป: {pdfQueue.length} ไฟล์</span>}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{setReviewData(null);setPdfQueue([]);}} style={{flex:1,padding:'8px 0',border:`1px solid ${T.border}`,borderRadius:6,background:'transparent',color:T.textMed,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>ยกเลิก</button>
              <button onClick={confirmReview} style={{flex:2,padding:'8px 0',background:T.blue,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700}}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      {isMobile&&<nav className="no-print" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:200,background:isDark?"#0D1B3E":"#1565C0",borderTop:isDark?"1px solid #1E3256":"none",display:"flex"}}>
        {[["monthly","📅","รายเดือน"],["summary","📊","รายปี"],["chart","📈","กราฟ"],["backup","💾","สำรอง"]].map(([id,ico,lbl])=>(
          <button key={id} onClick={id==="backup"?()=>exportBackup(DB,fiscalYear):()=>setMainTab(id)}
            style={{flex:1,border:"none",borderTop:`2px solid ${mainTab===id&&id!=="backup"?T.gold:"transparent"}`,background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 0 6px",gap:2,color:mainTab===id&&id!=="backup"?"#fff":"rgba(255,255,255,0.45)",fontFamily:"inherit",transition:"color .15s"}}>
            <span style={{fontSize:20}}>{ico}</span>
            <span style={{fontSize:9,fontWeight:500,letterSpacing:"0.02em"}}>{lbl}</span>
          </button>
        ))}
      </nav>}
    </div>
  );
}
