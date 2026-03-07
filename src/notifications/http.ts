export async function sendHttpNotification(
  url: string,
  payload: unknown,
  headers: Record<string, string> = {},
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Webhook request failed with status ${response.status}`);
  }
}
