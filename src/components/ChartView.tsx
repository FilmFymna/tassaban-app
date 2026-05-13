import React, { useState, useMemo } from 'react';
import type { ChartViewProps } from '../types';
import { ALL } from '../data/orgs';

export default function ChartView({MONTHS,mSum,getM,T,fmt,sR,sG,isMobile}: ChartViewProps){
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
