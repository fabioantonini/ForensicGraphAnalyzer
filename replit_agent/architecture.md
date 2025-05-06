# GrapholexInsight Architecture

## Overview

GrapholexInsight is a forensic graphology application that allows users to analyze handwriting samples and signatures. It consists of a full-stack web application with a React frontend and Node.js backend. The system uses advanced computer vision techniques and AI integration to provide signature verification, document analysis, and RAG (Retrieval-Augmented Generation) capabilities for forensic graphology.

## System Architecture

The application follows a client-server architecture with a clear separation between frontend and backend components:

### Frontend

- Built with React, using TypeScript for type safety
- Utilizes ShadcnUI components with Radix UI primitives for the interface
- State management via React Query for server-state and local state
- Internationalization support with i18next (Italian and English languages)
- Uses React Hook Form for form handling and validation
- Built and bundled using Vite

### Backend

- Node.js server built with Express
- TypeScript for enhanced type safety and developer experience
- RESTful API design pattern for client-server communication
- Authentication implemented with Passport.js and session-based authentication
- File processing utilities for handling document uploads (PDF, DOCX, etc.)
- Integration with Python scripts for advanced signature analysis

### Database

- PostgreSQL database using Neon serverless
- Drizzle ORM for type-safe database queries and schema definition
- Database schema includes:
  - Users and authentication data
  - Documents and document metadata
  - Signature projects and signature analysis results
  - Activity tracking and query history

### External Services

- ChromaDB for vector storage and semantic search
- OpenAI integration for embeddings and RAG capabilities
- Python-based signature analysis with OpenCV

## Key Components

### Authentication System

The authentication system uses Passport.js with a local strategy for username/password authentication. Sessions are stored in PostgreSQL using connect-pg-simple. The system implements secure password hashing using Node.js crypto library with scrypt.

```
auth.ts → setupAuth()
  ↓
storage.ts → user methods
  ↓
db.ts → database connection
```

### Document Management

Document management handles uploading, storing, processing, and retrieving documents. The system supports various document types (PDF, DOCX, TXT, HTML) and extracts text for indexing.

```
routes.ts → document routes
  ↓
document-processor.ts → processFile()
  ↓
storage.ts → document methods
  ↓
uploads/ directory → physical files
```

### Signature Analysis

The signature analysis component is a key feature allowing users to upload, analyze, and compare handwritten signatures.

```
signature-routes.ts → API endpoints
  ↓
signature-analyzer.ts → basic analysis
  ↓
python-bridge.ts → advanced analysis
  ↓
server/advanced-signature-analyzer.py → Python implementation
```

### RAG System

The Retrieval-Augmented Generation system combines document retrieval with generative AI:

```
routes.ts → query endpoints
  ↓
chromadb.ts → vector storage and retrieval
  ↓
openai.ts → embedding and completion
```

### Localization

The application supports multiple languages through i18next:

```
i18n/index.ts → configuration
  ↓
i18n/locales/ → translation files
```

## Data Flow

1. **Authentication Flow**:
   - User submits credentials → Passport.js validates → Session created → Frontend receives user data

2. **Document Upload Flow**:
   - Frontend uploads file → Backend processes and stores file → Text extracted → Vector embeddings created → Document indexed in ChromaDB → Frontend notified of completion

3. **Signature Analysis Flow**:
   - User uploads signature → Backend processes image → Basic parameters extracted → Python analysis (if available) → Results stored and returned to frontend

4. **Query Flow**:
   - User selects documents and submits query → Backend retrieves relevant chunks via ChromaDB → Context added to OpenAI prompt → Response generated and returned

## External Dependencies

### Essential Libraries

- **@neondatabase/serverless**: Serverless PostgreSQL client for database operations
- **drizzle-orm**: Type-safe ORM for PostgreSQL
- **express**: Web framework for Node.js
- **passport**: Authentication middleware for Node.js
- **chromadb**: Vector database for document embeddings
- **openai**: OpenAI API client for AI capabilities
- **multer**: Middleware for handling file uploads
- **react-query**: Data fetching and state management for React
- **vite**: Frontend build tool

### UI Components

- **@radix-ui**: Low-level UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Managing component variants
- **lucide-react**: Icon set

### Python Dependencies

- **opencv-python**: Computer vision library for signature analysis
- **numpy**: Numerical computing library
- **matplotlib**: Visualization library
- **scikit-image**: Image processing library

## Deployment Strategy

The application is configured for deployment on Replit, as indicated by the `.replit` configuration. The deployment process involves:

1. Building the client-side code with Vite
2. Bundling the server-side code with esbuild
3. Running the production server in Node.js environment

**Build Process**:
```
npm run build
  ↓
vite build (client)
  ↓
esbuild (server)
  ↓
dist/ directory
```

**Execution Process**:
```
npm run start
  ↓
NODE_ENV=production node dist/index.js
```

The application uses PostgreSQL for data persistence, ensuring data survives container restarts. Static assets are served from the `dist/public` directory.

## Schema Design

The database schema is defined in `shared/schema.ts` using Drizzle ORM and includes:

- **users**: Authentication and user profile data
- **documents**: Document metadata and file references
- **activities**: User activity tracking
- **queries**: Saved query history
- **signature_projects**: Projects for signature analysis
- **signatures**: Signature data and analysis results
- **report_templates**: Templates for generating reports

The schema design follows relational principles with foreign key relationships between tables.