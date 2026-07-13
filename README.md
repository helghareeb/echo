<div align="center">

# Sada · صدى

**Turn voice into text — حوّل الصوت إلى نص**

Free, open-source, cross-platform audio-to-subtitle transcription, tuned for Arabic.
A community restoration of the discontinued **almufragh (المفرغ)** app.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Web-4c9)](#-download--التحميل)
[![Built with Electron](https://img.shields.io/badge/Electron-2C2E3B?logo=electron&logoColor=9FEAF9)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Speech: Wit.ai](https://img.shields.io/badge/speech-Wit.ai%20(free)-00B0FF)](https://wit.ai)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![CI](https://github.com/helghareeb/echo/actions/workflows/ci.yml/badge.svg)](https://github.com/helghareeb/echo/actions/workflows/ci.yml)

</div>

---

## English

### What is Sada?

**Sada** takes your audio files and produces subtitle files (`.srt`) and plain text
(`.txt`). It splits audio into short clips with **ffmpeg**, sends each clip to
**Meta's Wit.ai** speech service, and stitches the word-level timings back into
clean, time-coded subtitles. It is tuned for **Arabic** speech.

Sada is a faithful, open-source restoration of the Windows-only **almufragh** app,
rebuilt to run on **Windows, macOS, Linux, and the browser**.

> **The service is free.** Wit.ai tokens are free from Meta — there is no paywall.
> You create your own token in a couple of minutes (see below) and it never
> leaves your device.

### ✨ Features

- 🎧 Transcribe `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac` to `.srt` + `.txt`
- 🕒 Accurate word-level timings stitched across clips
- 🌍 Cross-platform: desktop (Windows/macOS/Linux) and web
- 🗣️ Bilingual interface: **Arabic (RTL)** and **English**
- 🌗 Light / dark themes
- 🔒 Private: your token and audio stay on your device (desktop)
- 🆓 100% free and open source (MIT)

### 🔑 Get your free Wit.ai token

1. Go to **[wit.ai](https://wit.ai)** and sign in with a free Meta account.
2. Create a new **App** and set its language to **Arabic**.
3. Open the app's **Settings** (gear icon).
4. Copy the **Server Access Token** (not the Client token).
5. In Sada, open **Settings → Wit.ai token** and paste it. It is stored only on
   your device. Sada throttles requests to stay within the free tier.

### 📥 Download & التحميل

Grab the latest installer for your OS from the
**[Releases page](https://github.com/helghareeb/echo/releases)**:

| OS | File |
|----|------|
| Windows | `Sada-Setup-x.y.z.exe` (installer) or `Sada-x.y.z.exe` (portable) |
| macOS | `Sada-x.y.z.dmg` |
| Linux | `Sada-x.y.z.AppImage` or `.deb` |

> Builds are currently **unsigned**, so Windows SmartScreen / macOS Gatekeeper may
> warn on first launch. See [docs/BUILD.md](docs/BUILD.md).

### 🛠️ Build from source

```bash
# prerequisites: Node.js >= 18 and pnpm (npm i -g pnpm)
git clone https://github.com/helghareeb/echo.git
cd echo
pnpm install
pnpm build            # build the shared core

pnpm dev:desktop      # run the desktop app in dev
# or produce installers for your OS:
pnpm --filter @sada/desktop dist
```

### 🧱 Project structure

```
packages/core     # environment-agnostic pipeline (TypeScript, unit-tested)
packages/ui       # shared React UI (used by both apps via the window.sada bridge)
apps/desktop      # Electron app (electron-vite + React)
apps/web          # browser app (Vite + ffmpeg.wasm)
services/wit-proxy# CORS proxy for the web app (Cloudflare Worker / Node)
```

### 🌐 Run the web app

```bash
pnpm build            # build @sada/core
pnpm dev:web          # Vite dev server on http://localhost:5173
```

In dev, requests to Wit.ai are proxied for you (no CORS setup needed). For a
production deploy, host the small [wit-proxy](services/wit-proxy) and build with
`VITE_WIT_PROXY_URL` pointing at it. The web app uses **ffmpeg.wasm**, so it is
slower than the desktop app and best for shorter files.

The transcription logic (clip planning, timeline stitching, subtitle grouping,
Wit.ai request/parse) lives once in `@sada/core` and is shared by every target
through a small set of injected "ports".

### 🤝 Contributing

Contributions are very welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

### 📜 License & credits

MIT — see [LICENSE](LICENSE). Sada is an independent, community-driven
restoration of the free **almufragh** app; huge thanks to its original author.
Third-party components and their licenses are listed in [NOTICE](NOTICE).

---

<div dir="rtl">

## العربية

### ما هو صدى؟

**صدى** يحوّل ملفاتك الصوتية إلى ملفات ترجمة (`.srt`) ونص عادي (`.txt`). يقوم
بتقسيم الصوت إلى مقاطع قصيرة باستخدام **ffmpeg**، ثم يرسل كل مقطع إلى خدمة
التعرّف على الكلام **Wit.ai من Meta**، ويعيد تجميع توقيتات الكلمات في ترجمة
دقيقة ومؤقّتة. وهو مضبوط للكلام **العربي**.

صدى هو إحياء مفتوح المصدر لتطبيق **المفرغ** الذي كان يعمل على ويندوز فقط، وأُعيد
بناؤه ليعمل على **ويندوز وmacOS ولينكس والمتصفح**.

> **الخدمة مجانية.** مفاتيح Wit.ai مجانية من Meta — لا يوجد اشتراك مدفوع. تنشئ
> مفتاحك الخاص خلال دقيقتين (انظر بالأسفل) ولا يغادر جهازك.

### ✨ المزايا

- 🎧 تفريغ ملفات `.mp3` و`.wav` و`.ogg` و`.m4a` و`.flac` إلى `.srt` و`.txt`
- 🕒 توقيتات دقيقة على مستوى الكلمة عبر المقاطع
- 🌍 متعدد المنصات: سطح المكتب (ويندوز/macOS/لينكس) والويب
- 🗣️ واجهة بلغتين: **العربية (من اليمين لليسار)** و**الإنجليزية**
- 🌗 سمة فاتحة/داكنة
- 🔒 الخصوصية: مفتاحك وملفاتك تبقى على جهازك (سطح المكتب)
- 🆓 مجاني ومفتوح المصدر بالكامل (رخصة MIT)

### 🔑 احصل على مفتاح Wit.ai المجاني

1. افتح **[wit.ai](https://wit.ai)** وسجّل الدخول بحساب Meta مجاني.
2. أنشئ **تطبيقاً** جديداً واضبط لغته على **العربية**.
3. افتح **إعدادات** التطبيق (أيقونة الترس).
4. انسخ **مفتاح الوصول للخادم** (Server Access Token) وليس مفتاح العميل.
5. في صدى، افتح **الإعدادات ← مفتاح Wit.ai** والصقه. يُحفظ على جهازك فقط، ويقوم
   صدى بتنظيم الطلبات ليبقى ضمن الحد المجاني.

### 📥 التحميل

نزّل أحدث نسخة لنظامك من **[صفحة الإصدارات](https://github.com/helghareeb/echo/releases)**.
الإصدارات حالياً **غير موقّعة رقمياً**، لذا قد يظهر تحذير من ويندوز أو macOS عند
أول تشغيل — راجع [docs/BUILD.md](docs/BUILD.md).

### 🛠️ البناء من المصدر

```bash
# المتطلبات: Node.js 18+ و pnpm
git clone https://github.com/helghareeb/echo.git
cd echo
pnpm install
pnpm build
pnpm dev:desktop
```

### 🤝 المساهمة

نرحّب بمساهماتكم — انظر [CONTRIBUTING.md](CONTRIBUTING.md).

### 📜 الرخصة والشكر

رخصة MIT — انظر [LICENSE](LICENSE). صدى مشروع مجتمعي مستقل لإحياء تطبيق **المفرغ**
المجاني، مع خالص الشكر لمؤلفه الأصلي.

</div>
