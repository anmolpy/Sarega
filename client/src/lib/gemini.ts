/**
 * Google Gemini API integration for TrackNotes
 * Uses gemini-2.0-flash model for AI suggestions
 */

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function callGemini(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey) {
    throw new Error('No API key set. Go to Settings to add your Gemini API key.');
  }

  const response = await fetch(`${API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip markdown fences if present
  text = text.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();

  return text;
}

// ── Prompt Builders ────────────────────────────────────────────────────

export function buildTextEnhancePrompt(body: string): string {
  return `You are a creative songwriting assistant. Given the following lyrics or text note, suggest improvements — rhymes, rewrites, or a continuation. Keep the same mood and style. Be concise and practical.

Text:
${body}

Provide your suggestion as plain text, not JSON.`;
}

export function buildChordEnhancePrompt(lines: { chord: string; lyrics: string }[]): string {
  const formatted = lines.map((l) => `${l.chord} — ${l.lyrics}`).join('\n');
  return `You are a music theory assistant. Given this chord progression with lyrics, suggest a related progression or variation that would work well as a bridge or alternate section. Explain briefly why it works.

Progression:
${formatted}

Provide your suggestion as plain text.`;
}

export function buildDrumEnhancePrompt(
  grid: boolean[][],
  instruments: string[],
  bpm: number,
  swing: number
): string {
  const desc = instruments
    .map((inst, i) => {
      const steps = grid[i]
        .map((on, j) => (on ? j + 1 : null))
        .filter(Boolean);
      return `${inst}: steps ${steps.length > 0 ? steps.join(', ') : 'none'}`;
    })
    .join('\n');

  return `You are a drum programming assistant. Given this 16-step drum pattern at ${bpm} BPM with ${swing}% swing, suggest a variation or fill. Describe which steps to change and why.

Current pattern:
${desc}

Provide your suggestion as plain text describing the changes.`;
}
