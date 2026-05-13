import type { SCardProps } from '../types';

export default function SCard({label,p97,p3,color,gold}: SCardProps){
  return(
    <div style={{background:color,color:"#fff",borderRadius:8,padding:"12px 14px"}}>
      <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
      <div style={{display:"flex",gap:14}}>
        <div><div style={{fontSize:9,color:"rgba(255,255,255,0.45)",marginBottom:2}}>97%</div><div style={{fontSize:15,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{p97.toFixed(2)}</div></div>
        <div><div style={{fontSize:9,color:"rgba(255,255,255,0.45)",marginBottom:2}}>3%</div><div style={{fontSize:15,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{p3.toFixed(2)}</div></div>
        <div style={{marginLeft:"auto",textAlign:"right"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.45)",marginBottom:2}}>รวม</div><div style={{fontSize:15,fontWeight:800,color:gold,fontVariantNumeric:"tabular-nums"}}>{(p97+p3).toFixed(2)}</div></div>
      </div>
    </div>
  );
}
