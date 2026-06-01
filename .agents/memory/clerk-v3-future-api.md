---
name: Clerk v3 Future API sign-in methods
description: @clerk/expo@3.2.5 uses the "Future" API for sign-in — classic methods like attemptSecondFactor/prepareSecondFactor don't exist at runtime even though they appear in some type definitions.
---

## The rule

In `@clerk/expo@3.2.5`, the `signIn` object from `useSignIn()` is a `SignInFuture`-style resource. Use only these methods:

| Step | Method |
|---|---|
| Password sign-in | `signIn.password({ emailAddress, password })` → `{ error }` |
| Complete session | `signIn.finalize({ navigate })` → `{ error }` |
| Send MFA email | `signIn.sendMFAEmailCode()` → `{ error }` |
| Verify MFA email | `signIn.verifyMFAEmailCode({ code })` → `{ error }` |
| Send MFA SMS | `signIn.sendMFAPhoneCode()` → `{ error }` |
| Verify MFA SMS | `signIn.verifyMFAPhoneCode({ code })` → `{ error }` |
| Verify TOTP | `signIn.verifyTOTP({ code })` → `{ error }` |
| Send device-trust email | `signIn.sendEmailCode()` → `{ error }` |
| Verify device-trust email | `signIn.verifyEmailCode({ code })` → `{ error }` |

## What NOT to use (undefined at runtime)
- `signIn.attemptSecondFactor()`
- `signIn.prepareSecondFactor()`
- `signIn.attemptFirstFactor()`
- `signIn.prepareFirstFactor()`

## Why
Clerk v3 introduced a "Future" API that wraps the classic `SignInResource` methods. The `useSignIn()` hook exposes the Future wrapper, not the raw resource. The classic methods exist on the type `SignInResource` (in `@clerk/clerk-js` dist types) but are NOT on the Future wrapper that `useSignIn()` actually returns.

## Sign-in status handling
- `needs_second_factor`: check `signIn.supportedSecondFactors` to pick strategy, then send+verify using the table above
- `needs_client_trust`: send via `sendEmailCode()`, verify via `verifyEmailCode()`
- `complete`: call `finalize()`

## useSignIn does NOT return setActive
`useSignIn()` in this version returns `{ signIn, isLoaded, fetchStatus }`. There is no `setActive`. Session activation is done via `signIn.finalize()`.
