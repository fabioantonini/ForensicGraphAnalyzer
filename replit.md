# GrapholexInsight - Forensic Graphology Analysis System

## Overview

GrapholexInsight is a full-stack web application for forensic graphology analysis, built with React frontend and Node.js backend. The system provides document analysis, signature verification, and RAG (Retrieval Augmented Generation) capabilities for handwriting analysis.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build System**: Vite with custom configuration
- **UI Framework**: ShadcnUI components with Radix UI primitives
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: Wouter for client-side routing
- **Internationalization**: i18next with Italian and English support
- **Styling**: Tailwind CSS with custom theme configuration

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for type safety
- **Authentication**: Passport.js with session-based authentication
- **Session Storage**: PostgreSQL-backed session store
- **API Design**: RESTful endpoints with structured error handling
- **File Processing**: Multer for uploads, custom processors for documents

### Database Architecture
- **Primary Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM with type-safe queries
- **Vector Storage**: pgvector extension for embeddings
- **Schema**: Users, documents, signatures, projects, activities, queries
- **Migrations**: Drizzle Kit for schema management

## Key Components

### Authentication System
- Session-based authentication with PostgreSQL storage
- Password hashing using Node.js crypto with scrypt
- Role-based access control (user, admin, demo)
- Password reset functionality with email integration
- Demo account management with expiration

### Document Processing Pipeline
- Multi-format support (PDF, DOCX, TXT, HTML)
- Text extraction using mammoth (DOCX) and pdf-parse (PDF)
- Chunking system for large documents
- Vector embedding generation using OpenAI API
- Progress tracking for long-running operations

### Signature Analysis System
- Image upload and processing
- Python integration for advanced analysis using OpenCV
- Parameter extraction (stroke width, pressure, curvature)
- Comparison algorithms for signature verification
- Report generation with PDF output

### Vector Database Integration
- Primary: pgvector with PostgreSQL
- Fallback: ChromaDB with HTTP client
- Embedding storage and similarity search
- RAG system for document querying
- Semantic search capabilities

## Data Flow

### Document Upload Flow
1. Client uploads document via React interface
2. Multer middleware handles file processing
3. Document processor extracts text content
4. Text is chunked for embedding generation
5. OpenAI API generates embeddings
6. Embeddings stored in pgvector
7. Progress updates sent to client via polling

### Query Processing Flow
1. User submits query with selected documents
2. Query embedding generated using OpenAI
3. Vector similarity search in pgvector
4. Relevant chunks retrieved and ranked
5. RAG system combines context with query
6. OpenAI generates response with context
7. Results displayed in chat interface

### Signature Analysis Flow
1. Image upload to designated directory
2. Python script analyzes signature parameters
3. Comparison with reference signatures
4. Similarity score calculation
5. PDF report generation
6. Results stored in database

## External Dependencies

### Core Services
- **Neon PostgreSQL**: Primary database with pgvector extension
- **OpenAI API**: Embeddings and chat completions
- **SendGrid**: Email service for notifications

### Python Integration
- **ChromaDB**: Vector database (fallback)
- **OpenCV**: Image processing for signatures
- **Matplotlib**: Chart generation for reports
- **ReportLab**: PDF report generation

### Development Tools
- **Replit**: Development environment
- **Drizzle Kit**: Database migrations
- **ESBuild**: Production bundling

## Deployment Strategy

### Development Environment
- Replit-based development with hot reload
- Vite dev server for frontend
- tsx for TypeScript execution
- PostgreSQL and Python modules via Nix

### Production Build
- Vite builds frontend to dist/public
- ESBuild bundles server code
- Static file serving via Express
- Session persistence in PostgreSQL

### Configuration Management
- Environment variables for API keys
- JSON config files for email services
- Database URL from Neon dashboard
- Python dependencies via pyproject.toml

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 19, 2025. Initial setup