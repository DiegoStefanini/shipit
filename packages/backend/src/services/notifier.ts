import db from '../db/connection.js';

interface TelegramConfig {
  bot_token: string;
  chat_id: string;
}

interface DiscordConfig {
  webhook_url: string;
}

export async function sendTelegram(config: TelegramConfig, message: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.chat_id, text: message, parse_mode: 'HTML' }),
    });
    return res.ok;
  } catch (err) {
    console.error('Telegram send failed:', err);
    return false;
  }
}

export async function sendDiscord(config: DiscordConfig, message: string): Promise<boolean> {
  try {
    const res = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
    return res.ok || res.status === 204;
  } catch (err) {
    console.error('Discord send failed:', err);
    return false;
  }
}

export async function notify(channelId: string, message: string): Promise<boolean> {
  const channel = db.prepare('SELECT * FROM notification_channels WHERE id = ? AND enabled = 1').get(channelId) as
    | { id: string; type: string; config: string }
    | undefined;

  if (!channel) return false;

  const cfg = JSON.parse(channel.config);

  switch (channel.type) {
    case 'telegram':
      return sendTelegram(cfg as TelegramConfig, message);
    case 'discord':
      return sendDiscord(cfg as DiscordConfig, message);
    default:
      console.error(`Unknown channel type: ${channel.type}`);
      return false;
  }
}
