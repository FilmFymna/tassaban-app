import React from 'react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,background:'#f0f3f7',fontFamily:"'Noto Sans Thai','Sarabun',sans-serif",padding:24}}>
          <div style={{fontSize:48}}>⚠️</div>
          <div style={{fontSize:20,fontWeight:800,color:'#c0392b'}}>เกิดข้อผิดพลาด</div>
          <div style={{fontSize:13,color:'#555',maxWidth:480,textAlign:'center',wordBreak:'break-all'}}>{this.state.error.message}</div>
          <button onClick={()=>window.location.reload()} style={{padding:'10px 24px',background:'#0057A8',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:15,fontWeight:700}}>โหลดหน้าใหม่</button>
        </div>
      );
    }
    return this.props.children;
  }
}
