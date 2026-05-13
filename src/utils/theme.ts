import type { Theme } from '../types';

export type { Theme };

export const mkTheme = (dark: boolean): Theme => ({
  blue:  "#0057A8",           // Pantone 2945 C
  green: "#3a7cbf",           // muted blue-steel for OBT sections
  gold:  "#FFA300",           // Pantone 137 C
  red:   "#c0392b",
  bg:        dark ? "#0a0e18" : "#f0f3f7",
  card:      dark ? "#111827" : "#ffffff",
  card2:     dark ? "#161e2e" : "#f5f7fa",
  card3:     dark ? "#1a2236" : "#eef1f6",
  border:    dark ? "#253050" : "#dce2ea",
  border2:   dark ? "#2f3d5a" : "#c8d0db",
  borderHeavy: dark ? "#3d5070" : "#A2AAAD",  // Pantone 421 C
  text:      dark ? "#e2e8f0" : "#1a2744",
  textMed:   dark ? "#94a3b8" : "#555",
  textMute:  dark ? "#64748b" : "#888",
  textFaint: dark ? "#475569" : "#aaa",
  rowAlt:    dark ? "#0d1221" : "#fafbfc",
  shadow:    dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.07)",
  shadow2:   dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.2)",
  p97Bg:     dark ? "#0d2040" : "#e8f0fb",
  p97Sum:    dark ? "#091530" : "#d8e8f5",
  p3Bg:      dark ? "#2a1800" : "#fff5e6",
  p3Sum:     dark ? "#1f1000" : "#ffe8c0",
  p97Num:    dark ? "#6ab0f5" : undefined,
  p3Num:     dark ? "#ffb840" : undefined,
  numColor:  dark ? "#e2e8f0" : undefined,
  totRow:    dark ? "#0a0c10" : "#1a2744",
  msgOkBg:   dark ? "#0d2b1a" : "#e6f9ee",
  msgOkTxt:  dark ? "#4ade80" : "#1a6b38",
  msgOkBdr:  dark ? "#166534" : "#9de0b6",
  msgErrBg:  dark ? "#2b0d0d" : "#fde8e8",
  msgErrTxt: dark ? "#f87171" : "#c0392b",
  msgErrBdr: dark ? "#7f1d1d" : "#f5b7b1",
  tblHeadTxt:dark ? "#94a3b8" : "#4a5568",
  histBg:    dark ? "#0d2b1a" : "#f0fdf4",
  histBdr:   dark ? "#166534" : "#86efac",
  totBg:     dark ? "#0d2040" : "#cce0f5",
  totTxt:    dark ? "#6ab0f5" : "#0057A8",
});
