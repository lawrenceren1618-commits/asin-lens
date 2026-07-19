import "server-only";

export async function sendFeishuWebhook(text: string) {
  const webhook = process.env.FEISHU_BOT_WEBHOOK;
  if (!webhook) return { skipped: true as const };

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      msg_type: "text",
      content: { text },
    }),
  });

  if (!response.ok) {
    throw new Error(`Feishu webhook failed: ${response.status}`);
  }
  return { skipped: false as const };
}
