# Processo di Peer Review - Documentazione Tecnica

## Panoramica del Sistema

Il sistema di peer review di GrapholexInsight implementa un'analisi forense conforme agli standard ENFSI (European Network of Forensic Science Institutes) utilizzando un approccio multi-step con intelligenza artificiale.

## 📊 Transazioni OpenAI per Analisi

Il sistema esegue **3 chiamate separate a OpenAI GPT-4o** per ogni analisi peer review:

---

## 🔍 CHIAMATA 1: Analisi Strutturale Preliminare

### Scopo
Estrarre citazioni e elementi strutturali specifici dal documento

### Prompt Utilizzato
```
Sei un esperto forense ENFSI. Analizza questo documento per estrarre elementi strutturali specifici.

Devi identificare e citare ESATTAMENTE dal testo (con virgolette):
- Identificatori caso/riferimenti
- Nomi di esperti/laboratori/trasmettitori  
- Date significative
- Metodologie menzionate
- Strumenti/attrezzature citate
- Conclusioni/opinioni espresse

Fornisci output JSON con citazioni specifiche:
{
  "documentStructure": {
    "caseIdentifiers": ["citazione 1", "citazione 2"],
    "expertInfo": ["nome esperto", "laboratorio"],  
    "dates": ["data 1", "data 2"],
    "methodologies": ["metodologia citata"],
    "equipment": ["strumento citato"],
    "conclusions": ["conclusione specifica"]
  },
  "documentStats": {
    "totalPages": 0,
    "hasPageNumbers": true/false,
    "hasSectionHeaders": true/false,
    "hasFooters": true/false
  },
  "keyFindings": [
    {
      "category": "struttura/metodologia/tecnica/validazione",
      "finding": "descrizione specifica", 
      "quote": "citazione esatta dal documento",
      "location": "sezione/paragrafo approssimativo",
      "severity": "critica/alta/media/bassa"
    }
  ]
}
```

### Parametri Configurazione
- **Modello**: `gpt-4o`
- **Temperature**: `0.3` (bassa per maggiore precisione)
- **Max tokens**: `3000`
- **Response format**: `json_object`

---

## 🎯 CHIAMATA 2: Analisi Dettagliata ENFSI

### Scopo
Valutare ogni sub-criterio ENFSI con punteggi specifici e analisi dei gap

### Framework ENFSI Utilizzato

Il sistema valuta **39 sub-criteri** suddivisi in **6 categorie principali**:

#### 1. STRUTTURA OBBLIGATORIA (15% del punteggio totale)
- **Identificatore caso (3%)**: presente/assente, qualità
- **Dati esperto/laboratorio (3%)**: completezza informazioni
- **Qualifiche esaminatore (3%)**: dettaglio credenziali
- **Firma/autenticazione (2%)**: presenza firma digitale/fisica  
- **Date complete (2%)**: tutte le date richieste
- **Trasmettitore (1%)**: identificazione mittente
- **Numerazione pagine (1%)**: sistema numerazione

#### 2. DOCUMENTAZIONE MATERIALE (15%)
- **Elenco materiale (4%)**: completezza inventario
- **Stato ricevimento (3%)**: descrizione condizioni
- **Alterazioni/danni (3%)**: documentazione problemi
- **Info materiale (3%)**: metadati ricevuti
- **Chain of custody (2%)**: tracciabilità

#### 3. METODOLOGIA (25%)
- **Scopo esame (5%)**: chiarezza obiettivi
- **Approccio sistematico (6%)**: metodologia strutturata
- **Ipotesi alternative (5%)**: considerazione pro/contro
- **Sequenza esami (4%)**: logica procedimenti
- **Dettagli analisi (3%)**: specificità tecniche
- **Attrezzature (2%)**: appropriatezza strumenti

#### 4. ANALISI TECNICA (20%)
- **Parametri grafologici (5%)**: completezza parametri
- **Variazioni manoscrittura (4%)**: analisi variabilità
- **Stili scrittura (4%)**: classificazione stili
- **Processo comparazione (4%)**: metodologia confronto
- **Caratteristiche individuali (3%)**: vs. caratteristiche classe

#### 5. VALIDAZIONE (15%)
- **Peer review (5%)**: presenza revisione
- **Conferma evidenze (4%)**: validazione findings
- **Controlli qualità (3%)**: procedure QC
- **Validazione tecniche (3%)**: standard metodologici

#### 6. PRESENTAZIONE (10%)
- **Chiarezza risultati (4%)**: comprensibilità 
- **Significatività (2%)**: rilevanza contesto
- **Motivazioni (2%)**: giustificazioni opinioni
- **Tracciabilità (2%)**: documentazione processo

### Prompt Utilizzato (versione accorciata)
```
Sei un esperto forense ENFSI. Analizza questo documento secondo il framework ENFSI utilizzando i dati strutturali già identificati.

ANALISI STRUTTURALE DISPONIBILE:
[Dati della chiamata precedente]

FRAMEWORK ENFSI DETTAGLIATO - evaluta ogni sub-criterio:
[Struttura dettagliata con tutti i 39 sub-criteri]

Per ogni SUB-CRITERIO fornisci:
- Score: 0-100
- Evidence: citazione specifica dal documento (se presente)  
- Gap: cosa manca specificamente
- Severity: quanto è grave la mancanza

IMPORTANTE: Per i PROBLEMI CRITICI (score < 70 con severity "critica" o "alta"):
- Identifica max 3 problemi più gravi che compromettono la conformità ENFSI
- Per ogni problema, fornisci una RACCOMANDAZIONE SPECIFICA e ACTIONABLE che includa:
  * Step concreti da seguire
  * Riferimenti agli standard ENFSI
  * Esempio di implementazione o template
  * Risultato atteso

RISPOSTA JSON:
{
  "categories": {
    "structureInfo": {
      "overallScore": 85,
      "subcriteria": {
        "caseIdentifier": { "score": 90, "evidence": "citazione", "gap": "dettaglio mancante", "severity": "media" }
      }
    }
  },
  "criticalIssues": [...]
}
```

### Parametri Configurazione
- **Modello**: `gpt-4o`
- **Temperature**: `0.4`
- **Max tokens**: `4000`
- **Response format**: `json_object`

---

## 💡 CHIAMATA 3: Generazione Suggerimenti Actionable

### Scopo
Creare raccomandazioni specifiche prioritizzate per migliorare la conformità ENFSI

### Prompt Utilizzato
```
Basandoti sull'analisi dettagliata ENFSI, genera suggerimenti SPECIFICI e ACTIONABLE per migliorare la conformità.

DATI ANALISI:
[Risultati dell'analisi dettagliata]

CITAZIONI STRUTTURALI:
[Dati strutturali estratti]

Genera suggerimenti che siano:
1. SPECIFICI: Non generici ma basati sui gap identificati nell'analisi
2. ACTIONABLE: Con step numerati e concreti da seguire
3. PRIORITIZZATI: Ordina per impatto sulla conformità ENFSI
4. CON ESEMPI: Fornisci template/esempi pratici
5. MISURABILI: Include metriche di miglioramento attese

LINEE GUIDA RACCOMANDAZIONI:
- Ogni raccomandazione deve iniziare con un verbo d'azione
- Include riferimenti specifici agli standard ENFSI
- Fornisci step numerati: "1) [azione], 2) [azione], 3) [risultato atteso]"
- Specifica tempistiche realistiche per implementazione
- Identifica risorse/competenze necessarie

Fornisci la risposta in formato JSON strutturato:
{
  "prioritySuggestions": [
    {
      "priority": "ALTA",
      "category": "validation",
      "issue": "Mancanza di processo peer review documentato",
      "evidence": "Non è menzionata alcuna revisione tra pari",
      "recommendation": "Implementare processo peer review formale: 1) Identificare esperto qualificato...",
      "example": "Sezione template: 'PEER REVIEW - Il presente lavoro...'",
      "impact": "Aumento del punteggio di validazione da 75 a 85+"
    }
  ],
  "implementationRoadmap": {
    "immediate": ["Implementare processo peer review documentato"],
    "shortTerm": ["Aggiungere firme digitali ai documenti"], 
    "longTerm": ["Sistema qualità avanzato per validazione"]
  }
}
```

### Parametri Configurazione
- **Modello**: `gpt-4o`
- **Temperature**: `0.6` (più creativa per suggerimenti)
- **Max tokens**: `2500`
- **Response format**: `json_object`

---

## 📈 Riepilogo Performance e Costi

| Parametro | Valore |
|-----------|--------|
| **Totale chiamate per analisi** | 3 |
| **Token massimi utilizzati** | ~9,500 per analisi completa |
| **Tempo di processing** | 15-30 secondi |
| **Modello utilizzato** | GPT-4o per tutte le chiamate |
| **Approccio** | Multi-step per maggiore precisione |
| **Formato risposta** | JSON strutturato |

## 🎯 Sistema di Classificazione

Il sistema classifica automaticamente i report secondo 4 livelli:

| Classificazione | Punteggio | Descrizione | Colore |
|----------------|-----------|-------------|---------|
| **Eccellente** | 90-100% | Conformità completa agli standard ENFSI | 🟢 Verde |
| **Buono** | 75-89% | Standard rispettati, dettagli minori da migliorare | 🟡 Giallo |
| **Sufficiente** | 60-74% | Base accettabile, alcune lacune metodologiche | 🟠 Arancione |
| **Insufficiente** | <60% | Criteri fondamentali mancanti, revisioni necessarie | 🔴 Rosso |

## 🔄 Flusso del Processo

1. **Upload documento** → Sistema estrae testo (PDF, DOCX, TXT)
2. **Chiamata 1** → Analisi strutturale e estrazione citazioni
3. **Chiamata 2** → Valutazione dettagliata 39 sub-criteri ENFSI
4. **Chiamata 3** → Generazione suggerimenti actionable prioritizzati
5. **Processing** → Conversione risultati e calcolo punteggi finali
6. **Output** → Report PDF professionale con analisi completa

## 📊 Generazione Report PDF

Il sistema genera automaticamente un report PDF professionale che include:

- **Header blu con logo** e informazioni documento
- **Tabella riassuntiva punteggi** per categoria con colori e emoji
- **Sezione 1**: Analisi ENFSI dettagliata per categoria
- **Sezione 2**: Piano di miglioramento con suggerimenti prioritizzati
- **Sezione 3**: Metodologia e standard di riferimento
- **Numerazione pagine automatica**
- **Footer con timestamp** e informazioni di sistema

## 🎨 Caratteristiche Tecniche

- **Backend**: Node.js + TypeScript + Express
- **AI Integration**: OpenAI GPT-4o API
- **PDF Generation**: PDFKit con design professionale
- **Database**: PostgreSQL con Drizzle ORM
- **Authentication**: Session-based con Passport.js
- **Interfaccia**: React + TypeScript + Tailwind CSS

## 📚 Standard di Riferimento

Il sistema si basa sui seguenti standard forensi internazionali:

- **ENFSI Guideline for Evaluative Reporting in Forensic Science (2015)**
- **Best Practice Manual for the Forensic Examination of Handwriting (2018)**
- **ISO/IEC 17025:2017** - General requirements for testing and calibration laboratories

---

*Documentazione tecnica generata per GrapholexInsight v2.2.0*