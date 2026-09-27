// Show actionable, allow-listed errors without displaying provider messages
// that can contain the user's email or other request details.
export function authErrorMessage(error: { code?: string; status?: number }, verifying: boolean, creating: boolean): string {
  if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit' || error.status === 429) {
    return 'Der er sendt for mange forespørgsler. Vent lidt, før du prøver igen.';
  }
  if (error.code === 'email_address_not_authorized') {
    return 'Platformens mailafsender tillader endnu ikke denne modtager. Administratoren skal konfigurere en mailafsender til alle brugere. Ingen mail blev sendt.';
  }
  if (error.code === 'signup_disabled' || error.code === 'otp_disabled') {
    return 'Oprettelse af nye konti er slået fra på platformen. Kontakt administratoren.';
  }
  if (error.code === 'email_provider_disabled') {
    return 'Login med e-mail er slået fra på platformen. Kontakt administratoren.';
  }
  if (error.code === 'email_address_invalid') return 'Kontrollér, at e-mailadressen er skrevet korrekt.';
  if (error.status !== undefined && error.status >= 500) return 'Login-tjenesten kunne ikke gennemføre forespørgslen. Prøv igen senere eller kontakt administratoren.';
  return verifying ? 'Koden er ugyldig eller udløbet. Bed om en ny kode.' : creating
    ? 'Oprettelsesmailen kunne ikke sendes. Prøv igen senere eller kontakt administratoren.'
    : 'Login-mailen kunne ikke sendes. Kontrollér e-mailen eller vælg Opret konto.';
}
