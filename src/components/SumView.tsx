import React, { useMemo } from 'react';
import type { SumViewProps } from '../types';
import { TESSABAN, OBT, ALL } from '../data/orgs';

export default function SumView({MONTHS,mSum,hasData,setMon,setMainTab,setSubTab,getM,T,fmt,sR,isMobile}: SumViewProps){
  const th=(w: number,l=false,bg?: string): React.CSSProperties=>({padding:"6px 8px",textAlign:l?"left":"center",fontWeight:700,fontSize:11,color:T.tblHeadTxt,borderBottom:`1px solid ${T.border}`,borderRight:`1px solid ${T.border}`,minWidth:w,whiteSpace:"nowrap",...(bg?{background:bg}:{background:T.card3})});
  const td: React.CSSProperties={borderBottom:`1px solid ${T.border}`,borderRight:`1px solid ${T.border}`,verticalAlign:"middle"};
  const yr=MONTHS.reduce((a,m)=>{const s=mSum(m);return{t97:a.t97+s.t97,t3:a.t3+s.t3,o97:a.o97+s.o97,o3:a.o3+s.o3};},{t97:0,t3:0,o97:0,o3:0});
  const orgTotals = useMemo(() => {
    const m: Record<string,{t97:number,t3:number}> = {};
    ALL.forEach(org => {
      m[org] = {
        t97: MONTHS.reduce((s,mon) => { const md=getM(mon); return s+sR(md.table,org,md.days,"p97"); }, 0),
        t3:  MONTHS.reduce((s,mon) => { const md=getM(mon); return s+sR(md.table,org,md.days,"p3"); }, 0),
      };
    });
    return m;
  }, [MONTHS, getM, sR]);
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
                <th style={{...th(110),background:T.totRow,color:T.totGold}} rowSpan={2}>รวมทั้งหมด</th>
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
              <tr style={{background:T.totRow,fontWeight:800}}>
                <td style={{...td,padding:"8px 10px",color:T.totGold,borderColor:T.borderHeavy}} colSpan={2}>รวมทั้งปี</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:T.totTxt,borderColor:T.borderHeavy}}>{fmt(yr.t97)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:T.totTxt,borderColor:T.borderHeavy}}>{fmt(yr.t3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:T.totTxt,fontWeight:900,borderColor:T.borderHeavy}}>{fmt(yr.t97+yr.t3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:T.totGold,borderColor:T.borderHeavy}}>{fmt(yr.o97)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:T.totGold,borderColor:T.borderHeavy}}>{fmt(yr.o3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 8px",color:T.totGold,fontWeight:900,borderColor:T.borderHeavy}}>{fmt(yr.o97+yr.o3)}</td>
                <td style={{...td,textAlign:"right",padding:"8px 10px",color:T.totGold,fontSize:14,fontWeight:900,borderColor:T.borderHeavy}}>{fmt(yr.t97+yr.t3+yr.o97+yr.o3)}</td>
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
                    const {t97,t3}=orgTotals[org]||{t97:0,t3:0};
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
