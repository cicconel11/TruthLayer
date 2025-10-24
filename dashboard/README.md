# TruthLayer Dashboard

A Next.js-based dashboard for visualizing search engine transparency metrics and bias analysis.

## Features

- **Overview Dashboard**: High-level metrics across all search engines
- **Trend Analysis**: Time-series visualizations of bias metrics
- **Engine Comparison**: Side-by-side analysis of search engine performance
- **Data Export**: CSV and JSON export functionality with filtering

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database with TruthLayer schema
- Environment variables configured

### Installation

1. Install dependencies:
```bash
cd dashboard
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your database connection details
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3001](http://localhost:3001) in your browser.

### Production Build

```bash
npm run build
npm run start
```

## API Endpoints

The dashboard includes built-in API routes:

- `GET /api/metrics/overview` - Overall metrics summary
- `GET /api/metrics/trends` - Time-series bias metrics
- `GET /api/metrics/engines` - Engine comparison data
- `POST /api/export` - Data export functionality

## Technology Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety and developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **Chart.js** - Interactive data visualizations
- **PostgreSQL** - Database integration

## Configuration

### Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_API_URL` - API base URL (optional)
- `PORT` - Custom port for the dashboard (default: 3001)

### Database Connection

The dashboard connects directly to the TruthLayer PostgreSQL database to fetch metrics and search result data. Ensure your database is properly configured and accessible.

## Development

### Project Structure

```
dashboard/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/            # API route handlers
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout component
│   │   └── page.tsx        # Homepage component
│   ├── lib/                # Utility libraries
│   │   └── database.ts     # Database connection
│   └── types/              # TypeScript type definitions
│       ├── dashboard.ts    # Dashboard-specific types
│       └── models.ts       # Database model types
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── next.config.js
```

### Adding New Features

1. Create new API routes in `src/app/api/`
2. Add corresponding types in `src/types/`
3. Build UI components in `src/app/` or `src/components/`
4. Update the navigation in `src/app/layout.tsx`

## Deployment

The dashboard can be deployed to any platform that supports Next.js:

- **Vercel** (recommended)
- **Netlify**
- **Docker** containers
- **Traditional** Node.js hosting

Ensure environment variables are properly configured in your deployment environment.