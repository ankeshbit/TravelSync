# TravelSync — Collaborative Group Trip Planner

A full-stack web application for planning trips with friends, managing itineraries, splitting expenses, tracking locations on an interactive map, and collaborating in real-time. Built with Vue 3, Express, MongoDB, and Socket.io.

**Status**: Phase 5 Complete (Production Ready) ✅

## 📱 Features

### Phase 1: Authentication & Foundation ✅
- User registration and login with JWT authentication
- Secure password hashing (bcryptjs, 10 salt rounds)
- Token-based authorization on all endpoints
- Axios auto-token injection with interceptors

### Phase 2: Trip Management ✅
- Create, read, update, delete trips
- Invite friends by email with duplicate prevention
- Trip member management (owner-only controls)
- Dashboard listing with collaborative overview

### Phase 3: Itinerary & Maps 🗺️
- Interactive Google Maps with real-time updates
- Google Places Autocomplete search
- Add/organize places by day number
- Drag-to-reorder with instant persistence
- Editable location notes

### Phase 4: Expense Splitting 💰
- Add expenses with multiple payers
- Automatic equal split calculation
- Per-member balance tracking
- Minimum settlement transaction generation
- Multi-currency support (default INR)

### Phase 5: Polish & Deploy 🚀
- **Real-time Collaboration** - WebSocket integration for live updates across all users
- **AI Trip Planner** - Groq-powered suggestions for trip itineraries
- **OTP Authentication** - Optional two-factor authentication for accounts
- **Dark Mode Support** - System-aware theme switching with persistent preferences
- **Loading spinners** on all async operations
- **Toast notifications** (success, error, info)
- **Empty state messaging** for all lists
- **Error boundary** with graceful degradation
- **Mobile-first responsive** design
- **Security hardening** (helmet, rate-limit, CORS)
- **Centralized error handling** backend & frontend

## 🛠️ Tech Stack

### Frontend
- **Vue 3** (Composition API)
- **Pinia** for global state management
- **Vue Router** for SPA navigation
- **Tailwind CSS v4** with Material Design system
- **Google Maps JS API** with Places Autocomplete
- **Axios** with interceptors
- **Vite** for builds

### Backend
- **Node.js 18+** + **Express.js**
- **MongoDB Atlas** with Mongoose ODM
- **JWT** authentication (7-day expiry)
- **Helmet** for HTTP security headers
- **express-rate-limit** for brute force protection
- **bcryptjs** for password hashing

### DevOps
- **Docker** containerization
- **Vercel/Netlify** frontend hosting
- **Railway/Render** backend hosting
- **GitHub** version control

## 📦 Project Structure

```
TravelSync/
├── client/                     → Vue 3 Frontend (Vite)
│   ├── src/
│   │   ├── views/              → Page components
│   │   │   ├── LoginView.vue
│   │   │   ├── DashboardView.vue
│   │   │   ├── MapView.vue
│   │   │   ├── ExpensesView.vue
│   │   │   └── NotFoundView.vue
│   │   ├── components/         → Reusable components
│   │   │   ├── Navbar.vue
│   │   │   ├── Sidebar.vue
│   │   │   ├── Spinner.vue
│   │   │   ├── ToastNotification.vue
│   │   │   └── AddExpenseModal.vue
│   │   ├── stores/             → Pinia state
│   │   │   ├── trips.js
│   │   │   ├── places.js
│   │   │   ├── expenses.js
│   │   │   └── toast.js
│   │   ├── router/index.js     → Vue Router config
│   │   ├── api.js              → Axios + interceptors
│   │   ├── App.vue             → Root component
│   │   └── main.js             → Entry point
│   ├── vercel.json             → Vercel config (SPA routing)
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── .env.example
│   └── package.json
│
├── server/                     → Express Backend
│   ├── routes/                 → API endpoints
│   │   ├── auth.js             → /api/auth/*
│   │   └── trips.js            → /api/trips/*
│   ├── models/                 → Mongoose schemas
│   │   ├── User.js
│   │   └── Trip.js
│   ├── middleware/             → Express middleware
│   │   ├── auth.js             → JWT verification
│   │   └── errorHandler.js     → Centralized error handling
│   ├── utils/
│   │   └── calculateBalances.js → Expense balance logic
│   ├── server.js               → Express app + middleware
│   ├── Dockerfile              → Docker containerization
│   ├── .env.example
│   └── package.json
│
├── TravelSync-API.postman_collection.json  → Postman requests
├── README.md                   → This file
└── .gitignore
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **MongoDB Atlas** account ([free tier](https://www.mongodb.com/cloud/atlas))
- **Google Cloud Project** with Maps & Places APIs
- **Git**

### One-Command Setup

You need **two terminals** running simultaneously.

**Terminal 1 — Backend:**
```bash
cd server
npm install
npm start  # or 'npm run dev' for auto-reload with nodemon
```
✅ Server runs on `http://localhost:3000`

**Terminal 2 — Frontend:**
```bash
cd client
npm install
npm run dev
```
✅ Frontend runs on `http://localhost:5173`

### Configuration

**Backend (`server/.env`)**
```env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/travelsync
JWT_SECRET=your-secret-key-min-32-chars
ALLOWED_ORIGIN=http://localhost:5173
PORT=3000
NODE_ENV=development
GROQ_API_KEY=your-groq-key-for-ai-planner
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

**Frontend (`client/.env`)**
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key
```

### Verify Setup

```bash
# Test API endpoints with Postman
1. Import TravelSync-API.postman_collection.json
2. Register a user (auto-saves JWT token)
3. Create a trip
4. Test all endpoints
```

### App Routes

| URL | Page | Auth Required |
|-----|------|---------------|
| `http://localhost:5173/login` | Login | No |
| `http://localhost:5173/register` | Sign Up | No |
| `http://localhost:5173/dashboard` | Dashboard | Yes |
| `http://localhost:5173/trips/:id` | Trip Details | Yes |
| `http://localhost:5173/trips/:id/map` | Map & Itinerary | Yes |
| `http://localhost:5173/trips/:id/expenses` | Expenses | Yes |
| `http://localhost:5173/settings` | Settings | Yes |

## � API Reference

### Authentication Endpoints
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login & get JWT token |
| GET | `/api/auth/me` | Yes | Get current user profile |

### Trip Management
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/trips` | Yes | List user's trips |
| POST | `/api/trips` | Yes | Create new trip |
| GET | `/api/trips/:id` | Yes | Get trip details |
| PUT | `/api/trips/:id` | Yes | Update trip |
| DELETE | `/api/trips/:id` | Yes | Delete trip |

### Trip Members
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/trips/:tripId/members` | Yes | List trip members |
| POST | `/api/trips/:tripId/members` | Yes | Invite member by email |
| DELETE | `/api/trips/:tripId/members/:userId` | Yes | Remove member |

### Places (Itinerary)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/trips/:tripId/places` | Yes | List trip places |
| POST | `/api/trips/:tripId/places` | Yes | Add place to itinerary |
| PATCH | `/api/trips/:tripId/places/:placeId/note` | Yes | Edit place note |
| PATCH | `/api/trips/:tripId/places/reorder` | Yes | Reorder places by day |
| DELETE | `/api/trips/:tripId/places/:placeId` | Yes | Delete place |

### Expenses
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/trips/:tripId/expenses` | Yes | List trip expenses |
| POST | `/api/trips/:tripId/expenses` | Yes | Add expense |
| GET | `/api/trips/:tripId/expenses/balances` | Yes | Calculate member balances |
| DELETE | `/api/trips/:tripId/expenses/:expenseId` | Yes | Delete expense |

### AI Planner
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/trips/:tripId/ai-suggestions` | Yes | Get AI itinerary suggestions |

## 🌐 Real-Time Collaboration

TravelSync uses **Socket.io** for live updates across all connected users:

### Real-Time Features
- ✅ **Live Trip Updates** - See member additions/removals instantly
- ✅ **Presence Tracking** - View which members are currently viewing the trip
- ✅ **Itinerary Sync** - Place additions/changes broadcast to all members
- ✅ **Expense Updates** - New expenses appear immediately for all users
- ✅ **Collaborative Reordering** - Drag-to-reorder synchronized in real-time

### WebSocket Events
```javascript
// Client-to-Server
socket.emit('join_trip', tripId)
socket.emit('place_added', { tripId, place })
socket.emit('expense_added', { tripId, expense })
socket.emit('user_presence', { tripId, status })

// Server-to-Client
socket.on('trip_updated', (trip) => {})
socket.on('member_joined', (user) => {})
socket.on('place_changed', (place) => {})
socket.on('presence_updated', (members) => {})
```

## 🤖 AI Trip Planner

The **AI Planner** uses Groq API to generate intelligent itinerary suggestions:

### Features
- 🧠 Intelligent place recommendations based on destination and trip duration
- 📅 Automatic day-by-day itinerary generation
- 🏨 Suggests attractions, restaurants, and activities
- 🌍 Context-aware suggestions based on trip theme

### Setup
1. Get a free Groq API key from https://console.groq.com
2. Add to `server/.env`:
   ```env
   GROQ_API_KEY=your-groq-api-key
   ```
3. Click "AI Planner" button on Map view to generate suggestions

## 🔐 OTP Authentication

Optional two-factor authentication for enhanced account security:

### Setup OTP
1. Go to Settings → Security
2. Click "Enable 2FA"
3. Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
4. Enter 6-digit code to verify

### Disabling OTP
- Enter current OTP code in Settings → Security
- Account reverts to email/password only

## 🌓 Dark Mode

TravelSync features system-aware dark mode with persistent preferences:

### How It Works
- **Auto-detect** - Uses system theme preference by default
- **Manual Toggle** - Click theme icon in navbar to switch
- **Persistent** - Saves preference to localStorage
- **Full Coverage** - All components styled for both light and dark modes

### Implementation
- Uses Tailwind CSS dark mode utilities
- Composable: `useDarkMode()` for theme management
- Component: `ThemeToggle.vue` for user control

## 🌐 Deployment

### Backend → Railway/Render

1. Push to GitHub
2. Create new project and connect repo
3. Set environment variables:
   - `MONGO_URI` - MongoDB connection string
   - `JWT_SECRET` - 32+ character secret key
   - `ALLOWED_ORIGIN=https://travelsync.vercel.app`
   - `NODE_ENV=production`
   - `GROQ_API_KEY` - For AI Planner feature
   - `SMTP_EMAIL` & `SMTP_PASSWORD` - For email invitations
4. Deploy (auto-builds from `server/Dockerfile`)
5. Backend URL will be: `https://travelsync-backend-xxx.onrender.com`

### Frontend → Vercel/Netlify

1. Push to GitHub
2. Create new project, select `client/` directory
3. Set environment variables:
   - `VITE_API_BASE_URL=https://travelsync-backend-xxx.onrender.com/api`
   - `VITE_GOOGLE_MAPS_API_KEY` - From Google Cloud Console
4. Deploy (auto-runs `npm run build`)

### Post-Deployment Checklist

- [ ] Update backend `ALLOWED_ORIGIN` to frontend domain
- [ ] Restrict Google Maps API key to frontend domain
- [ ] Enable MongoDB IP whitelist for production server
- [ ] Set `NODE_ENV=production` on backend
- [ ] Use strong `JWT_SECRET` (32+ random characters)
- [ ] Test authentication flow end-to-end
- [ ] Verify Socket.io connection works cross-domain
- [ ] Test email invitations (requires SMTP setup)

### Google Maps API Restrictions

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit your API key
3. **Application Restrictions**: HTTP referrers → `https://travelsync.vercel.app/*`
4. **API Restrictions**: Maps JavaScript API + Places API only

## 🔒 Security Features

- ✅ **Helmet.js** - HTTP security headers
- ✅ **Rate Limiting** - 20 requests/15min on auth endpoints
- ✅ **CORS** - Restricted to allowed origins
- ✅ **JWT** - 7-day expiry tokens
- ✅ **bcryptjs** - 10 salt rounds on passwords
- ✅ **Input Validation** - All endpoints
- ✅ **Error Boundary** - No sensitive data in logs
- ✅ **No Secrets** - All config via environment variables

## 🧪 Testing

### With Postman
- Import collection file
- Use auto-saved JWT token
- Test all endpoints with example data

### Manual Testing
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","password":"pass123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}'

# Create Trip (with token)
curl -X POST http://localhost:3000/api/trips \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Paris 2026","destination":"Paris, France","startDate":"2026-06-01","endDate":"2026-06-15"}'
```

## 📸 Key Views

| View | Purpose | Components |
|------|---------|-----------|
| **Login/Register** | Authentication | Email, password validation |
| **Dashboard** | Trip overview | TripCard grid, create button |
| **Map** | Itinerary planning | Google Maps, Autocomplete, sidebar |
| **Expenses** | Splitting & balance | Expense list, balance summary, modal |
| **Trip Details** | Team & info | Members, dates, actions |

## ⚙️ Development Commands

### Backend (`cd server`)
```bash
npm install          # Install dependencies
npm start            # Run production server
npm run dev          # Run dev server with auto-reload (nodemon)
npm test             # Run tests
docker build -t app . # Build Docker image
docker run -p 3000:3000 app # Run Docker container
```

### Frontend (`cd client`)
```bash
npm install          # Install dependencies
npm run dev          # Development server (HMR enabled)
npm run build        # Production build
npm run preview      # Preview production build locally
npm test             # Run tests (if configured)
npm run lint         # Lint code
```

## 🐛 Troubleshooting

### MongoDB Connection Failed
```
✗ Check MONGO_URI in .env
✗ Whitelist your IP in Atlas network access
✗ Verify user permissions
```

### CORS Error
```
✗ Ensure ALLOWED_ORIGIN matches frontend domain
✗ Check that api.js uses correct baseURL
✗ Verify credentials: true in CORS options
```

### Google Maps Not Showing
```
✗ Verify VITE_GOOGLE_MAPS_KEY is set
✗ Enable Maps JavaScript API in Cloud Console
✗ Restrict key to your domain
✗ Ensure Places API is enabled
```

### Token Expired
```
→ User logged in for more than 7 days
→ User must log in again to get new token
→ Implement refresh tokens in Phase 6
```

## 📚 Additional Resources

- [Vue 3 Docs](https://vuejs.org/)
- [Express.js Guide](https://expressjs.com/)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Google Maps API](https://developers.google.com/maps/documentation/javascript)
- [JWT Introduction](https://jwt.io/introduction)

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit: `git commit -m "Add feature"`
3. Push: `git push origin feature/your-feature`
4. Open Pull Request

## 📄 License

MIT License - see LICENSE file

## 👨‍💻 Author

Built as a full-stack portfolio project demonstrating modern web development practices.

---

**Ready to deploy?** Follow the [Deployment](#-deployment) section above!

For questions or issues, open a GitHub issue or check the troubleshooting guide.