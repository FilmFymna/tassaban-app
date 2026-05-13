import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const _supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const _supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
if (!_supabaseUrl || !_supabaseKey) {
  throw new Error('❌ ขาด VITE_SUPABASE_URL หรือ VITE_SUPABASE_KEY ใน .env');
}
const sb = createClient(_supabaseUrl, _supabaseKey);

// ─── Types ───────────────────────────────────────────────────────────────────

interface CellData {
  p97: string;
  p3: string;
}

interface DayTable {
  [day: string]: CellData;
}

interface OrgTable {
  [org: string]: DayTable;
}

interface HistoryEntry {
  day: string;
  total_p97: number;
  total_p3: number;
  total_amount: number;
}

interface MonthData {
  days: string[];
  table: OrgTable;
  history: HistoryEntry[];
}

interface DBState {
  [month: string]: MonthData;
}

interface Theme {
  blue: string;
  green: string;
  gold: string;
  red: string;
  bg: string;
  card: string;
  card2: string;
  card3: string;
  border: string;
  border2: string;
  borderHeavy: string;
  text: string;
  textMed: string;
  textMute: string;
  textFaint: string;
  rowAlt: string;
  shadow: string;
  shadow2: string;
  p97Bg: string;
  p97Sum: string;
  p3Bg: string;
  p3Sum: string;
  p97Num: string | undefined;
  p3Num: string | undefined;
  numColor: string | undefined;
  totRow: string;
  msgOkBg: string;
  msgOkTxt: string;
  msgOkBdr: string;
  msgErrBg: string;
  msgErrTxt: string;
  msgErrBdr: string;
  tblHeadTxt: string;
  histBg: string;
  histBdr: string;
  totBg: string;
  totTxt: string;
}

interface Msg {
  ok: boolean;
  text: string;
}

interface MonthSummary {
  t97: number;
  t3: number;
  o97: number;
  o3: number;
  days: number;
}

interface ExtractRow {
  name: string;
  matched?: string;
  count?: number;
  p97?: number | string;
  p3?: number | string;
  amount?: number;
}

interface ExtractResponse {
  rows: ExtractRow[];
  total_count?: number;
  total_p97?: number;
  total_p3?: number;
  total_amount?: number;
  error?: string;
}

interface MTableProps {
  title: string;
  list: string[];
  days: string[];
  table: OrgTable;
  setCell: (org: string, day: string, field: 'p97' | 'p3', value: string) => void;
  T: Theme;
  sR: (tbl: OrgTable, org: string, days: string[], f: 'p97' | 'p3') => number;
  sD: (tbl: OrgTable, day: string, lst: string[], f: 'p97' | 'p3') => number;
  sG: (tbl: OrgTable, lst: string[], days: string[], f: 'p97' | 'p3') => number;
  n2: (n: number | string) => string;
}

interface SumViewProps {
  MONTHS: string[];
  mSum: (m: string) => MonthSummary;
  hasData: (m: string) => boolean;
  setMon: (m: string) => void;
  setMainTab: (tab: string) => void;
  setSubTab: (tab: string) => void;
  getM: (m: string) => MonthData;
  T: Theme;
  fmt: (n: number | null | undefined) => string;
  sR: (tbl: OrgTable, org: string, days: string[], f: 'p97' | 'p3') => number;
  isMobile: boolean;
}

interface ChartViewProps {
  MONTHS: string[];
  mSum: (m: string) => MonthSummary;
  getM: (m: string) => MonthData;
  T: Theme;
  fmt: (n: number | null | undefined) => string;
  sR: (tbl: OrgTable, org: string, days: string[], f: 'p97' | 'p3') => number;
  sG: (tbl: OrgTable, lst: string[], days: string[], f: 'p97' | 'p3') => number;
  isMobile: boolean;
}

interface SCardProps {
  label: string;
  p97: number;
  p3: number;
  color: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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
const MONTHS = ["ตุลาคม","พฤศจิกายน","ธันวาคม","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน"];

// ─── Utilities ────────────────────────────────────────────────────────────────

const currentFiscalYear = (): string => {
  const now = new Date();
  const m = now.getMonth()+1;
  const y = now.getFullYear()+543;
  return m >= 10 ? String(y+1) : String(y);
};

const mkTheme = (dark: boolean): Theme => ({
  blue:  "#0f4c81",
  green: "#1a7a4a",
  gold:  "#e8a020",
  red:   "#c0392b",
  bg:        dark ? "#0f1117" : "#f2f5f8",
  card:      dark ? "#1a1d23" : "#ffffff",
  card2:     dark ? "#212530" : "#f8f9fa",
  card3:     dark ? "#1e2230" : "#f1f5f9",
  border:    dark ? "#2d3340" : "#e2e8f0",
  border2:   dark ? "#3a404d" : "#d0d5dd",
  borderHeavy: dark ? "#4a5568" : "#aac4e0",
  text:      dark ? "#e2e8f0" : "#1a2744",
  textMed:   dark ? "#94a3b8" : "#555",
  textMute:  dark ? "#64748b" : "#888",
  textFaint: dark ? "#475569" : "#aaa",
  rowAlt:    dark ? "#161922" : "#fafbfc",
  shadow:    dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.07)",
  shadow2:   dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.2)",
  p97Bg:     dark ? "#1e3a5f" : "#f0f6ff",
  p97Sum:    dark ? "#162035" : "#eff6ff",
  p3Bg:      dark ? "#252830" : "#f9f9f9",
  p3Sum:     dark ? "#1c1e22" : "#f3f3f3",
  p97Num:    dark ? "#7eb8f7" : undefined,
  p3Num:     dark ? "#94a3b8" : undefined,
  numColor:  dark ? "#e2e8f0" : undefined,
  totRow:    dark ? "#0a0c10" : "#1a1a2e",
  msgOkBg:   dark ? "#0d2b1a" : "#e6f9ee",
  msgOkTxt:  dark ? "#4ade80" : "#1a6b38",
  msgOkBdr:  dark ? "#166534" : "#9de0b6",
  msgErrBg:  dark ? "#2b0d0d" : "#fde8e8",
  msgErrTxt: dark ? "#f87171" : "#c0392b",
  msgErrBdr: dark ? "#7f1d1d" : "#f5b7b1",
  tblHeadTxt:dark ? "#94a3b8" : "#4a5568",
  histBg:    dark ? "#0d2b1a" : "#f0fdf4",
  histBdr:   dark ? "#166534" : "#86efac",
  totBg:     dark ? "#1e3a5f" : "#dbeafe",
  totTxt:    dark ? "#93c5fd" : "#1e3a5f",
});

const initM = (): MonthData => ({ days:[], table:{}, history:[] });
const srtDays = (a: string[]): string[] => [...a].sort((x,y)=>parseInt(x)-parseInt(y));

function addDayTbl(table: OrgTable, day: string): OrgTable {
  const t = {...table};
  ALL.forEach(o => { t[o] = {...(t[o]||{}), [day]: t[o]?.[day] || {p97:"",p3:""}}; });
  return t;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function rmDayTbl(table: OrgTable, day: string): OrgTable {
  const t = {...table};
  ALL.forEach(o => { const r={...(t[o]||{})}; delete r[day]; t[o]=r; });
  return t;
}

const n2  = (n: number | string): string => { if(n===""||n===null||n===undefined) return ""; const v=parseFloat(String(n)); if(isNaN(v)) return ""; return v%1===0?v.toFixed(0):v.toFixed(2); };
const fmt = (n: number | null | undefined): string => { if(n===null||n===undefined) return "-"; const v=parseFloat(String(n)); if(isNaN(v)) return "-"; if(v===0) return "0.00"; return v.toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}); };
const sR  = (tbl: OrgTable, org: string, days: string[], f: 'p97' | 'p3'): number => days.reduce((s,d)=>s+(parseFloat(tbl[org]?.[d]?.[f])||0),0);
const sD  = (tbl: OrgTable, day: string, lst: string[], f: 'p97' | 'p3'): number  => lst.reduce((s,o)=>s+(parseFloat(tbl[o]?.[day]?.[f])||0),0);
const sG  = (tbl: OrgTable, lst: string[], days: string[], f: 'p97' | 'p3'): number => lst.reduce((s,o)=>s+sR(tbl,o,days,f),0);

function findOrg(name: string | null | undefined): string | null {
  if(!name) return null;
  const nm = (s: string) => s.replace(/\s+/g,"").replace("เทศบาลตำบล","ตำบล").replace("เทศบาลเมือง","เมือง").replace("อบต.","").replace("อบต","");
  const n=nm(name);
  return ALL.find(o=>{ const m=nm(o); return m===n||m.includes(n)||n.includes(m); })||null;
}

async function dbLoad(fy: string): Promise<DBState> {
  const {data,error}=await sb.from("monthly_data").select("*").like("month", `${fy}_%`);
  if(error) throw error;
  const out: DBState={};
  (data||[]).forEach((r: { month: string; days: string[]; table_data: OrgTable; history: HistoryEntry[] })=>{
    const mon = r.month.includes("_") ? r.month.split("_")[1] : r.month;
    out[mon]={days:r.days||[],table:r.table_data||{},history:r.history||[]};
  });
  return out;
}

async function dbSave(month: string, data: MonthData, fy: string): Promise<void> {
  const key = `${fy}_${month}`;
  const {error}=await sb.from("monthly_data").upsert(
    {month:key, days:data.days, table_data:data.table, history:data.history, updated_at:new Date().toISOString()},
    {onConflict:"month"}
  );
  if(error) throw error;
}

function exportExcel(mon: string, days: string[], table: OrgTable): void {
  const rows: (string | number)[][] = [];
  const h1: (string | number)[] = ["หน่วยงาน"];
  const h2: (string | number)[] = [""];
  days.forEach(d => { h1.push(`วันที่ ${d}`, ""); h2.push("97%","3%"); });
  h1.push("รวม 97%","รวม 3%","รวมทั้งหมด");
  h2.push("","","");
  rows.push(h1, h2);
  rows.push(["เทศบาล"]);
  TESSABAN.forEach(org => {
    const row: (string | number)[] = [org];
    days.forEach(d => { row.push(table[org]?.[d]?.p97??""  , table[org]?.[d]?.p3??""); });
    const r97=sR(table,org,days,"p97"), r3=sR(table,org,days,"p3");
    row.push(r97, r3, r97+r3);
    rows.push(row);
  });
  rows.push(["อบต."]);
  OBT.forEach(org => {
    const row: (string | number)[] = [org];
    days.forEach(d => { row.push(table[org]?.[d]?.p97??"", table[org]?.[d]?.p3??""); });
    const r97=sR(table,org,days,"p97"), r3=sR(table,org,days,"p3");
    row.push(r97, r3, r97+r3);
    rows.push(row);
  });
  const tot: (string | number)[] = ["รวมทั้งหมด"];
  days.forEach(d => { tot.push(sD(table,d,ALL,"p97"), sD(table,d,ALL,"p3")); });
  tot.push(sG(table,ALL,days,"p97"), sG(table,ALL,days,"p3"), sG(table,ALL,days,"p97")+sG(table,ALL,days,"p3"));
  rows.push(tot);
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadBlob(new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8;"}), `ยอดรายวัน_${mon}.csv`);
}

function exportBackup(DB: DBState, fiscalYear: string): void {
  const rows: (string | number)[][] = [["ปีงบประมาณ","เดือน","วันที่","หน่วยงาน","97%","3%"]];
  Object.entries(DB).forEach(([mon, md]) => {
    (md.days||[]).forEach(day => {
      ALL.forEach(org => {
        const cell = md.table?.[org]?.[day];
        if (cell?.p97 || cell?.p3) {
          rows.push([fiscalYear, mon, day, org, cell.p97||"", cell.p3||""]);
        }
      });
    });
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadBlob(new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8;"}), `backup_tessaban_${fiscalYear}_${new Date().toISOString().slice(0,10)}.csv`);
}

function useIsMobile(): boolean {
  const [m, setM] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return m;
}

// ─── ErrorBoundary ────────────────────────────────────────────────────────────

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,background:'#f2f5f8',fontFamily:"'Noto Sans Thai','Sarabun',sans-serif",padding:24}}>
          <div style={{fontSize:48}}>⚠️</div>
          <div style={{fontSize:20,fontWeight:800,color:'#c0392b'}}>เกิดข้อผิดพลาด</div>
          <div style={{fontSize:13,color:'#555',maxWidth:480,textAlign:'center',wordBreak:'break-all'}}>{this.state.error.message}</div>
          <button onClick={()=>window.location.reload()} style={{padding:'10px 24px',background:'#0f4c81',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:15,fontWeight:700}}>โหลดหน้าใหม่</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [isDark,   setIsDark]   = useState(() => localStorage.getItem("theme") === "dark");
  const [ready,    setReady]    = useState(false);
  const [saving,   setSaving]   = useState("");
  const [fiscalYear, setFiscalYear] = useState(currentFiscalYear);
  const [mainTab,  setMainTab]  = useState("monthly");
  const [subTab,   setSubTab]   = useState("import");
  const [mon,      setMon]      = useState("ตุลาคม");
  const [DB,       setDB]       = useState<DBState>({});
  const [msg,      setMsg]      = useState<Msg | null>(null);
  const [mDay,     setMDay]     = useState("");
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [showDayModal,  setShowDayModal]  = useState(false);
  const [pendingPdf,    setPendingPdf]    = useState<File | null>(null);
  const [pdfDay,        setPdfDay]        = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);
  const [reviewData, setReviewData] = useState<{ parsed: ExtractResponse; dayStr: string; activeMon: string } | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const dirty    = useRef<Set<string>>(new Set());
  const isMobile = useIsMobile();

  // Undo refs
  const undoRef      = useRef<{ mon: string; day: string; data: MonthData } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore backup ref
  const importBackupRef = useRef<HTMLInputElement>(null);

  const T = useMemo(() => mkTheme(isDark), [isDark]);

  const toggleDark = () => setIsDark(d => {
    localStorage.setItem("theme", d ? "light" : "dark");
    return !d;
  });

  const getM    = useCallback((m: string): MonthData => DB[m]||initM(), [DB]);
  const hasData = useCallback((m: string): boolean => (DB[m]?.days?.length||0)>0, [DB]);
  const cur     = getM(mon);

  const setM = useCallback((m: string, fn: (c: MonthData) => MonthData) => {
    setDB(prev=>{ const c=prev[m]||initM(); return {...prev,[m]:fn(c)}; });
    dirty.current.add(m);
  },[]);

  // showConfirm helper
  const showConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirmDialog({ message, onConfirm });
  }, []);

  useEffect(()=>{
    setReady(false); setDB({});
    dirty.current.clear();
    dbLoad(fiscalYear).then(d=>{ if(Object.keys(d).length) setDB(d); }).catch(console.error).finally(()=>setReady(true));
  },[fiscalYear]);

  const DBRef = useRef<DBState>(DB);
  useEffect(() => { DBRef.current = DB; }, [DB]);

  useEffect(()=>{
    if(!ready) return;
    const t=setTimeout(async()=>{
      const months=[...dirty.current];
      if(!months.length) return;
      // Snapshot the months to save BEFORE clearing, in case save fails
      setSaving("saving");
      try{
        const snapshot = DBRef.current;
        await Promise.all(months.map(m=>{
          const md=snapshot[m];
          if(!md) return Promise.resolve();
          return dbSave(m,md,fiscalYear);
        }));
        // Only clear dirty after successful save
        months.forEach(m => dirty.current.delete(m));
        setSaving("saved"); setTimeout(()=>setSaving(""),2500);
      }
      catch(e){ console.error(e); setSaving("error"); }
    },1200);
    return()=>clearTimeout(t);
  },[DB,ready,fiscalYear]);

  const pushDay = useCallback((d: string, mo?: string)=>{
    const n=parseInt(d); if(!n||n<1||n>31) return;
    const s=String(n), month=mo||mon;
    setM(month,c=>{ if(c.days.includes(s)) return c; return {...c,days:srtDays([...c.days,s]),table:addDayTbl({...c.table},s)}; });
  },[mon,setM]);

  // dropDay with undo snapshot
  const dropDay = useCallback((d: string)=>{
    setDB(prev => {
      const snapshot = prev[mon];
      if (snapshot) {
        undoRef.current = { mon, day: d, data: JSON.parse(JSON.stringify(snapshot)) };
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => { undoRef.current = null; }, 8000);
      }
      const updated = { ...prev };
      const c = prev[mon];
      if (c) {
        updated[mon] = {
          ...c,
          days: c.days.filter((x: string) => x !== d),
          table: rmDayTbl({ ...c.table }, d),
          history: c.history.filter((h: HistoryEntry) => h.day !== d)
        };
      }
      return updated;
    });
    dirty.current.add(mon);
    setMsg({ ok: true, text: `🗑️ ลบวันที่ ${d} แล้ว` });
  },[mon]);

  const setCell = useCallback((org: string, day: string, f: 'p97' | 'p3', v: string)=>{
    setM(mon,c=>({...c,table:{...c.table,[org]:{...c.table[org],[day]:{...c.table[org]?.[day],[f]:v}}}}));
  },[mon,setM]);

  const handlePdfPick = (file: File | undefined | null) => {
    if (!file) return;
    const ok = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!ok) { setMsg({ok:false,text:"รองรับเฉพาะ PDF และรูปภาพ"}); return; }
    setPendingPdf(file); setPdfDay(""); setShowDayModal(true);
  };

  const extractPdf = async (file: File | null, dayStr: string) => {
    if (!file) return;
    // Capture the active month at the moment the user confirmed extraction,
    // so stale-closure issues can't cause data to land in the wrong month.
    const activeMon = mon;
    setShowDayModal(false); setPdfLoading(true);
    setMsg({ok:true,text:`⏳ Claude กำลังอ่าน PDF วันที่ ${dayStr}...`});
    try {
      const b64 = await new Promise<string>((res,rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: b64, mimeType: file.type })
      });
      let parsed: ExtractResponse;
      try { parsed = await resp.json(); } catch { throw new Error('API ไม่ตอบสนอง — ตรวจสอบว่า API server รันอยู่'); }
      if (!resp.ok || parsed.error) throw new Error(parsed.error || 'เกิดข้อผิดพลาด');
      if (!Array.isArray(parsed?.rows)) throw new Error('ไม่พบข้อมูลในเอกสาร');

      if (getM(activeMon).history.find(h=>h.day===dayStr)) {
        let userCancelled = false;
        await new Promise<void>((resolve, reject) => {
          setConfirmDialog({
            message: `⚠️ วันที่ ${dayStr} เดือน${activeMon} มีข้อมูลอยู่แล้ว\nต้องการแทนที่มั้ย?`,
            onConfirm: resolve,
            onCancel: reject,
          });
        }).catch(() => { userCancelled = true; });
        if (userCancelled) return;
        // If we reach here the user confirmed — proceed
      }

      // Show review modal instead of saving immediately
      setPdfLoading(false);
      setMsg({ok:true, text:`✅ Claude อ่านสำเร็จ! กรุณาตรวจสอบข้อมูลก่อนบันทึก`});
      setReviewData({ parsed, dayStr, activeMon });
    } catch(e) {
      setMsg({ok:false, text:`❌ ${(e as Error).message}`});
    } finally {
      setPdfLoading(false); setPendingPdf(null);
    }
  };

  const handleImportBackup = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.replace(/^﻿/, '').split('\n').filter(l => l.trim());
      const rows = lines.slice(1).map(line => {
        const cols = line.match(/"([^"]*)"/g)?.map(c => c.slice(1,-1)) || [];
        return { fy: cols[0], mon: cols[1], day: cols[2], org: cols[3], p97: cols[4]||'', p3: cols[5]||'' };
      }).filter(r => r.mon && r.day && r.org);

      if (!rows.length) { setMsg({ ok: false, text: '❌ ไม่พบข้อมูลในไฟล์' }); return; }

      const restoredFy = rows[0].fy || fiscalYear;
      setDB(prev => {
        const next: DBState = { ...prev };
        rows.forEach(({ mon: rowMon, day, org, p97, p3 }) => {
          if (!next[rowMon]) next[rowMon] = { days: [], table: {}, history: [] };
          const c = next[rowMon];
          if (!c.days.includes(day)) {
            c.days = [...c.days, day].sort((a,b) => parseInt(a)-parseInt(b));
          }
          ALL.forEach(o => { if (!c.table[o]) c.table[o] = {}; if (!c.table[o][day]) c.table[o][day] = {p97:'',p3:''}; });
          if (c.table[org]?.[day] !== undefined) c.table[org][day] = { p97, p3 };
          dirty.current.add(rowMon);
        });
        return next;
      });

      setMsg({ ok: true, text: `✅ Restore สำเร็จ! ${rows.length} แถว (ปี ${restoredFy})` });
    } catch(e) {
      setMsg({ ok: false, text: `❌ อ่านไฟล์ไม่ได้: ${(e as Error).message}` });
    }
  }, [fiscalYear]);

  const mSum = useCallback((m: string): MonthSummary =>{
    const {days,table}=getM(m);
    return{t97:sG(table,TESSABAN,days,"p97"),t3:sG(table,TESSABAN,days,"p3"),o97:sG(table,OBT,days,"p97"),o3:sG(table,OBT,days,"p3"),days:days.length};
  },[getM]);

  const confirmReview = useCallback(() => {
    if (!reviewData) return;
    const { parsed, dayStr, activeMon } = reviewData;
    setM(activeMon, c => {
      const nd = c.days.includes(dayStr) ? c.days : srtDays([...c.days, dayStr]);
      const nt = addDayTbl({...c.table}, dayStr);
      parsed.rows.forEach(r => {
        const f = findOrg(r.matched || r.name);
        if (f && (r.p97 != null || r.p3 != null)) nt[f][dayStr] = {p97: r.p97!=null?String(r.p97):"", p3: r.p3!=null?String(r.p3):""};
      });
      const nh = [...c.history.filter(h=>h.day!==dayStr),
        {day:dayStr, total_p97:parsed.total_p97||0, total_p3:parsed.total_p3||0, total_amount:parsed.total_amount||0}
      ].sort((a,b)=>parseInt(a.day)-parseInt(b.day));
      return {...c, days:nd, table:nt, history:nh};
    });
    const matched = parsed.rows.filter(r=>findOrg(r.matched||r.name)).length;
    setMsg({ok:true, text:`✅ บันทึกแล้ว! วันที่ ${dayStr}: จับคู่ได้ ${matched}/${parsed.rows.length} รายการ`});
    setSubTab("monthtable");
    setReviewData(null);
  }, [reviewData, setM]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDayModal) setShowDayModal(false);
        if (confirmDialog) { confirmDialog.onCancel?.(); setConfirmDialog(null); }
        if (reviewData) setReviewData(null);
        if (msg) setMsg(null);
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
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Noto Sans Thai','Sarabun',sans-serif",transition:"background .2s",paddingBottom:isMobile?64:0}}>
      <style>{`
        @media print {
          .no-print { display:none!important; }
          .print-only { display:block!important; }
          body { background:#fff!important; margin:0; }
          * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          @page { size: A4 landscape; margin: 10mm; }
        }
        .print-only { display:none; }
      `}</style>

      {/* Header */}
      <header className="no-print" style={{background:`linear-gradient(135deg,${T.blue},#1a6bb5)`,color:"#fff",padding:"0 12px",display:"flex",alignItems:"center",gap:8,boxShadow:`0 3px 12px ${T.shadow2}`,position:"sticky",top:0,zIndex:100,minHeight:54}}>
        <span style={{fontSize:20}}>🏛️</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:800,fontSize:isMobile?12:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>ระบบบันทึกยอดรายวัน เทศบาล / อบต.</div>
          {!isMobile&&<div style={{fontSize:10,opacity:.75}}>ปีงบประมาณ {fiscalYear} | ส่ง PDF → Claude อ่านอัตโนมัติ</div>}
        </div>
        {saving&&<div style={{fontSize:10,padding:"2px 8px",borderRadius:12,background:saving==="saved"?"rgba(26,122,74,0.9)":saving==="error"?"rgba(192,57,43,0.9)":"rgba(255,255,255,0.2)",color:"#fff",whiteSpace:"nowrap"}}>{saving==="saving"?"💾...":saving==="saved"?"✅":"❌"}</div>}
        <select value={fiscalYear} onChange={e=>{ setFiscalYear(e.target.value); setMon("ตุลาคม"); }}
          style={{padding:"4px 6px",borderRadius:8,border:"none",fontFamily:"inherit",fontSize:11,fontWeight:700,background:"rgba(255,255,255,0.15)",color:"#fff",cursor:"pointer"}}>
          {Array.from({ length: 6 }, (_, i) => parseInt(fiscalYear) - 3 + i).map(y=><option key={y} value={String(y)} style={{color:"#000"}}>ปี {y}</option>)}
        </select>
        {!isMobile&&<div style={{display:"flex",gap:5,alignItems:"center"}}>
          {[["monthly","📅 รายเดือน"],["summary","📊 รายปี"],["chart","📈 กราฟ"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setMainTab(id)} style={{padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,background:mainTab===id?T.gold:"rgba(255,255,255,0.15)",color:mainTab===id?"#1a1a1a":"#fff"}}>{lbl}</button>
          ))}
          <button onClick={()=>exportBackup(DB, fiscalYear)} style={{padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,background:"rgba(255,255,255,0.15)",color:"#fff"}} title="Backup">💾</button>
        </div>}
        <button onClick={toggleDark} style={{padding:"4px 8px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:14,background:"rgba(255,255,255,0.15)",color:"#fff"}} title={isDark?"Light mode":"Dark mode"}>{isDark?"☀️":"🌙"}</button>
      </header>

      {!ready&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"70vh",gap:16}}><div style={{fontSize:42}}>⏳</div><div style={{fontSize:16,color:T.textMute,fontWeight:600}}>กำลังโหลดข้อมูล...</div></div>}

      {ready&&<>
        {/* Msg bar with Undo button */}
        {msg&&<div className="no-print" style={{margin:"10px 16px 0",padding:"9px 14px",borderRadius:8,fontSize:13,fontWeight:500,display:"flex",justifyContent:"space-between",alignItems:"center",background:msg.ok?T.msgOkBg:T.msgErrBg,color:msg.ok?T.msgOkTxt:T.msgErrTxt,border:`1px solid ${msg.ok?T.msgOkBdr:T.msgErrBdr}`}}>
          <span>{msg.text}</span>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {undoRef.current && (
              <button onClick={() => {
                const u = undoRef.current;
                if (!u) return;
                setDB(prev => ({ ...prev, [u.mon]: u.data }));
                dirty.current.add(u.mon);
                undoRef.current = null;
                if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                setMsg({ ok: true, text: `↩️ คืนข้อมูลวันที่ ${u.day} แล้ว` });
              }} style={{padding:'2px 10px',background:T.blue,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700}}>
                ↩️ Undo
              </button>
            )}
            <button onClick={()=>setMsg(null)} style={{border:"none",background:"none",cursor:"pointer",fontSize:16,opacity:.5,color:msg.ok?T.msgOkTxt:T.msgErrTxt}}>×</button>
          </div>
        </div>}

        {/* MONTHLY */}
        {mainTab==="monthly"&&<div style={{padding:isMobile?"8px 10px":"12px 16px"}}>
          <div className="no-print" style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
            {MONTHS.map(m=>(
              <button key={m} onClick={()=>{setMon(m);setSubTab("import");}} style={{padding:"4px 12px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,position:"relative",background:mon===m?T.blue:hasData(m)?isDark?"#0d2b1a":"#d1fae5":isDark?T.card2:"#e2e8f0",color:mon===m?"#fff":hasData(m)?T.green:T.textMed}}>
                {m}{hasData(m)&&mon!==m&&<span style={{position:"absolute",top:-3,right:-3,width:7,height:7,background:T.green,borderRadius:"50%",border:"1.5px solid #fff"}}/>}
              </button>
            ))}
          </div>

          <div className="no-print" style={{display:"flex",background:T.card,borderRadius:10,overflow:"hidden",boxShadow:`0 1px 4px ${T.shadow}`,width:"fit-content",marginBottom:14}}>
            {[["import","📋 นำเข้า"],["monthtable","📅 ตารางเดือน"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>setSubTab(id)} style={{padding:"7px 15px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,background:subTab===id?T.blue:"transparent",color:subTab===id?"#fff":T.textMed}}>{lbl}</button>
            ))}
          </div>

          {/* IMPORT */}
          {subTab==="import"&&<div style={{maxWidth:640,margin:"0 auto"}}>

            {/* Day modal */}
            {showDayModal&&(
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
                <div style={{background:T.card,borderRadius:16,padding:"28px 28px",width:"100%",maxWidth:340,boxShadow:`0 8px 40px ${T.shadow2}`}}>
                  <div style={{fontWeight:800,fontSize:20,color:T.blue,marginBottom:4}}>📅 วันที่ในเอกสาร</div>
                  <div style={{fontSize:13,color:T.textMute,marginBottom:16}}>เดือน {mon} — วันที่เท่าไร?</div>
                  <input type="text" inputMode="numeric" placeholder="เช่น 1, 15, 30" value={pdfDay}
                    onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");if(v===""||parseInt(v)<=31)setPdfDay(v);}}
                    onKeyDown={e=>{if(e.key==="Enter"&&pdfDay)extractPdf(pendingPdf,String(parseInt(pdfDay)));}}
                    autoFocus
                    style={{width:"100%",padding:"12px",borderRadius:10,border:`2px solid ${pdfDay?T.blue:T.border2}`,background:T.card2,color:T.text,fontFamily:"inherit",fontSize:22,textAlign:"center",boxSizing:"border-box",marginBottom:16,outline:"none"}}/>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={()=>{ setShowDayModal(false); setPendingPdf(null); setPdfDay(""); }} style={{flex:1,padding:10,border:`1px solid ${T.border}`,borderRadius:10,background:T.card2,color:T.textMed,cursor:"pointer",fontFamily:"inherit",fontSize:14}}>ยกเลิก</button>
                    <button onClick={()=>{if(pdfDay)extractPdf(pendingPdf,String(parseInt(pdfDay)));}} disabled={!pdfDay}
                      style={{flex:2,padding:10,background:pdfDay?T.blue:"#ccc",color:"#fff",border:"none",borderRadius:10,cursor:pdfDay?"pointer":"default",fontFamily:"inherit",fontSize:15,fontWeight:800}}>
                      🔍 อ่านข้อมูล
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PDF Drop Zone */}
            <div
              onDrop={e=>{e.preventDefault();handlePdfPick(e.dataTransfer.files[0]);}}
              onDragOver={e=>e.preventDefault()}
              onClick={()=>!pdfLoading&&fileRef.current?.click()}
              style={{border:`2.5px dashed ${pdfLoading?T.textFaint:T.blue}`,borderRadius:14,padding:"36px 24px",textAlign:"center",background:T.card,cursor:pdfLoading?"default":"pointer",boxShadow:`0 2px 8px ${T.shadow}`,marginBottom:14}}>
              <div style={{fontSize:46,marginBottom:10}}>{pdfLoading?"⏳":"📄"}</div>
              <div style={{fontSize:17,fontWeight:800,color:pdfLoading?T.textFaint:T.blue,marginBottom:6}}>
                {pdfLoading?"Claude กำลังอ่าน PDF...":`วาง PDF หรือรูปภาพที่นี่ — เดือน${mon}`}
              </div>
              <div style={{fontSize:13,color:T.textMute}}>รองรับ PDF · PNG · JPG · Claude อ่านและจัดข้อมูลอัตโนมัติ</div>
              <input ref={fileRef} type="file" accept=".pdf,image/*" style={{display:"none"}} onChange={e=>handlePdfPick(e.target.files?.[0])}/>
            </div>

            {/* Manual day add */}
            <div style={{background:T.card,borderRadius:12,padding:"14px 16px",marginTop:14,boxShadow:`0 1px 6px ${T.shadow}`}}>
              <div style={{fontWeight:700,color:T.blue,marginBottom:8,fontSize:13}}>⚙️ เพิ่มวันเปล่าด้วยตนเอง</div>
              <div style={{display:"flex",gap:8}}>
                <input type="text" inputMode="numeric" placeholder="วันที่ เช่น 5" value={mDay} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");if(v===""||parseInt(v)<=31)setMDay(v);}} onKeyDown={e=>{if(e.key==="Enter"){pushDay(mDay);setMDay("");}}} style={{width:110,padding:"7px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:T.card2,color:T.text,fontFamily:"inherit",fontSize:14}}/>
                <button onClick={()=>{pushDay(mDay);setMDay("");}} style={{padding:"7px 14px",background:T.blue,color:"#fff",border:"none",borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:700}}>+ เพิ่ม</button>
              </div>
              {cur.days.length>0&&<div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:6}}>{cur.days.map(d=><span key={d} style={{background:isDark?"#162035":"#e8f0fe",color:T.blue,padding:"3px 10px 3px 12px",borderRadius:20,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>{d}<button onClick={()=>dropDay(d)} style={{border:"none",background:"none",color:T.red,cursor:"pointer",fontSize:14,padding:0,lineHeight:1}}>×</button></span>)}</div>}
            </div>

            {/* Restore from CSV Backup */}
            <div style={{background:T.card,borderRadius:12,padding:"14px 16px",marginTop:14,boxShadow:`0 1px 6px ${T.shadow}`}}>
              <div style={{fontWeight:700,color:T.green,marginBottom:8,fontSize:13}}>📥 Restore จาก CSV Backup</div>
              <button onClick={()=>importBackupRef.current?.click()}
                style={{padding:'8px 16px',background:T.green,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700}}>
                📂 เลือกไฟล์ backup CSV
              </button>
              <input ref={importBackupRef} type="file" accept=".csv" style={{display:'none'}}
                onChange={e=>{const f=e.target.files?.[0];if(f)handleImportBackup(f);e.target.value='';}}/>
            </div>
          </div>}

          {/* MONTH TABLE */}
          {subTab==="monthtable"&&<div>
            <div className="no-print" style={{display:"flex",gap:10,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontWeight:800,fontSize:16,color:T.blue}}>ตารางรวมเดือน {mon}</span>
              <span style={{fontSize:13,color:T.textMute}}>| {cur.days.length} วัน</span>
              <div style={{marginLeft:"auto",display:"flex",gap:8}}>
                {cur.days.length>0&&<>
                  <button onClick={()=>exportExcel(mon,cur.days,cur.table)} style={{padding:"6px 14px",background:T.green,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700}}>📊 Export CSV</button>
                  <button onClick={()=>window.print()} style={{padding:"6px 14px",background:T.textMed,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700}}>🖨️ พิมพ์</button>
                </>}
              </div>
            </div>

            {cur.days.length===0
              ?<div style={{textAlign:"center",padding:60,color:T.textFaint,background:T.card,borderRadius:12}}><div style={{fontSize:44,marginBottom:10}}>📅</div><div>ยังไม่มีข้อมูล — ไปที่แท็บ "📋 นำเข้า"</div></div>
              :<>
                {cur.history.length>0&&<div className="no-print" style={{background:T.card,borderRadius:10,padding:"12px 16px",marginBottom:14,boxShadow:`0 1px 4px ${T.shadow}`}}><div style={{fontSize:12,fontWeight:700,color:T.textMed,marginBottom:8}}>📄 นำเข้าแล้ว — กด 🗑️ เพื่อลบวันนั้น</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{cur.history.map(h=><div key={h.day} style={{background:T.histBg,border:`1px solid ${T.histBdr}`,borderRadius:8,padding:"5px 12px",fontSize:12,display:"flex",alignItems:"center",gap:10}}><div><span style={{fontWeight:700,color:T.green}}>วันที่ {h.day}</span><span style={{color:T.textMute,marginLeft:8}}>97%: {(h.total_p97||0).toFixed(2)} | 3%: {(h.total_p3||0).toFixed(2)} | รวม: {(h.total_amount||0).toFixed(2)}</span></div>
                  <button onClick={()=>showConfirm(`ลบข้อมูลวันที่ ${h.day} เดือน${mon}?`, ()=>dropDay(h.day))} style={{border:"none",background:T.msgErrBg,color:T.red,cursor:"pointer",borderRadius:6,padding:"3px 7px",fontSize:13,fontWeight:700}}>🗑️</button></div>)}</div></div>}

                <div className="print-only" style={{marginBottom:20,borderBottom:"2px solid #0f4c81",paddingBottom:12}}>
                  <div style={{textAlign:"center",fontSize:16,fontWeight:800,color:"#0f4c81",marginBottom:4}}>รายงานยอดเงินอุดหนุนรายวัน</div>
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
                  <SCard label="รวมเทศบาล" p97={tSum97} p3={tSum3} color={T.blue}/>
                  <SCard label="รวม อบต." p97={oSum97} p3={oSum3} color={T.green}/>
                  <div style={{background:"#1a1a2e",color:"#fff",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:11,opacity:.7,marginBottom:3}}>ยอดรวมเดือน{mon}</div>
                    <div style={{fontSize:20,fontWeight:900,color:T.gold}}>{(aSum97+aSum3).toFixed(2)}</div>
                    <div style={{fontSize:10,opacity:.6,marginTop:2}}>97%: {aSum97.toFixed(2)} | 3%: {aSum3.toFixed(2)}</div>
                  </div>
                </div>
              </>}
          </div>}

        </div>}

        {/* SUMMARY */}
        {mainTab==="summary"&&<SumView MONTHS={MONTHS} mSum={mSum} hasData={hasData} setMon={setMon} setMainTab={setMainTab} setSubTab={setSubTab} getM={getM} T={T} fmt={fmt} sR={sR} isMobile={isMobile}/>}

        {/* CHART */}
        {mainTab==="chart"&&<ChartView MONTHS={MONTHS} mSum={mSum} getM={getM} T={T} fmt={fmt} sR={sR} sG={sG} isMobile={isMobile}/>}
      </>}

      {/* Confirm Modal */}
      {confirmDialog && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:T.card,borderRadius:16,padding:'28px 28px',width:'100%',maxWidth:360,boxShadow:`0 8px 40px ${T.shadow2}`}}>
            <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:20,lineHeight:1.6,whiteSpace:'pre-line'}}>{confirmDialog.message}</div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{ confirmDialog.onCancel?.(); setConfirmDialog(null); }} style={{flex:1,padding:10,border:`1px solid ${T.border}`,borderRadius:10,background:T.card2,color:T.textMed,cursor:'pointer',fontFamily:'inherit',fontSize:14}}>ยกเลิก</button>
              <button onClick={()=>{confirmDialog.onConfirm();setConfirmDialog(null);}} style={{flex:2,padding:10,background:T.red,color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:15,fontWeight:800}}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewData && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16,overflowY:'auto'}}>
          <div style={{background:T.card,borderRadius:16,padding:'24px 24px',width:'100%',maxWidth:600,boxShadow:`0 8px 40px ${T.shadow2}`,maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
            <div style={{fontWeight:800,fontSize:17,color:T.blue,marginBottom:4}}>🔍 ตรวจสอบข้อมูลที่ Claude อ่าน</div>
            <div style={{fontSize:13,color:T.textMute,marginBottom:14}}>วันที่ {reviewData.dayStr} เดือน{reviewData.activeMon} — กรุณาตรวจสอบก่อนบันทึก</div>
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
                  {reviewData.parsed.rows.map((r, i) => {
                    const matched = findOrg(r.matched || r.name);
                    const isUnmatched = !matched;
                    return (
                      <tr key={i} style={{background:isUnmatched?(isDark?'#2b0d0d':'#fde8e8'):i%2===0?T.card:T.rowAlt}}>
                        <td style={{padding:'5px 10px',borderBottom:`1px solid ${T.border}`,color:isUnmatched?T.red:T.text,fontWeight:isUnmatched?700:400}}>{r.name}</td>
                        <td style={{padding:'5px 10px',borderBottom:`1px solid ${T.border}`,color:isUnmatched?T.red:T.textMed,fontSize:11}}>{matched || '— ไม่พบ —'}</td>
                        <td style={{padding:'5px 8px',borderBottom:`1px solid ${T.border}`,textAlign:'right',color:T.blue,fontWeight:600}}>{r.p97 != null ? String(r.p97) : ''}</td>
                        <td style={{padding:'5px 8px',borderBottom:`1px solid ${T.border}`,textAlign:'right',color:T.textMute}}>{r.p3 != null ? String(r.p3) : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{fontSize:12,color:T.textMute,marginBottom:14}}>
              จับคู่ได้ {reviewData.parsed.rows.filter(r=>findOrg(r.matched||r.name)).length}/{reviewData.parsed.rows.length} รายการ
              {reviewData.parsed.rows.some(r=>!findOrg(r.matched||r.name)) && <span style={{color:T.red,fontWeight:700}}> · แถวสีแดง = ไม่พบในระบบ (จะไม่ถูกบันทึก)</span>}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setReviewData(null)} style={{flex:1,padding:10,border:`1px solid ${T.border}`,borderRadius:10,background:T.card2,color:T.textMed,cursor:'pointer',fontFamily:'inherit',fontSize:14}}>❌ ยกเลิก</button>
              <button onClick={confirmReview} style={{flex:2,padding:10,background:T.blue,color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:15,fontWeight:800}}>✅ บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      {isMobile&&<nav className="no-print" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:200,background:T.card,borderTop:`1px solid ${T.border}`,display:"flex",boxShadow:`0 -2px 8px ${T.shadow}`}}>
        {[["monthly","📅","รายเดือน"],["summary","📊","รายปี"],["chart","📈","กราฟ"],["backup","💾","สำรอง"]].map(([id,ico,lbl])=>(
          <button key={id} onClick={id==="backup"?()=>exportBackup(DB, fiscalYear):()=>setMainTab(id)}
            style={{flex:1,border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"7px 0 5px",gap:2,color:mainTab===id&&id!=="backup"?T.blue:T.textMute,fontFamily:"inherit",transition:"color .15s"}}>
            <span style={{fontSize:22}}>{ico}</span>
            <span style={{fontSize:9,fontWeight:700}}>{lbl}</span>
          </button>
        ))}
      </nav>}
    </div>
  );
}

// ─── MTable ───────────────────────────────────────────────────────────────────

function MTable({title,list,days,table,setCell,T,sR,sD,sG,n2}: MTableProps){
  const col=title==="เทศบาล"?T.blue:T.green;
  const NW=160,CW=48;
  const hdr97=sG(table,list,days,"p97"), hdr3=sG(table,list,days,"p3");
  return(
    <div style={{background:T.card,borderRadius:12,overflow:"hidden",boxShadow:`0 2px 8px ${T.shadow}`}}>
      <div style={{background:col,color:"#fff",padding:"8px 14px",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontWeight:800,fontSize:14}}>{title}</span>
        <span style={{fontSize:11,opacity:.75,background:"rgba(255,255,255,0.2)",padding:"1px 8px",borderRadius:20}}>97% / 3%</span>
        <span style={{marginLeft:"auto",fontSize:11,opacity:.85}}>Σ97%: {hdr97.toFixed(2)} | Σ3%: {hdr3.toFixed(2)} | รวม: {(hdr97+hdr3).toFixed(2)}</span>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",fontSize:11.5,tableLayout:"fixed",minWidth:NW+days.length*CW*2+190}}>
          <thead>
            <tr style={{background:T.card3}}>
              <th style={{width:NW,padding:"6px 8px",textAlign:"left",fontWeight:700,fontSize:12,color:T.tblHeadTxt,borderBottom:`1px solid ${T.border}`,borderRight:`2px solid ${T.borderHeavy}`}}>หน่วยงาน</th>
              {days.map(d=><th key={d} colSpan={2} style={{width:CW*2,padding:"6px 4px",textAlign:"center",fontWeight:700,fontSize:12,color:col,borderBottom:`1px solid ${T.border}`,borderRight:`2px solid ${T.borderHeavy}`}}>วันที่ {d}</th>)}
              <th colSpan={3} style={{width:190,padding:"6px 4px",textAlign:"center",fontWeight:700,fontSize:12,color:col,background:T.p97Bg,borderBottom:`1px solid ${T.border}`}}>รวมทั้งเดือน</th>
            </tr>
            <tr style={{borderBottom:`2px solid ${T.borderHeavy}`}}>
              <th style={{width:NW,padding:"4px 8px",background:T.card3,borderRight:`2px solid ${T.borderHeavy}`}}/>
              {days.map(d=><React.Fragment key={d}>
                <th style={{width:CW,padding:"4px 2px",textAlign:"center",fontWeight:700,fontSize:10,color:"#fff",background:col}}>97%</th>
                <th style={{width:CW,padding:"4px 2px",textAlign:"center",fontWeight:700,fontSize:10,color:"#fff",background:"#888",borderRight:`2px solid ${T.borderHeavy}`}}>3%</th>
              </React.Fragment>)}
              <th style={{width:60,padding:"4px 2px",textAlign:"center",fontWeight:700,fontSize:10,color:"#fff",background:col}}>97%</th>
              <th style={{width:60,padding:"4px 2px",textAlign:"center",fontWeight:700,fontSize:10,color:"#fff",background:"#888"}}>3%</th>
              <th style={{width:70,padding:"4px 2px",textAlign:"center",fontWeight:800,fontSize:10,color:T.totTxt,background:T.totBg}}>รวม</th>
            </tr>
          </thead>
          <tbody>
            {list.map((org,i)=>{
              const r97=sR(table,org,days,"p97"),r3=sR(table,org,days,"p3");
              return(<tr key={org} style={{background:i%2===0?T.card:T.rowAlt}}>
                <td style={{padding:"3px 8px",borderBottom:`1px solid ${T.border}`,borderRight:`2px solid ${T.borderHeavy}`,fontWeight:500,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontSize:12}}>{org}</td>
                {days.map(d=><React.Fragment key={d}>
                  <td style={{padding:2,borderBottom:`1px solid ${T.border}`,background:T.p97Bg}}>
                    <input type="text" inputMode="decimal" value={table[org]?.[d]?.p97??""} onChange={e=>setCell(org,d,"p97",e.target.value.replace(/[^0-9.]/g,""))} style={{width:"100%",border:"none",background:"transparent",textAlign:"right",padding:"3px 4px",fontFamily:"inherit",fontSize:11.5,outline:"none",color:T.p97Num||col,fontWeight:600,boxSizing:"border-box"}}/>
                  </td>
                  <td style={{padding:2,borderBottom:`1px solid ${T.border}`,borderRight:`2px solid ${T.borderHeavy}`,background:T.p3Bg}}>
                    <input type="text" inputMode="decimal" value={table[org]?.[d]?.p3??""} onChange={e=>setCell(org,d,"p3",e.target.value.replace(/[^0-9.]/g,""))} style={{width:"100%",border:"none",background:"transparent",textAlign:"right",padding:"3px 4px",fontFamily:"inherit",fontSize:11.5,outline:"none",color:T.p3Num||T.textMute,boxSizing:"border-box"}}/>
                  </td>
                </React.Fragment>)}
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${T.border}`,textAlign:"right",fontWeight:700,color:T.p97Num||col,background:T.p97Sum}}>{n2(r97)}</td>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${T.border}`,textAlign:"right",fontWeight:600,color:T.textMute,background:T.p3Sum}}>{n2(r3)}</td>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${T.border}`,textAlign:"right",fontWeight:800,color:T.totTxt,background:T.totBg,fontSize:12}}>{n2(r97+r3)}</td>
              </tr>);
            })}
            <tr style={{borderTop:`2px solid ${T.borderHeavy}`,background:T.p97Sum}}>
              <td style={{padding:"5px 8px",fontWeight:800,color:col,borderRight:`2px solid ${T.borderHeavy}`,fontSize:12}}>รวม 97%</td>
              {days.map(d=><React.Fragment key={d}>
                <td style={{padding:"5px 4px",textAlign:"right",fontWeight:800,color:T.totTxt,background:T.totBg,fontSize:12}}>{n2(sD(table,d,list,"p97"))}</td>
                <td style={{padding:"5px 4px",background:T.card3,borderRight:`2px solid ${T.borderHeavy}`}}></td>
              </React.Fragment>)}
              <td style={{padding:"5px 6px",textAlign:"right",background:col,color:"#fff",fontWeight:900,fontSize:13}} colSpan={3}>{n2(hdr97)}</td>
            </tr>
            <tr style={{background:T.p3Sum}}>
              <td style={{padding:"5px 8px",fontWeight:800,color:T.textMed,borderRight:`2px solid ${T.borderHeavy}`,fontSize:12}}>รวม 3%</td>
              {days.map(d=><React.Fragment key={d}>
                <td style={{padding:"5px 4px",background:T.card3}}></td>
                <td style={{padding:"5px 4px",textAlign:"right",fontWeight:800,color:T.textMed,background:T.card2,fontSize:12,borderRight:`2px solid ${T.borderHeavy}`}}>{n2(sD(table,d,list,"p3"))}</td>
              </React.Fragment>)}
              <td style={{padding:"5px 6px",textAlign:"right",background:"#555",color:"#fff",fontWeight:900,fontSize:13}} colSpan={3}>{n2(hdr3)}</td>
            </tr>
            <tr style={{background:T.totRow}}>
              <td style={{padding:"6px 8px",fontWeight:900,color:"#ffd84d",borderRight:`2px solid #333`,fontSize:12}}>รวมทั้งหมด</td>
              {days.map(d=><React.Fragment key={d}>
                <td colSpan={2} style={{padding:"6px 4px",textAlign:"right",fontWeight:900,color:"#ffd84d",background:T.totRow,fontSize:13,borderRight:"2px solid #333"}}>{n2(sD(table,d,list,"p97")+sD(table,d,list,"p3"))}</td>
              </React.Fragment>)}
              <td style={{padding:"6px 6px",textAlign:"right",background:"#0f4c81",color:"#ffd84d",fontWeight:900,fontSize:14}} colSpan={3}>{n2(hdr97+hdr3)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ChartView ────────────────────────────────────────────────────────────────

function ChartView({MONTHS,mSum,getM,T,fmt,sR,sG,isMobile}: ChartViewProps){
  const [cmpM1,setCmpM1]=useState("ตุลาคม");
  const [cmpM2,setCmpM2]=useState("พฤศจิกายน");
  const [view,setView]=useState("bar");

  const data = MONTHS.map(m=>{
    const s=mSum(m);
    const p97=s.t97+s.o97, p3=s.t3+s.o3;
    return {m, p97, p3, total:p97+p3};
  }).filter(d=>d.total>0);

  const maxVal = Math.max(...data.map(d=>d.total), 1);

  const cmpData = useMemo(() => {
    const m1=getM(cmpM1), m2=getM(cmpM2);
    return ALL.map(org=>({
      name: org.replace("เทศบาลตำบล","ทบ.").replace("เทศบาลเมือง","ทบ.ม."),
      v1: +(sR(m1.table,org,m1.days,"p97")+sR(m1.table,org,m1.days,"p3")).toFixed(2),
      v2: +(sR(m2.table,org,m2.days,"p97")+sR(m2.table,org,m2.days,"p3")).toFixed(2),
    })).filter(r=>r.v1>0||r.v2>0);
  }, [cmpM1,cmpM2,getM,sR]);

  const cmpMax = useMemo(() => Math.max(...cmpData.map(x=>Math.max(x.v1,x.v2)),1), [cmpData]);

  return(
    <div style={{padding:isMobile?"8px 10px":"14px 16px"}}>
      <div style={{fontWeight:800,fontSize:17,color:T.blue,marginBottom:14}}>📈 กราฟแสดงยอด</div>
      <div style={{display:"flex",gap:8,marginBottom:18}}>
        <button onClick={()=>setView("bar")} style={{padding:"6px 16px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,background:view==="bar"?T.blue:T.card2,color:view==="bar"?"#fff":T.textMed}}>📊 ยอดรายเดือน</button>
        <button onClick={()=>setView("compare")} style={{padding:"6px 16px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,background:view==="compare"?T.blue:T.card2,color:view==="compare"?"#fff":T.textMed}}>🔄 เปรียบเทียบเดือน</button>
      </div>

      {view==="bar"&&(
        data.length===0
          ?<div style={{textAlign:"center",padding:60,color:T.textFaint,background:T.card,borderRadius:12}}><div style={{fontSize:44,marginBottom:10}}>📊</div><div>ยังไม่มีข้อมูล</div></div>
          :<div style={{background:T.card,borderRadius:12,padding:"20px 16px",boxShadow:`0 2px 8px ${T.shadow}`}}>
            <div style={{fontWeight:700,fontSize:14,color:T.blue,marginBottom:20}}>ยอดรวมแต่ละเดือน (แยก 97% / 3%)</div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {data.map(({m,p97,p3,total})=>(
                <div key={m}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}>
                    <span style={{fontWeight:700,color:T.text}}>{m}</span>
                    <span style={{color:T.textMute,fontSize:11}}>รวม {fmt(total)}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{width:28,fontSize:10,color:T.blue,fontWeight:700,textAlign:"right",flexShrink:0}}>97%</span>
                      <div style={{flex:1,height:18,borderRadius:5,overflow:"hidden",background:T.card3,position:"relative"}}>
                        <div style={{width:`${(p97/maxVal)*100}%`,height:"100%",background:T.blue,transition:"width .4s",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:4}}>
                          {p97>0&&<span style={{fontSize:10,color:"#fff",fontWeight:700,whiteSpace:"nowrap"}}>{fmt(p97)}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{width:28,fontSize:10,color:T.gold,fontWeight:700,textAlign:"right",flexShrink:0}}>3%</span>
                      <div style={{flex:1,height:18,borderRadius:5,overflow:"hidden",background:T.card3,position:"relative"}}>
                        <div style={{width:`${(p3/maxVal)*100}%`,height:"100%",background:T.gold,transition:"width .4s",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:4}}>
                          {p3>0&&<span style={{fontSize:10,color:"#fff",fontWeight:700,whiteSpace:"nowrap"}}>{fmt(p3)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:16,marginTop:16,fontSize:12}}>
              <span style={{display:"flex",alignItems:"center",gap:5,color:T.textMed}}><span style={{width:12,height:12,background:T.blue,borderRadius:2,display:"inline-block"}}/>97%</span>
              <span style={{display:"flex",alignItems:"center",gap:5,color:T.textMed}}><span style={{width:12,height:12,background:T.gold,borderRadius:2,display:"inline-block"}}/>3%</span>
            </div>
          </div>
      )}

      {view==="compare"&&(
        <div>
          <div style={{background:T.card,borderRadius:12,padding:"16px 18px",marginBottom:16,boxShadow:`0 1px 6px ${T.shadow}`}}>
            <div style={{fontWeight:700,fontSize:14,color:T.blue,marginBottom:12}}>เลือกเดือนที่จะเปรียบเทียบ</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <div><div style={{fontSize:12,color:T.textMed,marginBottom:4}}>เดือนที่ 1</div>
                <select value={cmpM1} onChange={e=>setCmpM1(e.target.value)} style={{padding:"7px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:T.card2,color:T.text,fontFamily:"inherit",fontSize:14}}>
                  {MONTHS.map(m=><option key={m}>{m}</option>)}
                </select></div>
              <div><div style={{fontSize:12,color:T.textMed,marginBottom:4}}>เดือนที่ 2</div>
                <select value={cmpM2} onChange={e=>setCmpM2(e.target.value)} style={{padding:"7px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:T.card2,color:T.text,fontFamily:"inherit",fontSize:14}}>
                  {MONTHS.map(m=><option key={m}>{m}</option>)}
                </select></div>
            </div>
          </div>
          {cmpData.length===0
            ?<div style={{textAlign:"center",padding:60,color:T.textFaint,background:T.card,borderRadius:12}}><div style={{fontSize:44,marginBottom:10}}>🔄</div><div>ยังไม่มีข้อมูลในเดือนที่เลือก</div></div>
            :<div style={{background:T.card,borderRadius:12,padding:"16px",boxShadow:`0 2px 8px ${T.shadow}`}}>
              <div style={{fontWeight:700,fontSize:14,color:T.blue,marginBottom:14}}>เปรียบเทียบ {cmpM1} vs {cmpM2}</div>
              {cmpData.map(r=>(
                <div key={r.name} style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.textMed,marginBottom:3}}>{r.name}</div>
                  <div style={{display:"flex",gap:4,alignItems:"center"}}>
                    <div style={{width:50,fontSize:10,color:T.blue,textAlign:"right"}}>{r.v1>0?fmt(r.v1):"-"}</div>
                    <div style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
                      <div style={{height:10,background:T.blue,borderRadius:3,width:`${(r.v1/cmpMax)*100}%`}}/>
                      <div style={{height:10,background:T.gold,borderRadius:3,width:`${(r.v2/cmpMax)*100}%`}}/>
                    </div>
                    <div style={{width:50,fontSize:10,color:T.gold}}>{r.v2>0?fmt(r.v2):"-"}</div>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:16,marginTop:12,fontSize:12}}>
                <span style={{display:"flex",alignItems:"center",gap:5,color:T.textMed}}><span style={{width:12,height:8,background:T.blue,borderRadius:2,display:"inline-block"}}/>{cmpM1}</span>
                <span style={{display:"flex",alignItems:"center",gap:5,color:T.textMed}}><span style={{width:12,height:8,background:T.gold,borderRadius:2,display:"inline-block"}}/>{cmpM2}</span>
              </div>
            </div>}
        </div>
      )}
    </div>
  );
}

// ─── SumView ──────────────────────────────────────────────────────────────────

function SumView({MONTHS,mSum,hasData,setMon,setMainTab,setSubTab,getM,T,fmt,sR,isMobile}: SumViewProps){
  const th=(w: number,l=false,bg?: string): React.CSSProperties=>({padding:"6px 8px",textAlign:l?"left":"center",fontWeight:700,fontSize:11,color:T.tblHeadTxt,borderBottom:`1px solid ${T.border}`,borderRight:`1px solid ${T.border}`,minWidth:w,whiteSpace:"nowrap",...(bg?{background:bg}:{background:T.card3})});
  const td: React.CSSProperties={borderBottom:`1px solid ${T.border}`,borderRight:`1px solid ${T.border}`,verticalAlign:"middle"};
  const yr=MONTHS.reduce((a,m)=>{const s=mSum(m);return{t97:a.t97+s.t97,t3:a.t3+s.t3,o97:a.o97+s.o97,o3:a.o3+s.o3};},{t97:0,t3:0,o97:0,o3:0});
  const go=(m: string)=>{setMon(m);setMainTab("monthly");setSubTab("monthtable");};
  return(
    <div style={{padding:isMobile?"8px 10px":"14px 16px"}}>
      <div style={{fontWeight:800,fontSize:17,color:T.blue,marginBottom:14}}>📊 สรุปยอดรายปี</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8,marginBottom:18}}>
        {MONTHS.map(m=>{const s=mSum(m);const tot=s.t97+s.t3+s.o97+s.o3;return(
          <div key={m} onClick={()=>go(m)} style={{background:hasData(m)?T.card:T.card2,borderRadius:10,padding:"12px 14px",cursor:"pointer",boxShadow:`0 1px 5px ${T.shadow}`,border:`1.5px solid ${hasData(m)?T.blue:T.border}`}}>
            <div style={{fontWeight:800,fontSize:14,color:hasData(m)?T.blue:T.textFaint,marginBottom:4}}>{m}</div>
            {hasData(m)?<><div style={{fontSize:11,color:T.textMute,marginBottom:3}}>{s.days} วัน</div><div style={{fontSize:17,fontWeight:900,color:T.blue}}>{fmt(tot)}</div><div style={{fontSize:10,color:T.textMute,marginTop:3,display:"flex",gap:6}}><span style={{color:T.blue}}>ทบ {fmt(s.t97+s.t3)}</span><span style={{color:T.green}}>อบต {fmt(s.o97+s.o3)}</span></div></>:<div style={{fontSize:12,color:T.textFaint}}>ยังไม่มีข้อมูล</div>}
          </div>
        );})}
      </div>
      <div style={{background:T.card,borderRadius:12,overflow:"hidden",boxShadow:`0 2px 8px ${T.shadow}`,marginBottom:18}}>
        <div style={{background:T.blue,color:"#fff",padding:"10px 16px",fontWeight:800,fontSize:14}}>ตารางสรุปยอดแต่ละเดือน</div>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",fontSize:12}}>
            <thead>
              <tr>
                <th style={th(90,true)} rowSpan={2}>เดือน</th>
                <th style={th(40)} rowSpan={2}>วัน</th>
                <th style={{...th(270),background:T.blue,color:"#fff"}} colSpan={3}>เทศบาล</th>
                <th style={{...th(270),background:T.green,color:"#fff"}} colSpan={3}>อบต.</th>
                <th style={{...th(110),background:"#1a1a2e",color:"#ffd84d"}} rowSpan={2}>รวมทั้งหมด</th>
              </tr>
              <tr>
                <th style={{...th(85),background:T.p97Bg}}>97%</th>
                <th style={{...th(80),background:T.p3Bg}}>3%</th>
                <th style={{...th(90),background:T.blue,color:"#fff"}}>รวม</th>
                <th style={{...th(85),background:T.p97Bg}}>97%</th>
                <th style={{...th(80),background:T.p3Bg}}>3%</th>
                <th style={{...th(90),background:T.green,color:"#fff"}}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m,i)=>{const s=mSum(m);const tT=s.t97+s.t3,oT=s.o97+s.o3;return(
                <tr key={m} style={{background:i%2===0?T.card:T.rowAlt,cursor:"pointer"}} onClick={()=>go(m)}>
                  <td style={{...td,fontWeight:700,color:hasData(m)?T.blue:T.textFaint,padding:"6px 10px"}}>{m}</td>
                  <td style={{...td,textAlign:"center",color:T.textMute}}>{s.days||"-"}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px",color:T.text}}>{fmt(s.t97)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px",color:T.textMute}}>{fmt(s.t3)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px",fontWeight:700,color:T.blue,background:T.p97Sum}}>{fmt(tT)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px",color:T.text}}>{fmt(s.o97)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px",color:T.textMute}}>{fmt(s.o3)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 8px",fontWeight:700,color:T.green,background:T.histBg}}>{fmt(oT)}</td>
                  <td style={{...td,textAlign:"right",padding:"6px 10px",fontWeight:800,color:T.text,background:T.card2}}>{fmt(tT+oT)}</td>
                </tr>
              );})}
              <tr style={{background:"#1a1a2e",fontWeight:800}}>
                <td style={{...td,padding:"8px 10px",color:"#ffd84d",borderColor:"#333"}} colSpan={2}>รวมทั้งปี</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#90caf9",borderColor:"#333"}}>{fmt(yr.t97)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#90caf9",borderColor:"#333"}}>{fmt(yr.t3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#90caf9",fontWeight:900,borderColor:"#333"}}>{fmt(yr.t97+yr.t3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#a5d6a7",borderColor:"#333"}}>{fmt(yr.o97)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#a5d6a7",borderColor:"#333"}}>{fmt(yr.o3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:"#a5d6a7",fontWeight:900,borderColor:"#333"}}>{fmt(yr.o97+yr.o3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 10px",color:"#ffd84d",fontSize:14,fontWeight:900,borderColor:"#333"}}>{fmt(yr.t97+yr.t3+yr.o97+yr.o3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={{background:T.card,borderRadius:12,overflow:"hidden",boxShadow:`0 2px 8px ${T.shadow}`}}>
        <div style={{background:T.green,color:"#fff",padding:"10px 16px",fontWeight:800,fontSize:14}}>ยอดรวมรายหน่วยงานตลอดปี</div>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",fontSize:12}}>
            <thead><tr><th style={th(36,true)}>#</th><th style={th(180,true)}>หน่วยงาน</th><th style={th(100)}>97%</th><th style={th(100)}>3%</th><th style={th(110)}>รวม</th></tr></thead>
            <tbody>
              {([["เทศบาล",TESSABAN,T.blue],["อบต.",OBT,T.green]] as [string, string[], string][]).map(([grp,list,col])=>(
                <React.Fragment key={grp}>
                  <tr style={{background:col}}><td colSpan={5} style={{padding:"5px 12px",color:"#fff",fontWeight:800,fontSize:13}}>{grp}</td></tr>
                  {list.map((org,i)=>{
                    const t97=MONTHS.reduce((s,m)=>{const md=getM(m);return s+sR(md.table,org,md.days,"p97");},0);
                    const t3=MONTHS.reduce((s,m)=>{const md=getM(m);return s+sR(md.table,org,md.days,"p3");},0);
                    return(<tr key={org} style={{background:i%2===0?T.card:T.rowAlt}}><td style={{...td,textAlign:"center",color:T.textFaint,padding:"5px 6px"}}>{i+1}</td><td style={{...td,padding:"5px 10px",fontWeight:500,color:T.text,whiteSpace:"nowrap"}}>{org}</td><td style={{...td,textAlign:"right",padding:"5px 8px",color:col}}>{fmt(t97)}</td><td style={{...td,textAlign:"right",padding:"5px 8px",color:T.textMute}}>{fmt(t3)}</td><td style={{...td,textAlign:"right",padding:"5px 8px",fontWeight:700,color:T.text}}>{fmt(t97+t3)}</td></tr>);
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

// ─── SCard ────────────────────────────────────────────────────────────────────

function SCard({label,p97,p3,color}: SCardProps){
  return(<div style={{background:color,color:"#fff",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:11,opacity:.8,marginBottom:5}}>{label}</div><div style={{display:"flex",gap:10}}><div><div style={{fontSize:10,opacity:.7}}>97%</div><div style={{fontSize:14,fontWeight:800}}>{p97.toFixed(2)}</div></div><div><div style={{fontSize:10,opacity:.7}}>3%</div><div style={{fontSize:14,fontWeight:800}}>{p3.toFixed(2)}</div></div><div><div style={{fontSize:10,opacity:.7}}>รวม</div><div style={{fontSize:14,fontWeight:800,color:"#ffd84d"}}>{(p97+p3).toFixed(2)}</div></div></div></div>);
}
