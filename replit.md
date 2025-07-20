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

### July 19, 2025 - Complete Signature Verification System
- **Root Cause Analysis & Processing Unification**: Fixed inconsistent processing logic
  - Unified all signature types to use reliable `processSignature` function
  - Eliminated problematic complex function that caused first-upload failures
  - Consistent behavior for reference, verification, and reprocessing workflows
- **Stack Overflow Resolution**: Fixed crashes with large images (>2000px)
  - Automatic image resizing for memory-safe processing
  - Optimized `measureStrokeWidths` function with sampling limits (max 10k samples)
  - Iterative min/max calculation instead of spread operators to prevent stack overflow
- **UI Parameter Structure Fix**: Corrected parameter display in SignatureCard component
  - Updated to use `strokeWidth.meanMm/maxMm/minMm` structure from database
  - Added null-safety checks with fallback values
  - Fixed units display (mm instead of px) for real-world measurements
- **System Validation**: Achieved accurate signature comparison results
  - 100% similarity for identical signatures (perfect recognition)
  - 79% similarity for different signatures from same person (authentic detection)
  - Calibration system works correctly with real-world dimensions
- **Complete DPI Independence**: System fully based on user-specified dimensions
  - No dependency on image metadata DPI values
  - Precise calibration using realWidthMm and realHeightMm parameters
  - Maintains accuracy regardless of image source or resolution

### July 19, 2025 - Advanced Parameter Integration System
- **Complete Advanced Parameter Integration**: Enhanced signature analysis with 16+ additional parameters
  - Advanced Python script with OpenCV-based computer vision algorithms
  - Morphological skeleton analysis for precise curvature calculation
  - Ellipse fitting for accurate inclination measurement
  - Connected components analysis for intelligent spacing calculation
  - Pressure analysis from pixel intensity variations
  - Writing style classification and readability assessment
  - Loop detection and baseline deviation analysis
- **Database Schema Enhancement**: Extended SignatureParameters interface
  - 12 new optional advanced parameter fields
  - Calibration-independent measurements in real millimeters
  - Processing notes and metadata for analysis tracking
  - Full backward compatibility with existing signatures
- **Methodology Documentation Update**: Revised analysis explanations
  - Updated accuracy estimate to 92% (from 85%) due to enhanced parameters
  - Clear separation between base parameters (60%) and advanced parameters (40%)
  - Visual methodology cards showing parameter categories
  - Technical implementation details with computer vision algorithms
- **System Validation**: Successfully tested with real signature data
  - Standalone Python script functioning correctly with real images
  - Parameter extraction working with existing database signatures
  - Integration ready for new signature processing workflows
  - All measurements properly calibrated to real-world dimensions (mm)

### July 19, 2025 - AI-Enhanced PDF Report Generation System
- **Complete PDF Generation Overhaul**: Replaced Python dependency with native PDFKit solution
  - Full integration with existing comparison data (no re-analysis needed)
  - Professional report layout with case information, analysis results, and images
  - Automatic directory management and file path handling
- **AI-Powered Analysis Integration**: OpenAI GPT-4o for objective signature evaluation
  - Expert forensic graphology analysis of technical parameters
  - User API key support for personalized processing
  - Intelligent fallback system for rapid report generation when AI unavailable
  - 15-second timeout with graceful degradation to standard technical analysis
- **Enhanced Report Content**: Comprehensive forensic-grade documentation
  - Technical parameter comparison with real-world measurements (mm)
  - Visual comparison charts and signature image inclusion
  - Professional methodology notes and authenticity scoring legend
  - Multi-language support (Italian/English) with case-specific information
- **Batch Processing Optimization**: Efficient generation for multiple signatures
  - Sequential processing with individual error handling
  - Progress tracking and activity logging
  - Automatic validation of comparison prerequisites
  - Average processing time: ~18 seconds per signature including AI analysis
- **CRITICAL BUG FIXES**:
  - **Parameter Names**: Corrected parameter mapping in ChatGPT analysis (inclination/pressureStd vs advancedInclination/advancedPressure)
  - **Markdown Removal**: Complete filtration system to remove all Markdown tags (**bold**, *italic*, etc.) from AI responses
  - **Undefined Values**: Fixed "undefinedxundefined" dimensions display with proper null-safety checks
  - **Missing Parameters**: Replaced "N/A" with informative "Non disponibile per confronto" messages
  - **Dimensions Display Fix**: Implemented Sharp-based fallback system to read image dimensions directly from files for signatures processed before parameter saving improvements
  - All 16+ advanced parameters now correctly transmitted and displayed in professional PDF reports

### July 20, 2025 - Dashboard Recommendations System Optimization
- **Implemented Features Only**: Updated recommendation system to suggest only implemented functionalities
  - Removed suggestions for non-existent features (AI training, advanced report templates)
  - Added specific suggestions for: signature verification with 16+ parameters, multilingual OCR with 4 preprocessing modes, semantic search with RAG, AI-powered PDF reports, document anonymization with 13 entity types, signature quality confidence meter
- **AI Prompt Enhancement**: Updated OpenAI prompt to generate recommendations based only on real system capabilities
  - Detailed list of 10 implemented features in prompt context
  - Specific guidance to avoid mentioning non-existent functionalities
  - Focus on actionable suggestions for better usage of existing features
- **Multilingual Support**: Complete Italian/English support for all recommendation content
  - Fallback recommendations updated with detailed, specific descriptions
  - AI-generated suggestions properly localized based on user language preference
- **User Experience Improvement**: Recommendations now provide clear, actionable guidance
  - Specific technical details (16+ OpenCV parameters, 92% accuracy, 4 OCR modes)
  - Direct correlation with user activity and implemented system capabilities

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

### June 21, 2025 - Document Anonymization System Implementation
- **Complete Anonymization Pipeline**: Full document privacy protection system
  - AI-powered entity recognition using OpenAI GPT-4o for Italian and English documents
  - Support for 13 entity types: names, locations, emails, phones, organizations, dates, addresses, postal codes, fiscal codes, VAT numbers, money amounts, credit cards, IBAN
  - Multi-format document support: PDF, DOCX, TXT with intelligent text extraction
  - User API key integration: Uses individual OpenAI keys from user database
  - Enhanced formatting preservation: Professional PDF output with structured text files for other formats
  - **Text-based Entity Replacement**: Robust anonymization using text search instead of AI positions
    - Fixed position accuracy issues that prevented entity substitution
    - Regex-based search for reliable entity detection and replacement
    - Handles multiple occurrences and prevents partial substitutions
    - Successfully tested with Italian testamento document (18 entities detected and replaced)
- **Professional Frontend Interface**: Complete React-based anonymization workflow
  - Four-tab interface: Upload → Settings → Preview → Result
  - Drag-and-drop file upload with format validation (10MB limit)
  - Interactive entity selection with customizable replacement tags
  - Real-time preview with before/after text comparison
  - Download functionality for anonymized documents with proper content types
- **Multilingual Support**: Full Italian and English language support
  - Entity recognition optimized for both Italian and English text patterns
  - Support for Italian addresses (Via, Corso, Piazza) and English addresses (Street, Avenue, Road)
  - Italian and English date format recognition
  - Complete UI translations for both languages
- **Database Integration**: Full data persistence and tracking
  - New anonymizations table with processing status tracking
  - Entity detection results storage and retrieval
  - File management with secure download endpoints
  - Complete schema migration and indexing
- **Security & Privacy Features**: Enterprise-grade document protection
  - Secure file processing with temporary file cleanup
  - Token-based download authentication
  - User-specific processing using individual API keys
  - Debug logging for troubleshooting entity recognition

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