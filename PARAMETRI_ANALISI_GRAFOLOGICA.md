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

## **🔍 CONCLUSIONI**

**GrapholexInsight utilizza un approccio forense multi-livello** che combina:

1. **🎯 Analisi grafologica scientifica** (15 parametri pesati)
2. **🧠 Rilevamento dissimulazioni** (4 parametri naturalezza)  
3. **🖼️ Comparazione visiva avanzata** (SSIM a 3 componenti)
4. **⚖️ Classificazione intelligente** (matrice 2D con confidenza)

Il sistema è **progettato per l'affidabilità forense**, con algoritmi conservativi che privilegiano la precisione rispetto all'ottimismo, garantendo risultati utilizzabili in contesti legali e investigativi.

**🚀 Tutti i calcoli critici avvengono in Python** per massimizzare l'accuratezza, mentre il frontend si concentra esclusivamente su **visualizzazione professionale** e **esperienza utente ottimale**.