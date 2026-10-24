/** Keep the booking action consistent with the organiser's registration or meeting URL. */
export function onlineRegistrationLink(url?: string): boolean {
  return /register|registration|forms\.|\/form|lu\.ma|eventbrite/i.test(String(url || ''));
}
