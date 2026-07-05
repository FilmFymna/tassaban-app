import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

import type { DBState, MonthData, ExtractResponse, Msg, SavingState } from './types';
import { TESSABAN, OBT, ALL, MONTHS } from './data/orgs';
import { mkTheme } from './utils/theme';
import {
  n2, fmt, sR, sD, sG, findOrg,
  initM, srtDays, addDayTbl, rmDayTbl,
  exportCSV, exportBackup,
  extractDayFromFilename, sanitizeNum, normalizeMonth,
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

const currentMonth = (): string => MONTHS[(new Date().getMonth() + 3) % 12];

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
  const [saving,      setSaving]      = useState<SavingState>("");
  const [fiscalYear,  setFiscalYear]  = useState(currentFiscalYear);
  const [mainTab,     setMainTab]     = useState("monthly");
  const [subTab,      setSubTab]      = useState("import");
  const [mon,         setMon]         = useState(currentMonth);
  const [DB,          setDB]          = useState<DBState>({});
  const [prevYearDB,  setPrevYearDB]  = useState<DBState>({});
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
  const pendingMonRef   = useRef<string>(currentMonth());
  const preSwitchMonRef = useRef<string>(currentMonth());
  const abortCtrlRef    = useRef<AbortController | null>(null);
  const queueTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // I6
  const isMobile        = useIsMobile();

  const T = useMemo(() => mkTheme(isDark), [isDark]);

  // BUG-25: wrap in useCallback to avoid unnecessary re-renders
  const toggleDark = useCallback(() => setIsDark(d => !d), []);
  // M1: persist theme via effect (keeps setIsDark updater pure)
  useEffect(() => { localStorage.setItem("theme", isDark ? "dark" : "light"); }, [isDark]);

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
    let cancelled = false;
    setReady(false); setDB({}); setPrevYearDB({}); dirty.current.clear();
    // C2: guard against stale dbLoad results when fiscalYear flips rapidly
    dbLoad(fiscalYear)
      .then(d => { if(cancelled) return; if(Object.keys(d).length) setDB(d); })
      .catch(e => { if(cancelled) return; console.error(e); setMsg({ ok: false, text: '❌ โหลดข้อมูลไม่สำเร็จ — กรุณา refresh หน้าจอ' }); })
      .finally(() => { if(cancelled) return; setReady(true); });
    // Load previous fiscal year for year-over-year comparison (best-effort, silent on error)
    const prevFy = String(parseInt(fiscalYear) - 1);
    dbLoad(prevFy)
      .then(d => { if(cancelled) return; setPrevYearDB(d); })
      .catch(e => { if(cancelled) return; console.error('prev year load failed', e); });
    return () => { cancelled = true; };
  }, [fiscalYear]);

  // Sync DB to ref for save snapshot
  const DBRef = useRef<DBState>(DB);
  useEffect(() => { DBRef.current = DB; }, [DB]);

  const savingRef = useRef<SavingState>("");
  useEffect(() => { savingRef.current = saving; }, [saving]);

  const triggerRetry = useCallback(() => {
    setSaving("");
    dirty.current = new Set(Object.keys(DBRef.current));
    setDB(d => ({ ...d }));
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current.size > 0 || savingRef.current === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    if (saving !== "error") return;
    window.addEventListener("online", triggerRetry);
    return () => window.removeEventListener("online", triggerRetry);
  }, [saving, triggerRetry]);

  // BUG-21: cleanup undoTimerRef on unmount
  useEffect(() => () => { if(undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  // BUG-9: cleanup queueTimerRef on unmount
  useEffect(() => () => { if(queueTimerRef.current) clearTimeout(queueTimerRef.current); }, []);

  // I6: cleanup savedClearTimerRef on unmount
  useEffect(() => () => { if(savedClearTimerRef.current) clearTimeout(savedClearTimerRef.current); }, []);

  // Item 7: auto-save with retry on error
  useEffect(() => {
    if(!ready) return;
    // BUG-2: track cancellation so stale async lambdas don't mutate dirty after fiscalYear changes
    let cancelled = false;
    const t = setTimeout(async () => {
      const months = [...dirty.current];
      if(!months.length) return;
      setSaving("saving");
      try {
        const snapshot = DBRef.current;
        // BUG-4: capture dirty snapshot before await so we only delete months that were dirty at save time
        const dirtySnapshot = new Set(months);
        await Promise.all(months.map(m => {
          const md = snapshot[m];
          if(!md) return Promise.resolve();
          return dbSave(m, md, fiscalYear);
        }));
        if(cancelled) return; // BUG-2: don't mutate dirty or call setSaving after cleanup
        dirtySnapshot.forEach(m => dirty.current.delete(m)); // BUG-4: use snapshot, not live dirty
        setSaving("saved");
        // I6: clear any previous "saved" timer before starting a new one
        if(savedClearTimerRef.current) clearTimeout(savedClearTimerRef.current);
        savedClearTimerRef.current = setTimeout(() => setSaving(""), 2500);
      } catch(e) {
        if(cancelled) return; // BUG-2
        console.error(e);
        setSaving("error");
        setMsg({ ok: false, text: `❌ บันทึกไม่สำเร็จ — แก้ internet แล้วกด retry` });
      }
    }, 1200);
    return () => { cancelled = true; clearTimeout(t); }; // BUG-2: cleanup sets cancelled
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
      // BUG-3: mark dirty inside setDB callback so we use the correct mon from closure
      dirty.current.add(mon);
      return updated;
    });
    setMsg({ ok:true, text:`🗑️ ลบวันที่ ${d} แล้ว` });
  }, [mon]);

  const setCell = useCallback((org: string, day: string, f: 'p97'|'p3', v: string) => {
    setM(mon, c => ({...c, table:{...c.table,[org]:{...c.table[org],[day]:{...c.table[org]?.[day],[f]:v}}}}));
  }, [mon, setM]);

  const startExtract = useCallback(async (file: File) => {
    // I2: clear any pending queue timer and abort any in-flight prior request before starting fresh
    if(queueTimerRef.current) { clearTimeout(queueTimerRef.current); queueTimerRef.current = null; }
    abortCtrlRef.current?.abort();
    cancelledRef.current = false;
    pendingMonRef.current = mon; // BUG-1: capture mon at extract start to avoid stale closure
    preSwitchMonRef.current = mon; // capture for cancel revert (fix-6)
    const localCtrl = new AbortController(); // I4: local controller — finally checks ownership
    abortCtrlRef.current = localCtrl; // fix-2: real fetch cancellation
    setPendingPdf(file);
    setPendingResult(null);
    const autoDay = extractDayFromFilename(file.name);

    // M5: reject oversize files before reading
    if(file.size > 7_500_000) {
      setMsg({ ok:false, text:"❌ ไฟล์ใหญ่เกินไป (สูงสุด 7.5MB)" });
      setPendingPdf(null);
      setPdfQueue([]);
      return;
    }

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
        signal: localCtrl.signal,
      });
      let parsed: ExtractResponse;
      try { parsed = await resp.json(); } catch { throw new Error('API ไม่ตอบสนอง — ตรวจสอบว่า API server รันอยู่'); }
      if(!resp.ok || parsed.error) throw new Error(parsed.error || 'เกิดข้อผิดพลาด');
      if(!Array.isArray(parsed?.rows)) throw new Error('ไม่พบข้อมูลในเอกสาร');
      if(cancelledRef.current) return;

      // Auto-detect month from document — switch month dropdown if found
      const detectedMon = MONTHS.find(m => m === normalizeMonth(parsed.document_month)) || null;
      if(detectedMon) {
        pendingMonRef.current = detectedMon;
        setMon(detectedMon);
      }

      // Auto-detect day from document
      const docDayNum = parsed.document_day;
      const docDayStr = (docDayNum != null && docDayNum >= 1 && docDayNum <= 31) ? String(docDayNum) : null;

      setPendingResult(parsed);

      // Show modal pre-filled with detected day/month — user confirms before proceeding
      setPdfDay(docDayStr || autoDay || "");
      setShowDayModal(true);
    } catch(e) {
      // I4: AbortError means a newer request superseded us — leave its state alone
      if((e as Error)?.name === 'AbortError') return;
      if(cancelledRef.current) return;
      setPendingResult(null);
      setPdfQueue([]);
      setMsg({ ok:false, text:`❌ ${(e as Error).message}` });
      setPendingPdf(null);
    } finally {
      // BUG-6 / I4: only reset pdfLoading if we're still the active request AND not externally cancelled
      if(abortCtrlRef.current === localCtrl && !cancelledRef.current) setPdfLoading(false);
    }
  }, [mon]);

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
    // BUG-1: use the month captured at startExtract time, not current mon state
    const activeMon = pendingMonRef.current;
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
      setPdfDay(""); // fix-1: clear so next import starts fresh
    };

    if(getM(activeMon).days.includes(dayStr)) {
      setConfirmDialog({
        message: `⚠️ วันที่ ${dayStr} เดือน${activeMon} มีข้อมูลอยู่แล้ว\nต้องการแทนที่มั้ย?`,
        onConfirm: proceed,
        // I1: revert auto-switched month when user cancels the replace prompt
        onCancel: () => { setPendingResult(null); setPendingPdf(null); setPdfQueue([]); setMon(preSwitchMonRef.current); },
      });
      return;
    }

    proceed();
  }, [pendingResult, getM]);

  // Item 8: validate numbers + save
  const confirmReview = useCallback(() => {
    if(!reviewData) return;
    const { parsed, dayStr, activeMon } = reviewData;
    const matched = parsed.rows.filter(r => findOrg(r.matched||r.name)).length;
    // fix-8: don't save or navigate if nothing matched
    if(matched === 0) {
      setMsg({ ok:false, text:`⚠️ จับคู่ได้ 0/${parsed.rows.length} รายการ — ไม่มีข้อมูลถูกบันทึก กรุณาตรวจสอบ PDF` });
      setReviewData(null);
    } else {
      setM(activeMon, c => {
        const nd = c.days.includes(dayStr) ? c.days : srtDays([...c.days, dayStr]);
        const nt = addDayTbl({...c.table}, dayStr);
        parsed.rows.forEach(r => {
          const f = findOrg(r.matched || r.name);
          if(f) {
            const p97 = sanitizeNum(r.p97);
            const p3  = sanitizeNum(r.p3);
            if(p97 !== "" || p3 !== "") nt[f][dayStr] = { p97, p3 };
          }
        });
        // M4: sanitize parsed totals (Claude may return invalid/negative)
        const totP97 = parseFloat(sanitizeNum(parsed.total_p97)) || 0;
        const totP3  = parseFloat(sanitizeNum(parsed.total_p3))  || 0;
        const totAmt = parseFloat(sanitizeNum(parsed.total_amount)) || 0;
        const nh = [...c.history.filter(h => h.day !== dayStr),
          { day:dayStr, total_p97:totP97, total_p3:totP3, total_amount:totAmt }
        ].sort((a,b) => parseInt(a.day)-parseInt(b.day));
        return {...c, days:nd, table:nt, history:nh};
      });
      setMsg({ ok:true, text:`✅ บันทึกแล้ว! วันที่ ${dayStr}: จับคู่ได้ ${matched}/${parsed.rows.length} รายการ` });
      setSubTab("monthtable");
      setReviewData(null);
    }

    // Item 9: process next file in queue
    if(pdfQueue.length > 0) {
      const [next, ...rest] = pdfQueue;
      setPdfQueue(rest);
      // BUG-9: store timer id so it can be cleared on unmount/cancel
      if(queueTimerRef.current) clearTimeout(queueTimerRef.current);
      queueTimerRef.current = setTimeout(() => startExtract(next), 300);
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
      // M7: require non-empty fiscal year in backup — don't silently fall back to current
      const restoredFy = rows[0]?.fy?.trim();
      if(!restoredFy) { setMsg({ ok:false, text:'❌ Backup ไฟล์เสียหาย: ไม่พบปีงบประมาณ' }); return; }
      if(restoredFy !== fiscalYear) {
        setMsg({ok:false, text:`❌ Backup ปี ${restoredFy} ไม่ตรงกับปีปัจจุบัน ${fiscalYear}`});
        return;
      }
      // I5/I7: pre-validate rows so we can count skipped without double-counting in StrictMode
      const validRows = rows.map(r => ({...r, _dayNum: parseInt(r.day)}))
        .filter(r => r._dayNum && r._dayNum >= 1 && r._dayNum <= 31);
      const skippedInvalid = rows.length - validRows.length;
      const skippedUnknownOrg = validRows.filter(r => !ALL.includes(r.org)).length;
      const skipped = skippedInvalid + skippedUnknownOrg;
      setDB(prev => {
        const next: DBState = {...prev};
        const copied = new Set<string>(); // fix-5: track deep-copied months
        validRows.forEach(({ mon:rowMon, org, p97, p3, _dayNum }) => {
          const dayKey = String(_dayNum); // I5: normalize day key (strip leading zeros etc.)
          if(!next[rowMon]) {
            next[rowMon] = { days:[], table:{}, history:[] };
            copied.add(rowMon);
          } else if(!copied.has(rowMon)) {
            next[rowMon] = JSON.parse(JSON.stringify(next[rowMon])); // deep copy before mutating
            copied.add(rowMon);
          }
          const c = next[rowMon];
          if(!c.days.includes(dayKey)) c.days = [...c.days, dayKey];
          // I5: dedupe + re-sort days
          c.days = Array.from(new Set(c.days)).sort((a,b)=>parseInt(a)-parseInt(b));
          ALL.forEach(o => { if(!c.table[o]) c.table[o]={}; if(!c.table[o][dayKey]) c.table[o][dayKey]={p97:'',p3:''}; });
          if(c.table[org]?.[dayKey] !== undefined) c.table[org][dayKey] = { p97, p3 };
          dirty.current.add(rowMon);
        });
        return next;
      });
      const summary = skipped > 0
        ? `✅ Restore สำเร็จ! ${rows.length} แถว (ข้าม ${skipped} แถวเนื่องจาก org ไม่ตรง, ปี ${restoredFy})`
        : `✅ Restore สำเร็จ! ${rows.length} แถว (ปี ${restoredFy})`;
      setMsg({ ok:true, text: summary });
    } catch(e) {
      setMsg({ ok:false, text:`❌ อ่านไฟล์ไม่ได้: ${(e as Error).message}` });
    }
  }, [fiscalYear]);

  const mSum = useCallback((m: string) => {
    const {days,table} = getM(m);
    return { t97:sG(table,TESSABAN,days,"p97"), t3:sG(table,TESSABAN,days,"p3"), o97:sG(table,OBT,days,"p97"), o3:sG(table,OBT,days,"p3"), days:days.length };
  }, [getM]);

  const prevMSum = useCallback((m: string) => {
    const md = prevYearDB[m] || initM();
    const {days,table} = md;
    return { t97:sG(table,TESSABAN,days,"p97"), t3:sG(table,TESSABAN,days,"p3"), o97:sG(table,OBT,days,"p97"), o3:sG(table,OBT,days,"p3"), days:days.length };
  }, [prevYearDB]);

  const cancelPdfLoad = useCallback(() => {
    abortCtrlRef.current?.abort(); // fix-2: actually cancel in-flight HTTP request
    cancelledRef.current = true;
    setMon(preSwitchMonRef.current); // fix-6: revert month if auto-switched
    setPendingPdf(null);
    setPendingResult(null);
    setPdfQueue([]);
    setPdfDay("");
    setPdfLoading(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if(e.key === 'Escape') {
        // BUG-27: close one layer at a time (topmost first)
        if(showDayModal) { cancelledRef.current = true; setShowDayModal(false); setMon(preSwitchMonRef.current); setPdfDay(""); setPendingPdf(null); setPendingResult(null); setPdfQueue([]); }
        else if(pdfLoading) { cancelPdfLoad(); }
        else if(confirmDialog) { confirmDialog.onCancel?.(); setConfirmDialog(null); }
        else if(reviewData) { setReviewData(null); setPdfQueue([]); setMon(preSwitchMonRef.current); }
        else if(msg) setMsg(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showDayModal, pdfLoading, cancelPdfLoad, confirmDialog, reviewData, msg]);

  const restoreBg = isDark ? "#2A4A7A" : "#37474F";
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
          {saving&&<div onClick={saving==="error"?triggerRetry:undefined} style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:saving==="saved"?"rgba(74,222,128,0.15)":saving==="error"?"rgba(248,113,113,0.15)":"rgba(255,255,255,0.1)",color:saving==="saved"?"#4ADE80":saving==="error"?"#F87171":"rgba(255,255,255,0.6)",border:`1px solid ${saving==="saved"?"rgba(74,222,128,0.3)":saving==="error"?"rgba(248,113,113,0.3)":"rgba(255,255,255,0.15)"}`,whiteSpace:"nowrap",cursor:saving==="error"?"pointer":"default"}}>{saving==="saving"?"บันทึก...":saving==="saved"?"บันทึกแล้ว":"⚠ บันทึกไม่ได้ (แตะเพื่อลองใหม่)"}</div>}
          {!isMobile&&<button onClick={()=>exportBackup(DB,fiscalYear)} style={{padding:"4px 10px",height:32,border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontSize:11,background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.6)"}} title="Backup">💾 สำรอง</button>}
          <select value={fiscalYear} onChange={e=>{setFiscalYear(e.target.value);setMon("ตุลาคม");}}
            style={{padding:"4px 6px",height:32,borderRadius:4,border:"1px solid rgba(255,255,255,0.15)",fontFamily:"inherit",fontSize:11,fontWeight:600,background:"rgba(255,255,255,0.07)",color:"#fff",cursor:"pointer"}}>
            {/* BUG-15: range always includes both current fiscal year and selected year */}
            {(() => { const curFY = parseInt(currentFiscalYear()); const selFY = parseInt(fiscalYear); const minFY = Math.min(curFY - 2, selFY - 2); return Array.from({length:6},(_,i)=>minFY+i); })().map(y=><option key={y} value={String(y)} style={{color:"#000",background:"#1e293b"}}>ปี {y}</option>)}
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
            {!msg.ok&&saving==="error"&&(
              <button onClick={triggerRetry} style={{padding:'2px 10px',background:T.blue,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700}}>🔄 retry</button>
            )}
            <button onClick={()=>setMsg(null)} style={{border:"none",background:"none",cursor:"pointer",fontSize:16,opacity:.5,color:msg.ok?T.msgOkTxt:T.msgErrTxt}}>×</button>
          </div>
        </div>}

        {/* MONTHLY */}
        {mainTab==="monthly"&&<div style={{padding:isMobile?"8px 10px":"12px 16px"}}>
          <div className="no-print" style={{marginBottom:14}}>
            <select value={mon} onChange={e=>{setMon(e.target.value);setSubTab("import");}}
              style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${T.blue}`,background:isDark?T.card2:T.card,color:T.text,fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer",minWidth:160,outline:"none"}}>
              {MONTHS.map(m=>(
                <option key={m} value={m}>{hasData(m)?`• ${m}`:m}</option>
              ))}
            </select>
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
          {subTab==="import"&&<div style={{maxWidth:900,margin:"0 auto"}}>

            {/* Day modal */}
            {showDayModal&&(
              <div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
                <div style={{background:T.card,borderRadius:10,padding:"24px",width:"100%",maxWidth:340,boxShadow:`0 8px 48px ${T.shadow2}`,border:`1px solid ${T.border}`}}>
                  <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:4,letterSpacing:"0.01em"}}>วันที่ในเอกสาร</div>
                  <div style={{fontSize:13,color:T.textMute,marginBottom:4}}>เดือน {mon} — วันที่เท่าไร?</div>
                  {pdfQueue.length>0&&<div style={{fontSize:11,color:T.gold,marginBottom:10,fontWeight:600}}>📂 คิว: เหลืออีก {pdfQueue.length} ไฟล์</div>}
                  <div style={{fontSize:11,color:T.msgOkTxt,background:T.msgOkBg,border:`1px solid ${T.msgOkBdr}`,borderRadius:6,padding:'6px 10px',marginBottom:10}}>✅ Claude อ่านสำเร็จ — กรอกวันที่แล้วกดยืนยัน</div>
                  <input type="text" inputMode="numeric" placeholder="เช่น 1, 15, 30" value={pdfDay}
                    onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");if(v===""||( parseInt(v)>=1 && parseInt(v)<=31))setPdfDay(v);}}
                    onKeyDown={e=>{if(e.key==="Enter"&&pdfDay)handleDaySubmit(String(parseInt(pdfDay)));}}
                    autoFocus
                    style={{width:"100%",padding:"12px",borderRadius:10,border:`2px solid ${pdfDay?T.blue:T.border2}`,background:T.card2,color:T.text,fontFamily:"inherit",fontSize:22,textAlign:"center",boxSizing:"border-box",marginBottom:16,outline:"none"}}/>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={()=>{ cancelledRef.current = true; setShowDayModal(false); setMon(preSwitchMonRef.current); setPdfDay(""); setPendingPdf(null); setPendingResult(null); setPdfQueue([]); }} style={{flex:1,padding:"9px 0",border:`1px solid ${T.border}`,borderRadius:6,background:"transparent",color:T.textMed,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>ยกเลิก</button>
                    <button onClick={()=>{if(pdfDay)handleDaySubmit(String(parseInt(pdfDay)));}} disabled={!pdfDay}
                      style={{flex:2,padding:"9px 0",background:pdfDay?T.blue:T.border2,color:"#fff",border:"none",borderRadius:6,cursor:pdfDay?"pointer":"default",fontFamily:"inherit",fontSize:14,fontWeight:700}}>
                      ยืนยัน
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PDF Drop Zone — Hero */}
            <div
              onDrop={e=>{e.preventDefault();handleFilesSelected(e.dataTransfer.files);}}
              onDragOver={e=>e.preventDefault()}
              onClick={()=>!pdfLoading&&fileRef.current?.click()}
              style={{
                border:`2px ${pdfLoading?"dashed":"solid"} ${pdfLoading?T.textFaint:T.blue}`,
                borderRadius:12,
                padding:"48px 32px",
                minHeight:320,
                display:"flex",
                flexDirection:"column",
                alignItems:"center",
                justifyContent:"center",
                textAlign:"center",
                background:isDark?T.card2:T.card,
                cursor:pdfLoading?"default":"pointer",
                marginBottom:16,
                transition:"border-color .15s,background .15s",
              }}>
              <div style={{fontSize:56,marginBottom:14,opacity:pdfLoading?0.4:1}}>{pdfLoading?"⏳":"📄"}</div>
              <div style={{fontSize:18,fontWeight:700,color:pdfLoading?T.textFaint:T.blue,marginBottom:8,letterSpacing:"0.01em"}}>
                {pdfLoading?"Claude กำลังอ่าน PDF...":`วาง PDF หรือรูปภาพที่นี่`}
              </div>
              {!pdfLoading&&<div style={{fontSize:13,color:T.textFaint,marginBottom:4}}>เดือน{mon} · PDF · PNG · JPG</div>}
              {!pdfLoading&&<div style={{fontSize:12,color:T.textFaint}}>เลือกหลายไฟล์พร้อมกันได้</div>}
              {pdfLoading&&<button onClick={e=>{e.stopPropagation();cancelPdfLoad();}} style={{marginTop:16,padding:"6px 20px",background:"transparent",color:T.textMute,border:`1px solid ${T.border}`,borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>ยกเลิก</button>}
              <input ref={fileRef} type="file" accept=".pdf,image/*" multiple style={{display:"none"}} onChange={e=>{handleFilesSelected(e.target.files);e.target.value="";}} />
            </div>

            {/* Bottom 2-column grid: Manual add | Restore */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>

              {/* เพิ่มวันด้วยตนเอง */}
              <div style={{background:T.card,borderRadius:10,overflow:"hidden",border:`1px solid ${T.border}`}}>
                <div style={{background:T.blue,padding:"10px 16px"}}>
                  <span style={{fontWeight:700,fontSize:13,color:"#fff",letterSpacing:"0.01em"}}>เพิ่มวันด้วยตนเอง</span>
                </div>
                <div style={{padding:"16px"}}>
                  <div style={{display:"flex",gap:8}}>
                    <input type="text" inputMode="numeric" placeholder="เช่น 5" value={mDay}
                      onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");if(v===""||( parseInt(v)>=1 && parseInt(v)<=31))setMDay(v);}}
                      onKeyDown={e=>{if(e.key==="Enter"){pushDay(mDay);setMDay("");}}}
                      style={{flex:1,padding:"8px 12px",borderRadius:6,border:`1px solid ${isDark?"#2A3F6A":T.border2}`,background:isDark?"#0D1B3E":"#FFFFFF",color:isDark?"#8BA4C4":T.text,fontFamily:"inherit",fontSize:14}}/>
                    <button onClick={()=>{pushDay(mDay);setMDay("");}}
                      style={{padding:"8px 18px",background:T.blue,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:700}}>
                      เพิ่ม
                    </button>
                  </div>
                  {cur.days.length>0&&<div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:5}}>
                    {cur.days.map(d=>(
                      <span key={d} style={{background:isDark?"#1A2F55":"#E8F0FE",color:isDark?"#7EB3E8":"#1A237E",padding:"4px 8px 4px 12px",borderRadius:4,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4,border:`1px solid ${isDark?"#2A4070":"#BFCCF4"}`}}>
                        {d}
                        <button onClick={()=>dropDay(d)} style={{border:"none",background:"none",color:isDark?"#E05A3A":"#5C6BC0",cursor:"pointer",fontSize:14,padding:0,lineHeight:1}}>×</button>
                      </span>
                    ))}
                  </div>}
                </div>
              </div>

              {/* Restore จาก Backup */}
              <div style={{background:T.card,borderRadius:10,overflow:"hidden",border:`1px solid ${T.border}`}}>
                <div style={{background:restoreBg,padding:"10px 16px"}}>
                  <span style={{fontWeight:700,fontSize:13,color:"#fff",letterSpacing:"0.01em"}}>🔥 Restore จาก Backup</span>
                </div>
                <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{fontSize:12,color:T.textMute}}>นำเข้าข้อมูลจากไฟล์ backup CSV</div>
                  <button onClick={()=>importBackupRef.current?.click()}
                    style={{padding:"8px 18px",background:restoreBg,color:"#FFFFFF",border:"none",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,alignSelf:"flex-start"}}>
                    📁 เลือกไฟล์ backup CSV
                  </button>
                  <input ref={importBackupRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)handleImportBackup(f);e.target.value="";}}/>
                </div>
              </div>

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

        {mainTab==="summary"&&<SumView MONTHS={MONTHS} mSum={mSum} hasData={hasData} setMon={setMon} setMainTab={setMainTab} setSubTab={setSubTab} getM={getM} T={T} fmt={fmt} sR={sR} isMobile={isMobile} prevMSum={prevMSum} fiscalYear={fiscalYear}/>}
        {mainTab==="chart"&&<ChartView MONTHS={MONTHS} mSum={mSum} getM={getM} T={T} fmt={fmt} sR={sR} sG={sG} isMobile={isMobile}/>}
      </>}

      {/* Confirm Modal */}
      {confirmDialog&&(
        <div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
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
        <div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16,overflowY:'auto'}}>
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
              <button onClick={()=>{setReviewData(null);setPdfQueue([]);setMon(preSwitchMonRef.current);}} style={{flex:1,padding:'8px 0',border:`1px solid ${T.border}`,borderRadius:6,background:'transparent',color:T.textMed,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>ยกเลิก</button>
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
