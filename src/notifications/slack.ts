import { sendHttpNotification } from "./http.js";

export async function sendSlackNotification(
  url: string,
  text: string,
): Promise<void> {
  await sendHttpNotification(url, { text });
}
