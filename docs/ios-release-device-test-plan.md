# iOS release device test plan

Record full device model, screen class, iOS version/build, TestFlight version/build, install type, tester, UTC timestamp, result, and evidence for every row. Use the exact release-candidate IPA; do not substitute Safari or browser emulation for native-shell tests.

## TestFlight and install state

- [ ] App Store Connect upload completed and processing finished without warnings that affect the candidate.
- [ ] Fresh install on a current full-size supported iPhone running the current supported iOS version.
- [ ] Fresh install on the smallest supported iPhone screen class.
- [ ] Upgrade from the known stale pre-camera-fix TestFlight build; confirm version/build changed and permissions behave correctly.
- [ ] Terminate and relaunch after fresh install and after upgrade; no launch crash or lost authenticated state.

## Accounts and lifecycle

- [ ] Fresh install; branded launch screen; no permission sheet appears on launch.
- [ ] Sign up, email verification, sign in, sign out, password reset, session expiration.
- [ ] Relaunch and app termination during sync; session remains valid and sync resumes safely.
- [ ] Account export produces readable JSON.
- [ ] Account deletion requires `DELETE`; verify Auth, user tables, storage, OAuth tokens, push subscriptions, health data, and relationships are gone.

## AI disclosure and revocation

- [ ] First AI use shows OpenAI disclosure before generation.
- [ ] Decline all categories; general plan succeeds without health/check-in titles.
- [ ] Grant health only; calendar titles remain “Busy time”; check-in omitted.
- [ ] Grant calendar/check-in individually and verify expected behavior.
- [ ] Grant all, then revoke each; next request immediately omits revoked data.
- [ ] Missing/null legacy preferences behave denied.

## Apple Health

- [ ] Deny authorization; app remains usable and provides recovery guidance.
- [ ] Partially authorize; authorized/available categories sync and missing categories do not error.
- [ ] Authorize all requested categories; verify 90-day default and one-year choice.
- [ ] Empty Health database; no crash, misleading claim, or blocking state.
- [ ] Incremental sync after new Health data; no duplicate observations/workouts.
- [ ] Revoke in iOS Settings; sync handles it gracefully.
- [ ] Disconnect/keep data stops future sync and clears local marker.
- [ ] Disconnect/delete removes Apple-only records without removing Oura, Fitbit, or manual data.
- [ ] Confirm Health permissions are read-only and no write authorization is requested.

## Photos and permissions

- [ ] Meal: Photo Library, Files picker, Take Photo, cancellation, permission denial, same photo twice.
- [ ] Receipt: Photo Library, Files picker, Take Photo, cancellation, permission denial, same photo twice.
- [ ] Profile: Photo Library, Files picker, Take Photo, replacement, removal.
- [ ] Reset camera permission, test Allow and Don't Allow on first prompt, then verify recovery through iOS Settings.
- [ ] Repeat Take Photo/cancel/retake/close/reopen at least ten times without leaked camera state or termination.
- [ ] Background and resume while the OS picker/camera is open, then capture successfully or recover cleanly.
- [ ] Terminate the app while the picker is open, relaunch, and confirm no corrupt pending image state.
- [ ] Invalid type, zero-byte, >12 MB, extreme dimensions, corrupt image.
- [ ] Confirm EXIF/location metadata is absent after transformation and raw image is not retained for meal/receipt analysis.
- [ ] Confirm camera capture does not record microphone audio.

## Accessibility and presentation

- [ ] Light/dark mode; launch appearance is acceptable in both.
- [ ] Small-screen supported iPhone and latest supported iPhone on iOS 26.
- [ ] Large Dynamic Type through accessibility sizes; no clipped consent/legal/delete controls.
- [ ] VoiceOver order, headings, control names, switch values, dialogs, focus return, and error announcements.
- [ ] Portrait orientation and safe-area behavior around notch/home indicator.
- [ ] Attempt rotation and confirm the declared portrait-only behavior is stable; do not claim landscape support.
- [ ] Reduced Motion enabled; essential state changes remain understandable without motion.
- [ ] iPad is not declared; verify App Store device support matches the generated project.

## Resilience

- [ ] Airplane mode/no network, slow network, backend 5xx, provider failure, AI unavailable.
- [ ] Photo analysis fallback to manual entry.
- [ ] HealthKit unavailable/denied and connected providers absent; seeded/manual demo remains usable.
- [ ] Push denied and email integration unavailable; core app remains usable.
- [ ] Force quit during upload/synchronization; no corrupt or orphaned state after relaunch.
- [ ] Return from background after a network transition; retries are bounded and the UI does not claim success prematurely.
