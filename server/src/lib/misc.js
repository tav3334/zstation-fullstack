/** Str::slug($value, $separator) : translittération ASCII + séparateur. */
export function slug(value, separator = '-') {
  return String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/@/g, `${separator}at${separator}`)
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_-]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, 'g'), '');
}

/** Envoie une notification WhatsApp via Green API (silencieux si non configuré). */
export async function sendWhatsApp(message) {
  const { GREEN_API_INSTANCE_ID: instanceId, GREEN_API_TOKEN: apiToken, GREEN_API_CHAT_ID: chatId } = process.env;
  if (!instanceId || !apiToken || !chatId) {
    console.info('WhatsApp notification ignorée : configuration Green API incomplète.');
    return false;
  }
  try {
    const res = await fetch(`https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });
    if (!res.ok) {
      console.warn('Échec envoi WhatsApp Green API', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Erreur envoi WhatsApp Green API: ${err.message}`);
    return false;
  }
}
