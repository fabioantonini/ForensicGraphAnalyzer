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

## Recent Changes

### June 19, 2025 - OCR System Implementation
- **OCR Real Implementation**: Complete implementation with Tesseract.js for actual text extraction
  - Frontend: Responsive React interface with file upload, settings, and results display
  - Backend: Express endpoints with real OCR processing using Tesseract.js
  - Translation: Full multilingual support for Italian and English
  - Integration: Automatic document saving to knowledge base with vector indexing
- **Image Preprocessing**: Real image enhancement with Sharp library
  - Auto: Standard normalization and light sharpening
  - Enhance: Improved contrast, gamma correction, and sharpening
  - Sharpen: Aggressive sharpening with brightness modulation
  - Denoise: Noise reduction with blur and threshold conversion
- **Translation System Fixes**: 
  - Resolved "layout.ocr" display issue in sidebar navigation
  - Added OCR namespace to i18n configuration with complete translation files
  - Fixed namespace loading for proper multilingual functionality
- **Navigation Enhancement**: Sidebar now correctly displays translated menu items
- **Document Processing**: OCR results can be saved directly to the RAG system for querying
- **User Experience Enhancement**: 
  - Added comprehensive processing options guide with visual indicators
  - Implemented tooltip system with detailed explanations for each preprocessing mode
  - Complete multilingual support for all guide content and tooltips
  - Color-coded visual system to help users understand when to use each option

### June 21, 2025 - OCR System Completion & Bug Fixes
- **PDF OCR Support**: Complete PDF processing with direct text extraction using pdf-parse
  - Hybrid approach: Direct text extraction for PDFs (faster, 95% confidence)
  - Tesseract.js OCR for image files (JPEG, PNG, TIFF, BMP)
  - Fixed GraphicsMagick dependency issues by using native PDF text extraction
  - Multi-format support with automatic detection and appropriate processing
- **Form Data Upload Fix**: Resolved file upload issues in OCR system
  - Fixed apiRequest function to properly handle FormData for file uploads
  - Corrected Content-Type header handling for multipart form data
  - Added comprehensive debug logging for upload troubleshooting
- **Recommendation System Bug Fix**: Fixed deletion functionality in personalized recommendations
  - Corrected apiRequest parameter order for "mark as viewed" and "dismiss" operations
  - Fixed HTTP method usage for recommendation updates
- **Signature Quality Confidence Meter**: Fully functional drag & drop signature analysis
  - Real-time quality assessment using Sharp library for image analysis
  - Resolution, contrast, sharpness, and completeness evaluation
  - Scoring system (0-100%) with actionable recommendations
  - Complete Italian/English translations and navigation integration

### Technical Implementation Details
- OCR Service: Tesseract.js with real text extraction (not simulation)
- Image Processing: Sharp library for preprocessing with 4 different modes
- Language Support: Italian, English, French, German, Spanish with proper mapping
- DPI Configuration: Applied to image metadata for quality optimization
- File Support: JPEG, PNG, TIFF, BMP, PDF formats with 10MB size limit
- UI Components: Professional drag-drop interface with progress tracking and result preview
- Database Integration: Seamless document creation and vector embedding storage

## Changelog

## Next Steps
- Sistema di verifica firme: miglioramenti e ottimizzazioni in programma
- Possibili implementazioni future: tour guidato, raccomandazioni AI personalizzate

Changelog:
- June 19, 2025. Initial setup and OCR system completion with full multilingual support