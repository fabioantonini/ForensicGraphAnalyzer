# Peer Review Process - Technical Documentation

## System Overview

GrapholexInsight's peer review system implements forensic analysis compliant with ENFSI (European Network of Forensic Science Institutes) standards using a multi-step approach powered by artificial intelligence.

## 📊 OpenAI Transactions per Analysis

The system performs **3 separate calls to OpenAI GPT-4o** for each peer review analysis:

---

## 🔍 CALL 1: Preliminary Structural Analysis

### Purpose
Extract specific citations and structural elements from the document

### Prompt Used
```
You are an ENFSI forensic expert. Analyze this document to extract specific structural elements.

You must identify and quote EXACTLY from the text (with quotation marks):
- Case identifiers/references
- Names of experts/laboratories/submitters  
- Significant dates
- Mentioned methodologies
- Cited tools/equipment
- Expressed conclusions/opinions

Provide JSON output with specific citations:
{
  "documentStructure": {
    "caseIdentifiers": ["quote 1", "quote 2"],
    "expertInfo": ["expert name", "laboratory"],  
    "dates": ["date 1", "date 2"],
    "methodologies": ["cited methodology"],
    "equipment": ["cited instrument"],
    "conclusions": ["specific conclusion"]
  },
  "documentStats": {
    "totalPages": 0,
    "hasPageNumbers": true/false,
    "hasSectionHeaders": true/false,
    "hasFooters": true/false
  },
  "keyFindings": [
    {
      "category": "structure/methodology/technique/validation",
      "finding": "specific description", 
      "quote": "exact quote from document",
      "location": "approximate section/paragraph",
      "severity": "critical/high/medium/low"
    }
  ]
}
```

### Configuration Parameters
- **Model**: `gpt-4o`
- **Temperature**: `0.3` (low for higher precision)
- **Max tokens**: `3000`
- **Response format**: `json_object`

---

## 🎯 CALL 2: Detailed ENFSI Analysis

### Purpose
Evaluate each ENFSI sub-criterion with specific scoring and gap analysis

### ENFSI Framework Used

The system evaluates **39 sub-criteria** divided into **6 main categories**:

#### 1. MANDATORY STRUCTURE (15% of total score)
- **Case identifier (3%)**: present/absent, quality
- **Expert/laboratory data (3%)**: information completeness
- **Examiner qualifications (3%)**: credential details
- **Signature/authentication (2%)**: presence of digital/physical signature  
- **Complete dates (2%)**: all required dates
- **Submitter (1%)**: sender identification
- **Page numbering (1%)**: numbering system

#### 2. MATERIAL DOCUMENTATION (15%)
- **Material list (4%)**: inventory completeness
- **Reception conditions (3%)**: condition description
- **Alterations/damage (3%)**: problem documentation
- **Material info (3%)**: received metadata
- **Chain of custody (2%)**: traceability

#### 3. METHODOLOGY (25%)
- **Examination purpose (5%)**: objective clarity
- **Systematic approach (6%)**: structured methodology
- **Alternative hypotheses (5%)**: pro/contra consideration
- **Examination sequence (4%)**: procedure logic
- **Analysis details (3%)**: technical specificity
- **Equipment (2%)**: tool appropriateness

#### 4. TECHNICAL ANALYSIS (20%)
- **Graphological parameters (5%)**: parameter completeness
- **Handwriting variations (4%)**: variability analysis
- **Writing styles (4%)**: style classification
- **Comparison process (4%)**: comparison methodology
- **Individual characteristics (3%)**: vs. class characteristics

#### 5. VALIDATION (15%)
- **Peer review (5%)**: review presence
- **Evidence confirmation (4%)**: findings validation
- **Quality controls (3%)**: QC procedures
- **Technique validation (3%)**: methodological standards

#### 6. PRESENTATION (10%)
- **Results clarity (4%)**: comprehensibility 
- **Significance (2%)**: contextual relevance
- **Reasoning (2%)**: opinion justifications
- **Traceability (2%)**: process documentation

### Prompt Used (shortened version)
```
You are an ENFSI forensic expert. Analyze this document according to the ENFSI framework using the previously identified structural data.

AVAILABLE STRUCTURAL ANALYSIS:
[Previous call data]

DETAILED ENFSI FRAMEWORK - evaluate each sub-criterion:
[Detailed structure with all 39 sub-criteria]

For each SUB-CRITERION provide:
- Score: 0-100
- Evidence: specific quote from document (if present)  
- Gap: what specifically is missing
- Severity: how serious the gap is

IMPORTANT: For CRITICAL ISSUES (score < 70 with "critical" or "high" severity):
- Identify max 3 most serious problems compromising ENFSI compliance
- For each problem, provide a SPECIFIC and ACTIONABLE RECOMMENDATION including:
  * Concrete steps to follow
  * References to ENFSI standards
  * Implementation example or template
  * Expected result

JSON RESPONSE:
{
  "categories": {
    "structureInfo": {
      "overallScore": 85,
      "subcriteria": {
        "caseIdentifier": { "score": 90, "evidence": "quote", "gap": "missing detail", "severity": "medium" }
      }
    }
  },
  "criticalIssues": [...]
}
```

### Configuration Parameters
- **Model**: `gpt-4o`
- **Temperature**: `0.4`
- **Max tokens**: `4000`
- **Response format**: `json_object`

---

## 💡 CALL 3: Actionable Suggestions Generation

### Purpose
Create specific prioritized recommendations to improve ENFSI compliance

### Prompt Used
```
Based on the detailed ENFSI analysis, generate SPECIFIC and ACTIONABLE suggestions to improve compliance.

ANALYSIS DATA:
[Detailed analysis results]

STRUCTURAL QUOTES:
[Extracted structural data]

Generate suggestions that are:
1. SPECIFIC: Not generic but based on identified gaps in the analysis
2. ACTIONABLE: With numbered and concrete steps to follow
3. PRIORITIZED: Ordered by impact on ENFSI compliance
4. WITH EXAMPLES: Provide practical templates/examples
5. MEASURABLE: Include expected improvement metrics

RECOMMENDATION GUIDELINES:
- Each recommendation must start with an action verb
- Include specific references to ENFSI standards
- Provide numbered steps: "1) [action], 2) [action], 3) [expected result]"
- Specify realistic implementation timelines
- Identify necessary resources/competencies

Provide response in structured JSON format:
{
  "prioritySuggestions": [
    {
      "priority": "HIGH",
      "category": "validation",
      "issue": "Lack of documented peer review process",
      "evidence": "No peer review is mentioned in the document",
      "recommendation": "Implement formal peer review process: 1) Identify qualified expert for independent review...",
      "example": "Template section: 'PEER REVIEW - This work has been reviewed by Dr. [Name]...'",
      "impact": "Validation score increase from 75 to 85+"
    }
  ],
  "implementationRoadmap": {
    "immediate": ["Implement documented peer review process"],
    "shortTerm": ["Add digital signatures to documents"], 
    "longTerm": ["Advanced quality system for validation"]
  }
}
```

### Configuration Parameters
- **Model**: `gpt-4o`
- **Temperature**: `0.6` (more creative for suggestions)
- **Max tokens**: `2500`
- **Response format**: `json_object`

---

## 📈 Performance and Cost Summary

| Parameter | Value |
|-----------|-------|
| **Total calls per analysis** | 3 |
| **Maximum tokens used** | ~9,500 per complete analysis |
| **Processing time** | 15-30 seconds |
| **Model used** | GPT-4o for all calls |
| **Approach** | Multi-step for higher precision |
| **Response format** | Structured JSON |

## 🎯 Classification System

The system automatically classifies reports according to 4 levels:

| Classification | Score | Description | Color |
|----------------|-------|-------------|-------|
| **Excellent** | 90-100% | Complete compliance with ENFSI standards | 🟢 Green |
| **Good** | 75-89% | Standards met, minor details to improve | 🟡 Yellow |
| **Sufficient** | 60-74% | Acceptable base, some methodological gaps | 🟠 Orange |
| **Insufficient** | <60% | Fundamental criteria missing, revisions necessary | 🔴 Red |

## 🔄 Process Flow

1. **Document upload** → System extracts text (PDF, DOCX, TXT)
2. **Call 1** → Structural analysis and citation extraction
3. **Call 2** → Detailed evaluation of 39 ENFSI sub-criteria
4. **Call 3** → Generation of prioritized actionable suggestions
5. **Processing** → Results conversion and final score calculation
6. **Output** → Professional PDF report with complete analysis

## 📊 PDF Report Generation

The system automatically generates a professional PDF report that includes:

- **Blue header with logo** and document information
- **Summary table of scores** by category with colors and emojis
- **Section 1**: Detailed ENFSI analysis by category
- **Section 2**: Improvement plan with prioritized suggestions
- **Section 3**: Methodology and reference standards
- **Automatic page numbering**
- **Footer with timestamp** and system information

## 🎨 Technical Features

- **Backend**: Node.js + TypeScript + Express
- **AI Integration**: OpenAI GPT-4o API
- **PDF Generation**: PDFKit with professional design
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with Passport.js
- **Interface**: React + TypeScript + Tailwind CSS

## 📚 Reference Standards

The system is based on the following international forensic standards:

- **ENFSI Guideline for Evaluative Reporting in Forensic Science (2015)**
- **Best Practice Manual for the Forensic Examination of Handwriting (2018)**
- **ISO/IEC 17025:2017** - General requirements for testing and calibration laboratories

---

*Technical documentation generated for GrapholexInsight v2.2.0*