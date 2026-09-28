# TravelSync — Collaborative Group Trip Planner

A full-stack web application for planning trips with friends, managing itineraries, splitting expenses, tracking locations on an interactive map, and collaborating in real-time. Built with Vue 3, Express, PostgreSQL (Prisma), and Socket.io.

**Status**: Phase 5 Complete (Production Ready) ✅

---

## 📱 Features

### Phase 1: Authentication & Foundation ✅
- **Firebase Authentication** — Dual-provider authentication supporting Email & Password and Google OAuth single sign-on via Firebase Web SDK.
- **Firebase Admin SDK Verification** — Backend Express middleware verifies Firebase ID tokens cryptographically on every protected route.
- **Automated Profile Synchronization** — Seamlessly links or creates user accounts in the database upon first sign-in using Firebase UID and verified email.
- **Self-Service Password Reset** — Integrated password recovery flow utilizing Firebase Auth reset links.
- **Axios Auto-Token Interceptors** — Request interceptor automatically attaches the current Firebase ID token; response interceptor transparently forces token refresh on 401 and retries failed requests.

### Phase 2: Trip Management ✅
- **Trip CRUD Operations** — Create, view, edit, and delete trips seamlessly.
- **Collaborative Invitations** — Invite friends to trips by email with duplicate invitation prevention.
- **Access Controls** — Owner-only controls for managing trip settings, deleting trips, and managing members.
- **Unified Dashboard** — Dashboard interface showing a comprehensive list of collaborative trips with overview statistics.

### Phase 3: Itinerary & Maps 🗺️
- **Interactive Google Maps** — Real-time markers, routes, and place tracking on high-fidelity maps.
- **Places Autocomplete** — Integrated Google Places Autocomplete search to quickly look up and Pin locations.
- **Day-by-Day Planning** — Add and organize itinerary places grouped by daily schedules.
- **Drag-and-Drop Reordering** — Fluid visual reordering with instant state persistence.
- **Location Notes** — Add editable descriptions, tips, and notes to specific itinerary places.

### Phase 4: Expense Splitting 💰
- **Multi-Payer Expenses** — Log expenses paid by a single user and split among multiple members.
- **Equal Split Math** — Automated equal splitting with precise floating-point precision logic.
- **Balance Tracking** — Real-time tracking of net positive or negative balances for all members.
- **Minimum Settlements** — Custom simplification algorithm generating the absolute minimum transactions needed to settle all debts.
- **Multi-Currency Support** — Core support for travel budgets, defaulted to INR (₹).

### Phase 5: Polish & Deployment 🚀
- **Real-Time Collaboration** — Socket.io integration syncing place updates, expense entries, drag-reorders, and member additions instantly across all clients.
- **Presence Tracking** — View which team members are currently online and viewing the active trip map or dashboard.
- **AI Itinerary Planner** — Context-aware, Groq-powered AI engine (`llama-3.3-70b-versatile`) suggesting custom day-by-day itineraries based on duration, members, budget level, and interests.
- **OTP Verification** — Two-factor authentication (2FA) verification codes sent via email for user registration and account deletion.
- **Dark Mode Support** — System-aware dark theme switching with persistent local storage preferences.
- **Interactive UI Feedback** — Micro-animations, skeleton screen loaders, toast notifications (success, error, info), and clean empty-state messaging.
- **Security Hardening** — Helmet headers, cors configurations, rate-limiters on authentication and AI paths, and secure error boundary structures.

---

## 🛠️ Tech Stack

### Frontend
- **Vue 3** (Composition API, `<script setup>`)
- **Firebase Web SDK (v11)** — User authentication (Email/Password, Google, GitHub OAuth popups)
- **Pinia** — Centralized, modular reactive state management
- **Vue Router** — Client-side SPA routing and navigation guards
- **Tailwind CSS v4** — High-performance utility styles and Material design principles
- **Google Maps JavaScript API** — Interactive mapping and location search
- **Axios** — HTTP client configured with automated Firebase token interceptors
- **Vite** — High-speed build tool and hot module replacement dev server

### Backend
- **Node.js** (v18+) & **Express.js** — Robust RESTful API and routing
- **Firebase Admin SDK** — Cryptographic verification of Firebase ID tokens
- **Socket.io** — WebSockets connection for real-time collaboration updates
- **Neon DB (PostgreSQL)** & **Prisma ORM** — Modern serverless relational database and schema migrations
- **Helmet.js** — Secure HTTP headers configuration
- **express-rate-limit** — Brute-force protection on authentication and AI suggestions routes
- **Nodemailer** — Verification email OTP generation and delivery (for account deletion verification)

### DevOps
- **Docker** — Containerized backend server development configurations

---

## 📦 Project Structure

```
TravelSync/
├── client/                     → Vue 3 Frontend (Vite)
│   ├── src/
│   │   ├── views/              → Page level components
│   │   │   ├── LoginView.vue       → Firebase Email/Password & Social Auth
│   │   │   ├── RegisterView.vue    → Firebase user registration
│   │   │   ├── ForgotPasswordView.vue → Firebase password reset
│   │   │   ├── DashboardView.vue
│   │   │   ├── MapView.vue
│   │   │   ├── ExpensesView.vue
│   │   │   └── NotFoundView.vue
│   │   ├── components/         → Reusable UI widgets
│   │   │   ├── Navbar.vue
│   │   │   ├── Sidebar.vue
│   │   │   ├── Spinner.vue
│   │   │   ├── ToastNotification.vue
│   │   │   └── AddExpenseModal.vue
│   │   ├── services/
│   │   │   └── authService.js  → Firebase Auth methods wrapper
│   │   ├── stores/             → Pinia state stores
│   │   │   ├── auth.js         → Firebase user state & session sync
│   │   │   ├── trips.js
│   │   │   ├── places.js
│   │   │   ├── expenses.js
│   │   │   └── toast.js
│   │   ├── firebase.js         → Firebase Web SDK initialization
│   │   ├── router/index.js     → SPA routes and Firebase auth guards
│   │   ├── api.js              → Axios instance + Firebase token interceptor
│   │   ├── App.vue             → Root entry UI
│   │   └── main.js             → JS bootstrap entry point
│   ├── vercel.json             → Vercel routing configuration
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── .env.example
│   └── package.json
│
├── server/                     → Express Backend
│   ├── config/
│   │   ├── env.js              → Fail-fast environment variable validation
│   │   └── firebaseAdmin.js    → Firebase Admin SDK token verification
│   ├── routes/                 → REST API controllers
│   │   ├── auth.js             → /api/auth/* (profile sync, photo, OTP, delete)
│   │   ├── trips.js            → /api/trips/* (CRUD, expenses, places, AI suggestions)
│   │   └── explore.js          → /api/explore/* (public curated feed)
│   ├── prisma/
│   │   └── schema.prisma       → Prisma PostgreSQL schema (User, Trip, Place, Expense, Otp)
│   ├── middleware/             → Request pipelines
│   │   ├── auth.js             → Unified token verification & 503 DB-down handling
│   │   └── errorHandler.js     → Centralized global error handling & Prisma error mapping
│   ├── utils/
│   │   ├── calculateBalances.js → Split and settlement logic
│   │   ├── mailer.js           → Nodemailer SMTP email dispatcher (OTP delivery)
│   │   ├── otpStore.js          → Prisma-backed OTP store (crypto.randomInt, timingSafeEqual, cooldown)
│   │   └── verifyAuthToken.js   → Multi-provider auth verifier with Neon session caching
│   ├── db.js                   → Prisma Client instance and data formatters
│   ├── socket.js               → WebSocket connection handler and room manager
│   ├── server.js               → Express app bootstrap, CORS, and rate limiters
│   ├── Dockerfile              → Container setup guidelines
│   ├── .env.example
│   └── package.json
│
├── TravelSync-API.postman_collection.json  → Imported API postman tests
├── README.md                   → Core documentation file
└── .gitignore
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18+)
- **Neon PostgreSQL** database account (`DATABASE_URL`)
- **Google Cloud Platform API Key** with the following APIs enabled:
  - Maps JavaScript API
  - Places API
  - Geocoding API *(for destination-based map centering)*
- **Groq API Key** (for AI itinerary suggestions)
- **Unsplash Access Key** (for trip cover photo auto-generation — free at [unsplash.com/developers](https://unsplash.com/developers))
- **SMTP Server access** (Gmail App password or similar for email OTP delivery)

### Setup in Two Commands

You need to spin up the **backend server** and **frontend client** concurrently.

**Terminal 1 — Backend API Server:**
```bash
cd server
npm install
npm run dev  # Starts nodemon auto-reloading server
```
*API Server executes on: `http://localhost:3000`*

**Terminal 2 — Frontend Vue App:**
```bash
cd client
npm install
npm run dev  # Starts Vite HMR server
```
*Web App executes on: `http://localhost:5173`*

---

## ⚙️ Configuration Setup

### Backend Environment (`server/.env`)
Copy `server/.env.example` to `server/.env` and configure:
```env
DATABASE_URL=postgresql://user:password@ep-project.neon.tech/neondb?sslmode=require
ALLOWED_ORIGIN=http://localhost:5173
PORT=3000
NODE_ENV=development

# Firebase Admin SDK (server-side token verification)
# Get from Firebase Console → Project Settings → Service accounts → Generate new private key
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

GROQ_API_KEY=gsk_your_groq_api_key_here
SMTP_EMAIL=your-verification-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

### Frontend Environment (`client/.env`)
Copy `client/.env.example` to `client/.env` and configure:
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_GOOGLE_MAPS_KEY=your_google_maps_api_key_here

# Firebase Web SDK (safe to expose in client browser)
# Get from Firebase Console → Project Settings → General → Your apps → SDK setup and configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

---

## 🔐 API Reference

> [!TIP]
> **Self-Hosted Interactive Swagger Documentation**  
> When the backend server is running in development mode, navigate to `http://localhost:3000/api-docs` to view the comprehensive, interactive Swagger UI specification. You can run test requests directly through your browser interface!

### Authentication & Profile Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/auth/me` | Firebase ID Token | Retrieve or initialize user profile in database for authenticated Firebase user |
| PUT | `/api/auth/me` | Firebase ID Token | Update user display name in database |
| DELETE | `/api/auth/me` | Firebase ID Token | Cascade-delete user profile, owned trips, and associations (requires OTP verification) |
| POST | `/api/auth/logout` | Optional | Clear server-side session cookies/state (primary sign-out via Firebase SDK) |
| POST | `/api/auth/upload-photo` | Firebase ID Token | Upload profile picture to server storage and update user record |
| POST | `/api/auth/send-otp` | Firebase ID Token | Dispatch email OTP code for sensitive actions (account deletion) |
| POST | `/api/auth/verify-otp` | No | Validate OTP token before proceeding with account deletion |

### Trip Management Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/trips` | Yes | List all trips where the user is either the owner or a member |
| POST | `/api/trips` | Yes | Create a new trip with standard metadata |
| GET | `/api/trips/:id` | Yes | Fetch details of a single trip, populating owners and members |
| PUT | `/api/trips/:id` | Yes | Update trip parameters (name, destination, start/end dates) |
| DELETE | `/api/trips/:id` | Yes | Cascade delete trip document (Owner-only privilege) |
| GET | `/api/trips/:tripId/activity` | Yes | Retrieve the chronological history of user activities (last 50 logs) |

### Trip Member Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/trips/:tripId/members` | Yes | List all participating members in a trip |
| POST | `/api/trips/:tripId/members` | Yes | Invite a new user by email with duplicate protection |
| DELETE | `/api/trips/:tripId/members/:userId` | Yes | Remove a member from the trip (Owner-only privilege) |

### Places & Itinerary Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/trips/:tripId/places` | Yes | Retrieve the list of scheduled locations in the itinerary |
| POST | `/api/trips/:tripId/places` | Yes | Append a new place to the itinerary list |
| PATCH | `/api/trips/:tripId/places/:placeId/note` | Yes | Update custom notes or comments on a specific location |
| PATCH | `/api/trips/:tripId/places/reorder` | Yes | Reorder scheduled itinerary places across day indexes |
| DELETE | `/api/trips/:tripId/places/:placeId` | Yes | Remove a place from the trip itinerary |

### Expense & Split Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/trips/:tripId/expenses` | Yes | List all logged expenses, populating paying and split participants |
| POST | `/api/trips/:tripId/expenses` | Yes | Append a new group expense entry |
| DELETE | `/api/trips/:tripId/expenses/:expenseId` | Yes | Remove an expense entry (Creator or Owner privilege) |
| GET | `/api/trips/:tripId/expenses/balances` | Yes | Calculate net balances and generate optimized debt settlement transactions |

### AI Assistant Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/trips/:tripId/ai-suggestions` | Yes | Fetches day-by-day suggested itineraries customized by budget level and tags |

---

## 🌐 Real-Time Collaboration Core

TravelSync relies on WebSockets via **Socket.io** to coordinate real-time state synchronization across all concurrent users.

### Synchronized Interactions
- **Collaborative Map** — Live synchronization of marker placements, place notes edits, and deletion events.
- **Drag-Reorders** — Real-time updates broadcasting day-index and list-index adjustments immediately.
- **Expense Log Sync** — Newly added or deleted expenses render immediately across all screens without reloading.
- **Online Presence Indicator** — Displays which members are actively online, tracking active viewing state in the trip dashboard.

### WebSocket Action Map
```javascript
// Outbound Client Events
socket.emit('join_trip', tripId)
socket.emit('place_added', { tripId, place })
socket.emit('expense_added', { tripId, expense })
socket.emit('user_presence', { tripId, status })

// Inbound Broadcast Events
socket.on('trip_updated', (trip) => { /* Update trip metadata */ })
socket.on('member_joined', (user) => { /* Broadcast member entry */ })
socket.on('place_changed', (place) => { /* Sync itinerary reorders */ })
socket.on('presence_updated', (members) => { /* Update online indicators */ })
```

---

## 🤖 AI Trip Planner Details

The TravelSync **AI Plan Assistant** interfaces directly with the Groq API (leveraging `llama-3.3-70b-versatile` high-performance model) to draft customized plans:

1. **Intelligent Context Analysis**: Evaluates trip duration (calculates days from start/end times), destination, traveler count, existing itinerary listings, and custom notes.
2. **Dynamic Preferences**: Users customize suggestions via a modal prompt, choosing budget limits (Economy, Moderate, Luxury) and thematic preferences (e.g., foodie, museums, nightlife, nature).
3. **Accordion Itinerary Viewer**: Renders structured daily timelines complete with suggestion names, duration guidelines, time badges, category tags, and descriptive reviews.
4. **Instant Action Addition**: Add any AI suggestion directly to the active collaborative trip schedule with a single click.

---

## 🧪 Testing

The repository relies on automated test suites to maintain structural and computational integrity.

### Run Server-Side Jest Suite (`cd server`)
Backend unit tests evaluate calculation accuracies, single-user splitting fallbacks, floating-point roundings, and debt minimization:
```bash
npm run test
```
*Automatically generates comprehensive code coverage reports under `server/coverage/`.*

### Run Client-Side Vitest Suite (`cd client`)
Frontend component tests verify component renders, empty list message states, form inputs, validation handlers, and modal emission triggers:
```bash
npm run test
```
*Runs Vitest configurations and generates local component coverage summaries.*

---

## 🌓 Dark Theme Switcher

TravelSync includes system-aware styling that detects theme preferences and stores user choices:
- **System Theme Hooks**: Detects browser `prefers-color-scheme` preferences upon loading.
- **Toggle Icon**: Convenient theme-switching toggler built into the standard navigation bar.
- **Local Persistence**: Saves theme choices to `localStorage` to preserve visual configurations across active sessions.
- **Design Tokens**: Structured custom styling built utilizing Tailwind CSS utilities ensuring contrast and high-fidelity visibility in both standard and dark themes.

---

## 🔒 Security Practices

1. **Security Headers** — Integrated `helmet.js` to guard against common web vulnerabilities, specifically configured to handle cross-origin image loads safely in development.
2. **API Rate Limiter** — Brute-force protection limiting users to 20 requests per 15 minutes on auth routes and 5 suggestions per minute on AI routes.
3. **Database Cascade Deletion** — Cascading triggers ensuring all child documents (owned trips, invitations) are securely expunged upon user account deletion.
4. **Environment Isolation** — Complete environment variable segmentation ensuring zero hardcoded secrets.

---

## 🐛 Troubleshooting

### Database Connectivity Errors (PostgreSQL / Neon)
- Double-check database connection URL in `server/.env` under the `DATABASE_URL` field.
- Verify that your Neon database is active and `?sslmode=require` is present in the connection string.
- Run `npm run db:push` in `server/` to ensure your database schema and Prisma Client are in sync.

### CORS Errors
- Ensure `ALLOWED_ORIGIN` in your backend `.env` matches the client URI (by default, `http://localhost:5173`).
- Ensure Axios instance in the client (`client/src/api.js`) is initialized with `withCredentials: true`.

### Google Maps Widget Not Rendering
- Confirm `VITE_GOOGLE_MAPS_KEY` is present in your active frontend `.env` file (and make sure to avoid using the name `VITE_GOOGLE_MAPS_API_KEY`).
- Confirm that **Maps JavaScript API**, **Places API**, and **Geocoding API** are all explicitly enabled in the Google Cloud Console.
- Verify that your API key is allowed to receive calls from your local domain (`http://localhost:5173`).

### Map Shows "For Development Purposes Only" Watermark
- This watermark means **billing is not enabled** on your Google Cloud project.
- Go to [console.cloud.google.com/billing](https://console.cloud.google.com/billing) and link a billing account.
- Google provides a $200/month free credit — standard usage during development will not incur charges.

### Session Invalidation & Manual Relogin
- Access tokens expire after 15 minutes.
- Silent session renewal runs automatically in the background utilizing the rotating refresh token (valid for 7 days).
- In the event that a user has been inactive for more than 7 days, the active refresh token will expire and the user will be seamlessly returned to the `/login` screen to re-authenticate.

---

## 🤝 Contributing

1. Create a descriptive feature branch: `git checkout -b feature/your-feature-name`
2. Commit your modular changes: `git commit -m "Add descriptive details"`
3. Push changes to origin: `git push origin feature/your-feature-name`
4. Submit a detailed Pull Request (PR) for integration testing.

---

## 📄 License

This repository is distributed under the conditions of the **MIT License**.