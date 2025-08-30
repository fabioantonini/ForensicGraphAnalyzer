# 📋 Local Installation Guide - GrapholexInsight

## 🎯 Overview
GrapholexInsight is a complete system for forensic graphology analysis that includes:
- React frontend with TypeScript
- Node.js/Express backend
- PostgreSQL database with pgvector extension
- Python integration for advanced analysis
- AI services (OpenAI API)
- OCR system and document processing

---

## 🔧 System Prerequisites

### 1. Required Software

#### **Node.js (v18 or higher)**
```bash
# Check installed version
node --version
npm --version

# If not installed, download from: https://nodejs.org/
```

#### **Python (v3.8 or higher)**
```bash
# Check installed version
python --version
# or
python3 --version

# If not installed, download from: https://python.org/
```

#### **PostgreSQL (v12 or higher)**
```bash
# Check installation
psql --version

# Ubuntu/Debian installation:
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS installation (with Homebrew):
brew install postgresql

# Windows installation:
# Download from: https://www.postgresql.org/download/windows/
```

#### **Git**
```bash
# Check installation
git --version

# If not installed:
# Ubuntu/Debian: sudo apt install git
# macOS: brew install git
# Windows: https://git-scm.com/download/win
```

---

## 📦 Project Installation

### 1. Repository Cloning
```bash
# Clone the repository
git clone [REPOSITORY_URL] grapholex-insight
cd grapholex-insight
```

### 2. Node.js Dependencies Installation
```bash
# Install project dependencies
npm install

# Verify all dependencies are installed
npm list
```

### 3. Python Dependencies Installation
```bash
# Install Python dependencies (from package.json)
npm run install:python

# Or manually:
pip install chromadb docx2pdf matplotlib numpy opencv-python pillow pypdf2 python-docx reportlab scikit-image

# On macOS you might need:
pip3 install chromadb docx2pdf matplotlib numpy opencv-python pillow pypdf2 python-docx reportlab scikit-image
```

---

## 🗄️ Database Configuration

### 1. PostgreSQL Startup
```bash
# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS (with Homebrew)
brew services start postgresql

# Windows: start the service from Control Panel
```

### 2. Database and User Creation
```bash
# Access PostgreSQL as superuser
sudo -u postgres psql

# Create database and user
CREATE DATABASE grapholex_insight;
CREATE USER grapholex_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE grapholex_insight TO grapholex_user;

# Exit psql
\q
```

### 3. pgvector Extension Installation
```bash
# Access the database
psql -U grapholex_user -d grapholex_insight

# Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

# Verify installation
\dx

# Exit
\q
```

**Note:** If pgvector is not available, install it:
```bash
# Ubuntu/Debian
sudo apt install postgresql-[VERSION]-pgvector

# Or compile from source:
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

---

## 🔑 Environment Variables Configuration

### 1. Creating `.env` File
```bash
# Create .env file in project root
touch .env
```

### 2. Database Configuration
Add to `.env` file:
```env
# Database Configuration
DATABASE_URL=postgresql://grapholex_user:secure_password@localhost:5432/grapholex_insight
PGHOST=localhost
PGPORT=5432
PGUSER=grapholex_user
PGPASSWORD=secure_password
PGDATABASE=grapholex_insight
```

### 3. OpenAI API Configuration
```env
# OpenAI Configuration (REQUIRED)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**How to get OpenAI API key:**
1. Go to https://platform.openai.com/
2. Register/login to your account
3. Go to "API Keys" in the menu
4. Create a new API key
5. Copy the key into the `.env` file

### 4. Email Configuration (Optional)
```env
# Gmail SMTP Configuration (for password reset)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

**How to configure Gmail SMTP:**
1. Go to https://myaccount.google.com/security
2. Enable 2-factor authentication
3. Generate an "App Password"
4. Use that password in the `.env` file

### 5. Other Configurations
```env
# Session Secret (generate a secure random string)
SESSION_SECRET=your-very-long-random-secret-string-here

# Port Configuration
PORT=5000

# Environment
NODE_ENV=development
```

---

## 🔄 Database Initialization

### 1. Schema Push
```bash
# Synchronize database schema
npm run db:push

# If there are conflicts, force the push
npm run db:push --force
```

### 2. Tables Verification
```bash
# Connect to database
psql -U grapholex_user -d grapholex_insight

# List tables
\dt

# You should see tables like: users, documents, signatures, etc.
\q
```

---

## 🚀 Application Startup

### 1. Development Mode Startup
```bash
# Start complete application (frontend + backend)
npm run dev
```

### 2. Functionality Verification
- **Frontend:** http://localhost:5000
- **Backend API:** http://localhost:5000/api/

### 3. Logs Check
Check console logs to verify:
- ✅ Database connection successful
- ✅ pgvector extension installed
- ✅ Express server started
- ✅ Vite frontend served

---

## 🧪 Installation Testing

### 1. User Registration Test
1. Go to http://localhost:5000
2. Click "Register"
3. Create a new account
4. Verify login works

### 2. Document Upload Test
1. Go to "Documents" section
2. Upload a test PDF file
3. Verify it's processed correctly

### 3. Signature Analysis Test
1. Go to "Signatures" section
2. Create a new project
3. Upload two signature images
4. Execute comparison

---

## 🔧 Common Troubleshooting

### Error "pgvector extension not found"
```bash
# Reinstall pgvector
sudo apt install postgresql-contrib postgresql-[VERSION]-pgvector
# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Error "OpenAI API key invalid"
- Verify API key is correct in `.env` file
- Check available credits on OpenAI
- Ensure key has necessary permissions

### Error "Python dependencies missing"
```bash
# Reinstall Python dependencies
pip install --upgrade chromadb opencv-python matplotlib numpy
```

### Error "Port 5000 already in use"
```bash
# Find process using the port
lsof -i :5000
# Kill the process
kill -9 [PID]
# Or change port in .env file
PORT=3000
```

### Database Connection Error
```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql

# Verify manual connection
psql -U grapholex_user -d grapholex_insight -h localhost
```

---

## 📚 Useful Commands

### Database
```bash
# Complete database reset
npm run db:push --force

# Database backup
pg_dump -U grapholex_user grapholex_insight > backup.sql

# Database restore
psql -U grapholex_user -d grapholex_insight < backup.sql
```

### Development
```bash
# Start frontend only
npm run dev:client

# Start backend only
npm run dev:server

# Production build
npm run build
```

### Logs and Debug
```bash
# View real-time logs
tail -f logs/app.log

# Debug with detailed information
DEBUG=* npm run dev
```

---

## 🔒 Security

### Recommended Production Configurations

1. **Change default passwords**
2. **Use HTTPS with SSL certificates**
3. **Configure appropriate firewall**
4. **Keep dependencies updated:**
   ```bash
   npm audit
   npm audit fix
   ```
5. **Regular database backups**
6. **Limit OpenAI API access**

---

## 📞 Support

For issues or questions:
1. Check application logs
2. Verify environment variables configuration
3. Consult dependencies documentation
4. Verify all external services are working

---

## 🎉 Installation Complete!

If you've followed all steps correctly, you should now have:
- ✅ GrapholexInsight running locally
- ✅ PostgreSQL database configured
- ✅ AI analysis operational
- ✅ All features available

**Happy forensic graphology analysis!** 🔍📝