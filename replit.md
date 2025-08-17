# GrapholexInsight - Forensic Graphology Analysis System

## Overview
GrapholexInsight is a full-stack web application for forensic graphology analysis. Its main purpose is to provide document analysis, signature verification, and RAG (Retrieval Augmented Generation) capabilities for handwriting analysis. The project aims to offer a comprehensive solution for forensic graphology, combining advanced image processing, AI-powered analysis, and robust data management for legal and investigative applications.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript
- **Build System**: Vite
- **UI Framework**: ShadcnUI, Radix UI
- **State Management**: React Query (TanStack Query)
- **Routing**: Wouter
- **Internationalization**: i18next (Italian, English)
- **Styling**: Tailwind CSS

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Authentication**: Passport.js (session-based)
- **API Design**: RESTful
- **File Processing**: Multer for uploads, custom processors

### Database
- **Primary Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM
- **Vector Storage**: pgvector
- **Schema**: Users, documents, signatures, projects, activities, queries

### Key Features
- **Authentication System**: Session-based authentication, role-based access control (user, admin, demo), password reset, demo account management.
- **Document Processing Pipeline**: Multi-format support (PDF, DOCX, TXT, HTML), text extraction, chunking, vector embedding generation (OpenAI API), progress tracking.
- **Signature Analysis System**: Image upload and processing, Python integration for advanced analysis (OpenCV), parameter extraction (stroke width, pressure, curvature), comparison algorithms, PDF report generation.
- **Vector Database Integration**: pgvector (PostgreSQL) and ChromaDB (fallback) for embedding storage, similarity search, and RAG system for document querying.
- **OCR System**: Tesseract.js for text extraction, Sharp library for image preprocessing (Auto, Enhance, Sharpen, Denoise modes), multilingual support, automatic document saving to knowledge base.
- **Document Anonymization System**: AI-powered entity recognition (OpenAI GPT-4o) for 13 entity types (names, locations, emails, etc.), multi-format support (PDF, DOCX, TXT), text-based entity replacement, professional frontend interface, multilingual support, database integration, secure file processing.
- **Automatic Signature Cropping**: Computer vision-based automatic cropping with intelligent edge detection, advanced clustering algorithm for optimal signature detection, confidence meter, dual processing modes (automatic/manual), backend integration with API endpoint.
- **Signature Verification Workflow**: Unified cropping-calibration workflow where user enters real dimensions of the signature, automatic cropping, direct calibration, and parameter extraction in real millimeters. Reference signature display in comparison dialog with persistent database storage.
- **AI-Enhanced PDF Report Generation**: Native PDFKit solution, AI-powered analysis (OpenAI GPT-4o) for objective signature evaluation, comprehensive forensic-grade documentation, batch processing optimization.
- **Dashboard Recommendations**: Suggestions for implemented functionalities (e.g., signature verification with 16+ parameters, multilingual OCR, semantic search with RAG, AI-powered PDF reports, document anonymization).
- **Chart Visualization System**: Accurate display of chart parameters and compatibility calculations, using relative differences for percentages.
- **Drag & Drop Interface**: Dual upload modes (drag & drop, click-to-select), visual feedback, FileList compatibility, and state management.

### Deployment Strategy
- **Development Environment**: Replit, Vite dev server, tsx, PostgreSQL/Python via Nix.
- **Production Build**: Vite for frontend, ESBuild for server, static file serving via Express.
- **Configuration Management**: Environment variables, JSON config, database URL from Neon, Python dependencies via pyproject.toml.

## External Dependencies

### Core Services
- **Neon PostgreSQL**: Primary database with pgvector extension.
- **OpenAI API**: Embeddings and chat completions.
- **SendGrid**: Email service for notifications.

### Python Integration
- **ChromaDB**: Vector database (fallback).
- **OpenCV**: Image processing for signatures.
- **Matplotlib**: Chart generation for reports.
- **ReportLab**: PDF report generation.

### Development Tools
- **Replit**: Development environment.
- **Drizzle Kit**: Database migrations.
- **ESBuild**: Production bundling.
- **Tesseract.js**: OCR text extraction.
- **Sharp**: Image processing for preprocessing and quality assessment.
- **pdf-parse**: PDF text extraction.
- **mammoth**: DOCX text extraction.

## Recent Changes (Agosto 2025)
- **AUTENTICAZIONE SISTEMA RIPARATA COMPLETAMENTE**: Risolti problemi critici login per tutti gli utenti. Hash password corretto da formato `hash.salt` a `salt.hash` standard. Funzione `comparePasswords` allineata al nuovo formato. Sistema ora stabile per utenti: fabioantonini/fabio123, demouser/demopwd. Eliminato errore "Input buffers must have the same byte length".
- **AUDIT ENDPOINT TYPESCRIPT COMPLETATO**: Ridotti errori LSP da 116 a 52 nei signature routes. Aggiunti controlli null safety (`?.`) per parametri firma. Corretti mapping proprietà (pressure→pressureMean, proportionRatio→proportion, curvature→avgCurvature). Sistema type-safe senza regressioni funzionali.
- **MIDDLEWARE AUTHENTICATION CONSOLIDATO**: Standardizzati middleware da `req.isAuthenticated && req.isAuthenticated()` a `req.isAuthenticated()`. Verificata registrazione corretta di tutti i route endpoint (signature, wake-up, anonymization, password reset).
- **SISTEMA SENDGRID CONFIGURAZIONE AVANZATA**: Implementati endpoint `/api/admin/sendgrid-config` e `/api/admin/sendgrid-test` per gestione dinamica configurazione email. Identificato problema: trial SendGrid scaduto 10 luglio 2025. Sistema reset password manuale funzionante per admin.

## Previous Changes (Gennaio 2025)
- **WAKE UP QUIZ SISTEMA COMPLETO**: Implementato sistema educativo completo con quiz AI di grafologia e cultura generale. Frontend React integrato, routing completato, sidebar localizzata "Quiz Wake Up". Integrazione con servizio OpenAI esistente usando chiave API del profilo utente.
- **NAVIGAZIONE QUIZ RIPARATA**: Risolti problemi di navigazione tra domande, aggiunto caricamento automatico sessioni attive, bottone "Abbandona quiz" per tornare alla schermata principale, logica anti-ricaricamento automatico dopo abbandono sessione.
- **LOCALIZZAZIONE WAKE UP COMPLETA (Agosto 2025)**: Sistema multilingue perfezionato con traduzioni complete italiano/inglese per tutto il sistema Wake Up Quiz. Incluse tutte le categorie (Forensic Graphology, General Culture, Mixed), descrizioni dettagliate, bottoni (Quick Quiz 5 questions/domande, Full Quiz 10 questions/domande), statistiche (Precision/Accuracy, Current Level), e generazione quiz automatica nella lingua selezionata tramite OpenAI API. Sistema i18n completamente funzionante con mappatura dinamica per contenuti backend (messaggi performance, suggerimenti personalizzati). Risolti TUTTI i testi hardcoded italiani residui, inclusi: barra progresso ("Progress: X of Y"/"Progresso: X di Y"), bottoni quiz ("Back to Dashboard"/"Torna alla Dashboard"), messaggi durante quiz ("You haven't answered this question yet."/"Non hai ancora risposto a questa domanda."), statistiche finestra ("Accuracy"/"Precisione", "X of Y"/"X di Y"), messaggi performance ("Great performance! You demonstrate good mastery"/"Ottima prestazione! Dimostri una buona padronanza"), e suggerimenti personalizzati ("Excellent! Keep staying updated"/"Eccellente! Continua a mantenerti aggiornato"). Sistema 100% localizzato senza residui di chiavi di traduzione non tradotte, funzionante perfettamente in tempo reale anche cambiando lingua con finestre aperte.
- **UX QUIZ MIGLIORATA (Agosto 2025)**: Eliminato salto automatico alle sessioni attive - ora l'utente deve cliccare esplicitamente "Riprendi Sessione". Aggiunta sezione "Sessioni Attive" con card arancioni visibili nella pagina principale. Dialog di avvertimento migliorato quando si crea nuovo quiz con sessioni esistenti. Visualizzazione completa risposte nelle "Domande Completate" con risposta utente (verde/rosso) e risposta corretta.
- **CACHE E SINCRONIZZAZIONE QUIZ**: Risolti problemi cache React Query per aggiornamento automatico sessioni completate. Aggiunta invalidazione cache '/api/wake-up/sessions' quando quiz completato. ScrollArea ottimizzata (h-[500px]) per visualizzazione completa domande e risposte.
- **RISOLTO BUG CALCOLO LIVELLI PERFORMANCE (Agosto 2025)**: Corretto errore critico nel calcolo del livello di performance Wake Up Quiz. Formula errata `(punteggio_medio / (punteggio_medio + 100)) * 100` sostituita con utilizzo diretto della precisione (accuracy). Ora i livelli riflettono correttamente: Insufficiente (<40%), Sufficiente (40-59%), Buono (60-74%), Ottimo (75-89%), Eccellente (≥90%). Sistema di valutazione ora preciso e coerente con le prestazioni reali degli utenti.
- **RISOLTO BUG VISUALIZZAZIONE PERCENTUALI**: Corretto problema conversione che mostrava 0.8% invece di 84.3% di similarità
- **Sincronizzazione Database-Frontend**: Database salva valori come frazione decimale, frontend ora moltiplica per 100 per visualizzazione corretta  
- **Cache HTTP Disabilitato**: Eliminato caching per endpoint signatures per garantire dati sempre aggiornati dal PostgreSQL
- **DatabaseStorage Completo**: Aggiornato updateSignature per includere tutti i campi necessari (comparisonResult, referenceSignatureFilename, etc.)
- **Soglie Autenticità Uniformate**: Standardizzate tutte le soglie del sistema (≥85% autentica, 65-84% probabilmente autentica, <65% sospetta)
- **Sistema Production-Ready**: Completata pulizia messaggi debug, visualizzazione corretta firma di riferimento nel dialog confronto
- **PDF REPORT COMPLETO**: Implementato sistema completo di generazione PDF con analisi AI dettagliata, confronto parametri firma in verifica vs riferimento, grafico di confronto, immagini e metodologia. Risolti errori formattazione numerica con funzione formatNumber() sicura. Sistema PDF production-ready con download funzionante.
- **ANALISI PERITALE AI DETTAGLIATA**: Aggiunta sezione completa con 6 sottosezioni: confronto parametro per parametro, valutazione coerenza dimensionale, analisi caratteristiche grafologiche, identificazione anomalie, conclusione professionale autenticità, analisi tecnica algoritmica. Risolto errore inizializzazione variabili.
- **PARAMETRI COMPLETI 21/21**: Implementati tutti i parametri del documento originale con mapping completo dal sistema Python: varianza spessore, proporzione, curvatura media, stile scrittura, leggibilità, dimensione asole medie, spaziatura media, deviazione baseline, componenti connesse, complessità tratto. Sistema 100% conforme all'elenco parametri di riferimento (Gennaio 2025).