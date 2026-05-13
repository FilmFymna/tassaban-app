import Anthropic from '@anthropic-ai/sdk';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const ORGS = ["เทศบาลเมืองวารินชำราบ","เทศบาลตำบลห้วยขะยูง","เทศบาลตำบลนาเยีย","เทศบาลตำบลแสนสุข","เทศบาลตำบลเมืองศรีไค","เทศบาลตำบลคำน้ำแซบ","เทศบาลตำบลคำขวาง","เทศบาลตำบลบุ่งไหม","เทศบาลตำบลธาตุ","เทศบาลตำบลบุ่งมะแลง","เทศบาลตำบลท่าช้าง","เทศบาลตำบลสว่าง","เทศบาลตำบลนาเรือง","เทศบาลตำบลนาจาน","เทศบาลตำบลสำโรง","อบต.คูเมือง","อบต.ท่าลาด","อบต.โนนผึ้ง","อบต.โนนโหนน","อบต.บุ่งหวาย","อบต.โพธิ์ใหญ่","อบต.สระสมิง","อบต.หนองกินเพล","อบต.ห้วยขะยุง","อบต.ขามป้อม","อบต.ค้อน้อย","อบต.โคกก่อง","อบต.โคกสว่าง","อบต.โนนกลาง","อบต.โนนกาเล็น","อบต.บอน","อบต.หนองไฮ","อบต.แก่งโดม","อบต.นาดี"];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64) return res.status(400).json({ error: 'No file' });
    if (!mimeType) return res.status(400).json({ error: 'No mimeType' });
    const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_TYPES.includes(mimeType)) return res.status(400).json({ error: `Unsupported mimeType: ${mimeType}` });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY });

    const isPdf = mimeType === 'application/pdf';
    const promptText = `อ่านข้อมูลจากเอกสารนี้ ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น\nรายชื่อหน่วยงาน:\n${ORGS.join("\n")}\nรูปแบบ: {"rows":[{"name":"ชื่อในเอกสาร","matched":"ชื่อในระบบ","count":0,"p97":0.0,"p3":0.0,"amount":0}],"total_count":0,"total_p97":0.0,"total_p3":0.0,"total_amount":0}`;

    const messages = [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: promptText,
          cache_control: { type: 'ephemeral' }
        },
        isPdf
          ? { type: 'document', source: { type: 'base64', media_type: mimeType, data: fileBase64 } }
          : { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileBase64 } }
      ]
    }];

    const response = await client.beta.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages,
      betas: ['pdfs-2024-09-25'],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return res.status(500).json({ error: 'ไม่พบ JSON', raw: text.slice(0, 200) });
    let parsed;
    try { parsed = JSON.parse(m[0]); } catch (e) { return res.status(500).json({ error: 'JSON parse failed', raw: m[0].slice(0, 200) }); }
    return res.status(200).json(parsed);
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
