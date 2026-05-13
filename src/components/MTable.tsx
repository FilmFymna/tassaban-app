import React from 'react';
import type { MTableProps } from '../types';

const MTable = React.memo(function MTable({title,list,days,table,setCell,T,sR,sD,sG,n2}: MTableProps){
  const col = title==="เทศบาล" ? T.blue : T.green;
  const NW=160, CW=48;
  const hdr97=sG(table,list,days,"p97"), hdr3=sG(table,list,days,"p3");
  return(
    <div style={{background:T.card,borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
      <div style={{background:col,color:"#fff",padding:"8px 16px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontWeight:700,fontSize:13,letterSpacing:"0.01em"}}>{title}</span>
        <span style={{fontSize:10,color:"rgba(255,255,255,0.6)",background:"rgba(255,255,255,0.12)",padding:"1px 8px",borderRadius:3,letterSpacing:"0.04em"}}>97% / 3%</span>
        <span style={{marginLeft:"auto",fontSize:11,color:"rgba(255,255,255,0.75)",fontVariantNumeric:"tabular-nums"}}>Σ97%: {hdr97.toFixed(2)} · Σ3%: {hdr3.toFixed(2)} · รวม: {(hdr97+hdr3).toFixed(2)}</span>
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
              const r97=sR(table,org,days,"p97"), r3=sR(table,org,days,"p3");
              return(
                <tr key={org} style={{background:i%2===0?T.card:T.rowAlt}}>
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
                </tr>
              );
            })}
            <tr style={{borderTop:`2px solid ${T.borderHeavy}`,background:T.p97Sum}}>
              <td style={{padding:"5px 8px",fontWeight:800,color:col,borderRight:`2px solid ${T.borderHeavy}`,fontSize:12}}>รวม 97%</td>
              {days.map(d=><React.Fragment key={d}>
                <td style={{padding:"5px 4px",textAlign:"right",fontWeight:800,color:T.totTxt,background:T.totBg,fontSize:12}}>{n2(sD(table,d,list,"p97"))}</td>
                <td style={{padding:"5px 4px",background:T.card3,borderRight:`2px solid ${T.borderHeavy}`}}/>
              </React.Fragment>)}
              <td style={{padding:"5px 6px",textAlign:"right",background:col,color:"#fff",fontWeight:900,fontSize:13}} colSpan={3}>{n2(hdr97)}</td>
            </tr>
            <tr style={{background:T.p3Sum}}>
              <td style={{padding:"5px 8px",fontWeight:800,color:T.textMed,borderRight:`2px solid ${T.borderHeavy}`,fontSize:12}}>รวม 3%</td>
              {days.map(d=><React.Fragment key={d}>
                <td style={{padding:"5px 4px",background:T.card3}}/>
                <td style={{padding:"5px 4px",textAlign:"right",fontWeight:800,color:T.textMed,background:T.card2,fontSize:12,borderRight:`2px solid ${T.borderHeavy}`}}>{n2(sD(table,d,list,"p3"))}</td>
              </React.Fragment>)}
              <td style={{padding:"5px 6px",textAlign:"right",background:T.sum3Bg,color:"#fff",fontWeight:900,fontSize:13}} colSpan={3}>{n2(hdr3)}</td>
            </tr>
            <tr style={{background:T.totRow}}>
              <td style={{padding:"6px 8px",fontWeight:900,color:T.totGold,borderRight:`2px solid ${T.borderHeavy}`,fontSize:12}}>รวมทั้งหมด</td>
              {days.map(d=><React.Fragment key={d}>
                <td colSpan={2} style={{padding:"6px 4px",textAlign:"right",fontWeight:900,color:T.totGold,background:T.totRow,fontSize:13,borderRight:`2px solid ${T.borderHeavy}`}}>{n2(sD(table,d,list,"p97")+sD(table,d,list,"p3"))}</td>
              </React.Fragment>)}
              <td style={{padding:"6px 6px",textAlign:"right",background:T.blue,color:T.totGold,fontWeight:900,fontSize:14}} colSpan={3}>{n2(hdr97+hdr3)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default MTable;
