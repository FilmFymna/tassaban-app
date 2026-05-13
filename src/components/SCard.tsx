import type { SCardProps } from '../types';

export default function SCard({label,p97,p3,color}: SCardProps){
  return(
    <div style={{background:color,color:"#fff",borderRadius:10,padding:"12px 14px"}}>
      <div style={{fontSize:11,opacity:.8,marginBottom:5}}>{label}</div>
      <div style={{display:"flex",gap:10}}>
        <div><div style={{fontSize:10,opacity:.7}}>97%</div><div style={{fontSize:14,fontWeight:800}}>{p97.toFixed(2)}</div></div>
        <div><div style={{fontSize:10,opacity:.7}}>3%</div><div style={{fontSize:14,fontWeight:800}}>{p3.toFixed(2)}</div></div>
        <div><div style={{fontSize:10,opacity:.7}}>รวม</div><div style={{fontSize:14,fontWeight:800,color:"#ffd84d"}}>{(p97+p3).toFixed(2)}</div></div>
      </div>
    </div>
  );
}
