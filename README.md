<p align="center">
  <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9764002453409e98/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena Logo" width="140" height="140">
</p>

<h1 align="center">FairArena</h1>

<p align="center">
  <strong>Modern full-stack platform for fair and transparent skill assessment</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-7.3-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Prisma-7.2-2D3748?logo=prisma&logoColor=white" alt="Prisma">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/License-Proprietary-red.svg" alt="License">
</p>

---

## 🎬 Demo

<p align="center">
  <a href="https://www.fairarena.app" target="_blank">
    <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b9a8100146eb9293f/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena Dashboard Preview" width="100%" />
  </a>
</p>

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20 LTS+
- **pnpm** 10.x+
- **PostgreSQL** 15+
- **Redis** 7+

### Installation

```bash
# Clone the repository
git clone https://github.com/FairArena/FairArena.git
cd FairArena

# Install all dependencies
pnpm install

# Set up environment variables
cp Backend/.env.example Backend/.env
cp Frontend/.env.example Frontend/.env.local
```

### Run Development

```bash
# Terminal 1: Backend API
cd Backend && pnpm dev

# Terminal 2: Background Jobs
cd Backend && pnpm dev:inngest

# Terminal 3: Frontend
cd Frontend && pnpm dev
```

### Access Points

| Service        | URL                            |
| -------------- | ------------------------------ |
| 🌐 Frontend    | http://localhost:5173          |
| 🔧 Backend API | http://localhost:3000          |
| 📖 API Docs    | http://localhost:3000/api-docs |
| ⚡ Inngest     | http://localhost:8288          |

---

## ✨ Features

### Platform Features

| Feature               | Description                               |
| --------------------- | ----------------------------------------- |
| 🔐 **Authentication** | Clerk-based auth with OAuth & MFA         |
| 👤 **Profiles**       | Complete user profiles with social links  |
| 🏢 **Organizations**  | Create and manage organizations           |
| 👥 **Teams**          | Team collaboration with roles & invites   |
| 💳 **Credits**        | Credit-based usage with Razorpay payments |
| 🤖 **AI Assistant**   | Google Gemini-powered chat                |
| 🔔 **Notifications**  | Real-time notification system             |
| 📧 **Email**          | 19 transactional email templates          |
| 🆘 **Support**        | In-app ticket system                      |

### Technical Highlights

| Feature                    | Description                     |
| -------------------------- | ------------------------------- |
| ⚡ **34+ Background Jobs** | Inngest event-driven processing |
| 🗄️ **Read Replicas**       | Horizontal database scaling     |
| 🚀 **Redis Caching**       | Performance optimization        |
| 🛡️ **Arcjet Security**     | Rate limiting & bot detection   |
| 📊 **OpenTelemetry**       | Distributed tracing to SigNoz   |
| 🐳 **Docker Ready**        | Full containerization           |

---

## 🏗 Architecture

<p align="center">
  <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/697b974d001a7a80496e/files/697b99fa00063e4fb03e/view?project=69735edc00127d2033d8&mode=admin" alt="FairArena System Architecture" width="100%">
</p>

```
┌─────────────────────────────────────────────────────────────────┐
│                        FairArena Platform                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │   Frontend   │ ◄─────► │   Backend    │                      │
│  │   React 19   │         │  Express 5   │                      │
│  │   Vite 7     │         │  Prisma 7    │                      │
│  └──────────────┘         └──────┬───────┘                      │
│                                  │                               │
│         ┌────────────────────────┼────────────────────────┐     │
│         ▼                        ▼                        ▼     │
│  ┌──────────────┐        ┌──────────────┐        ┌──────────┐  │
│  │   PostgreSQL │        │    Redis     │        │  Inngest │  │
│  │  (+ Replicas)│        │   (Cache)    │        │ (34 Jobs)│  │
│  └──────────────┘        └──────────────┘        └──────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
FairArena/
├── Backend/           # Express REST API (see Backend/README.md)
├── Frontend/          # React SPA (see Frontend/README.md)
├── ShellScripts/      # Deployment scripts
├── docker-compose.yml # Full stack orchestration
└── Caddyfile          # Reverse proxy config
```

---

## 🐳 Docker

```bash
# Start full stack
docker compose up -d

# View logs
docker compose logs -f

# Stop all
docker compose down
```

---

## 📚 Documentation

| Document                | Location                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| **Frontend README**     | [Frontend/README.md](./Frontend/README.md)                                   |
| **Backend README**      | [Backend/README.md](./Backend/README.md)                                     |
| **API Reference**       | [Backend/docs/API_REFERENCE.md](./Backend/docs/API_REFERENCE.md)             |
| **System Architecture** | [Backend/docs/SYSTEM_ARCHITECTURE.md](./Backend/docs/SYSTEM_ARCHITECTURE.md) |
| **System Architecture Eraser Diagram** | [docs/architecture/README.md](./docs/architecture/README.md)                  |
| **Database Design**     | [Backend/docs/DATABASE_DESIGN.md](./Backend/docs/DATABASE_DESIGN.md)         |
| **Infrastructure**      | [Backend/docs/INFRASTRUCTURE.md](./Backend/docs/INFRASTRUCTURE.md)           |
| **Postman Collection**  | [Backend/postman/](./Backend/postman/)                                       |

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

This project is licensed under the **Proprietary License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <a href="https://www.fairarena.app">🌐 Website</a> •
  <a href="https://github.com/FairArena/FairArena">💻 GitHub</a> •
  <a href="mailto:support@fairarena.app">📧 Support</a>
</p>

<p align="center">
  <sub>Built with ❤️ by the FairArena Team</sub>
</p>
