import type { WatchNotifyTarget, WebhookConfig, WebhookEvent } from "../types/index.js";
import { sendDiscordNotification } from "./discord.js";
import { sendHttpNotification } from "./http.js";
import { sendSlackNotification } from "./slack.js";

export async function dispatchNotification(
  target: WatchNotifyTarget,
  url: string,
  message: string,
): Promise<void> {
  if (target === "slack") {
    await sendSlackNotification(url, message);
    return;
  }
  if (target === "discord") {
    await sendDiscordNotification(url, message);
    return;
  }
  await sendHttpNotification(url, { message });
}

export async function dispatchWebhookEvent(
  config: WebhookConfig,
  event: WebhookEvent,
  payload: unknown,
): Promise<void> {
  if (config.event !== event) return;
  const headers = { ...(config.headers ?? {}) };
  if (config.secret) {
    headers["x-rainy-signature"] = config.secret;
  }
  await sendHttpNotification(config.url, { event, payload }, headers);
}
