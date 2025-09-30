# GrapholexInsight - Diagramma Architettura

## Rappresentazione Visuale dell'Architettura

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   React UI      │  │   TanStack      │  │   Wouter        │      │
│  │   TypeScript    │  │   Query         │  │   Routing       │      │
│  │   + ShadcnUI    │  │   (State Mgmt)  │  │                 │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   Tailwind CSS  │  │   i18next       │  │   Lucide Icons  │      │
│  │   Styling       │  │   Translation   │  │   UI Elements   │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                         VITE BUILD TOOL                            │
│              Hot Module Replacement + Asset Bundling               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                             HTTP/WebSocket
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                           SERVER LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   Express.js    │  │   Passport.js   │  │   Multer        │      │
│  │   REST API      │  │   Auth System   │  │   File Upload   │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   TypeScript    │  │   Session Mgmt  │  │   CORS + Helmet │      │
│  │   Business Logic│  │   connect-pg    │  │   Security      │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                      DOCUMENT PROCESSING                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   pdf-parse     │  │   mammoth       │  │   Sharp         │      │
│  │   PDF Extract   │  │   DOCX Extract  │  │   Image Proc    │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐                          │
│  │   Tesseract.js  │  │   Cheerio       │                          │
│  │   OCR Engine    │  │   HTML Parser   │                          │
│  └─────────────────┘  └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                               SQL Queries
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                PostgreSQL (Neon)                           │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                  │    │
│  │  │   Drizzle ORM   │  │   pgvector      │                  │    │
│  │  │   Type Safety   │  │   Vector Store  │                  │    │
│  │  └─────────────────┘  └─────────────────┘                  │    │
│  │                                                             │    │
│  │  Tables: users, documents, signatures, projects,           │    │
│  │          activities, queries, document_embeddings          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                ChromaDB (Fallback)                         │    │
│  │  Python Process │ HTTP Client │ Vector Collections         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                          Python Child Processes
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                        PYTHON LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │     OpenCV      │  │   scikit-image  │  │   NumPy         │      │
│  │  Computer Vision│  │   Algorithms    │  │   Math Utils    │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   Matplotlib    │  │   ReportLab     │  │   Pillow        │      │
│  │   Charts        │  │   PDF Reports   │  │   Image I/O     │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                     │
│              Signature Analysis │ PDF Generation                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                              HTTPS API Calls
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      OpenAI API                             │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                  │    │
│  │  │   GPT-4o        │  │   Embeddings    │                  │    │
│  │  │   Text Gen      │  │   text-embed-3  │                  │    │
│  │  │   Analysis      │  │   1536 dims     │                  │    │
│  │  └─────────────────┘  └─────────────────┘                  │    │
│  │                                                             │    │
│  │  Used for: RAG responses, anonymization,                   │    │
│  │           quiz generation, signature analysis              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Email Service                            │    │
│  │             Gmail SMTP │ SendGrid Fallback                  │    │
│  │             Password Reset │ Notifications                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘


                        ┌─────────────────┐
                        │   FILE SYSTEM   │
                        ├─────────────────┤
                        │  uploads/       │
                        │  ├─documents/    │
                        │  ├─signatures/   │
                        │  ├─reports/      │
                        │  └─temp/         │
                        └─────────────────┘
```

## Flusso Dati Principale

### 1. Upload Documento
```
Client → Express/Multer → File System → Text Extraction → 
OpenAI Embeddings → pgvector Storage → Client Notification
```

### 2. Ricerca Semantica (RAG)
```
Client Query → pgvector Similarity Search → Context Retrieval → 
OpenAI GPT-4o → Response Generation → Client Display
```

### 3. Analisi Firma
```
Client Upload → File System → Python/OpenCV → Parameter Extraction → 
Database Storage → Comparison Algorithm → PDF Report Generation
```

### 4. OCR Processing
```
Client Upload → Sharp Preprocessing → Tesseract.js → Text Extraction → 
Optional Knowledge Base Integration → Client Results
```

## Caratteristiche Architetturali

### Scalabilità
- **Horizontal**: PostgreSQL connection pooling
- **Vertical**: Node.js cluster mode ready
- **Caching**: TanStack Query + Redis ready

### Sicurezza
- **Authentication**: Session-based with PostgreSQL store
- **Authorization**: Role-based access control
- **Data Protection**: Input validation, SQL injection prevention
- **File Security**: Type validation, size limits, sandboxed processing

### Performance
- **Frontend**: Component lazy loading, asset optimization
- **Backend**: Database indexing, query optimization
- **Processing**: Async operations, progress tracking
- **Caching**: Multiple levels (browser, query, database)

### Monitoring
- **Logging**: Structured logging with Winston
- **Metrics**: Custom analytics dashboard
- **Health Checks**: Database connectivity, service availability
- **Error Tracking**: Comprehensive error handling

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REPLIT PLATFORM                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   Node.js       │  │   PostgreSQL    │                  │
│  │   Runtime       │  │   Neon Cloud    │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   File System   │  │   Environment   │                  │
│  │   Persistent    │  │   Variables     │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  Auto-scaling │ SSL/TLS │ Monitoring │ Backups             │
└─────────────────────────────────────────────────────────────┘
```

## Istruzioni per Creazione Immagine

Per convertire questo diagramma in immagine PNG:

1. **Tool Consigliati**:
   - draw.io (diagrams.net) - gratuito online
   - Lucidchart - professionale
   - Mermaid.js - da codice
   - PlantUML - da testo

2. **Colori Suggeriti**:
   - Client Layer: #E3F2FD (blu chiaro)
   - Server Layer: #E8F5E8 (verde chiaro)  
   - Database Layer: #FFF3E0 (arancione chiaro)
   - Python Layer: #F3E5F5 (viola chiaro)
   - External Services: #FFEBEE (rosso chiaro)

3. **Icone da Aggiungere**:
   - React logo per frontend
   - Node.js logo per backend
   - PostgreSQL elefante per database
   - Python logo per ML layer
   - OpenAI logo per AI services

Vuoi che ti aiuti a creare una versione con un tool specifico o preferisci usare questo testo per generare l'immagine con un AI image generator?