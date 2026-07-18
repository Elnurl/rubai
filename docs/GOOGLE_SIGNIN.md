# Enable Google Sign-In (Supabase)

Error you saw:

```json
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

Means: the app asked Supabase for Google login, but **Google is turned off** in your Supabase project. This is a dashboard setting — not an APK bug.

## Steps

### 1. Supabase — enable provider

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → project `gpviliheclxqgdzfjgan`
2. **Authentication** → **Providers** → **Google**
3. Toggle **Enable Sign in with Google**
4. You need a Google Cloud OAuth **Client ID** and **Client Secret** (next step)
5. Save

### 2. Google Cloud — OAuth client

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create **OAuth client ID** (type: Web application)
3. Authorized redirect URIs — add exactly:

```
https://gpviliheclxqgdzfjgan.supabase.co/auth/v1/callback
```

4. Copy Client ID + Client Secret into Supabase Google provider fields → Save

### 3. Supabase redirect URLs (app callback)

**Authentication** → **URL Configuration**:

- Site URL: `mobile://auth/callback`
- Additional Redirect URLs:
  - `mobile://auth/callback`
  - `exp+rubai://auth/callback`

### 4. Test

No APK rebuild needed for enabling Google in Supabase. Open the app → **Continue with Google**.

Until this is done, use **email + password** (that already works for your account).

## Railway note

Google login talks to Supabase only. Cloud sync / AI still need Railway API + OpenAI keys on Railway.
