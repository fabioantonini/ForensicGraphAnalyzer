# GrapholexInsight - Documentazione Features e Architettura

## Panoramica Generale

GrapholexInsight è un sistema completo di analisi grafologica forense sviluppato come applicazione web full-stack. L'applicazione combina tecnologie avanzate di intelligenza artificiale, processamento documenti, analisi delle immagini e retrieval augmented generation (RAG) per fornire una piattaforma professionale destinata a periti calligrafi, investigatori e professionisti del settore legale.

### Obiettivi Principali
- **Analisi Firma Professionale**: Sistema di verifica firme con 21 parametri reali misurati in millimetri
- **Gestione Documentale Intelligente**: Upload, processamento e indicizzazione automatica di documenti
- **OCR Avanzato**: Estrazione testo multilingue con preprocessing avanzato delle immagini
- **Ricerca Semantica (RAG)**: Query intelligenti sulla base di conoscenza documentale
- **Anonimizzazione AI**: Protezione automatica dei dati sensibili
- **Sistema Educativo**: Quiz interattivi per formazione in grafologia

---

## Architettura Tecnica

### Stack Tecnologico

#### Frontend
- **Framework**: React 18 con TypeScript
- **Build Tool**: Vite con hot module replacement
- **Routing**: Wouter (lightweight routing)
- **State Management**: TanStack Query v5 (React Query)
- **UI Framework**: ShadcnUI + Radix UI primitives
- **Styling**: Tailwind CSS con sistema di temi JSON
- **Internazionalizzazione**: i18next con rilevamento automatico lingua

#### Backend
- **Runtime**: Node.js con Express.js
- **Linguaggio**: TypeScript end-to-end
- **Autenticazione**: Passport.js con strategia locale e sessioni
- **File Upload**: Multer con gestione multi-formato
- **ORM**: Drizzle ORM con type safety completa

#### Database e Storage
- **Database Primario**: PostgreSQL (Neon Serverless)
- **Vector Database**: pgvector extension per embeddings
- **Fallback Vector DB**: ChromaDB (Python)
- **File Storage**: Sistema locale con hash-based naming

#### AI e ML
- **LLM Provider**: OpenAI GPT-4o
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensioni)
- **Computer Vision**: OpenCV (Python) per analisi firme
- **OCR Engine**: Tesseract.js con preprocessing Sharp

#### Integrazione Python
- **Bridge**: Child process execution per script Python
- **Librerie**: OpenCV, Matplotlib, ReportLab, Pillow, scikit-image
- **Dati Exchange**: JSON serialization per parametri firme

---

## Features Implementate

### 1. Sistema di Autenticazione
**Descrizione**: Gestione completa utenti con controllo accessi basato su ruoli

**Funzionalità**:
- Registrazione utenti con validazione email
- Login/logout con gestione sessioni sicure
- Ruoli utente: `user`, `admin`, `demo`
- Password reset (integrazione email)
- Protezione route con middleware

**Tecnologie Utilizzate**:
- Passport.js per autenticazione
- bcrypt per hashing password
- express-session per gestione sessioni
- connect-pg-simple per session store PostgreSQL

### 2. Gestione Documentale Avanzata
**Descrizione**: Sistema completo per upload, gestione e organizzazione documenti

**Funzionalità**:
- Upload drag & drop per PDF, DOCX, TXT, HTML
- Import contenuti da URL esterni
- Controllo duplicati intelligente con rilevamento immediate
- Validazione file size (limite 25MB)
- Estrazione automatica testo e metadati
- Chunking intelligente per documenti lunghi
- Progress tracking real-time durante upload

**Tecnologie Utilizzate**:
- Multer per file upload
- pdf-parse per estrazione testo PDF
- mammoth per conversione DOCX
- Cheerio per parsing HTML
- crypto per hash-based filename generation

### 3. Controllo Duplicati Intelligente
**Descrizione**: Sistema di prevenzione duplicati con validazione client-side immediata

**Funzionalità**:
- Validazione immediate alla selezione file (prima dell'upload)
- Rilevamento exact match e similitude basename
- Blocco automatico upload con feedback visivo
- Gestione cross-format (PDF vs TXT stesso nome)
- Interfaccia unificata su tutti i punti di upload

**Tecnologie Utilizzate**:
- API endpoint `/api/documents/check-duplicate`
- React state management per UI feedback
- Algoritmi di string matching per basename detection

### 4. Sistema OCR Multimodale
**Descrizione**: Estrazione testo avanzata da immagini e documenti scansionati

**Funzionalità**:
- Supporto formati: JPEG, PNG, PDF scansionati
- Preprocessing intelligente con 4 modalità:
  - Automatico
  - Migliora Contrasto
  - Aumenta Nitidezza
  - Riduci Rumore
- Modalità "Completa" per documenti lunghi (120+ pagine)
- Progress tracking con percentuali e tempo stimato
- Controlli interruzione per operazioni lunghe
- Supporto multilingue (italiano, inglese)
- Integrazione automatica con knowledge base

**Tecnologie Utilizzate**:
- Tesseract.js per OCR engine
- Sharp per image preprocessing
- WebWorkers per processamento non-blocking
- Traineddata files per supporto multilingue

### 5. Ricerca Semantica (RAG)
**Descrizione**: Sistema di retrieval augmented generation per query intelligenti

**Funzionalità**:
- Query in linguaggio naturale
- Ricerca semantica su contenuti indicizzati
- Generazione risposte contestuali con AI
- Filtri per documenti, date, rilevanza
- Storico query con possibilità di ripetizione
- Citazioni accurate con riferimenti fonte
- Supporto query multilingue

**Tecnologie Utilizzate**:
- OpenAI embeddings per vector representation
- pgvector per similarity search
- OpenAI GPT-4o per generation
- Custom scoring algorithms per relevance

### 6. Analisi Firme Professionale
**Descrizione**: Sistema completo di verifica firme con parametri forensi reali

**Funzionalità**:
- Creazione progetti multi-firma
- Upload e gestione immagini firme
- Cropping automatico con computer vision
- Calibrazione DPI per misure reali in millimetri
- Estrazione 21 parametri forensi:
  - Dimensioni (altezza, larghezza, area)
  - Spessori (min, max, medio, variazione)
  - Pressione (intensità, variazioni)
  - Velocità di scrittura stimata
  - Inclinazioni e angoli
  - Curvature e direzionalità
  - Rapporti proporzionali
- Algoritmi di comparazione avanzati
- Soglie autenticità standardizzate (≥85%, 65-84%, <65%)
- Generazione report PDF professionale

**Tecnologie Utilizzate**:
- OpenCV (Python) per image processing
- NumPy, scikit-image per algoritmi matematici
- PDFKit per generazione report
- Matplotlib per grafici e visualizzazioni
- Custom algorithms per parameter extraction

### 7. Anonimizzazione Documenti AI
**Descrizione**: Protezione automatica dati sensibili tramite intelligenza artificiale

**Funzionalità**:
- Rilevamento automatico 13 categorie entità sensibili:
  - Nomi persone
  - Indirizzi completi
  - Numeri telefono
  - Email addresses
  - Codici fiscali
  - Numeri carte credito
  - Date nascita
  - Coordinate bancarie
  - Targhe automobilistiche
  - Numeri documenti
  - Informazioni mediche
  - Dati biometrici
  - Altri PII (Personally Identifiable Information)
- Personalizzazione entità da anonimizzare
- Preview modifiche prima dell'applicazione
- Sostituzione intelligente mantenendo formato documento
- Supporto multi-formato (PDF, DOCX, TXT)

**Tecnologie Utilizzate**:
- OpenAI GPT-4o per entity recognition
- Custom replacement algorithms
- Format-specific processors per ogni tipo documento

### 8. Wake Up Quiz System
**Descrizione**: Sistema educativo interattivo per formazione in grafologia

**Funzionalità**:
- Generazione AI domande grafologia e cultura generale
- Sistema anti-ripetizione per varietà contenuti
- Supporto multilingue completo
- Tracking progresso personalizzato
- Multiple tipologie domande (multipla, vero/falso, aperte)
- Gamification con punteggi e statistiche
- Contenuti sempre freschi via OpenAI

**Tecnologie Utilizzate**:
- OpenAI GPT-4o per question generation
- Algoritmi anti-repetition
- Session storage per progresso temporaneo
- Database persistence per statistiche long-term

### 9. Dashboard e Analytics
**Descrizione**: Centro di controllo con statistiche e raccomandazioni

**Funzionalità**:
- Statistiche in tempo reale:
  - Conteggio documenti totali
  - Numero query eseguite
  - Utilizzo storage
  - Attività recenti
- Raccomandazioni AI personalizzate
- Quick access alle funzioni principali
- Overview stato sistema
- Metriche performance

**Tecnologie Utilizzate**:
- Real-time queries con TanStack Query
- Chart.js per visualizzazioni
- Custom analytics algorithms

### 10. Sistema di Internazionalizzazione
**Descrizione**: Supporto multilingue completo italiano-inglese

**Funzionalità**:
- Switch lingua real-time senza reload
- Traduzione completa UI/UX
- Fallback intelligente per chiavi mancanti
- Persistenza preferenza linguistica
- Formatting localizzato date/numeri
- Contenuti AI in lingua selezionata

**Tecnologie Utilizzate**:
- i18next core framework
- i18next-browser-languagedetector
- react-i18next per integrazione React
- JSON resource files per traduzioni

---

## Integrazione Vector Database

### PostgreSQL + pgvector
**Configurazione Primaria**:
- Estensione pgvector 0.8.0
- Tabella `document_embeddings` per storage vettori
- Indici ottimizzati per similarity search
- Operatori distanza coseno e euclidea

### ChromaDB (Fallback)
**Configurazione Secondaria**:
- Server ChromaDB in background
- Client HTTP per comunicazione
- Collezioni per topic isolation
- Metadata filtering avanzato

---

## Sicurezza e Performance

### Misure di Sicurezza
- Session-based authentication con CSRF protection
- Input validation con Zod schemas
- File type validation rigorosa
- SQL injection prevention via ORM
- XSS protection con sanitizzazione input
- Rate limiting su API endpoints
- User isolation completo

### Ottimizzazioni Performance
- Lazy loading componenti React
- Image compression automatica
- Database connection pooling
- Query optimization con indici
- Caching strategico con React Query
- Compression middleware Express
- Asset bundling ottimizzato Vite

---

## Deployment e DevOps

### Ambiente di Sviluppo
- Replit integrated development environment
- Hot module replacement per development rapido
- TypeScript strict mode per type safety
- ESLint + Prettier per code quality

### Configurazione Production
- Variabili ambiente per configurazione
- Database migrations automatiche
- Asset optimization e minification
- Error monitoring e logging
- Health checks automatici

---

## Roadmap e Estensioni Future

### Funzionalità in Sviluppo
- Export dati in formati standardizzati
- API pubbliche per integrazioni esterne
- Plugin system per estensioni
- Mobile app companion
- Collaborative features per team
- Advanced ML models per analisi firme

### Integrazioni Pianificate
- Sistemi ERP/CRM esterni
- Cloud storage providers
- Signature verification hardware
- Blockchain per certificazione
- Advanced biometric systems

---

## Conclusioni

GrapholexInsight rappresenta una soluzione tecnologicamente avanzata per l'analisi grafologica forense, combinando intelligenza artificiale moderna, processamento documenti sofisticato e interfacce utente intuitive. L'architettura modulare e la scelta di tecnologie consolidate garantiscono scalabilità, maintainability e performance ottimali per utilizzo professionale in contesti investigativi e legali.

La piattaforma è progettata per crescere ed evolversi con le esigenze degli utenti, mantenendo sempre al centro l'affidabilità scientifica e la precisione richiesta nel campo della perizia calligrafica.