# Active Web Platform

A modern, full-featured membership and business management platform with role-based access control, featuring dedicated portals for members, businesses, and administrators.

## ✨ Overview

Active Web is a comprehensive web application designed to manage memberships, business partnerships, and administrative operations. The platform features a stunning, professional UI with blue and purple gradients, smooth animations, and responsive design across all devices.

## 🚀 Key Features

### 👤 Member Portal
- **Dashboard** - Modern dashboard with activity overview and quick actions
- **Explore** - Discover businesses and opportunities with advanced filtering
- **Notifications** - Real-time notification center with categorized alerts
- **Profile Management** - Complete profile customization and settings
- **Application Tracking** - Submit and track membership applications
- **Certificate Management** - View and download digital certificates
- **Payment Processing** - Secure payment integration with transaction history
- **Events & Updates** - Stay informed about latest events and announcements

### 🏢 Business Portal
- **Business Dashboard** - Comprehensive analytics and performance metrics
- **Discover** - Explore business opportunities and partnerships
- **Products & Services** - Manage product listings and service offerings
- **Analytics** - Detailed insights with interactive charts and reports
- **Settings** - Business profile, notifications, security, and billing management
- **Member Connections** - Connect with platform members
- **Campaign Management** - Create and track marketing campaigns

### 👨‍💼 Admin Portal (Multi-Level Hierarchy)
- **Super Admin** - Full system access with admin credential generation
- **State Admin** - State-level administration and oversight
- **District Admin** - District-wide operations management
- **Block Admin** - Block-level applications and member management

#### Admin Capabilities
- Application approval workflow with status tracking
- Comprehensive member and business management
- Real-time dashboard with statistical insights
- User role and permission management
- System settings and configuration
- Reports and analytics generation
- Hierarchical access control system

## 🎨 Design Highlights

- **Modern UI/UX** - Professional design with blue and purple color schemes
- **Gradient Effects** - Stunning gradients and glassmorphism effects
- **Responsive Design** - Seamless experience across desktop, tablet, and mobile
- **Smooth Animations** - Micro-interactions and hover effects
- **Dark/Light Themes** - Theme support with smooth transitions
- **Accessibility** - WCAG compliant with keyboard navigation support

## 🛠️ Tech Stack

### Core Technologies
- **Frontend Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.19 (Lightning-fast HMR)
- **Language**: TypeScript 5.8.3
- **Routing**: React Router DOM 6.30.1

### UI & Styling
- **Component Library**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 3.4.17 with custom configurations
- **Icons**: Lucide React & React Icons
- **Animations**: Tailwind CSS Animate
- **Themes**: next-themes for dark/light mode

### Data & Forms
- **State Management**: TanStack Query 5.83.0 (React Query)
- **Form Handling**: React Hook Form 7.61.1
- **Validation**: Zod 3.25.76
- **Date Utilities**: date-fns 3.6.0

### Data Visualization
- **Charts**: Recharts 2.15.4
- **Analytics**: Custom dashboard components

### Additional Libraries
- **Notifications**: Sonner 1.7.4
- **Carousels**: Embla Carousel React 8.6.0
- **Panels**: React Resizable Panels 2.1.9
- **Utility**: clsx, tailwind-merge, class-variance-authority

## 📦 Installation

### Prerequisites
- Node.js 18+ or Bun
- npm, yarn, or bun package manager

### Setup Steps

```bash
# Clone the repository
git clone https://github.com/aathif07/active-web.git
cd active-web

# Install dependencies
npm install
# or using bun for faster installation
bun install

# Start development server
npm run dev
# or
bun dev
```

The application will be available at `http://localhost:5173`

## 🏃 Available Scripts

```bash
# Development
npm run dev              # Start Vite dev server with HMR

# Production Build
npm run build            # Build optimized production bundle
npm run build:dev        # Build in development mode

# Code Quality
npm run lint             # Run ESLint checks
npm run preview          # Preview production build locally
```

## 🗂️ Project Structure

```
active-web/
├── public/                    # Static assets
│   ├── images/                # Image files
│   └── fonts/                 # Custom fonts
├── src/
│   ├── assets/                # Application assets
│   ├── components/            # Reusable React components
│   │   ├── ui/                # shadcn/ui base components
│   │   ├── Layout.tsx         # Main layout component
│   │   ├── Sidebar.tsx        # Desktop sidebar navigation
│   │   ├── MobileMenu.tsx     # Mobile navigation menu
│   │   └── ...                # Other shared components
│   ├── data/                  # Static data and constants
│   │   └── districts.ts       # District/location data
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility libraries
│   │   └── utils.ts           # Helper functions
│   ├── pages/                 # Route pages
│   │   ├── Index.tsx          # Landing page
│   │   ├── NotFound.tsx       # 404 page
│   │   ├── admin/             # Admin portal pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Applications.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── ...
│   │   ├── business/          # Business portal pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Discover.tsx
│   │   │   ├── Products.tsx
│   │   │   ├── Analytics.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── ...
│   │   └── member/            # Member portal pages
│   │       ├── Dashboard.tsx
│   │       ├── Explore.tsx
│   │       ├── Notifications.tsx
│   │       ├── Profile.tsx
│   │       └── ...
│   ├── utils/                 # Utility functions
│   │   └── authService.ts     # Authentication utilities
│   ├── App.tsx                # Main App component with routes
│   ├── main.tsx               # Application entry point
│   └── index.css              # Global styles
├── scripts/                   # Build and utility scripts
├── .gitignore                 # Git ignore rules
├── components.json            # shadcn/ui configuration
├── eslint.config.js           # ESLint configuration
├── package.json               # Dependencies and scripts
├── postcss.config.js          # PostCSS configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite configuration
└── README.md                  # This file
```

## 🔐 Authentication & Access Control

### Multi-Portal Authentication System

The platform features a role-based authentication system with separate login flows for each user type:

#### 1. Member Authentication
- **Routes**: `/login`, `/register`, `/forgot-password`
- **Features**:
  - Email/phone registration with verification
  - Secure login with password hashing
  - Password reset via email
  - Session management with localStorage
  - Remember me functionality

#### 2. Business Authentication
- **Routes**: `/business/login`, `/business/register`
- **Features**:
  - Business account registration
  - Company profile setup
  - Business verification process
  - Multi-user account support
  - Dashboard access control

#### 3. Admin Authentication (Hierarchical)
- **Routes** (Role-specific portals):
  - `/admin/super/login` - Super Admin (Full System Access)
  - `/admin/state/login` - State Admin (State-level Operations)
  - `/admin/district/login` - District Admin (District Management)
  - `/admin/block/login` - Block Admin (Block-level Control)

### Default Development Credentials

⚠️ **For Development/Testing Only** - Change in Production!

```
# Super Admin
Username: super_admin_001
Password: super_pass_123

# State Admin
Username: state_admin_001
Password: state_pass_123

# District Admin
Username: district_admin_001
Password: district_pass_123

# Block Admin
Username: block_admin_001
Password: block_pass_123
```

### Access Control Features
- **Role-based permissions** - Hierarchical access control
- **Protected routes** - Automatic redirection for unauthorized access
- **Session management** - Secure token-based sessions
- **Activity logging** - Track user actions and changes

⚠️ **Production Security Requirements**:
- Implement proper backend authentication server
- Use encrypted password storage (bcrypt/argon2)
- Implement JWT or session tokens
- Enable HTTPS/SSL
- Add rate limiting and CSRF protection
- Implement 2FA for admin accounts

## 🌐 API Integration

### Backend Configuration

The application is designed to integrate with a REST API backend:

**Default API Base URL**: `http://localhost:4000/api/`

### Key API Endpoints

#### Authentication
```
POST   /api/auth/login              # User login
POST   /api/auth/register           # User registration
POST   /api/auth/forgot-password    # Password reset
POST   /api/auth/verify-email       # Email verification
```

#### Member Operations
```
GET    /api/users/:id               # Get user profile
PUT    /api/users/:id               # Update profile
GET    /api/users/:id/applications  # User applications
POST   /api/applications            # Submit application
GET    /api/certificates/:id        # Get certificate
```

#### Business Operations
```
GET    /api/businesses              # List businesses
GET    /api/businesses/:id          # Get business details
POST   /api/businesses              # Create business
PUT    /api/businesses/:id          # Update business
GET    /api/products                # List products
POST   /api/analytics               # Submit analytics
```

#### Admin Operations
```
GET    /api/admin/applications      # List applications
PUT    /api/admin/applications/:id  # Update application status
GET    /api/admin/members           # List members
GET    /api/admin/statistics        # Dashboard statistics
POST   /api/admin/users             # Create admin user
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:4000/api
VITE_APP_NAME=Active Web
VITE_APP_ENV=development
```

## 📱 Responsive Design

The application is built with a **mobile-first** approach ensuring optimal experience across all devices:

### Features
- **Adaptive Layouts** - Fluid grids that adjust to any screen size
- **Desktop Navigation** - Full-featured sidebar with collapsible sections
- **Mobile Navigation** - Touch-optimized bottom navigation and hamburger menu
- **Responsive Tables** - Stack and scroll on smaller screens
- **Touch Interactions** - Swipe gestures and touch-friendly controls
- **Breakpoint System**:
  - Mobile: `< 640px`
  - Tablet: `640px - 1024px`
  - Desktop: `> 1024px`

## 🎨 UI Component Library

Built with **shadcn/ui** and custom components providing a rich set of pre-built, accessible components:

### Form Components
- **Inputs** - Text, email, password, number inputs
- **Selects** - Dropdown selects with search
- **Checkboxes & Radio** - Custom styled form controls
- **Date Pickers** - Calendar-based date selection
- **File Upload** - Drag and drop file uploads

### Data Display
- **Tables** - Sortable, filterable data tables
- **Cards** - Content containers with various styles
- **Badges** - Status indicators and labels
- **Avatars** - User profile images with fallbacks
- **Charts** - Line, bar, pie charts via Recharts

### Navigation
- **Tabs** - Tabbed content navigation
- **Breadcrumbs** - Navigation hierarchy
- **Pagination** - Page navigation controls
- **Menus** - Dropdown and context menus

### Feedback
- **Alerts** - Success, error, warning messages
- **Toasts** - Temporary notification popups (Sonner)
- **Progress** - Loading and progress indicators
- **Dialogs** - Modal dialogs and confirmations
- **Tooltips** - Helpful hover information

### Layout
- **Accordion** - Expandable sections
- **Collapsible** - Show/hide content
- **Separator** - Visual dividers
- **Scroll Area** - Custom scrollable regions

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build tool configuration |
| `tailwind.config.ts` | Tailwind CSS customization |
| `tsconfig.json` | TypeScript compiler settings |
| `tsconfig.app.json` | App-specific TypeScript config |
| `tsconfig.node.json` | Node-specific TypeScript config |
| `eslint.config.js` | ESLint code quality rules |
| `components.json` | shadcn/ui component configuration |
| `postcss.config.js` | PostCSS plugin configuration |

## 🚀 Deployment

### Production Build

```bash
# Create optimized production build
npm run build

# Preview the production build locally
npm run preview
```

Build output will be in the `dist/` directory.

### Deployment Platforms

#### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

#### Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

#### Traditional Hosting
1. Run `npm run build`
2. Upload contents of `dist/` folder to your web server
3. Configure server for SPA routing (redirect all routes to index.html)

### Environment Variables

Set these in your deployment platform:

```env
VITE_API_URL=https://api.yourproduction.com/api
VITE_APP_NAME=Active Web
VITE_APP_ENV=production
```

### Nginx Configuration (if using traditional hosting)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 🐛 Troubleshooting

### Common Issues

**Dev server won't start**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Build errors**
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run build
```

**TypeScript errors**
```bash
# Restart TypeScript server in your IDE
# Or check tsconfig.json settings
```

## 🌐 Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📚 Development Guidelines

### Code Style
- Use TypeScript for all new files
- Follow ESLint rules (`npm run lint`)
- Use functional components with hooks
- Prefer const over let

### Component Structure
```tsx
// Imports
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// Types/Interfaces
interface Props {
  title: string;
}

// Component
export function MyComponent({ title }: Props) {
  const [state, setState] = useState('');
  
  return (
    <div>
      <h1>{title}</h1>
      {/* JSX */}
    </div>
  );
}
```

### File Naming
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Styles: `kebab-case.css`

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Commit Message Format
```
type(scope): subject

body (optional)
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## 📄 License

This project is proprietary software. All rights reserved.

## 👥 Team & Support

**Project Repository**: [https://github.com/aathif07/active-web](https://github.com/aathif07/active-web)

For issues, questions, or contributions, please use the GitHub issue tracker.

## 🙏 Acknowledgments

- **React Team** - For the amazing React framework
- **Vite** - Lightning-fast build tool
- **shadcn** - Beautiful UI components
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide** - Beautiful icon library
- **Recharts** - Composable charting library

---

Made with ❤️ by the Active Web Team
