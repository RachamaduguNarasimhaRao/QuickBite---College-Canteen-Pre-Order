# Contributing to QuickBite

Thank you for your interest in contributing to QuickBite! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/QuickBite---College-Canteen-Pre-Order.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm install`
5. Start development: `npm run dev`

## Development Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Project Structure
```
QuickBite/
├── frontend/          # React Vite application
├── backend/           # Hono.js server
├── src/
│   ├── react-app/    # React components and pages
│   ├── worker/       # Cloudflare Worker code
│   └── shared/       # Shared types and utilities
├── migrations/       # Database migrations
└── test/            # Test files
```

### Running the Project
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Build for production
npm run build

# Check build (dry-run)
npm run check
```

## Code Style

- Follow the project's existing code style
- Use TypeScript for all new code
- Run `npm run lint` before committing
- Ensure all tests pass

## Commit Guidelines

- Use clear, descriptive commit messages
- Keep commits focused and atomic
- Reference issues when applicable (e.g., "Fixes #123")

## Pull Request Process

1. Update your branch to be up to date with main: `git pull origin main`
2. Run `npm run lint` and `npm run build` to ensure no errors
3. Create a PR with a clear description of changes
4. Ensure CI/CD checks pass
5. Request review from maintainers

## Firebase Configuration (Development)

If working on authentication features:
1. Add your development host to Firebase Console → Authentication → Authorized domains
2. Add localhost, 127.0.0.1, and your LAN IP address
3. For LAN development, use `npm run dev:lan`

## Reporting Issues

- Use the GitHub issue tracker
- Include steps to reproduce
- Provide screenshots or error logs if applicable
- Specify your environment (OS, Node version, etc.)

## Questions?

Feel free to open an issue or join our community Discord for discussions.

Thank you for contributing! 🚀
