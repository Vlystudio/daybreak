# Sign in with Apple applicability decision

Daybreak V1 uses first-party Supabase email/password accounts. Google OAuth is solely a Google Calendar integration after authentication; Oura and Fitbit are wearable connections. None establishes the primary Daybreak account, and there is no Google, Facebook, X, LinkedIn, Amazon, or other third-party social login button.

Therefore Sign in with Apple is not added for V1 under the social-login requirement. Adding any third-party primary account login triggers a release-blocking review and, absent a documented Apple exception, full Sign in with Apple implementation including nonce/PKCE, private relay, credential state, account linking/deduplication, reauthentication, revocation, and deletion.

Current integration OAuth uses a server-signed state bound to the authenticated user plus a mirrored HttpOnly, secure, same-site nonce cookie and strict callback provider/redirect validation. Supabase session credentials remain in the WKWebView cookie store; Capacitor Preferences stores only non-secret Apple Health connection and last-sync timestamps, never auth tokens.
