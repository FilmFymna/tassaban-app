export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64) return res.status(400).json({ error: 'No file' });
    const KEY = process.env.VITE_GEMINI_KEY;
    if (!KEY) return res.status(500).json({ error: 'No API key' });
    const ORGS = ["เทศบาลเมืองวารินชำราบ","เทศบาลตำบลห้วยขะยูง","เทศบาลตำบลนาเยีย","เทศบาลตำบลแสนสุข","เทศบาลตำบลเมืองศรีไค","เทศบาลตำบลคำน้ำแซบ","เทศบาลตำบลคำขวาง","เทศบาลตำบลบุ่งไหม","เทศบาลตำบลธาตุ","เทศบาลตำบลบุ่งมะแลง","เทศบาลตำบลท่าช้าง","เทศบาลตำบลสว่าง","เทศบาลตำบลนาเรือง","เทศบาลตำบลนาจาน","เทศบาลตำบลสำโรง","อบต.คูเมือง","อบต.ท่าลาด","อบต.โนนผึ้ง","อบต.โนนโหนน","อบต.บุ่งหวาย","อบต.โพธิ์ใหญ่","อบต.สระสมิง","อบต.หนองกินเพล","อบต.ห้วยขะยุง","อบต.ขามป้อม","อบต.ค้อน้อย","อบต.โคกก่อง","อบต.โคกสว่าง","อบต.โนนกลาง","อบต.โนนกาเล็น","อบต.บอน","อบต.หนองไฮ","อบต.แก่งโดม","อบต.นาดี"];
    const prompt = `อ่านข้อมูลจากเอกสารนี้ ตอบเป็น JSON เท่านั้น\nรายชื่อหน่วยงาน:\n${ORGS.join("\n")}\nรูปแบบ: {"rows":[{"name":"ชื่อในเอกสาร","matched":"ชื่อในระบบ","count":0,"p97":0.0,"p3":0.0,"amount":0}],"total_count":0,"total_p97":0.0,"total_p3":0.0,"total_amount":0}`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${KEY}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:mimeType||'application/pdf',data:fileBase64}},{text:prompt}]}],generationConfig:{temperature:0,maxOutputTokens:4000}})
    });
    if(!r.ok){const e=await r.text();return res.status(500).json({error:e.slice(0,300)});}
    const data=await r.json();
    const text=data.candidates?.[0]?.content?.parts?.[0]?.text||'';
    const m=text.match(/\{[\s\S]*\}/);
    if(!m)return res.status(500).json({error:'ไม่พบ JSON',raw:text.slice(0,200)});
    return res.status(200).json(JSON.parse(m[0]));
  }catch(e){return res.status(500).json({error:e.message});}
}
