# Project Restructuring Guide

## New Frontend Structure

```
src/
├── features/                    # Feature-based modules
│   ├── business/               # Business management feature
│   │   ├── pages/              # All business pages
│   │   └── components/         # Business-specific components
│   ├── member/                 # Member/User feature
│   │   ├── pages/              # All member pages
│   │   └── components/         # Member-specific components
│   ├── admin/                  # Admin features
│   │   ├── super-admin/pages/
│   │   ├── state-admin/pages/
│   │   ├── district-admin/pages/
│   │   └── block-admin/pages/
│   └── payment/                # Payment feature
│       └── pages/
├── shared/                     # Shared across all features
│   ├── components/             # Reusable UI components (buttons, cards, etc.)
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # API services
│   └── utils/                  # Utility functions
├── core/                       # Core application setup
│   └── routes/                 # Route definitions
├── assets/                     # Static assets (images, fonts)
├── data/                       # Static data files
└── lib/                        # Third-party library configurations
```

## New Backend Structure

```
server/
├── src/
│   ├── features/               # Feature modules
│   │   ├── business/
│   │   │   ├── controllers/    # companyController, productController
│   │   │   ├── routes/         # companyRoutes, productRoutes
│   │   │   └── services/       # Business logic layer
│   │   ├── member/
│   │   │   ├── controllers/    # authController, personalFormController, etc.
│   │   │   ├── routes/         # authRoutes, personalFormRoutes, etc.
│   │   │   └── services/       # Member business logic
│   │   ├── admin/
│   │   │   ├── controllers/    # adminController
│   │   │   ├── routes/         # adminRoutes
│   │   │   └── services/       # Admin business logic
│   │   └── payment/
│   │       ├── controllers/    # paymentController
│   │       ├── routes/         # paymentRoutes
│   │       └── services/       # Payment business logic
│   ├── shared/                 # Shared resources
│   │   ├── models/             # MongoDB models (all models)
│   │   ├── middleware/         # Express middleware (auth, errorHandler)
│   │   └── utils/              # Utility functions
│   └── config/                 # Configuration files
│       ├── database.js
│       └── multiDatabase.js
└── server.js                   # Application entry point
```

## Import Path Updates

### Frontend
- Old: `import Dashboard from "@/pages/business/Dashboard"`
- New: `import Dashboard from "@/features/business/pages/Dashboard"`

- Old: `import Button from "@/components/ui/button"`  
- New: `import Button from "@/shared/components/ui/button"`

### Backend
- Old: `import Company from '../models/Company.js'`
- New: `import Company from '../../shared/models/Company.js'`

- Old: `import { protect } from '../middleware/auth.js'`
- New: `import { protect } from '../../shared/middleware/auth.js'`

## Benefits of This Structure

1. **Clear Separation of Concerns**: Each feature is self-contained
2. **Scalability**: Easy to add new features without affecting existing ones
3. **Maintainability**: Anyone can understand the codebase structure quickly
4. **Team Collaboration**: Multiple developers can work on different features without conflicts
5. **Testing**: Easier to test individual features in isolation
6. **Code Reuse**: Shared components and utilities are clearly separated

## Migration Status

✅ Frontend folder structure created
✅ Frontend files copied to new structure
✅ Backend folder structure created
✅ Backend models, middleware, config copied
✅ Backend controllers organized by feature
✅ Backend routes organized by feature
⏳ Import paths need to be updated
⏳ Testing required after import updates
