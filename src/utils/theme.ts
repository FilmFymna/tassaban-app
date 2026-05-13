import type { Theme } from '../types';

export type { Theme };

export const mkTheme = (dark: boolean): Theme => ({
  blue:  dark ? "#0057A8" : "#1565C0",  // Pantone 2945 C (dark) / Material Blue 800 (light)
  green: dark ? "#3a7cbf" : "#1E88E5", // OBT sections
  gold:  "#FFA300",           // Pantone 137 C
  red:   "#DC2626",
  bg:        dark ? "#090D14" : "#EEF2F7",
  card:      dark ? "#0F1623" : "#FFFFFF",
  card2:     dark ? "#141D2F" : "#F8FAFC",
  card3:     dark ? "#19243A" : "#F1F5F9",
  border:    dark ? "#1E2D42" : "#E2E8F0",
  border2:   dark ? "#263855" : "#CBD5E1",
  borderHeavy: dark ? "#3d5070" : "#A2AAAD",  // Pantone 421 C (light)
  text:      dark ? "#E2E8F0" : "#0F172A",
  textMed:   dark ? "#94A3B8" : "#475569",
  textMute:  dark ? "#64748B" : "#64748B",
  textFaint: dark ? "#364B69" : "#94A3B8",
  rowAlt:    dark ? "#0C1020" : "#F8FAFC",
  shadow:    dark ? "rgba(0,0,0,0.5)" : "rgba(15,23,42,0.05)",
  shadow2:   dark ? "rgba(0,0,0,0.7)" : "rgba(15,23,42,0.1)",
  p97Bg:     dark ? "#0D1E3D" : "#F0F4FF",
  p97Sum:    dark ? "#081630" : "#DBEAFE",
  p3Bg:      dark ? "#1C1100" : "#FFFBEB",
  p3Sum:     dark ? "#130C00" : "#FEF3C7",
  p97Num:    dark ? "#60A5FA" : undefined,
  p3Num:     dark ? "#FFA300" : undefined,
  numColor:  dark ? "#E2E8F0" : undefined,
  totRow:    dark ? "#090D14" : "#0F172A",
  totGold:   "#ffd84d",
  sum3Bg:    "#475569",
  msgOkBg:   dark ? "#052E16" : "#F0FDF4",
  msgOkTxt:  dark ? "#4ADE80" : "#15803D",
  msgOkBdr:  dark ? "#166534" : "#86EFAC",
  msgErrBg:  dark ? "#2D0A0A" : "#FEF2F2",
  msgErrTxt: dark ? "#F87171" : "#DC2626",
  msgErrBdr: dark ? "#7F1D1D" : "#FECACA",
  tblHeadTxt:dark ? "#64748B" : "#64748B",
  histBg:    dark ? "#052E16" : "#F0FDF4",
  histBdr:   dark ? "#166534" : "#86EFAC",
  totBg:     dark ? "#0D1E3D" : "#EFF6FF",
  totTxt:    dark ? "#60A5FA" : "#0057A8",
});
