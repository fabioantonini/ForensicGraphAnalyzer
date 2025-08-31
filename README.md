# GrapholexInsight 🔍✍️

## Forensic Graphology Analysis System

**GrapholexInsight** is a comprehensive full-stack web application designed for professional forensic graphology analysis. It provides advanced signature verification, document analysis, and AI-powered handwriting authentication for legal and investigative applications.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-v18+-green.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)

---

## ✨ Key Features

### 🖋️ **Advanced Signature Analysis**
- **22+ Forensic Parameters**: Pressure analysis, curvature detection, inclination measurement
- **Real-time Calibration**: Millimeter-precise measurements with user-guided calibration
- **Naturalness Detection**: AI-powered algorithms to detect forgeries and dissimulation
- **SSIM Visual Analysis**: Structural similarity comparison for objective authentication
- **Compatibility Scoring**: Scientific algorithms with weighted parameter analysis

### 📄 **Document Processing Pipeline**
- **Multi-format Support**: PDF, DOCX, TXT, HTML document processing
- **Advanced OCR**: Tesseract.js integration with multi-language support (25+ languages)
- **Smart Preprocessing**: Auto-enhance, sharpen, denoise modes for optimal text extraction
- **Large Document Handling**: Progress tracking for 120+ page documents
- **Duplicate Detection**: Intelligent duplicate prevention with smart base-name matching

### 🧠 **AI-Powered Analysis**
- **Vector Database Integration**: pgvector (PostgreSQL) + ChromaDB for semantic search
- **RAG System**: Retrieval Augmented Generation for intelligent document querying
- **Document Anonymization**: GPT-4o powered entity detection and replacement (13 entity types) with OCR integration for scanned PDFs and images
- **AI Report Generation**: Automated forensic documentation with objective analysis
- **Wake-Up Quiz**: Interactive graphology knowledge testing with progress tracking

### 🔐 **Enterprise Security**
- **Role-based Access Control**: User, Admin, Demo account management
- **Session-based Authentication**: Secure Passport.js implementation
- **Password Reset**: Gmail SMTP integration for secure account recovery
- **Demo Account Cleanup**: Automated trial period management and data retention

### 🌐 **Modern Web Interface**
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Real-time Updates**: Live processing status with intelligent polling
- **Multilingual Support**: Full i18next integration (Italian, English)
- **Drag & Drop Interface**: Intuitive file upload with visual feedback
- **Professional Charts**: Interactive visualization of analysis parameters

---

## 🚀 Tech Stack

### **Frontend**
- **React 18** + **TypeScript** - Modern component architecture
- **Vite** - Lightning-fast development and building
- **ShadcnUI** + **Radix UI** - Professional component library
- **Tailwind CSS** - Utility-first styling
- **TanStack Query** - Powerful data fetching and caching
- **Wouter** - Lightweight client-side routing

### **Backend**
- **Node.js** + **Express.js** - Robust API server
- **TypeScript** - Type-safe server development
- **Drizzle ORM** - Modern database toolkit
- **PostgreSQL** (Neon) - Primary database with pgvector extension
- **Passport.js** - Authentication middleware
- **Multer** - File upload handling

### **AI & Analysis**
- **Python 3.11+** - Core analysis engine
- **OpenCV** - Computer vision for signature processing
- **NumPy** + **SciPy** - Scientific computing
- **OpenAI API** - GPT-4o for AI analysis and embeddings
- **Tesseract.js** - OCR text extraction
- **Sharp** - High-performance image processing

### **Storage & Vector DB**
- **pgvector** - PostgreSQL vector extension
- **ChromaDB** - Vector database fallback
- **Gmail SMTP** - Email service integration

---

## 📋 Prerequisites

- **Node.js** 18+ and npm/yarn
- **Python** 3.11+ with pip
- **PostgreSQL** database (or Neon serverless)
- **OpenAI API** key for AI features
- **Gmail** app password for email services

---

## 🛠️ Installation

### 1. **Clone the Repository**
```bash
git clone https://github.com/your-username/grapholexinsight.git
cd grapholexinsight
```

### 2. **Install Dependencies**
```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

### 3. **Environment Configuration**
Create the required configuration files:

```bash
# Database configuration
DATABASE_URL="postgresql://username:password@host:port/database"

# OpenAI API
OPENAI_API_KEY="your-openai-api-key"

# Gmail SMTP (create .gmail-config.json)
{
  "user": "your-email@gmail.com",
  "pass": "your-app-password"
}
```

### 4. **Database Setup**
```bash
# Push database schema
npm run db:push

# Optional: Seed demo data
npm run db:seed
```

### 5. **Start Development Server**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

---

## 📖 Usage

### **Quick Start Guide**

1. **Create Account**: Register or use demo account
2. **Upload Signatures**: Drag & drop signature images
3. **Calibrate Dimensions**: Set real-world measurements
4. **Run Analysis**: Get comprehensive forensic analysis
5. **Compare Signatures**: Upload reference and verification samples
6. **Generate Reports**: Download professional PDF reports

### **Advanced Features**

- **Document OCR**: Upload documents for text extraction and indexing
- **Semantic Search**: Query your document knowledge base
- **Document Anonymization**: Remove sensitive information automatically from text documents and scanned images
- **Feedback System**: Report issues and request features
- **FAQ Support**: Access comprehensive help documentation

---

## 📊 Analysis Parameters

GrapholexInsight analyzes **22+ forensic parameters** including:

### **Primary Graphological Parameters (15)**
- Pressure Mean & Standard Deviation
- Average Curvature & Inclination
- Proportion & Velocity Analysis
- Asola (Loop) Size & Spacing
- Overlap Ratio & Letter Connections
- Baseline Stability & Stroke Complexity
- Connected Components & Writing Style

### **Naturalness Detection (4)**
- Fluidity Score (40% weight)
- Pressure Consistency (30% weight)
- Coordination Index (30% weight)
- Combined Naturalness Index

### **Visual Analysis**
- SSIM (Structural Similarity) - 60% of final score
- Luminance, Contrast, Structure comparison

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

- **Documentation**: Check our comprehensive [FAQ System](docs/faq.md)
- **Issues**: Report bugs via [GitHub Issues](https://github.com/your-username/grapholexinsight/issues)
- **Feedback**: Use the in-app feedback system
- **Email**: contact@grapholexinsight.com

---

## 🎯 Use Cases

- **Legal Investigations**: Document authentication for court cases
- **Financial Institutions**: Signature verification for banking
- **Insurance Companies**: Fraud detection and prevention
- **Academic Research**: Graphology studies and analysis
- **Forensic Laboratories**: Professional handwriting analysis

---

## 🔬 Scientific Accuracy

GrapholexInsight implements scientifically validated algorithms based on:
- **Forensic Graphology Standards**: Industry-standard measurement techniques
- **Computer Vision Research**: Advanced OpenCV implementations
- **Machine Learning Models**: AI-powered pattern recognition
- **Statistical Analysis**: Weighted parameter comparison with confidence intervals

---

## 🌟 Acknowledgments

- **OpenCV Community** - Computer vision algorithms
- **OpenAI** - AI analysis capabilities
- **Tesseract** - OCR technology
- **PostgreSQL** - Robust database foundation
- **React Community** - Modern web framework

---

<div align="center">

**Made with ❤️ for the forensic analysis community**

[⭐ Star this repository](https://github.com/your-username/grapholexinsight) if you find it helpful!

</div>