export interface CellData { p97: string; p3: string; }
export interface DayTable { [day: string]: CellData; }
export interface OrgTable { [org: string]: DayTable; }
export interface HistoryEntry { day: string; total_p97: number; total_p3: number; total_amount: number; }
export interface MonthData { days: string[]; table: OrgTable; history: HistoryEntry[]; }
export interface DBState { [month: string]: MonthData; }
export interface MonthSummary { t97: number; t3: number; o97: number; o3: number; days: number; }
export interface ExtractRow { name: string; matched?: string; count?: number; p97?: number | string; p3?: number | string; amount?: number; }
export interface ExtractResponse {
  rows: ExtractRow[];
  total_count?: number;
  total_p97?: number;
  total_p3?: number;
  total_amount?: number;
  document_day?: number | null;
  error?: string;
}
export interface Msg { ok: boolean; text: string; }

export interface Theme {
  blue: string; green: string; gold: string; red: string;
  bg: string; card: string; card2: string; card3: string;
  border: string; border2: string; borderHeavy: string;
  text: string; textMed: string; textMute: string; textFaint: string;
  rowAlt: string; shadow: string; shadow2: string;
  p97Bg: string; p97Sum: string; p3Bg: string; p3Sum: string;
  p97Num: string | undefined; p3Num: string | undefined; numColor: string | undefined;
  totRow: string;
  msgOkBg: string; msgOkTxt: string; msgOkBdr: string;
  msgErrBg: string; msgErrTxt: string; msgErrBdr: string;
  tblHeadTxt: string; histBg: string; histBdr: string;
  totBg: string; totTxt: string;
}

export interface MTableProps {
  title: string; list: string[]; days: string[]; table: OrgTable;
  setCell: (org: string, day: string, field: 'p97' | 'p3', value: string) => void;
  T: Theme;
  sR: (tbl: OrgTable, org: string, days: string[], f: 'p97' | 'p3') => number;
  sD: (tbl: OrgTable, day: string, lst: string[], f: 'p97' | 'p3') => number;
  sG: (tbl: OrgTable, lst: string[], days: string[], f: 'p97' | 'p3') => number;
  n2: (n: number | string) => string;
}

export interface SumViewProps {
  MONTHS: string[]; mSum: (m: string) => MonthSummary; hasData: (m: string) => boolean;
  setMon: (m: string) => void; setMainTab: (tab: string) => void; setSubTab: (tab: string) => void;
  getM: (m: string) => MonthData; T: Theme; fmt: (n: number | null | undefined) => string;
  sR: (tbl: OrgTable, org: string, days: string[], f: 'p97' | 'p3') => number; isMobile: boolean;
}

export interface ChartViewProps {
  MONTHS: string[]; mSum: (m: string) => MonthSummary; getM: (m: string) => MonthData;
  T: Theme; fmt: (n: number | null | undefined) => string;
  sR: (tbl: OrgTable, org: string, days: string[], f: 'p97' | 'p3') => number;
  sG: (tbl: OrgTable, lst: string[], days: string[], f: 'p97' | 'p3') => number;
  isMobile: boolean;
}

export interface SCardProps { label: string; p97: number; p3: number; color: string; }
