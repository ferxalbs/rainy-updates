import { sendHttpNotification } from "./http.js";

export async function sendDiscordNotification(
  url: string,
  text: string,
): Promise<void> {
  await sendHttpNotification(url, { content: text });
}
