<p align="center">
  <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena Logo" width="120" height="120">
</p>

<h1 align="center">FairArena Frontend</h1>

<p align="center">
  <strong>Modern React application powering the FairArena platform</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#project-structure">Structure</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-7.3-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/TailwindCSS-4.1-06B6D4?logo=tailwindcss&logoColor=white" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/Radix_UI-Latest-161618?logo=radixui&logoColor=white" alt="Radix UI">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Clerk-Auth-7C3AED?logo=clerk&logoColor=white" alt="Clerk">
  <img src="https://img.shields.io/badge/Sentry-Monitoring-362D59?logo=sentry&logoColor=white" alt="Sentry">
  <img src="https://img.shields.io/badge/License-Proprietary-red.svg" alt="License">
</p>

---

## 📖 Table of Contents

- [Quick Start](#-quick-start)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Configuration](#-configuration)
- [Scripts](#-scripts)
- [Pages & Components](#-pages--components)
- [Deployment](#-deployment)
- [Author](#-author)

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 20 LTS+ | JavaScript runtime |
| pnpm | 10.x+ | Package manager |

### Installation

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your configuration

# 3. Start development server
pnpm dev
```

### Development URLs

| Service | URL | Description |
|---------|-----|-------------|
| 🌐 **App** | http://localhost:5173 | Main application |
| 🔧 **API** | http://localhost:3000 | Backend API |

---

## ✨ Features

### User Experience

| Feature | Description |
|---------|-------------|
| 🎨 **Dark/Light Mode** | Theme switching with system preference detection |
| 📱 **Responsive Design** | Mobile-first, works on all devices |
| ⚡ **Instant Navigation** | React Router with lazy loading |
| 🔔 **Real-time Notifications** | Live notification system |
| 🤖 **AI Assistant** | Context-aware AI chat sidebar |
| 🎯 **Smooth Animations** | Motion library animations |
| 🍪 **Cookie Consent** | GDPR-compliant cookie management |

### Core Functionality

| Feature | Description |
|---------|-------------|
| 🔐 **Authentication** | Clerk-based sign in/up with OAuth |
| 👤 **Profile Management** | Complete profile with social links |
| 🏢 **Organizations** | Create & manage organizations |
| 👥 **Teams** | Team management with roles & invites |
| 💳 **Payments** | Razorpay integration for credits |
| 📧 **Newsletter** | Email subscription management |
| 🆘 **Support** | In-app support ticket system |
| ⭐ **Profile Stars** | Star/follow user profiles |

### Technical Features

| Feature | Description |
|---------|-------------|
| 🔒 **Protected Routes** | Authentication guards |
| 📊 **Analytics** | Firebase + Microsoft Clarity |
| 🐛 **Error Tracking** | Sentry integration |
| ✅ **Form Validation** | React Hook Form + Zod |
| 🎨 **Design System** | shadcn/ui + Radix primitives |
| 🚀 **Code Splitting** | Lazy loading for performance |

---

## 🛠 Technology Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|:-------:|---------|
| **React** | 19.2 | UI library |
| **TypeScript** | 5.9 | Type-safe development |
| **Vite** | 7.3 | Build tool & dev server |
| **TailwindCSS** | 4.1 | Utility-first CSS |
| **React Router** | 7.11 | Client-side routing |

### UI Components

| Library | Purpose |
|---------|---------|
| **Radix UI** | Accessible primitives (15+ components) |
| **shadcn/ui** | Pre-built components |
| **Lucide React** | Icon library |
| **Motion** | Animation library |
| **Sonner** | Toast notifications |

### Integrations

| Service | Purpose |
|---------|---------|
| **Clerk** | Authentication & user management |
| **Razorpay** | Payment processing |
| **Firebase** | Analytics |
| **Microsoft Clarity** | Session replay & heatmaps |
| **Sentry** | Error monitoring |
| **reCAPTCHA** | Bot protection |

### Form & Validation

| Library | Purpose |
|---------|---------|
| **React Hook Form** | Form state management |
| **Zod** | Schema validation |
| **DOMPurify** | XSS sanitization |

---

## 📁 Project Structure

```
Frontend/
├── 📂 public/                    # Static assets
├── 📂 src/
│   ├── 📂 components/            # React components (60+)
│   │   ├── ui/                   # shadcn/ui components (26)
│   │   ├── kibo-ui/              # Custom UI components
│   │   ├── legal/                # Legal page components
│   │   ├── AISidebar.tsx         # AI assistant interface
│   │   ├── AppSidebar.tsx        # Main navigation
│   │   ├── CookieConsentModal.tsx
│   │   ├── CreateOrganizationModal.tsx
│   │   ├── CreateTeamModal.tsx
│   │   ├── ErrorBoundary.tsx     # Error handling
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── Navbar.tsx
│   │   ├── OTPVerification.tsx
│   │   ├── OrganizationsModal.tsx
│   │   ├── PaymentSuccessModal.tsx
│   │   ├── PricingModal.tsx
│   │   ├── TeamInviteModal.tsx
│   │   └── ... (32+ more)
│   │
│   ├── 📂 pages/                 # Page components (27)
│   │   ├── About.tsx
│   │   ├── AccountLogs.tsx
│   │   ├── AccountSettings.tsx
│   │   ├── CookiePolicy.tsx
│   │   ├── CreditsPage.tsx
│   │   ├── CreditsVerificationPage.tsx
│   │   ├── Dashboard.tsx
│   │   ├── EditProfile.tsx
│   │   ├── Feedback.tsx
│   │   ├── Inbox.tsx
│   │   ├── MyProfile.tsx
│   │   ├── PrivacyPolicy.tsx
│   │   ├── PublicProfile.tsx
│   │   ├── RefundPage.tsx
│   │   ├── Signin.tsx
│   │   ├── Signup.tsx
│   │   ├── Support.tsx
│   │   ├── TeamInviteAcceptPage.tsx
│   │   ├── TeamsPage.tsx
│   │   ├── TermsAndConditions.tsx
│   │   └── ... (more)
│   │
│   ├── 📂 contexts/              # React contexts (7)
│   │   ├── AuthContext.tsx
│   │   ├── NotificationContext.tsx
│   │   ├── OrganizationContext.tsx
│   │   └── ...
│   │
│   ├── 📂 hooks/                 # Custom hooks (3)
│   │   ├── useAuth.ts
│   │   ├── useNotifications.ts
│   │   └── ...
│   │
│   ├── 📂 services/              # API services (2)
│   │   ├── api.ts                # Axios instance
│   │   └── ...
│   │
│   ├── 📂 lib/                   # Utilities (3)
│   │   ├── utils.ts              # Helper functions
│   │   └── ...
│   │
│   ├── 📂 config/                # Configuration
│   ├── 📂 content/               # Static content
│   ├── 📂 layout/                # Layout components (2)
│   │
│   ├── App.tsx                   # Root component with routing
│   ├── main.tsx                  # Application entry
│   ├── index.css                 # Global styles
│   └── theme-context.tsx         # Theme provider
│
├── 📄 index.html                 # HTML template
├── 📄 package.json               # Dependencies
├── 📄 tsconfig.json              # TypeScript config
├── 📄 vite.config.ts             # Vite configuration
├── 📄 tailwind.config.js         # TailwindCSS config
├── 📄 eslint.config.js           # ESLint config
└── 📄 README.md                  # This file
```

---

## ⚙ Configuration

### Required Environment Variables

Create `.env.local` with these variables:

| Variable | Source | Description |
|----------|--------|-------------|
| `VITE_API_BASE_URL` | Backend | API server URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) | Auth key (`pk_...`) |
| `VITE_RECAPTCHA_SITE_KEY` | [Google reCAPTCHA](https://www.google.com/recaptcha) | Site key |
| `VITE_RAZORPAY_KEY_ID` | [Razorpay Dashboard](https://dashboard.razorpay.com) | Public key (`rzp_...`) |
| `VITE_FIREBASE_API_KEY` | [Firebase Console](https://console.firebase.google.com) | Analytics key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Console | Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Console | Project ID |
| `VITE_FIREBASE_APP_ID` | Firebase Console | App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Console | Analytics ID |
| `VITE_CLARITY_PROJECT_ID` | [Microsoft Clarity](https://clarity.microsoft.com) | Project ID |
| `VITE_SENTRY_DSN` | [Sentry Dashboard](https://sentry.io) | Error tracking DSN |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_APP_ENV` | `development` | Environment mode |
| `VITE_ENABLE_ANALYTICS` | `false` | Enable analytics |

### Example `.env.local`

```env
# API
VITE_API_BASE_URL=http://localhost:3000

# Authentication (Clerk)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx

# Payments (Razorpay)
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx

# Security
VITE_RECAPTCHA_SITE_KEY=6Lxxxxxxxxxxxxxxxxxxxxxxxxxx

# Analytics
VITE_FIREBASE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=fairarena-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=fairarena-xxxxx
VITE_FIREBASE_APP_ID=1:xxxxxxxxxxxx:web:xxxxxxxxxxxx
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_CLARITY_PROJECT_ID=xxxxxxxxxx

# Error Tracking
VITE_SENTRY_DSN=https://xxxx@xxx.ingest.sentry.io/xxxxx
```

---

## 📜 Scripts

### Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with HMR |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |

### Code Quality

| Command | Description |
|---------|-------------|
| `pnpm typecheck` | Type check without emit |
| `pnpm lint` | Run ESLint |

---

## 📄 Pages & Components

### Pages (27)

| Page | Route | Description |
|------|-------|-------------|
| **Home** | `/` | Landing page |
| **Dashboard** | `/dashboard` | User dashboard |
| **Sign In** | `/sign-in` | Authentication |
| **Sign Up** | `/sign-up` | Registration |
| **My Profile** | `/profile` | View own profile |
| **Edit Profile** | `/profile/edit` | Edit profile |
| **Public Profile** | `/profile/:userId` | View user profile |
| **Profile Stars** | `/profile/stars` | Profile stars list |
| **Profile Views** | `/profile/views` | Who viewed profile |
| **Inbox** | `/inbox` | Notifications |
| **Credits** | `/credits` | Credit balance |
| **Credits Verification** | `/credits/verify` | Phone verification |
| **Teams** | `/teams` | Team management |
| **Team Invite Accept** | `/invite/:code` | Accept invite |
| **Account Settings** | `/settings` | User settings |
| **Account Logs** | `/settings/logs` | Activity logs |
| **Support** | `/support` | Help & tickets |
| **Feedback** | `/feedback/:code` | Submit feedback |
| **About** | `/about` | About page |
| **Why Choose Us** | `/why-choose-us` | Features page |
| **Privacy Policy** | `/privacy` | Privacy policy |
| **Terms** | `/terms` | Terms & conditions |
| **Cookie Policy** | `/cookies` | Cookie policy |
| **Refund** | `/refund` | Refund policy |
| **Unsubscribe** | `/unsubscribe` | Email unsubscribe |
| **Maintenance** | `/maintenance` | Maintenance mode |

### Key Components (60+)

| Category | Components |
|----------|------------|
| **Navigation** | Navbar, AppSidebar, Footer, Header |
| **Authentication** | OTPVerification, ErrorBoundary |
| **Organizations** | CreateOrganizationModal, OrganizationDetailsModal, OrganizationSettingsModal, OrganizationAuditLogsModal, OrganizationSwitcher |
| **Teams** | CreateTeamModal, TeamInviteModal, TeamManagementModal |
| **Payments** | PricingModal, PaymentSuccessModal, PaymentFailureModal |
| **AI** | AIButton, AISidebar |
| **Social** | InviteFriend, WaitList, NewsLetter |
| **Legal** | CookieConsentModal |
| **Analytics** | ClarityManager, FirebaseAnalyticsManager |
| **UI** | 26 shadcn/ui components (Button, Card, Dialog, etc.) |

---

## 🚢 Deployment

### Build for Production

```bash
# Build optimized bundle
pnpm build

# Output directory
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── ...
```

### Preview Build

```bash
pnpm preview
# Opens at http://localhost:4173
```

### Docker Build

```bash
# Build image
docker build -t fairarena-frontend .

# Run container
docker run -p 80:80 fairarena-frontend
```

### Production Checklist

- [ ] Set all `VITE_*` environment variables
- [ ] Enable production Clerk keys
- [ ] Configure production API URL
- [ ] Enable Sentry for error tracking
- [ ] Set up Firebase Analytics
- [ ] Configure Razorpay production keys
- [ ] Set up CDN for static assets
- [ ] Enable HTTPS

### Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 88+ |
| Firefox | 78+ |
| Safari | 14+ |
| Edge | 88+ |

---

## 🎨 Design System

### Colors

Uses TailwindCSS with CSS variables for theming:

```css
/* Light Mode */
--background: 0 0% 100%;
--foreground: 240 10% 3.9%;
--primary: 240 5.9% 10%;

/* Dark Mode */
--background: 240 10% 3.9%;
--foreground: 0 0% 98%;
--primary: 0 0% 98%;
```

### Components

Built on [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com):

- Alert Dialog
- Avatar
- Button
- Card
- Checkbox
- Dialog
- Dropdown Menu
- Label
- Popover
- Progress
- Scroll Area
- Select
- Separator
- Switch
- Tabs
- Tooltip
- ... and more

---

## 👤 Author

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Saksham-Goel1107">
        <img src="https://github.com/Saksham-Goel1107.png" width="100px;" alt=""/>
        <br />
        <sub><b>Saksham Goel</b></sub>
      </a>
      <br />
      <a href="https://www.sakshamg.me">🌐 Website</a> •
      <a href="https://github.com/Saksham-Goel1107">GitHub</a>
    </td>
  </tr>
</table>

---

## 📄 License

This project is licensed under the **Proprietary License** — see the [LICENSE](../LICENSE) file for details.

---

<p align="center">
  <a href="https://fair.sakshamg.me">🌐 Website</a> •
  <a href="https://github.com/fairarena">💻 GitHub</a> •
  <a href="mailto:fairarena.contact@gmail.com">📧 Support</a>
</p>

<p align="center">
  <sub>Built with ❤️ by the FairArena Team</sub>
</p>
