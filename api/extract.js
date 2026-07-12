export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

// ~7.5MB binary → ~10MB base64 (base64 overhead ≈ 33%)
const MAX_B64_CHARS = 10_000_000;

const ORGS = ["เทศบาลเมืองวารินชำราบ","เทศบาลตำบลห้วยขะยูง","เทศบาลตำบลนาเยีย","เทศบาลตำบลแสนสุข","เทศบาลตำบลเมืองศรีไค","เทศบาลตำบลคำน้ำแซบ","เทศบาลตำบลคำขวาง","เทศบาลตำบลบุ่งไหม","เทศบาลตำบลธาตุ","เทศบาลตำบลบุ่งมะแลง","เทศบาลตำบลท่าช้าง","เทศบาลตำบลสว่าง","เทศบาลตำบลนาเรือง","เทศบาลตำบลนาจาน","เทศบาลตำบลสำโรง","อบต.คูเมือง","อบต.ท่าลาด","อบต.โนนผึ้ง","อบต.โนนโหนน","อบต.บุ่งหวาย","อบต.โพธิ์ใหญ่","อบต.สระสมิง","อบต.หนองกินเพล","อบต.ห้วยขะยุง","อบต.ขามป้อม","อบต.ค้อน้อย","อบต.โคกก่อง","อบต.โคกสว่าง","อบต.โนนกลาง","อบต.โนนกาเล็น","อบต.บอน","อบต.หนองไฮ","อบต.แก่งโดม","อบต.นาดี"];

const PROMPT = `อ่านข้อมูลจากเอกสารนี้ ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น
รายชื่อหน่วยงาน:
${ORGS.join("\n")}
ถ้าเอกสารระบุวันที่ชัดเจน ให้ใส่เลขวัน (1-31) ใน document_day มิฉะนั้นให้เป็น null
ถ้าเอกสารระบุชื่อเดือนภาษาไทย ให้ใส่ชื่อเดือนเต็มใน document_month (เช่น "มีนาคม" "เมษายน" "ตุลาคม") มิฉะนั้นให้เป็น null
ตัวเลขทุกช่องต้องเป็นทศนิยม ไม่ใช้เครื่องหมายคอมม่าคั่นหลัก (เช่น 1250.00 ไม่ใช่ 1,250.00)
รูปแบบ: {"rows":[{"name":"ชื่อในเอกสาร","matched":"ชื่อในระบบ","count":0,"p97":0.0,"p3":0.0,"amount":0}],"total_count":0,"total_p97":0.0,"total_p3":0.0,"total_amount":0,"document_day":null,"document_month":null}`;

export default async function handler(req, res) {
  // CORS headers — BUG-5: never fall back to wildcard; BUG-26: only set if not already set by api-server.js
  if (!res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://tassaban-app.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64) return res.status(400).json({ error: 'No file' });
    if (typeof fileBase64 !== 'string') return res.status(400).json({ error: 'fileBase64 must be a string' });
    if (!mimeType)   return res.status(400).json({ error: 'No mimeType' });

    // Item 2: file size limit
    if (fileBase64.length > MAX_B64_CHARS) {
      return res.status(413).json({ error: 'ไฟล์ใหญ่เกินไป (สูงสุด ~7.5MB)' });
    }

    const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_TYPES.includes(mimeType)) return res.status(400).json({ error: `Unsupported mimeType: ${mimeType}` });
    const KEY = process.env.ANTHROPIC_KEY;
    if (!KEY) return res.status(500).json({ error: 'No API key' });

    const isPdf = mimeType === 'application/pdf';
    // Chain client abort → Anthropic call so a canceled upload doesn't burn tokens
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 25000);
    const onClientClose = () => ctrl.abort();
    req.on('close', onClientClose);
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': KEY,
          'anthropic-version': '2023-06-01',
          ...(isPdf ? {'anthropic-beta':'pdfs-2024-09-25'} : {}),
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: [
              isPdf
                ? { type: 'document', source: { type: 'base64', media_type: mimeType, data: fileBase64 } }
                : { type: 'image',    source: { type: 'base64', media_type: mimeType, data: fileBase64 } },
              { type: 'text', text: PROMPT },
            ],
          }],
        }),
      });
    } finally {
      clearTimeout(timeoutId);
      req.off?.('close', onClientClose);
    }

    if (!r.ok) {
      const e = await r.text();
      // Log full body server-side but don't forward Anthropic's raw error (may hint at key/auth issues)
      console.error(`Anthropic ${r.status}:`, e.slice(0, 500));
      return res.status(502).json({ error: 'AI service unavailable — กรุณาลองใหม่' });
    }
    const data = await r.json();
    const text = data.content?.[0]?.text || '';
    // Prefer JSON inside ```json``` fence; fall back to a balanced-brace scan.
    // Old /\{[\s\S]*\}/ was greedy and grabbed the outer span across any prose braces.
    let jsonStr = null;
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    if (!jsonStr) {
      const start = text.indexOf('{');
      if (start !== -1) {
        // Track string state so a `}` inside a JSON string value doesn't prematurely close the object.
        let depth = 0, end = -1, inStr = false, esc = false;
        for (let i = start; i < text.length; i++) {
          const c = text[i];
          if (esc) { esc = false; continue; }
          if (inStr) { if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
          if (c === '"') inStr = true;
          else if (c === '{') depth++;
          else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end !== -1) jsonStr = text.slice(start, end + 1);
      }
    }
    if (!jsonStr) return res.status(500).json({ error: 'ไม่พบ JSON', raw: text.slice(0, 200) });
    let parsed;
    try { parsed = JSON.parse(jsonStr); } catch (e) { return res.status(500).json({ error: 'JSON parse failed', raw: jsonStr.slice(0, 200) }); }
    return res.status(200).json(parsed);
  } catch (e) {
    if (e?.name === 'AbortError') return; // client hung up or timeout — no response needed
    console.error('extract handler error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
