export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  const prompt = `You are an expert forensic receipt fraud analyst with deep knowledge of Southeast Asian merchant receipts (Grab, Gojek, FoodPanda, etc).

Analyze this receipt image thoroughly for fraud indicators. Return ONLY valid JSON, no markdown, no explanation.

Examine these specific areas:

1. AI_GENERATION: Is this AI-generated? Check for: unnatural paper texture, perfect lighting, logo artifacts, font rendering artifacts typical of diffusion models, missing print imperfections, overly clean edges
2. DIGITAL_TAMPERING: Was this digitally edited? Check for: JPEG compression artifacts around specific fields, inconsistent font weight/kerning/baseline in date or serial number vs surrounding text, color inconsistency in edited regions, misaligned text
3. SERIAL_DATE_EDIT: CRITICAL - Compare serial number and date/time fields very carefully against surrounding text. Different font, weight, spacing, or color = strong fraud signal
4. TEMPLATE_VALIDITY: Does layout, logo, field positions match known real receipts for this merchant?
5. MATH_VALIDATION: Add up all line items, check subtotal + tax + fees = total exactly
6. PRINT_AUTHENTICITY: Real thermal receipts have specific characteristics - check for these

Return this exact JSON:
{
  "verdict": "LEGITIMATE" or "SUSPICIOUS" or "FRAUDULENT",
  "fraud_score": number 0-100,
  "merchant": "merchant name or Unknown",
  "signals": [
    {
      "category": "AI_GENERATED or TAMPERED or SERIAL_DATE_EDIT or TEMPLATE_INVALID or MATH_ERROR or CLEAN",
      "status": "pass or warn or fail or info",
      "name": "short name max 4 words",
      "detail": "specific precise finding with details of what you observed"
    }
  ],
  "summary": "2-3 sentences explaining overall assessment and confidence level"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error?.message || 'API error ' + response.status);
    const raw = data.content.map(i => i.text || '').join('').replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
