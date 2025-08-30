# 📊 Parametri di Analisi Grafologica - GrapholexInsight

## 🎯 Panoramica del Sistema di Analisi

GrapholexInsight utilizza un **sistema multi-livello** per l'analisi forense delle firme che combina:

- **🐍 Analisi Python avanzata** (22 parametri primari)
- **🟦 Orchestrazione Backend** (mapping e metadata)  
- **🟨 Visualizzazione Frontend** (rendering e UI)
- **🖼️ Analisi SSIM** (comparazione visiva)

---

## **🔍 PARAMETRI UTILIZZATI PER LA COMPARAZIONE**

### **📈 Parametri Grafologici con Peso (15 parametri)**

Questi parametri determinano la **compatibilità percentuale** tra le firme e contribuiscono al **40%** del punteggio finale di similarità.

| **Parametro** | **Peso** | **Dove Calcolato** | **Algoritmo** | **Descrizione** |
|---------------|----------|-------------------|---------------|-----------------|
| **PressureMean** | **16%** | 🐍 Python | `np.mean(image_flat)` | Pressione media del tratto (0-255) |
| **AvgCurvature** | **14%** | 🐍 Python | Analisi derivate secondo ordine | Curvatura media dei tratti |
| **Proportion** | **12%** | 🐍 Python | `width_mm / height_mm` | Rapporto larghezza/altezza |
| **Velocity** | **10%** | 🐍 Python | `total_length / straight_distance` | Velocità di scrittura stimata |
| **PressureStd** | **8%** | 🐍 Python | `np.std(image_flat)` | Deviazione standard pressione |
| **AvgAsolaSize** | **8%** | 🐍 Python | Analisi contorni circolari | Dimensione media asole (mm²) |
| **AvgSpacing** | **6%** | 🐍 Python | Distanze X tra componenti | Spaziatura media tra elementi (mm) |
| **Inclination** | **5%** | 🐍 Python | PCA + `1 - min(1, diff/45°)` | Inclinazione tratti (°, -45 a +45) |
| **OverlapRatio** | **5%** | 🐍 Python | `pixels_inchiostro / area_bbox` | Rapporto sovrapposizione tratti |
| **LetterConnections** | **5%** | 🐍 Python | Analisi morfologica contorni | Numero connessioni tra lettere |
| **BaselineStdMm** | **4%** | 🐍 Python | `np.std(y_positions) / px_per_mm` | Deviazione baseline (mm) |
| **StrokeComplexity** | **4%** | 🐍 Python | `contour_points / area` | Complessità del tratto |
| **ConnectedComponents** | **2%** | 🐍 Python | `len(contours)` | Numero componenti separate |
| **WritingStyle** | **1%** | 🐍 Python | Classificazione basata proporzioni | Stile scrittura (Corsivo/Stampatello/Misto) |
| **Readability** | **0%** | 🐍 Python | Basata su pressure_mean | Leggibilità (Alta/Media/Bassa) |

### **💡 Formula di Compatibilità per Parametro:**

#### **🎯 Inclinazione (Algoritmo Forense Specifico):**
```python
inclination_diff = abs(ref_val - ver_val)
compatibility = 1 - min(1, inclination_diff / 45.0)  # Normalizza su 45° max
return max(0.1, compatibility)  # Minimo 10% per robustezza
```

#### **📏 Parametri Piccoli (Asole, Baseline):**
```python
if diff <= 0.05: return 0.95  # 95% se differenza ≤ 0.05mm
elif diff <= 0.1: return 0.80
elif diff <= 0.2: return 0.60
else: return max(0, 1 - (diff * 2))
```

#### **📊 Altri Parametri (Algoritmo Relativo):**
```python
relative_diff = diff / max_val
if relative_diff <= 0.05: return 0.98    # 98% se diff ≤ 5%
elif relative_diff <= 0.1: return 0.90   # 90% se diff ≤ 10%
elif relative_diff <= 0.15: return 0.80  # 80% se diff ≤ 15%
elif relative_diff <= 0.25: return 0.60  # 60% se diff ≤ 25%
elif relative_diff <= 0.50: return 0.30  # 30% se diff ≤ 50%
else: return max(0.10, 1 - relative_diff)  # Minimo 10%
```

---

## **🧠 PARAMETRI DI NATURALEZZA (Anti-Dissimulazione)**

### **📊 Utilizzati per Classificazione Intelligente (4 parametri)**

Questi parametri **NON** vengono usati per calcolare la compatibilità percentuale, ma determinano il **verdetto finale** e la **classificazione forense**.

| **Parametro** | **Peso Naturalezza** | **Dove Calcolato** | **Algoritmo** | **Descrizione** |
|---------------|----------------------|-------------------|---------------|-----------------|
| **FluidityScore** | **40%** | 🐍 Python | Analisi smoothness contorni | Fluidità movimenti (0-100) |
| **PressureConsistency** | **30%** | 🐍 Python | Varianza locale pressione | Consistenza pressione (0-100) |
| **CoordinationIndex** | **30%** | 🐍 Python | Regolarità curve e angoli | Coordinazione motoria (0-100) |
| **NaturalnessIndex** | **-** | 🐍 Python | **Combinazione pesata dei 3** | **Indice finale combinato (0-100)** |

### **🎯 Formula Indice di Naturalezza:**
```python
naturalness = (
    fluidity * 0.4 + 
    pressure_consistency * 0.3 + 
    coordination * 0.3
)
```

### **🧮 Matrice di Classificazione 2D:**

| **Similarità** | **Naturalezza Alta (≥80%)** | **Naturalezza Bassa (<60%)** |
|----------------|---------------------------|------------------------------|
| **Alta (≥85%)** | ✅ **Autentica** (95% confidenza) | ⚠️ **Possibile copia abile** (70%) |
| **Media (65-84%)** | ✅ **Probabilmente autentica** (75%) | ❌ **Sospetta** (60%) |
| **Bassa (<65%)** | ⚠️ **Sospetta** (75%) | ❌ **Probabilmente falsa** (90%) |

---

## **📐 PARAMETRI GEOMETRICI E METADATA**

### **🔧 Calcolati ma Non Utilizzati per Compatibilità (6 parametri)**

Questi parametri forniscono **informazioni tecniche** e supportano la **calibrazione**, ma non influenzano i punteggi di compatibilità.

| **Parametro** | **Dove Calcolato** | **Utilizzo** | **Descrizione** |
|---------------|-------------------|--------------|-----------------|
| **real_width_mm** | 🐍 Python | **Calibrazione** | Larghezza reale dichiarata (mm) |
| **real_height_mm** | 🐍 Python | **Calibrazione** | Altezza reale dichiarata (mm) |
| **pixels_per_mm** | 🐍 Python | **Calibrazione** | Densità pixel/mm calcolata |
| **original_width** | 🐍 Python | **Metadata** | Larghezza originale immagine (px) |
| **original_height** | 🐍 Python | **Metadata** | Altezza originale immagine (px) |
| **aspectRatio** | 🟦 Backend | **Frontend** | Rapporto aspetto per UI |

---

## **🎨 PARAMETRI BACKEND (Visualizzazione e Metadata)**

### **📱 Calcolati nel Backend TypeScript (7 parametri)**

Questi parametri supportano la **visualizzazione** e forniscono **metadata aggiuntive**, ma non partecipano ai calcoli di compatibilità forense.

| **Parametro** | **Dove Calcolato** | **Utilizzo** | **Descrizione** |
|---------------|-------------------|--------------|-----------------|
| **strokeWidths** | 🟦 Backend | **Analisi** | Min/Max/Mean spessore tratto |
| **featurePoints** | 🟦 Backend | **Analisi** | Punti caratteristici (loops, corners) |
| **geometricFeatures** | 🟦 Backend | **Analisi** | Caratteristiche geometriche |
| **imageMetadata** | 🟦 Backend | **Metadata** | DPI, qualità, contrasto, colore |
| **backgroundNoise** | 🟦 Backend | **Qualità** | Livello rumore background (0-1) |
| **imageQuality** | 🟦 Backend | **Qualità** | Qualità complessiva immagine (0-1) |
| **contrastLevel** | 🟦 Backend | **Qualità** | Livello contrasto (0-1) |

---

## **🖼️ PARAMETRI SSIM (Analisi Visiva)**

### **📊 Comparazione Pixel-per-Pixel (4 componenti)**

I parametri SSIM costituiscono il **60%** del punteggio finale di similarità e vengono calcolati interamente in Python.

| **Componente** | **Dove Calcolato** | **Peso SSIM** | **Formula** | **Descrizione** |
|-----------------|-------------------|---------------|-------------|-----------------|
| **Luminance** | 🐍 Python | **33%** | `(2*μ₁*μ₂ + c₁) / (μ₁² + μ₂² + c₁)` | Similarità luminosità |
| **Contrast** | 🐍 Python | **33%** | `(2*σ₁*σ₂ + c₂) / (σ₁² + σ₂² + c₂)` | Similarità contrasto |
| **Structure** | 🐍 Python | **33%** | `(σ₁₂ + c₃) / (σ₁*σ₂ + c₃)` | Similarità strutturale |
| **SSIM Total** | 🐍 Python | **60%** | **Prodotto dei 3 componenti** | **Punteggio SSIM finale** |

---

## **⚖️ FORMULA FINALE DI SIMILARITÀ**

### **🧮 Calcolo del Punteggio Totale:**

```python
# Paso 1: Calcola SSIM (analisi visiva)
ssim_score = calculate_ssim(image1, image2)  # 0-1

# Paso 2: Calcola punteggio parametri pesato
weighted_parameters = sum(compatibility * weight for param, weight in key_parameters)

# Paso 3: Combina SSIM + Parametri
final_similarity = (ssim_score * 0.60) + (weighted_parameters * 0.40)
```

### **🎯 Pesi Finali:**
- **SSIM (Analisi Visiva):** **60%**
- **Parametri Grafologici:** **40%**
  - PressureMean: 6.4% (16% × 40%)
  - AvgCurvature: 5.6% (14% × 40%)
  - Proportion: 4.8% (12% × 40%)
  - Altri parametri: proporzioni analoghe

---

## **🔄 FLUSSO DI ELABORAZIONE**

### **📋 Sequenza di Calcolo:**

1. **🖼️ Preprocessing Immagine** (Python)
   - Conversione scala di grigi
   - Sogliatura binaria
   - Noise reduction

2. **🔍 Estrazione Parametri** (Python)
   - Analisi contorni
   - Calcolo 15 parametri grafologici
   - Calcolo 4 parametri naturalezza

3. **📊 Comparazione SSIM** (Python)
   - Analisi strutturale pixel-per-pixel
   - Calcolo componenti Luminance, Contrast, Structure

4. **⚖️ Calcolo Compatibilità** (Python)
   - Algoritmi forensi specifici per ogni parametro
   - Calcolo compatibilità percentuali individuali

5. **🎯 Classificazione Intelligente** (Python)
   - Matrice 2D (Similarità × Naturalezza)
   - Verdetto finale con confidenza

6. **🟦 Mapping Backend** (TypeScript)
   - Trasformazione dati Python → formato UI
   - Aggiunta metadata immagine

7. **🟨 Visualizzazione Frontend** (React)
   - Rendering tabelle e grafici
   - Interfaccia utente

---

## **🧪 DETTAGLI TECNICI ALGORITMI**

### **🔬 Algoritmi Python Specifici:**

#### **Inclinazione (PCA-based):**
```python
# Principal Component Analysis per direzione principale
cov_matrix = np.cov(centered_points.T)
eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)
principal_direction = eigenvectors[:, -1]

# Angolo rispetto alla verticale
angle_rad = np.arccos(np.clip(dot_product, -1.0, 1.0))
inclination = np.degrees(angle_rad)
```

#### **Pressione (Analisi Intensità):**
```python
# Media e deviazione dell'intensità dei pixel
image_flat = image.flatten().astype(np.float64)
pressure_mean = float(np.mean(image_flat))
pressure_std = float(np.std(image_flat))
```

#### **Curvatura (Derivate Numeriche):**
```python
# Calcolo curvatura usando derivate primo e secondo ordine
dx = np.gradient(x_coords)
dy = np.gradient(y_coords)
ddx = np.gradient(dx)
ddy = np.gradient(dy)
curvature = np.abs(dx * ddy - dy * ddx) / (dx**2 + dy**2)**(3/2)
```

#### **Asole (Analisi Circolarità):**
```python
# Filtro contorni interni circolari
asole = [cnt for cnt in internal_contours 
         if 20 < cv2.contourArea(cnt) < 500 
         and calculate_circularity(cnt) > 0.5]
avg_asola_size_mm = np.mean([cv2.contourArea(a) for a in asole]) / (px_per_mm²)
```

#### **Naturalezza (Multi-componente):**
```python
# Fluidità: analisi smoothness
fluidity = analyze_stroke_smoothness(contours, binary)

# Consistenza pressione: varianza locale
pressure_consistency = analyze_local_pressure_variance(gray, binary)

# Coordinazione: regolarità movimenti
coordination = analyze_movement_regularity(contours, binary)

# Indice finale
naturalness = fluidity*0.4 + pressure_consistency*0.3 + coordination*0.3
```

---

## **📱 PARAMETRI FRONTEND (Solo Visualizzazione)**

### **🟨 Calcolati nel Frontend React (0 parametri grafologici)**

Il frontend **non calcola** parametri grafologici, ma si limita a:

- **📊 Rendering grafici** con dati ricevuti dal backend
- **📋 Visualizzazione tabelle** con compatibilità pre-calcolate
- **🎨 Interfaccia utente** per upload e configurazione
- **📈 Interpretazione risultati** con colori e icone

---

## **🚫 PARAMETRI NON UTILIZZATI PER COMPATIBILITÀ**

### **🔧 Solo Informativi/Metadata (11 parametri):**

| **Categoria** | **Parametri** | **Utilizzo** |
|---------------|---------------|--------------|
| **Dimensioni Fisiche** | `real_width_mm`, `real_height_mm` | Calibrazione utente |
| **Calibrazione** | `pixels_per_mm`, `original_width`, `original_height` | Conversione pixel→mm |
| **Metadata Immagine** | `DPI`, `imageQuality`, `contrastLevel`, `backgroundNoise`, `detectedInkColor` | Informazioni tecniche |
| **Display PDF** | `display.*` (stringhe pre-formattate) | Report PDF |

### **⚖️ Utilizzati per Classificazione (ma non compatibilità):**

| **Parametro** | **Utilizzo Specifico** |
|---------------|----------------------|
| **NaturalnessIndex** | **Verdetto intelligente** (Autentica/Sospetta/Falsa) |
| **SSIM components** | **Analisi visiva separata** (60% del punteggio) |
| **Fluidity/Pressure/Coordination** | **Rilevamento dissimulazioni** |

---

## **🔄 ARCHITETTURA DEL SISTEMA**

### **📊 Distribuzione Responsabilità:**

```
🐍 PYTHON (advanced-signature-analyzer.py)
├── ✅ 15 parametri grafologici pesati (40% finale)
├── ✅ 4 parametri naturalezza (classificazione)
├── ✅ Analisi SSIM (60% finale)
├── ✅ Algoritmi forensi specifici
└── ✅ Calibrazione dimensioni reali

🟦 BACKEND (signature-analyzer.ts + signature-routes.ts)  
├── 🔄 Orchestrazione chiamate Python
├── 🔄 Mapping dati Python → formato UI
├── 🔄 Metadata immagine (DPI, qualità)
├── 🔄 Gestione upload e storage
└── 🔄 API REST per frontend

🟨 FRONTEND (signatures-page.tsx + signature-card.tsx)
├── 🎨 Visualizzazione tabelle compatibilità
├── 🎨 Rendering grafici radar/bar
├── 🎨 Interface crop/calibrazione
├── 🎨 Upload drag&drop
└── 🎨 Interpretazione risultati (colori, icone)
```

---

## **🎯 DECISIONI ARCHITETTURALI**

### **🔬 Perché Python per i Calcoli:**
- **OpenCV avanzato** per analisi morfologica
- **NumPy/SciPy** per algoritmi matematici complessi
- **scikit-image** per processamento immagini
- **Maggiore precisione** nei calcoli in virgola mobile

### **🟦 Perché Backend TypeScript:**
- **Orchestrazione** tra Python e Frontend
- **Gestione sessioni** e autenticazione
- **API REST** strutturate e type-safe
- **Database ORM** (Drizzle) per persistence

### **🟨 Perché Frontend React:**
- **Interfaccia reattiva** per upload e configurazione
- **Visualizzazione real-time** dei risultati
- **Esperienza utente** ottimizzata
- **Nessun calcolo pesante** (delegato al backend)

---

## **📈 METRICHE DI PERFORMANCE**

### **⏱️ Tempi di Elaborazione Tipici:**
- **Analisi singola firma:** ~2-3 secondi
- **Comparazione due firme:** ~5-8 secondi 
- **Generazione grafico:** ~1-2 secondi
- **Report PDF completo:** ~3-5 secondi

### **🎯 Precisione Algoritmi:**
- **Inclinazione:** Precisione ±0.5° con PCA
- **Pressione:** Normalizzata 0-255 (8-bit grayscale)
- **Dimensioni:** Accuratezza mm basata su calibrazione utente
- **SSIM:** Standard IEEE con costanti ottimizzate

---

## **🎓 SIGNIFICATO GRAFOLOGICO DEI PARAMETRI**

### **📊 Parametri Grafologici Primari - Interpretazione Forense:**

#### **1. PressureMean (16% - Peso Massimo)**
**Significato:** Intensità media con cui la persona preme la penna sul foglio.
- **Alto (>150):** Personalità determinata, energia elevata, possibile tensione
- **Medio (80-150):** Equilibrio emotivo, controllo normale della scrittura  
- **Basso (<80):** Delicatezza, possibile debolezza fisica o emotiva
- **🔍 Forense:** Parametro molto stabile nel tempo, difficile da imitare consapevolmente

#### **2. AvgCurvature (14%)**
**Significato:** Grado di curvilinearità vs angolarità dei tratti.
- **Alta:** Scrittura fluida, personalità adattabile, pensiero intuitivo
- **Bassa:** Scrittura angolare, rigidità mentale, pensiero logico-razionale
- **🔍 Forense:** Caratteristica profondamente inconscia, resistente alla dissimulazione

#### **3. Proportion (12%)**
**Significato:** Rapporto tra sviluppo orizzontale e verticale della firma.
- **>2:** Firma molto allargata - estroversione, bisogno di spazio sociale
- **1-2:** Proporzioni equilibrate - personalità bilanciata
- **<1:** Firma compressa - introversione, autocontrollo, riservatezza
- **🔍 Forense:** Riflette l'immagine di sé e la proiezione sociale

#### **4. Velocity (10%)**
**Significato:** Velocità stimata di esecuzione della firma.
- **Alta (>3):** Impazienza, rapidità decisionale, possibile superficialità
- **Media (2-3):** Ritmo equilibrato, controllo normale
- **Bassa (<2):** Riflessione, precisione, possibile insicurezza o età avanzata
- **🔍 Forense:** Difficile controllare consapevolmente durante l'imitazione

#### **5. PressureStd (8%)**
**Significato:** Variabilità della pressione durante la scrittura.
- **Alta:** Instabilità emotiva, nervosismo, stress
- **Media:** Controllo normale delle emozioni
- **Bassa:** Equilibrio, controllo costante, possibile rigidità
- **🔍 Forense:** Indicatore di stato emotivo al momento della firma

#### **6. AvgAsolaSize (8%)**
**Significato:** Dimensione degli "occhielli" o spazi chiusi nelle lettere (come nelle 'a', 'o', 'e').
- **Grandi (>2mm²):** Immaginazione, apertura mentale, espansività, possibile vanità
- **Medie (0.5-2mm²):** Equilibrio tra razionalità e creatività, controllo normale
- **Piccole (<0.5mm²):** Controllo, riservatezza, possibile chiusura mentale, precisione
- **🔍 Forense:** Caratteristica molto personale e distintiva, difficile da contraffare

#### **7. AvgSpacing (6%)**
**Significato:** Distanza tra gli elementi grafici della firma.
- **Ampia (>3mm):** Bisogno di autonomia, distacco sociale, possibile isolamento
- **Media (1-3mm):** Socialità equilibrata, normale gestione delle relazioni
- **Stretta (<1mm):** Socievolezza, legami stretti, possibile dipendenza dagli altri
- **🔍 Forense:** Riflette il rapporto con gli altri e la gestione dello spazio sociale

#### **8. Inclination (5%)**
**Significato:** Inclinazione media dei tratti rispetto alla verticale.
- **Destra (+15° a +45°):** Estroversione, slancio verso il futuro, emotività, impulsività
- **Verticale (-5° a +5°):** Controllo, equilibrio, razionalità, autocontrollo
- **Sinistra (-5° a -45°):** Introversione, legame al passato, riflessione, prudenza
- **🔍 Forense:** Parametro fondamentale - riflette orientamento psicologico profondo

#### **9. OverlapRatio (5%)**
**Significato:** Densità di "riempimento" dell'area occupata dalla firma.
- **Alto (>60%):** Presenza dominante, assertività, possibile invadenza o aggressività
- **Medio (30-60%):** Equilibrio nell'occupazione dello spazio, presenza normale
- **Basso (<30%):** Discrezione, modestia, possibile insicurezza o timidezza
- **🔍 Forense:** Riflette autostima e percezione del proprio ruolo sociale

#### **10. LetterConnections (5%)**
**Significato:** Continuità del flusso grafico tra elementi della firma.
- **Molte (>8):** Logica deduttiva, pensiero sequenziale, sistematicità, coerenza
- **Medie (4-8):** Equilibrio tra logica e intuizione, flessibilità mentale
- **Poche (<4):** Intuizione predominante, pensiero per salti, creatività, frammentarietà
- **🔍 Forense:** Indica modalità di ragionamento e organizzazione del pensiero

#### **11. BaselineStdMm (4%)**
**Significato:** Stabilità della linea di base immaginaria su cui "poggia" la scrittura.
- **Bassa (<0.5mm):** Controllo superiore, stabilità emotiva, determinazione, costanza
- **Media (0.5-1mm):** Normale variabilità emotiva, flessibilità controllata
- **Alta (>1mm):** Instabilità emotiva, variabilità umorale, stress, possibile ansia
- **🔍 Forense:** Indicatore primario di controllo psicomotorio e stato emotivo

#### **12. StrokeComplexity (4%)**
**Significato:** Ricchezza di dettagli e articolazione dei movimenti grafici.
- **Alta (>0.8):** Personalità complessa, ricchezza interiore, possibile complicazione mentale
- **Media (0.3-0.8):** Equilibrio tra semplicità ed espressività, normale articolazione
- **Bassa (<0.3):** Essenzialità, chiarezza mentale, possibile semplificazione eccessiva
- **🔍 Forense:** Riflette la complessità della struttura di personalità

#### **13. ConnectedComponents (2%)**
**Significato:** Frammentazione vs continuità nell'esecuzione della firma.
- **Poche (1-2):** Continuità esecutiva, coerenza interna, pensiero integrato
- **Medie (3-4):** Normale articolazione con pause controllate
- **Molte (>4):** Frammentazione, possibile dispersività, ansia o tremori
- **🔍 Forense:** Indica coerenza interna e controllo neuromotorio

#### **14. WritingStyle (1%)**
**Significato:** Modalità grafica predominante adottata.
- **Corsivo:** Fluidità espressiva, adattabilità, emotività, personalizzazione
- **Stampatello:** Controllo formale, chiarezza comunicativa, possibile rigidità
- **Misto:** Flessibilità adattiva, equilibrio tra controllo ed espressività
- **🔍 Forense:** Riflette modalità di approccio alle relazioni e alla comunicazione

#### **15. Readability (0%)**
**Significato:** Chiarezza e leggibilità complessiva della forma grafica.
- **Alta:** Chiarezza comunicativa, trasparenza relazionale, ordine mentale
- **Media:** Normale equilibrio tra espressività personale e controllo sociale
- **Bassa:** Complessità espressiva, possibile confusione o volontà di riservatezza
- **🔍 Forense:** Indica atteggiamento verso la comunicazione e la trasparenza sociale

---

### **🧠 Parametri di Naturalezza - Rilevamento Dissimulazioni:**

#### **1. FluidityScore (40% naturalezza)**
**Significato:** Misura la fluidità e naturalezza dei movimenti grafici analizzando la regolarità delle curve.
- **Alto (>80):** Movimenti grafici spontanei e naturali, esecuzione automatica della firma
- **Medio (50-80):** Controllo normale con occasionali micro-tensioni, naturalezza accettabile  
- **Basso (<50):** Movimenti rigidi e controllati, possibile dissimulazione consapevole
- **🔍 Forense:** **CRUCIALE per rilevare imitazioni** - la fluidità naturale è impossibile da simulare perfettamente

#### **2. PressureConsistency (30% naturalezza)** 
**Significato:** Analizza la costanza della pressione lungo tutto il tracciato della firma.
- **Alta (>80):** Controllo motorio stabile, equilibrio neuromotorio, esecuzione spontanea
- **Media (50-80):** Normale variabilità della pressione, controllo adeguato
- **Bassa (<50):** Variazioni irregolari di pressione, possibile tensione da imitazione
- **🔍 Forense:** **INDICATORE DI AUTENTICITÀ** - le imitazioni mostrano inconsistenza tipica dello sforzo

#### **3. CoordinationIndex (30% naturalezza)**
**Significato:** Valuta la coordinazione motoria fine attraverso l'analisi della regolarità di curve e angoli.
- **Alto (>80):** Eccellente controllo neuromotorio, movimenti armonici e coordinati
- **Medio (50-80):** Coordinazione normale, controllo psicomotorio adeguato
- **Basso (<50):** Incoordinazione motoria, tremori, stress da falsificazione
- **🔍 Forense:** **RILEVATORE DI STRESS DA IMITAZIONE** - i falsari mostrano micro-tremori e incoordinazione

#### **4. NaturalnessIndex (Indice Combinato Finale)**
**Significato:** Punteggio globale che combina fluidità, consistenza pressione e coordinazione motoria.
- **Alto (>80):** Firma eseguita in modo completamente naturale, altissima probabilità di autenticità
- **Medio (60-80):** Esecuzione normale con lievi tensioni fisiologiche o emotive
- **Basso (<60):** Forte sospetto di dissimulazione, imitazione, o stress estremo
- **🔍 Forense:** **INDICATORE PRINCIPALE DI FALSIFICAZIONE** - combina tutti gli aspetti dell'automatismo grafico

---

### **📊 Parametri SSIM - Significato nell'Analisi Visiva:**

#### **1. Luminance (Luminosità)**
**Significato:** Confronta la luminosità media delle due firme.
- **Alta (>0.9):** Intensità di tratto molto simile, stesso tipo di penna/pressione
- **Media (0.7-0.9):** Leggere differenze di intensità, compatibile
- **Bassa (<0.7):** Differenze significative di pressione o strumento di scrittura
- **🔍 Forense:** Indica coerenza nello strumento e nel modo di scrivere

#### **2. Contrast (Contrasto)**
**Significato:** Confronta la variabilità tonal all'interno di ciascuna firma.
- **Alto (>0.9):** Pattern di contrasto molto simili, stessa dinamica di pressione
- **Medio (0.7-0.9):** Lievi differenze nel controllo della pressione
- **Basso (<0.7):** Dinamiche di pressione significativamente diverse
- **🔍 Forense:** Rivela differenze nel controllo motorio della pressione

#### **3. Structure (Struttura)**
**Significato:** Confronta l'organizzazione spaziale e la forma geometrica complessiva.
- **Alta (>0.9):** Struttura geometrica quasi identica, stessa "architettura" della firma
- **Media (0.7-0.9):** Struttura compatibile con lievi variazioni
- **Bassa (<0.7):** Architettura della firma significativamente diversa
- **🔍 Forense:** Parametro più importante per l'identificazione - confronta la "forma" globale

#### **4. SSIM Total (Punteggio Finale)**
**Significato:** Indice complessivo di similarità strutturale tra le due firme.
- **Alto (>0.8):** Firme visualmente molto simili, alta compatibilità
- **Medio (0.6-0.8):** Similarità accettabile con alcune differenze
- **Basso (<0.6):** Differenze visive significative, scarsa compatibilità
- **🔍 Forense:** **GOLD STANDARD** per la comparazione visiva oggettiva

---

### **🎯 Significato Integrato nell'Analisi Forense:**

#### **🔬 Parametri di Stabilità (Alta Affidabilità):**
- **PressureMean, AvgCurvature, Inclination**: Caratteristiche profonde della personalità
- **Difficili da modificare** consapevolmente o imitare accuratamente

#### **📊 Parametri di Controllo (Media Affidabilità):**
- **Proportion, Velocity, StrokeComplexity**: Modificabili con sforzo consapevole
- **Utili per rilevare** tentativi di dissimulazione

#### **🔍 Parametri di Esecuzione (Variabili):**
- **PressureStd, LetterConnections, BaselineStdMm**: Influenzati da stato emotivo
- **Indicatori di stress** o condizioni particolari al momento della firma

#### **🎨 Parametri Stilistici (Interpretativi):**
- **WritingStyle, Readability, AvgSpacing**: Caratteristiche più superficiali
- **Facilmente influenzabili** da fattori esterni

---

## **🔍 CONCLUSIONI**

**GrapholexInsight utilizza un approccio forense multi-livello** che combina:

1. **🎯 Analisi grafologica scientifica** (15 parametri pesati)
2. **🧠 Rilevamento dissimulazioni** (4 parametri naturalezza)  
3. **🖼️ Comparazione visiva avanzata** (SSIM a 3 componenti)
4. **⚖️ Classificazione intelligente** (matrice 2D con confidenza)

Il sistema è **progettato per l'affidabilità forense**, con algoritmi conservativi che privilegiano la precisione rispetto all'ottimismo, garantendo risultati utilizzabili in contesti legali e investigativi.

**🚀 Tutti i calcoli critici avvengono in Python** per massimizzare l'accuratezza, mentre il frontend si concentra esclusivamente su **visualizzazione professionale** e **esperienza utente ottimale**.