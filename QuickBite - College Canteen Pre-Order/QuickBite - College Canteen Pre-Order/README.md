# QuickBite - College Canteen Pre-Order

[![CI/CD Pipeline](https://github.com/RachamaduguNarasimhaRao/QuickBite---College-Canteen-Pre-Order/actions/workflows/ci.yml/badge.svg)](https://github.com/RachamaduguNarasimhaRao/QuickBite---College-Canteen-Pre-Order/actions)

A modern web application for college canteen pre-ordering built with React, TypeScript, and Hono.js, deployed on Cloudflare Workers.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

- **User Authentication** - Secure Firebase authentication with Google OAuth
- **Menu Management** - Browse available menu items and place orders
- **Order Management** - View order history and confirm orders
- **Staff Registration** - Staff management system
- **Admin Dashboard** - Administrative controls and analytics
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **Real-time Updates** - Live order status updates
- **Dark Mode Support** - Optional dark theme for better user experience

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Client-side routing
- **Lucide React** - Icon library

### Backend
- **Hono.js** - Modern web framework
- **Cloudflare Workers** - Serverless runtime
- **Firebase** - Authentication and data management
- **Zod** - Schema validation

### DevOps
- **GitHub Actions** - CI/CD pipeline
- **Wrangler** - Cloudflare Workers CLI
- **ESLint** - Code linting
- **TypeScript** - Type checking

## 📦 Prerequisites

- **Node.js** v18 or higher
- **npm** or **yarn** package manager
- **Git** for version control
- Firebase project credentials (for production)
- Cloudflare account (for deployment)

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/RachamaduguNarasimhaRao/QuickBite---College-Canteen-Pre-Order.git

# Navigate to project directory
cd QuickBite---College-Canteen-Pre-Order

# Install dependencies
npm install
```

### Running the Development Server

```bash
# Start the dev server
npm run dev

# For LAN access (network development)
npm run dev:lan
```

The application will be available at `http://localhost:5173` (or the configured port).

### Building for Production

```bash
# Build the project
npm run build

# Check the build (dry-run)
npm run check

# Generate TypeScript worker types
npm run cf-typegen
```

## 📁 Project Structure

```
QuickBite/
├── .github/
│   └── workflows/           # GitHub Actions CI/CD pipelines
├── backend/
│   ├── src/                 # Backend source code
│   │   └── index.ts         # Hono server entry point
│   └── package.json
├── frontend/
│   ├── public/              # Static assets
│   ├── src/                 # React application source
│   └── package.json
├── src/
│   ├── react-app/           # Main React application
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── worker/              # Cloudflare Worker code
│   │   └── index.ts
│   └── shared/              # Shared types and utilities
│       └── types.ts
├── migrations/              # Database migrations
├── test/                    # Test files
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
├── wrangler.json            # Cloudflare Workers configuration
└── package.json             # Root package configuration
```

## 💻 Development

### Available Scripts

```bash
npm run dev              # Start development server
npm run dev:lan         # Start dev server on network
npm run lint            # Run ESLint
npm run build           # Build for production
npm run check           # Pre-deployment checks
npm run cf-typegen      # Generate Cloudflare types
npm run dev:reset-db    # Reset local database
npm run ngrok           # Expose local server via ngrok
npm run share           # Alias for dev:lan
```

### Code Style

- All TypeScript code should be properly typed
- Run `npm run lint` before committing
- Follow the [project's coding conventions](./CONTRIBUTING.md)

### Development Tips

#### Firefox Authentication (dev)
Add your development domain to Firebase's authorized domains:

1. Open Firebase Console → Authentication → Sign-in method → Authorized domains
2. Add `localhost`, `127.0.0.1`, your LAN IP (e.g., `192.168.1.10`), or tunnel hostname (e.g., `abcd.ngrok.io`)
3. Restart the dev server and try signing in again

#### Network Development

```bash
# Start with network access
npm run dev:lan

# Find your LAN IP
ipconfig  # Windows
ifconfig  # Linux/Mac

# Access the app at: http://<YOUR-LAN-IP>:5173
```

Configure Firebase for your LAN IP:
- **Authorized domains**: Add your IP address only (e.g., `192.168.1.5`)
- **Google OAuth redirect URIs**: 
  - `http://192.168.1.5:5176`
  - `http://192.168.1.5:5176/__/auth/handler`

## 🚀 Deployment

### Automatic Deployment (GitHub Actions)

Pushes to the `main` branch automatically trigger:
1. **Linting checks** - Code quality verification
2. **Type checking** - TypeScript validation
3. **Build verification** - Ensure production build succeeds
4. **Deployment** - Deploy to Cloudflare Workers

### GitHub Actions Setup

Configure these secrets in your GitHub repository settings:

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers deploy permission
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

### Manual Deployment

```bash
# Build and deploy to Cloudflare Workers
npm run build
wrangler deploy

# Deploy with API token (alternative)
CLOUDFLARE_API_TOKEN=<token> wrangler deploy
```

### Pre-Deployment Checklist

- [ ] All tests pass: `npm run lint`
- [ ] TypeScript types verified: `npm run build`
- [ ] Pre-deployment check passes: `npm run check`
- [ ] Environment variables configured
- [ ] Firebase credentials updated in production
- [ ] Cloudflare Workers secrets configured

## ⚙️ Configuration

### Environment Variables

Create `.env.local` (not committed) for development:

```bash
# Firebase Configuration (optional for local dev)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

### Cloudflare Workers (wrangler.json)

The project is configured to run on Cloudflare Workers. Update `wrangler.json` with:
- Your account ID
- Your project name
- Environment-specific bindings

### Database Migrations

Migrations are located in the `migrations/` directory. Run migrations according to your deployment process.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:
- Reporting issues
- Submitting pull requests
- Code style standards
- Development setup

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🔗 Resources

- [Mocha Community](https://getmocha.com) - Built with Mocha
- [GitHub Repository](https://github.com/RachamaduguNarasimhaRao/QuickBite---College-Canteen-Pre-Order)
- [Discord Community](https://discord.gg/shDEGBSe2d)

## 📧 Contact

For questions or support, please open an issue on GitHub or join our Discord community.
