# GrapholexInsight - Forensic Graphology Analysis System

## Overview
GrapholexInsight is a full-stack web application designed for forensic graphology analysis. Its primary purpose is to offer comprehensive document analysis, signature verification, and Retrieval Augmented Generation (RAG) capabilities for handwriting analysis. The project aims to provide a robust solution for legal and investigative applications by integrating advanced image processing, AI-powered analysis, and efficient data management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frameworks**: React with TypeScript, Vite
- **UI Libraries**: ShadcnUI, Radix UI
- **Styling**: Tailwind CSS
- **Internationalization**: i18next (Italian, English)

### Technical Implementations
- **Frontend State Management**: React Query (TanStack Query)
- **Frontend Routing**: Wouter
- **Backend Runtime**: Node.js with Express.js
- **Backend Language**: TypeScript
- **Authentication**: Passport.js (session-based)
- **API Design**: RESTful
- **File Processing**: Multer for uploads, custom processors
- **Primary Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Vector Storage**: pgvector
- **Deployment**: Replit for development, Vite/ESBuild for production. Configuration via environment variables, JSON, and database.

### Feature Specifications
- **Authentication System**: Session-based authentication, role-based access control (user, admin, demo), password reset.
- **Document Processing Pipeline**: Supports multi-format documents (PDF, DOCX, TXT, HTML), includes text extraction, chunking, and vector embedding generation (OpenAI API).
- **Signature Analysis System**: Image upload and processing with Python integration (OpenCV), parameter extraction (stroke width, pressure, curvature), comparison algorithms, and PDF report generation. This includes automatic signature cropping using computer vision, and a unified cropping-calibration workflow for real-millimeter parameter extraction.
- **Vector Database Integration**: Utilizes pgvector (PostgreSQL) and ChromaDB (fallback) for embedding storage, similarity search, and a RAG system for document querying. Automatic indexing of OCR documents confirmed working correctly.
- **OCR System**: Employs Tesseract.js for text extraction and Sharp for image preprocessing (Auto, Enhance, Sharpen, Denoise modes), with multilingual support. Full integration with knowledge base - OCR documents are automatically indexed in vector store for RAG queries. Features complete mode for large documents (120+ pages), user-friendly progress indicators with percentage rounding, interruption controls for long operations, and preventive file size validation (25MB limit) with clear user feedback.
- **Advanced Duplicate Detection**: Intelligent client-side duplicate detection that activates immediately upon file selection. Uses smart base-name matching (e.g., detects "document.pdf" vs "document.txt" as duplicates) with immediate visual feedback and upload prevention. Implemented across all upload interfaces (Documents page, OCR page) with clear error messages indicating duplicate type and existing document details.
- **Document Anonymization System**: AI-powered (OpenAI GPT-4o) for identifying and replacing 13 entity types across multiple document formats (PDF, DOCX, TXT).
- **AI-Enhanced PDF Report Generation**: Native PDFKit solution integrated with AI (OpenAI GPT-4o) for objective signature evaluation and comprehensive forensic documentation.
- **Dashboard Recommendations**: Provides suggestions for implemented functionalities like signature verification, multilingual OCR, semantic search, AI-powered reports, and document anonymization.
- **Chart Visualization System**: Displays chart parameters and compatibility calculations using relative differences.
- **Drag & Drop Interface**: Supports dual upload modes with visual feedback.
- **Wake Up Quiz System**: AI-powered graphology and general knowledge quiz with multilingual support, user-specific progress tracking, stable question generation with anti-repetition system for enhanced variety while maintaining accuracy. Enhanced UX with loading indicators during question generation.
- **OpenAI Model Management**: Updated to support GPT-4o (default) and GPT-5, with removal of deprecated models (o3, o4-mini, gpt-3.5-turbo). Unified temperature control across all supported models.
- **Feedback System**: Complete user feedback collection system with 4 quick actions (Bug Reports, Feature Requests, App Rating, Recommendations), full multilingual support (Italian/English), smart form pre-filling with translated content, comprehensive statistics dashboard, and integrated history tracking. Completely localized interface with dynamic language switching, all TypeScript errors resolved, and seamless translation of all UI components including forms, placeholders, buttons, and status indicators. Feedback namespace properly integrated into i18n system for full translation support. Authentication system corrected to use Passport.js consistently across all feedback routes for proper admin access control.
- **FAQ System**: Comprehensive frequently asked questions section with 9 thematic categories (General, Documents, Signatures, OCR, AI, Peer Review, Wake Up, Privacy, Reports) containing 36 detailed questions and answers. Features full multilingual support (Italian/English), expandable sections with integrated search functionality, direct integration with feedback system for user support, and seamless navigation from sidebar menu.

### System Design Choices
- **Database Schema**: Includes tables for Users, documents, signatures, projects, activities, and queries.
- **Authentication Thresholds**: Standardized authenticity thresholds: ≥85% authentic, 65-84% probably authentic, <65% suspicious.
- **Email Service**: Uses Gmail SMTP for email services, with intelligent fallback mechanisms.

## External Dependencies

### Core Services
- **Neon PostgreSQL**: Primary database service, including pgvector extension.
- **OpenAI API**: Used for embeddings, chat completions, AI analysis, and anonymization.
- **Gmail SMTP**: Email service for notifications and password resets.

### Python Integration
- **ChromaDB**: Secondary vector database (fallback).
- **OpenCV**: Image processing library for signature analysis.
- **Matplotlib**: Used for chart generation in reports.
- **ReportLab**: Utilized for PDF report generation.

### Other Libraries and Tools
- **Drizzle Kit**: Database migration tool.
- **ESBuild**: Used for production bundling.
- **Tesseract.js**: JavaScript OCR engine.
- **Sharp**: High-performance Node.js image processing.
- **pdf-parse**: PDF text extraction library.
- **mammoth**: DOCX text extraction library.