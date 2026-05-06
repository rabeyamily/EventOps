# VSP EventOps Frontend

Next.js frontend application for the VSP EventOps staff operations platform.

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

3. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Project Structure

```
frontend/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Home page
│   │   ├── login/        # Login page
│   │   └── dashboard/    # Dashboard page
│   ├── components/       # Shared React components
│   ├── lib/              # Utilities and API client
│   │   ├── api-client.ts # Axios instance
│   │   └── api/          # API functions
│   ├── store/            # Zustand state management
│   │   └── auth-store.ts # Authentication store
│   ├── types/            # TypeScript types
│   └── hooks/            # Custom React hooks
├── public/               # Static assets
└── package.json
```

## Features

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Axios** for API calls
- **React Hook Form** for form handling
- **Zod** for validation

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Authentication

The frontend supports:
- Email/password login
- Role-aware sign-in (staff/admin)
- Session-based authentication with cookies

## Maintenance Notes

When adding new pages, keep route-level loading and error boundaries in `src/app` aligned with the user flow.

