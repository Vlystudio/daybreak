# iOS SDK and privacy-manifest review

| Target | SDK                  | Necessary | Manifest                                                 | Signature                              | Data                                              | Domains                 | Tracking | Health transmission |
| ------ | -------------------- | --------: | -------------------------------------------------------- | -------------------------------------- | ------------------------------------------------- | ----------------------- | -------: | ------------------: |
| App    | Capacitor            |       Yes | dependency archive; verify in final Xcode privacy report | external_archive_verification_required | webview operational data                          | daybreak-one.vercel.app |       No |                  No |
| App    | CapacitorPreferences |       Yes | dependency archive; verify required-reason declaration   | not_applicable                         | local Apple Health connection and last-sync state | None                    |       No |                  No |
| App    | DaybreakHealthkit    |       Yes | app manifest plus source review                          | first_party_source                     | user-authorized HealthKit samples                 | daybreak-one.vercel.app |       No |                 Yes |

Final signatures and dependency manifests must be verified from the signed archive and Xcode privacy report.
