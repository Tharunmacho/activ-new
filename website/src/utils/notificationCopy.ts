// Display-only wording. Keep stored reasons and API status codes unchanged.
export function notificationReason(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  const rules: [RegExp, string][] = [
    [/^Media upload error:.*WebP.*not.*supported/i, 'WhatsApp could not send this image because its format is not supported. Try Resend to use a compatible image.'],
    [/^Media download error\b|^Media upload error:.*Downloading media from weblink failed/i, 'WhatsApp could not download the image or document. Check that the file opens, then try Resend.'],
    [/^Not sent: this is ACTIV['’]s own WhatsApp number\b/i, 'WhatsApp cannot send to its own sending number. Use a different recipient number.'],
    [/Current delivery or recipient eligibility could not be verified/i, 'We could not check whether this message can be sent again. Please try again.'],
    [/Worker interrupted.*provider outcome unknown/i, 'Sending stopped before we could confirm the result. Check the delivery history before sending again.'],
    [/(?:provider acceptance.*(?:uncertain|could not be confirmed))|(?:outcome.*(?:unknown|unconfirmed))/i, 'We could not confirm whether the message was sent. Check its delivery history before sending again.'],
    [/^SMTP (?:accepted only some intended email addresses|did not confirm acceptance for the intended email address)\./i, 'We could not confirm whether the message was sent to every email address. Check its delivery history before sending again.'],
    [/expired or one-time credential|fresh credential through the account workflow/i, 'This password message cannot be sent again. Use Forgot password, or set a new admin password in Manage Admins.'],
    [/Another worker owns this delivery/i, 'This message is already being sent.'],
    [/no enabled push device|no_enabled_devices/i, 'No phone or browser is currently set up to receive notifications for this person.'],
    [/visitor has disabled notifications or has no active device/i, 'This visitor has turned off notifications or has no phone or browser set up for them.'],
    [/push_unconfigured|push\/unavailable/i, 'The push notification service is not ready. Please try again later.'],
    [/sender is not configured|provider is not configured/i, 'The sending service needs setup before messages can be sent.'],
    [/no external failed message to retry/i, 'There is no failed message available to send again.'],
    [/already accepted, delivered, read, replaced|accepted, partially accepted, read, queued/i, 'This message has no confirmed failure. It may already be sent, opened, replaced or waiting to send. Check its history.'],
    [/A retry is running or its outcome needs review/i, 'This message is being sent again, or its last result still needs checking.'],
    [/Retries are disabled for this delivery/i, 'This message cannot be sent again.'],
    [/older than the 30-day retry window/i, 'This message is more than 30 days old and cannot be sent again.'],
    [/already queued, retried, or unavailable/i, 'This update is already waiting to send, was tried again or is no longer available.'],
    [/recipient account.*(?:no longer|inactive)/i, 'This person’s account is no longer active or available.'],
    [/No usable recipient address is available/i, 'There is no valid email address or phone number for this person.'],
    [/This report row cannot be retried/i, 'This message cannot be sent again.'],
    [/original failed delivery log is unavailable/i, 'The record of the original failed message is no longer available.'],
    [/This delivery changed or was already queued/i, 'This message has changed or is already waiting to send.'],
    [/provider did not accept this retry|Provider did not send this message/i, 'The sending service could not send this message.'],
    [/This retry review has expired or is invalid/i, 'This review has expired. Review the failed messages again before sending.'],
    [/Choose between 1 and 100 delivery rows/i, 'Choose between 1 and 100 messages.'],
    [/Choose delivery report rows or filters/i, 'Choose messages or use the report filters.'],
    [/Submit the reviewed delivery rows and token|status token cannot authorize retries/i, 'Review the failed messages again before sending.'],
    [/messaging\/(?:invalid-registration-token|registration-token-not-registered)/i, 'This phone or browser needs to turn on notifications again.'],
    [/messaging\/(?:quota-exceeded|message-rate-exceeded)/i, 'The sending service is busy. This message can be tried again later.'],
    [/messaging\/(?:authentication-error|mismatched-credential|third-party-auth-error)/i, 'The push notification service needs its settings checked.'],
    [/^app\/invalid-credential\b/i, 'The push notification service could not sign in. Its settings need checking.'],
    [/^(?:\(#?132005\)|#?132005\b)/i, 'The message was too long for WhatsApp.'],
    [/^(?:\(#?132001\)|#?132001\b)/i, 'The WhatsApp message format could not be found.'],
    [/^(?:\(#?131026\)|#?131026\b)/i, 'This number could not receive the WhatsApp message.'],
    [/^(?:\(#?131048\)|#?131048\b)|^WhatsApp could not deliver:.*\(code 131048\)/i, 'WhatsApp has temporarily limited messages from ACTIV. Try again later.'],
    [/^(?:\(#?131049\)|#?131049\b)|^WhatsApp could not deliver:.*\(code 131049\)/i, 'WhatsApp did not allow this promotional message to this number.'],
    [/^(?:\(#?131053\)|#?131053\b)|^WhatsApp could not deliver:.*\(code 131053\)/i, 'WhatsApp could not use the image or document. Check that the file opens, then try Resend.'],
    [/^(?:\(#?131047\)|#?131047\b)/i, 'WhatsApp requires an approved message format because the person has not replied recently.'],
    [/^(?:SMTP[ :]+)?535(?:[ -]|$)|^Invalid login:\s*535\b/i, 'The email service could not sign in. Its settings need checking.'],
    [/invalid phone(?: number)?|phone(?: number)? (?:is )?invalid/i, 'The phone number is not valid.'],
    [/no (email|address)|missing email/i, 'There is no email address.'],
    [/ETIMEDOUT|ECONNREFUSED|timeout/i, 'The sending service did not respond. Check the message history before sending again.'],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] || text;
}

export function notificationTemplatePath(value: unknown): string {
  return (typeof value === 'string' ? value : '')
    .replace(/\bskipped\b/gi, 'not used')
    .replace(/\brefused\b/gi, 'not accepted')
    .replace(/\bsent on\b/gi, 'sent using')
    .replace(/\bfailed on\b/gi, 'could not send using');
}
