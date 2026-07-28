# Age-rating and export-compliance worksheet

## Age rating

Answer the current App Store Connect questionnaire from the signed candidate,
not from this draft. Proposed answers:

| Current descriptor                                                                      | Draft answer     | Evidence/rationale                                                                                                     |
| --------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Age assurance/in-app control                                                            | Yes              | Signup requires explicit adult self-attestation; describe it accurately as self-attestation, not identity verification |
| Unrestricted web access                                                                 | No               | The WKWebView uses Daybreak’s fixed HTTPS application origin and is not a general browser                              |
| User-generated content distributed to others                                            | No               | V1 has no public feed, messaging, or user-to-user publishing                                                           |
| Social media/messaging/chat                                                             | No               | Disabled/not in submitted V1                                                                                           |
| Advertising                                                                             | No               | No ad SDK or ad surface                                                                                                |
| Health or wellness topics                                                               | Frequent/present | Planning includes fitness, nutrition, sleep, and general wellness recommendations                                      |
| Medical or treatment information                                                        | None             | No diagnosis, treatment, medication, or emergency guidance                                                             |
| Profanity, fear, substances, sexuality/nudity, violence, gambling, contests, loot boxes | None             | Not in the submitted feature set                                                                                       |

Apple may calculate a lower content rating from wellness topics. Because
Daybreak’s Terms and eligibility require users to be 18 or older, choose
**Override to Higher Age Rating: 18+** and provide an age-suitability URL that
explains adult self-attestation and general-wellness scope. Apple’s current help
states that a higher override is required when an app EULA’s minimum age exceeds
the calculated rating. Do not select Made for Kids.

Reconcile regional ratings and availability with counsel. Record screenshots of
the completed questionnaire and final per-region output.

## Export compliance

The native shell uses HTTPS/TLS and Apple/WebKit security services. Server-side
AES-256-GCM protects OAuth tokens but is not shipped in the iOS client. No
proprietary or unpublished cryptographic algorithm is intended in the app.

Draft determination: the signed client likely uses only exempt encryption, so
`ITSAppUsesNonExemptEncryption` should be `NO`. This is not legal/export advice.
Before relying on it:

1. Inspect the exact archive and every native SDK for implemented encryption.
2. Answer Apple’s current App Encryption questions for the actual distribution
   countries and legal entity.
3. Obtain export counsel/owner approval, including any U.S. self-classification
   report and France/import requirements.
4. If Apple requires documentation, upload and approve it before TestFlight/App
   Review and add Apple’s compliance code to the release configuration.
5. Save a non-secret App Store Connect determination reference with the archive.

Do not answer “no encryption”; the accurate claim is “no non-exempt encryption”
only if the final legal/technical review confirms the exemption.
