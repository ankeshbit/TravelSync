# TravelSync — Collaborative Group Trip Planner

A full-stack web application for planning trips with friends, managing itineraries, splitting expenses, and tracking locations on an interactive map. Built with Vue 3, Express, and MongoDB.

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

### Backend Setup

1. **Clone and navigate**
   ```bash
   git clone <your-repo>
   cd TravelSync/server
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm install helmet express-rate-limit
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI, JWT secret, etc.
   ```

4. **Start server**
   ```bash
   npm start
   ```
   Server runs on `http://localhost:3000`

### Frontend Setup

1. **Navigate and install**
   ```bash
   cd ../client
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Set API URL and Google Maps key
   ```

3. **Start dev server**
   ```bash
   npm run dev
   ```
   Frontend on `http://localhost:5173`

### Test Endpoints with Postman

1. Import `TravelSync-API.postman_collection.json`
2. Register a user (auto-saves JWT token)
3. Create a trip
4. Test all 17 endpoints

## 📋 Environment Variables

### Server (`server/.env`)

```
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/travelsync
JWT_SECRET=your-secret-key-min-32-chars
ALLOWED_ORIGIN=http://localhost:5173
PORT=3000
NODE_ENV=development
```

### Client (`client/.env`)

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key
```

## 🔌 API Reference

### Authentication
- `POST /api/auth/register` - Create user
- `POST /api/auth/login` - Get JWT token

### Trips (CRUD)
- `GET /api/trips` - List user's trips
- `POST /api/trips` - Create trip
- `GET /api/trips/:id` - Get details
- `PUT /api/trips/:id` - Update
- `DELETE /api/trips/:id` - Delete

### Members
- `GET /api/trips/:tripId/members` - List members
- `POST /api/trips/:tripId/members` - Invite (by email)
- `DELETE /api/trips/:tripId/members/:userId` - Remove

### Places (Itinerary)
- `GET /api/trips/:tripId/places` - List
- `POST /api/trips/:tripId/places` - Add place
- `PATCH /api/trips/:tripId/places/:placeId/note` - Edit note
- `PATCH /api/trips/:tripId/places/reorder` - Reorder by day
- `DELETE /api/trips/:tripId/places/:placeId` - Delete

### Expenses
- `GET /api/trips/:tripId/expenses` - List
- `POST /api/trips/:tripId/expenses` - Add expense
- `GET /api/trips/:tripId/expenses/balances` - Calculate balances
- `DELETE /api/trips/:tripId/expenses/:expenseId` - Delete

## 🌐 Deployment

### Backend → Railway/Render

1. Push to GitHub
2. Create new project and connect repo
3. Set environment variables:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `ALLOWED_ORIGIN=https://your-frontend.com`
   - `NODE_ENV=production`
4. Deploy (auto-builds from `server/Dockerfile`)

### Frontend → Vercel/Netlify

1. Push to GitHub  
2. Create new project, select `client/` directory
3. Set environment variables:
   - `VITE_API_BASE_URL=https://your-api.com/api`
   - `VITE_GOOGLE_MAPS_API_KEY`
4. Deploy (auto-runs `npm run build`)

### Google Maps API Restrictions

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit your API key
3. **Application Restrictions**: HTTP referrers → `https://your-domain.com/*`
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

```bash
# Backend
cd server
npm start              # Run server
npm test              # Run tests (if setup)
docker build -t app . # Build Docker image

# Frontend
cd client
npm run dev           # Development server
npm run build         # Production build
npm run preview       # Preview build
npm test              # Run tests (if setup)
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
✗ Verify VITE_GOOGLE_MAPS_API_KEY is set
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

├── server/                  → Express REST API
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   └── server.js
├── .gitignore
└── README.md
```

## Running the Project

You need **two terminals** running simultaneously.

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (free tier) **or** MongoDB running locally

---

### Terminal 1 — Backend (Express API)

```bash
cd server
npm install
npm run dev
```

Server runs at: `http://localhost:5000`

---

### Terminal 2 — Frontend (Vue + Vite)

```bash
cd client
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

### App Routes

| URL                              | Page      | Auth Required |
|----------------------------------|-----------|---------------|
| `http://localhost:5173/login`    | Login     | No            |
| `http://localhost:5173/register` | Sign Up   | No            |
| `http://localhost:5173/dashboard`| Dashboard | Yes (JWT)     |

---

### Backend Environment Setup

Create a `.env` file inside the `/server` folder (copy from `.env.example`):

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/travelsync
JWT_SECRET=your_super_secret_key_change_this_in_production
PORT=5000
```

> ⚠️ Never commit `.env` to version control. It is already listed in `.gitignore`.

---

## Phase 1 Features

- [x] JWT-based authentication (register, login, logout)
- [x] Password hashing with bcrypt
- [x] Protected API routes with auth middleware
- [x] Vue Router with navigation guards (redirect if not authenticated)
- [x] Polished Login & Sign Up UI (glassmorphism, split-panel layout)
- [x] Axios with token interceptor
- [x] MongoDB connection with Mongoose
- [x] Responsive design (mobile + desktop)

## API Endpoints

| Method | Route              | Auth Required | Description          |
|--------|--------------------|---------------|----------------------|
| GET    | /api/health        | No            | Server health check  |
| POST   | /api/auth/register | No            | Register new user    |
| POST   | /api/auth/login    | No            | Login                |
| POST   | /api/auth/logout   | No            | Logout (client-side) |
| GET    | /api/auth/me       | Yes           | Get current user     |