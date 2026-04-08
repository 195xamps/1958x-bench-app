import OpenAI from 'openai';

// Generates a short, sentence-cased topic title for a chat from the first
// user/assistant exchange. Uses gpt-4o-mini because it's ~10x cheaper than
// gpt-4o and the task is well within its capabilities. Costs roughly
// $0.0001 per chat at current pricing.
//
// Failures are non-fatal — the caller should fire-and-forget and ignore
// errors. Returns null on any failure or if the result looks unusable.
export async function generateChatTitle(
  client: OpenAI,
  userMessage: string,
  assistantMessage: string,
): Promise<string | null> {
  // Cap the inputs so a long assistant essay doesn't blow the prompt budget.
  const trimmedUser = userMessage.slice(0, 600);
  const trimmedAssistant = assistantMessage.slice(0, 800);

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 30,
      messages: [
        {
          role: 'system',
          content:
            'You generate short, descriptive titles for guitar amp repair conversations. ' +
            'Respond with JUST the title — no quotes, no punctuation at the end, no preamble. ' +
            'Rules:\n' +
            '- 4 to 7 words\n' +
            '- Sentence case (only the first word and proper nouns capitalized)\n' +
            '- Include amp model names if they appear (e.g. "Deluxe Reverb", "JCM800", "AC30")\n' +
            '- Concrete and specific, not generic ("Bias check on Twin Reverb" not "Tube biasing question")\n' +
            '- No emojis, no hashtags, no quotes\n' +
            '- If the conversation is off-topic or too vague to summarize, respond with exactly: SKIP',
        },
        {
          role: 'user',
          content: `User asked:\n${trimmedUser}\n\nAssistant answered:\n${trimmedAssistant}\n\nTitle:`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    if (!raw || raw === 'SKIP') return null;

    // Defensive cleanup: strip wrapping quotes, trailing punctuation, code fences
    let title = raw
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^(title|topic):\s*/i, '')
      .replace(/[.!?]+$/g, '')
      .trim();

    // Sanity check the length — if the model goes weird, bail
    if (title.length < 3 || title.length > 80) return null;

    return title;
  } catch (err) {
    console.warn('[generateChatTitle] failed:', (err as Error).message);
    return null;
  }
}
