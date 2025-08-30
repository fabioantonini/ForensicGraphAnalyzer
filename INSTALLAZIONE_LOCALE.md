# 📋 Guida di Installazione Locale - GrapholexInsight

## 🎯 Panoramica
GrapholexInsight è un sistema completo per l'analisi grafologica forense che include:
- Frontend React con TypeScript
- Backend Node.js/Express
- Database PostgreSQL con estensione pgvector
- Integrazione Python per analisi avanzate
- Servizi AI (OpenAI API)
- Sistema OCR e processamento documenti

---

## 🔧 Prerequisiti di Sistema

### 1. Software Richiesto

#### **Node.js (v18 o superiore)**
```bash
# Verifica versione installata
node --version
npm --version

# Se non installato, scarica da: https://nodejs.org/
```

#### **Python (v3.8 o superiore)**
```bash
# Verifica versione installata
python --version
# oppure
python3 --version

# Se non installato, scarica da: https://python.org/
```

#### **PostgreSQL (v12 o superiore)**
```bash
# Verifica installazione
psql --version

# Installazione Ubuntu/Debian:
sudo apt update
sudo apt install postgresql postgresql-contrib

# Installazione macOS (con Homebrew):
brew install postgresql

# Installazione Windows:
# Scarica da: https://www.postgresql.org/download/windows/
```

#### **Git**
```bash
# Verifica installazione
git --version

# Se non installato:
# Ubuntu/Debian: sudo apt install git
# macOS: brew install git
# Windows: https://git-scm.com/download/win
```

---

## 📦 Installazione del Progetto

### 1. Clonazione del Repository
```bash
# Clona il repository
git clone [URL_DEL_REPOSITORY] grapholex-insight
cd grapholex-insight
```

### 2. Installazione Dipendenze Node.js
```bash
# Installa dipendenze del progetto
npm install

# Verifica che tutte le dipendenze siano installate
npm list
```

### 3. Installazione Dipendenze Python
```bash
# Installa dipendenze Python (dal file package.json)
npm run install:python

# Oppure manualmente:
pip install chromadb docx2pdf matplotlib numpy opencv-python pillow pypdf2 python-docx reportlab scikit-image

# Su macOS potresti aver bisogno di:
pip3 install chromadb docx2pdf matplotlib numpy opencv-python pillow pypdf2 python-docx reportlab scikit-image
```

---

## 🗄️ Configurazione Database

### 1. Avvio PostgreSQL
```bash
# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS (con Homebrew)
brew services start postgresql

# Windows: avvia il servizio dal Pannello di Controllo
```

### 2. Creazione Database e Utente
```bash
# Accedi a PostgreSQL come superuser
sudo -u postgres psql

# Crea database e utente
CREATE DATABASE grapholex_insight;
CREATE USER grapholex_user WITH PASSWORD 'password_sicura';
GRANT ALL PRIVILEGES ON DATABASE grapholex_insight TO grapholex_user;

# Esci da psql
\q
```

### 3. Installazione Estensione pgvector
```bash
# Accedi al database
psql -U grapholex_user -d grapholex_insight

# Installa l'estensione pgvector
CREATE EXTENSION IF NOT EXISTS vector;

# Verifica l'installazione
\dx

# Esci
\q
```

**Nota:** Se pgvector non è disponibile, installalo:
```bash
# Ubuntu/Debian
sudo apt install postgresql-[VERSION]-pgvector

# Oppure compila dai sorgenti:
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

---

## 🔑 Configurazione Variabili d'Ambiente

### 1. Creazione File `.env`
```bash
# Crea il file .env nella root del progetto
touch .env
```

### 2. Configurazione Database
Aggiungi al file `.env`:
```env
# Database Configuration
DATABASE_URL=postgresql://grapholex_user:password_sicura@localhost:5432/grapholex_insight
PGHOST=localhost
PGPORT=5432
PGUSER=grapholex_user
PGPASSWORD=password_sicura
PGDATABASE=grapholex_insight
```

### 3. Configurazione OpenAI API
```env
# OpenAI Configuration (OBBLIGATORIO)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Come ottenere la chiave OpenAI:**
1. Vai su https://platform.openai.com/
2. Registrati/accedi al tuo account
3. Vai su "API Keys" nel menu
4. Crea una nuova chiave API
5. Copia la chiave nel file `.env`

### 4. Configurazione Email (Opzionale)
```env
# Gmail SMTP Configuration (per password reset)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

**Come configurare Gmail SMTP:**
1. Vai su https://myaccount.google.com/security
2. Attiva l'autenticazione a 2 fattori
3. Genera una "Password per le app"
4. Usa quella password nel file `.env`

### 5. Altre Configurazioni
```env
# Session Secret (genera una stringa casuale sicura)
SESSION_SECRET=your-very-long-random-secret-string-here

# Port Configuration
PORT=5000

# Environment
NODE_ENV=development
```

---

## 🔄 Inizializzazione Database

### 1. Push dello Schema
```bash
# Sincronizza lo schema del database
npm run db:push

# Se ci sono conflitti, forza il push
npm run db:push --force
```

### 2. Verifica Tabelle
```bash
# Connettiti al database
psql -U grapholex_user -d grapholex_insight

# Lista le tabelle
\dt

# Dovresti vedere tabelle come: users, documents, signatures, etc.
\q
```

---

## 🚀 Avvio dell'Applicazione

### 1. Avvio in Modalità Sviluppo
```bash
# Avvia l'applicazione completa (frontend + backend)
npm run dev
```

### 2. Verifica del Funzionamento
- **Frontend:** http://localhost:5000
- **Backend API:** http://localhost:5000/api/

### 3. Controllo Logs
Controlla i logs nella console per verificare:
- ✅ Connessione al database riuscita
- ✅ Estensione pgvector installata
- ✅ Server Express avviato
- ✅ Frontend Vite servito

---

## 🧪 Test dell'Installazione

### 1. Test Registrazione Utente
1. Vai su http://localhost:5000
2. Clicca su "Registrati"
3. Crea un nuovo account
4. Verifica che il login funzioni

### 2. Test Upload Documento
1. Vai nella sezione "Documenti"
2. Carica un file PDF di test
3. Verifica che venga processato correttamente

### 3. Test Analisi Firma
1. Vai nella sezione "Firme"
2. Crea un nuovo progetto
3. Carica due immagini di firme
4. Esegui il confronto

---

## 🔧 Risoluzione Problemi Comuni

### Errore "pgvector extension not found"
```bash
# Reinstalla pgvector
sudo apt install postgresql-contrib postgresql-[VERSION]-pgvector
# Riavvia PostgreSQL
sudo systemctl restart postgresql
```

### Errore "OpenAI API key invalid"
- Verifica che la chiave API sia corretta nel file `.env`
- Controlla i crediti disponibili su OpenAI
- Assicurati che la chiave abbia i permessi necessari

### Errore "Python dependencies missing"
```bash
# Reinstalla le dipendenze Python
pip install --upgrade chromadb opencv-python matplotlib numpy
```

### Errore "Port 5000 already in use"
```bash
# Trova il processo che usa la porta
lsof -i :5000
# Uccidi il processo
kill -9 [PID]
# Oppure cambia porta nel file .env
PORT=3000
```

### Errore di Connessione Database
```bash
# Verifica che PostgreSQL sia in esecuzione
sudo systemctl status postgresql

# Verifica la connessione manuale
psql -U grapholex_user -d grapholex_insight -h localhost
```

---

## 📚 Comandi Utili

### Database
```bash
# Reset completo del database
npm run db:push --force

# Backup del database
pg_dump -U grapholex_user grapholex_insight > backup.sql

# Restore del database
psql -U grapholex_user -d grapholex_insight < backup.sql
```

### Sviluppo
```bash
# Avvio solo frontend
npm run dev:client

# Avvio solo backend
npm run dev:server

# Build per produzione
npm run build
```

### Logs e Debug
```bash
# Visualizza logs in tempo reale
tail -f logs/app.log

# Debug con informazioni dettagliate
DEBUG=* npm run dev
```

---

## 🔒 Sicurezza

### Configurazioni Consigliate per Produzione

1. **Cambia password predefinite**
2. **Usa HTTPS con certificati SSL**
3. **Configura firewall appropriato**
4. **Mantieni aggiornate le dipendenze:**
   ```bash
   npm audit
   npm audit fix
   ```
5. **Backup regolari del database**
6. **Limita accesso alle API OpenAI**

---

## 📞 Supporto

Per problemi o domande:
1. Controlla i logs dell'applicazione
2. Verifica la configurazione delle variabili d'ambiente
3. Consulta la documentazione delle dipendenze
4. Verifica che tutti i servizi esterni siano funzionanti

---

## 🎉 Installazione Completata!

Se hai seguito tutti i passaggi correttamente, dovresti ora avere:
- ✅ GrapholexInsight funzionante in locale
- ✅ Database PostgreSQL configurato
- ✅ Analisi AI operative
- ✅ Tutte le funzionalità disponibili

**Buon lavoro con l'analisi grafologica forense!** 🔍📝