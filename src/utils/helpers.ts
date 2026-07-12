import type { OrgTable, MonthData, DBState } from '../types';
import { ALL, TESSABAN, OBT } from '../data/orgs';

export const n2  = (n: number | string): string => { if(n===""||n===null||n===undefined) return ""; const v=parseFloat(String(n)); if(isNaN(v)) return ""; return v.toFixed(2); };
export const fmt = (n: number | null | undefined): string => { if(n===null||n===undefined) return "-"; const v=parseFloat(String(n)); if(isNaN(v)) return "-"; if(v===0) return "0.00"; return v.toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}); };
export const sR  = (tbl: OrgTable, org: string, days: string[], f: 'p97' | 'p3'): number => days.reduce((s,d)=>s+(parseFloat(tbl[org]?.[d]?.[f])||0),0);
export const sD  = (tbl: OrgTable, day: string, lst: string[], f: 'p97' | 'p3'): number  => lst.reduce((s,o)=>s+(parseFloat(tbl[o]?.[day]?.[f])||0),0);
export const sG  = (tbl: OrgTable, lst: string[], days: string[], f: 'p97' | 'p3'): number => lst.reduce((s,o)=>s+sR(tbl,o,days,f),0);

// Longest common substring length between two strings
function lcsLength(a: string, b: string): number {
  if(!a || !b) return 0;
  const m = a.length, n = b.length;
  let best = 0;
  // rolling 1-D table is enough since we only need max length
  let prev = new Array<number>(n + 1).fill(0);
  for(let i = 1; i <= m; i++) {
    const curr = new Array<number>(n + 1).fill(0);
    for(let j = 1; j <= n; j++) {
      if(a[i-1] === b[j-1]) {
        curr[j] = prev[j-1] + 1;
        if(curr[j] > best) best = curr[j];
      }
    }
    prev = curr;
  }
  return best;
}

export function findOrg(name: string | null | undefined): string | null {
  if(!name) return null;
  // I8: strip leading list-noise (e.g. "1. ", "12) ") so OCR'd numbered lists match
  const cleaned = name.replace(/^[\s\d\.\)\-:]+/, "");
  // Constrain scope by prefix category to disambiguate near-collisions like
  // ห้วยขะยูง (TESSABAN) vs ห้วยขะยุง (OBT) — 1-char diff would otherwise trip the 0.15 margin.
  // If the input has no clear prefix, fall back to full ALL.
  const scope: string[] = /^(เทศบาล|ทบ\.|ทต\.|ทน\.|ทม\.)/.test(cleaned) ? TESSABAN
    : /^(องค์การบริหารส่วนตำบล|อบต)/.test(cleaned) ? OBT
    : ALL;
  const nm = (s: string) => s.replace(/\s+/g,"")
    .replace("องค์การบริหารส่วนตำบล","").replace("เทศบาลนคร","เมือง")
    .replace("เทศบาลตำบล","ตำบล").replace("เทศบาลเมือง","เมือง")
    .replace("อบต.","").replace("อบต","");
  const n = nm(cleaned);
  if(!n) return null;
  // exact-match-on-normalized-name is primary
  const exact = scope.find(o => nm(o) === n);
  if(exact) return exact;
  if(n.length < 3) return null;
  // Fallback: score every org by LCS-length / max-length. To avoid the old substring+ratio
  // false positives (e.g. "สว่าง" matching "โคกสว่าง"), require:
  //   1. best score >= 0.6, AND
  //   2. best beats second-best by margin >= 0.15 (disambiguation guard — return null on ties)
  let best = { org: "", score: 0 };
  let second = { org: "", score: 0 };
  for(const o of scope) {
    const m = nm(o);
    if(m.length < 3) continue;
    const score = lcsLength(m, n) / Math.max(m.length, n.length);
    if(score > best.score) { second = best; best = { org: o, score }; }
    else if(score > second.score) { second = { org: o, score }; }
  }
  if(best.score < 0.6) return null;
  if(best.score - second.score < 0.15) return null; // ambiguous — bail
  return best.org;
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

export function exportCSV(fiscalYear: string, mon: string, days: string[], table: OrgTable): void {
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
    row.push(n2(r97), n2(r3), n2(r97+r3)); rows.push(row);
  });
  rows.push(["อบต."]);
  OBT.forEach(org => {
    const row: (string | number)[] = [org];
    days.forEach(d => { row.push(table[org]?.[d]?.p97??"", table[org]?.[d]?.p3??""); });
    const r97=sR(table,org,days,"p97"), r3=sR(table,org,days,"p3");
    row.push(n2(r97), n2(r3), n2(r97+r3)); rows.push(row);
  });
  const tot: (string | number)[] = ["รวมทั้งหมด"];
  days.forEach(d => { tot.push(n2(sD(table,d,ALL,"p97")), n2(sD(table,d,ALL,"p3"))); });
  const g97 = sG(table,ALL,days,"p97"), g3 = sG(table,ALL,days,"p3");
  tot.push(n2(g97), n2(g3), n2(g97+g3));
  rows.push(tot);
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadBlob(new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8;"}), `ยอดรายวัน_${fiscalYear}_${mon}.csv`);
}

export function exportBackup(DB: DBState, fiscalYear: string): boolean {
  const rows: (string | number)[][] = [["ปีงบประมาณ","เดือน","วันที่","หน่วยงาน","97%","3%"]];
  Object.entries(DB).forEach(([mon, md]) => {
    (md.days||[]).forEach(day => {
      ALL.forEach(org => {
        const cell = md.table?.[org]?.[day];
        if (cell?.p97 || cell?.p3) rows.push([fiscalYear, mon, day, org, cell.p97||"", cell.p3||""]);
      });
    });
  });
  // Guard empty backups so the caller can surface a message instead of a silent header-only file
  if (rows.length === 1) return false;
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadBlob(new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8;"}), `backup_tessaban_${fiscalYear}_${new Date().toISOString().slice(0,10)}.csv`);
  return true;
}

// ดึงวันที่จากชื่อไฟล์ เช่น "15.pdf", "2025-01-15.pdf", "day15.pdf"
export function extractDayFromFilename(filename: string): string | null {
  const base = filename.replace(/\.[^.]+$/, "");
  // Reject bare 4-digit year (e.g. "2025.pdf") — pattern 2's trailing anchor would otherwise
  // capture the last 2 digits ("25") as a day.
  if (/^\d{4}$/.test(base)) return null;
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

const MONTH_ALIASES: Record<string, string> = {
  "ม.ค.":"มกราคม","ม.ค":"มกราคม","มค":"มกราคม",
  "ก.พ.":"กุมภาพันธ์","ก.พ":"กุมภาพันธ์","กพ":"กุมภาพันธ์",
  "มี.ค.":"มีนาคม","มี.ค":"มีนาคม","มีค":"มีนาคม",
  "เม.ย.":"เมษายน","เม.ย":"เมษายน","เมย":"เมษายน",
  "พ.ค.":"พฤษภาคม","พ.ค":"พฤษภาคม","พค":"พฤษภาคม",
  "มิ.ย.":"มิถุนายน","มิ.ย":"มิถุนายน","มิย":"มิถุนายน",
  "ก.ค.":"กรกฎาคม","ก.ค":"กรกฎาคม","กค":"กรกฎาคม","กรกฏาคม":"กรกฎาคม",
  "ส.ค.":"สิงหาคม","ส.ค":"สิงหาคม","สค":"สิงหาคม",
  "ก.ย.":"กันยายน","ก.ย":"กันยายน","กย":"กันยายน",
  "ต.ค.":"ตุลาคม","ต.ค":"ตุลาคม","ตค":"ตุลาคม",
  "พ.ย.":"พฤศจิกายน","พ.ย":"พฤศจิกายน","พย":"พฤศจิกายน",
  "ธ.ค.":"ธันวาคม","ธ.ค":"ธันวาคม","ธค":"ธันวาคม",
  // numeric variants — Claude may return "10" or "01" for document_month
  "1":"มกราคม","01":"มกราคม",
  "2":"กุมภาพันธ์","02":"กุมภาพันธ์",
  "3":"มีนาคม","03":"มีนาคม",
  "4":"เมษายน","04":"เมษายน",
  "5":"พฤษภาคม","05":"พฤษภาคม",
  "6":"มิถุนายน","06":"มิถุนายน",
  "7":"กรกฎาคม","07":"กรกฎาคม",
  "8":"สิงหาคม","08":"สิงหาคม",
  "9":"กันยายน","09":"กันยายน",
  "10":"ตุลาคม","11":"พฤศจิกายน","12":"ธันวาคม",
};

export function normalizeMonth(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // strip whitespace variants: \s covers space/tab/newline, plus ZWS U+200B, ZWNJ U+200C, ZWJ U+200D, BOM U+FEFF
  let t = raw.replace(/[\s\u200B\u200C\u200D\uFEFF]/g, " ").trim().replace(/[\s]+/g, " ");
  // Transliterate Thai digits so numeric aliases apply (e.g. \u0E51\u0E50 \u2192 10 \u2192 \u0E15\u0E38\u0E25\u0E32\u0E04\u0E21)
  t = t.replace(/[\u0E50-\u0E59]/g, d => String(d.charCodeAt(0) - 0x0E50));
  return MONTH_ALIASES[t] || t;
}

// Downscale + re-encode an image on the client so mobile photos don't blow past
// the Vercel serverless function timeout during Anthropic processing.
// PDFs are returned unchanged. Long-edge capped at maxDim; JPEG quality is set to
// keep municipal-doc text readable while shrinking a 5-8MB photo to ~300-700KB.
export async function readAndMaybeDownscale(
  file: File,
  maxDim = 1600,
  quality = 0.85,
): Promise<{ b64: string; mimeType: string; sizeKb: number }> {
  const readB64 = () => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(((r.result as string).split(',')[1]) || '');
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  if (!file.type.startsWith('image/')) {
    const b64 = await readB64();
    return { b64, mimeType: file.type, sizeKb: Math.round(b64.length * 0.75 / 1024) };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('อ่านรูปไม่ได้'));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    // If already small enough AND under ~600KB, ship original bytes untouched
    if (scale === 1 && file.size < 600_000) {
      const b64 = await readB64();
      return { b64, mimeType: file.type, sizeKb: Math.round(b64.length * 0.75 / 1024) };
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas ไม่พร้อมใช้งาน');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const b64 = dataUrl.split(',')[1] || '';
    return { b64, mimeType: 'image/jpeg', sizeKb: Math.round(b64.length * 0.75 / 1024) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Normalize a user-typed / pasted cell value into a well-formed decimal string
// - transliterates Thai digits (๐-๙) → Arabic (0-9) so Thai-IME users don't lose input
// - strips anything that isn't a digit or dot (drops sign, commas, spaces)
// - keeps only the first dot (paste of "1.2.3" → "1.23", not silently accepting the typo)
// - promotes a leading dot to "0." so ".5" parses as 0.5 instead of storing a literal "."
export function sanitizeInput(raw: string): string {
  let s = raw.replace(/[๐-๙]/g, d => String(d.charCodeAt(0) - 0x0E50));
  s = s.replace(/[^0-9.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  if (s.startsWith(".")) s = "0" + s;
  return s;
}

// Validate number from Claude response — returns "" for invalid/negative/zero
export function sanitizeNum(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  const n = parseFloat(String(v).replace(/,/g, ""));
  if (isNaN(n) || n < 0) return "";
  if (n === 0) return ""; // M3: keep empty cells empty
  const rounded = parseFloat(n.toFixed(2));
  if (!isFinite(rounded) || rounded === 0) return ""; // guard Infinity + tiny fractions rounding to 0
  return String(rounded);
}
