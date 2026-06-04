import type { OrgTable, MonthData, DBState } from '../types';
import { ALL, TESSABAN, OBT } from '../data/orgs';

export const n2  = (n: number | string): string => { if(n===""||n===null||n===undefined) return ""; const v=parseFloat(String(n)); if(isNaN(v)) return ""; return v.toFixed(2); };
export const fmt = (n: number | null | undefined): string => { if(n===null||n===undefined) return "-"; const v=parseFloat(String(n)); if(isNaN(v)) return "-"; if(v===0) return "0.00"; return v.toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}); };
export const sR  = (tbl: OrgTable, org: string, days: string[], f: 'p97' | 'p3'): number => days.reduce((s,d)=>s+(parseFloat(tbl[org]?.[d]?.[f])||0),0);
export const sD  = (tbl: OrgTable, day: string, lst: string[], f: 'p97' | 'p3'): number  => lst.reduce((s,o)=>s+(parseFloat(tbl[o]?.[day]?.[f])||0),0);
export const sG  = (tbl: OrgTable, lst: string[], days: string[], f: 'p97' | 'p3'): number => lst.reduce((s,o)=>s+sR(tbl,o,days,f),0);

export function findOrg(name: string | null | undefined): string | null {
  if(!name) return null;
  const nm = (s: string) => s.replace(/\s+/g,"")
    .replace("เทศบาลตำบล","ตำบล").replace("เทศบาลเมือง","เมือง")
    .replace("อบต.","").replace("อบต","");
  const n = nm(name);
  if(!n) return null;
  // exact match first
  const exact = ALL.find(o => nm(o) === n);
  if (exact) return exact;
  // BUG-12: fallback substring — require min 3 chars, longer string must contain shorter,
  // and the shorter string must be ≥60% the length of the longer to prevent false positives
  return ALL.find(o => {
    const m = nm(o);
    if(m.length < 3 || n.length < 3) return false;
    const longer = m.length > n.length ? m : n;
    const shorter = m.length > n.length ? n : m;
    if(shorter.length / longer.length < 0.6) return false;
    return longer.includes(shorter);
  }) || null;
}

export const initM = (): MonthData => ({ days:[], table:{}, history:[] });
export const srtDays = (a: string[]): string[] => [...a].sort((x,y)=>parseInt(x)-parseInt(y));

export function addDayTbl(table: OrgTable, day: string): OrgTable {
  const t = {...table};
  ALL.forEach(o => { t[o] = {...(t[o]||{}), [day]: t[o]?.[day] || {p97:"",p3:""}}; });
  return t;
}

export function rmDayTbl(table: OrgTable, day: string): OrgTable {
  const t = {...table};
  ALL.forEach(o => { const r={...(t[o]||{})}; delete r[day]; t[o]=r; });
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

export function exportCSV(mon: string, days: string[], table: OrgTable): void {
  const rows: (string | number)[][] = [];
  const h1: (string | number)[] = ["หน่วยงาน"];
  const h2: (string | number)[] = [""];
  days.forEach(d => { h1.push(`วันที่ ${d}`, ""); h2.push("97%","3%"); });
  h1.push("รวม 97%","รวม 3%","รวมทั้งหมด"); h2.push("","","");
  rows.push(h1, h2);
  rows.push(["เทศบาล"]);
  TESSABAN.forEach(org => {
    const row: (string | number)[] = [org];
    days.forEach(d => { row.push(table[org]?.[d]?.p97??"", table[org]?.[d]?.p3??""); });
    const r97=sR(table,org,days,"p97"), r3=sR(table,org,days,"p3");
    row.push(r97, r3, r97+r3); rows.push(row);
  });
  rows.push(["อบต."]);
  OBT.forEach(org => {
    const row: (string | number)[] = [org];
    days.forEach(d => { row.push(table[org]?.[d]?.p97??"", table[org]?.[d]?.p3??""); });
    const r97=sR(table,org,days,"p97"), r3=sR(table,org,days,"p3");
    row.push(r97, r3, r97+r3); rows.push(row);
  });
  const tot: (string | number)[] = ["รวมทั้งหมด"];
  days.forEach(d => { tot.push(sD(table,d,ALL,"p97"), sD(table,d,ALL,"p3")); });
  tot.push(sG(table,ALL,days,"p97"), sG(table,ALL,days,"p3"), sG(table,ALL,days,"p97")+sG(table,ALL,days,"p3"));
  rows.push(tot);
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadBlob(new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8;"}), `ยอดรายวัน_${mon}.csv`);
}

export function exportBackup(DB: DBState, fiscalYear: string): void {
  const rows: (string | number)[][] = [["ปีงบประมาณ","เดือน","วันที่","หน่วยงาน","97%","3%"]];
  Object.entries(DB).forEach(([mon, md]) => {
    (md.days||[]).forEach(day => {
      ALL.forEach(org => {
        const cell = md.table?.[org]?.[day];
        if (cell?.p97 || cell?.p3) rows.push([fiscalYear, mon, day, org, cell.p97||"", cell.p3||""]);
      });
    });
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadBlob(new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8;"}), `backup_tessaban_${fiscalYear}_${new Date().toISOString().slice(0,10)}.csv`);
}

// ดึงวันที่จากชื่อไฟล์ เช่น "15.pdf", "2025-01-15.pdf", "day15.pdf"
export function extractDayFromFilename(filename: string): string | null {
  const base = filename.replace(/\.[^.]+$/, "");
  const patterns = [
    /\d{4}[-_]?\d{2}[-_]?(\d{2})$/,   // 2025-01-15 หรือ 20250115
    /(?:^|[-_\s])(\d{1,2})$/,           // ลงท้ายด้วยเลข: "15", "day-15"
    /(?:วันที่|day|d)[-_\s]?(\d{1,2})/i,
    /^(\d{1,2})$/,                       // ชื่อไฟล์เป็นเลขล้วน
  ];
  for (const p of patterns) {
    const m = base.match(p);
    if (m) {
      const day = parseInt(m[1]);
      if (day >= 1 && day <= 31) return String(day);
    }
  }
  return null;
}

// Validate number from Claude response — returns "" for invalid/negative
export function sanitizeNum(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  const n = parseFloat(String(v));
  if (isNaN(n) || n < 0) return "";
  return String(n);
}
