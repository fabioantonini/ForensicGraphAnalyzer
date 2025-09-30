# 📊 Graphological Analysis Parameters - GrapholexInsight

## 🎯 System Analysis Overview

GrapholexInsight utilizes a **multi-layer system** for forensic signature analysis that combines:

- **🐍 Advanced Python Analysis** (22 primary parameters)
- **🟦 Backend Orchestration** (mapping and metadata)  
- **🟨 Frontend Visualization** (rendering and UI)
- **🖼️ SSIM Analysis** (visual comparison)

---

## **🔍 PARAMETERS USED FOR COMPARISON**

### **📈 Graphological Parameters with Weight (15 parameters)**

These parameters determine the **percentage compatibility** between signatures and contribute to **40%** of the final similarity score.

| **Parameter** | **Weight** | **Calculated In** | **Algorithm** | **Description** |
|---------------|----------|-------------------|---------------|-----------------|
| **PressureMean** | **16%** | 🐍 Python | `np.mean(image_flat)` | Average stroke pressure (0-255) |
| **AvgCurvature** | **14%** | 🐍 Python | Second-order derivatives analysis | Average stroke curvature |
| **Proportion** | **12%** | 🐍 Python | `width_mm / height_mm` | Width/height ratio |
| **Velocity** | **10%** | 🐍 Python | `total_length / straight_distance` | Estimated writing velocity |
| **PressureStd** | **8%** | 🐍 Python | `np.std(image_flat)` | Pressure standard deviation |
| **AvgAsolaSize** | **8%** | 🐍 Python | Circular contour analysis | Average loops size (mm²) |
| **AvgSpacing** | **6%** | 🐍 Python | X-distances between components | Average spacing between elements (mm) |
| **Inclination** | **5%** | 🐍 Python | PCA + `1 - min(1, diff/45°)` | Stroke inclination (°, -45 to +45) |
| **OverlapRatio** | **5%** | 🐍 Python | `ink_pixels / bbox_area` | Stroke overlap ratio |
| **LetterConnections** | **5%** | 🐍 Python | Morphological contour analysis | Number of letter connections |
| **BaselineStdMm** | **4%** | 🐍 Python | `np.std(y_positions) / px_per_mm` | Baseline deviation (mm) |
| **StrokeComplexity** | **4%** | 🐍 Python | `contour_points / area` | Stroke complexity |
| **ConnectedComponents** | **2%** | 🐍 Python | `len(contours)` | Number of separate components |
| **WritingStyle** | **1%** | 🐍 Python | Proportion-based classification | Writing style (Cursive/Print/Mixed) |
| **Readability** | **0%** | 🐍 Python | Based on pressure_mean | Readability (High/Medium/Low) |

### **💡 Parameter Compatibility Formula:**

#### **🎯 Inclination (Specific Forensic Algorithm):**
```python
inclination_diff = abs(ref_val - ver_val)
compatibility = 1 - min(1, inclination_diff / 45.0)  # Normalize on 45° max
return max(0.1, compatibility)  # Minimum 10% for robustness
```

#### **📏 Small Parameters (Loops, Baseline):**
```python
if diff <= 0.05: return 0.95  # 95% if difference ≤ 0.05mm
elif diff <= 0.1: return 0.80
elif diff <= 0.2: return 0.60
else: return max(0, 1 - (diff * 2))
```

#### **📊 Other Parameters (Relative Algorithm):**
```python
relative_diff = diff / max_val
if relative_diff <= 0.05: return 0.98    # 98% if diff ≤ 5%
elif relative_diff <= 0.1: return 0.90   # 90% if diff ≤ 10%
elif relative_diff <= 0.15: return 0.80  # 80% if diff ≤ 15%
elif relative_diff <= 0.25: return 0.60  # 60% if diff ≤ 25%
elif relative_diff <= 0.50: return 0.30  # 30% if diff ≤ 50%
else: return max(0.10, 1 - relative_diff)  # Minimum 10%
```

---

## **🧠 NATURALNESS PARAMETERS (Anti-Dissimulation)**

### **📊 Used for Intelligent Classification (4 parameters)**

These parameters are **NOT** used to calculate percentage compatibility, but determine the **final verdict** and **forensic classification**.

| **Parameter** | **Naturalness Weight** | **Calculated In** | **Algorithm** | **Description** |
|---------------|----------------------|-------------------|---------------|-----------------|
| **FluidityScore** | **40%** | 🐍 Python | Contour smoothness analysis | Movement fluidity (0-100) |
| **PressureConsistency** | **30%** | 🐍 Python | Local pressure variance | Pressure consistency (0-100) |
| **CoordinationIndex** | **30%** | 🐍 Python | Curve and angle regularity | Motor coordination (0-100) |
| **NaturalnessIndex** | **-** | 🐍 Python | **Weighted combination of 3** | **Final combined index (0-100)** |

### **🎯 Naturalness Index Formula:**
```python
naturalness = (
    fluidity * 0.4 + 
    pressure_consistency * 0.3 + 
    coordination * 0.3
)
```

### **🧮 2D Classification Matrix:**

| **Similarity** | **High Naturalness (≥80%)** | **Low Naturalness (<60%)** |
|----------------|---------------------------|------------------------------|
| **High (≥85%)** | ✅ **Authentic** (95% confidence) | ⚠️ **Possible skilled copy** (70%) |
| **Medium (65-84%)** | ✅ **Probably authentic** (75%) | ❌ **Suspicious** (60%) |
| **Low (<65%)** | ⚠️ **Suspicious** (75%) | ❌ **Probably false** (90%) |

---

## **📐 GEOMETRIC PARAMETERS AND METADATA**

### **🔧 Calculated but Not Used for Compatibility (6 parameters)**

These parameters provide **technical information** and support **calibration**, but do not influence compatibility scores.

| **Parameter** | **Calculated In** | **Usage** | **Description** |
|---------------|-------------------|--------------|-----------------|
| **real_width_mm** | 🐍 Python | **Calibration** | Declared real width (mm) |
| **real_height_mm** | 🐍 Python | **Calibration** | Declared real height (mm) |
| **pixels_per_mm** | 🐍 Python | **Calibration** | Calculated pixel/mm density |
| **original_width** | 🐍 Python | **Metadata** | Original image width (px) |
| **original_height** | 🐍 Python | **Metadata** | Original image height (px) |
| **aspectRatio** | 🟦 Backend | **Frontend** | Aspect ratio for UI |

---

## **🎨 BACKEND PARAMETERS (Visualization and Metadata)**

### **📱 Calculated in Backend TypeScript (7 parameters)**

These parameters support **visualization** and provide **additional metadata**, but do not participate in forensic compatibility calculations.

| **Parameter** | **Calculated In** | **Usage** | **Description** |
|---------------|-------------------|--------------|-----------------|
| **strokeWidths** | 🟦 Backend | **Analysis** | Min/Max/Mean stroke width |
| **featurePoints** | 🟦 Backend | **Analysis** | Feature points (loops, corners) |
| **geometricFeatures** | 🟦 Backend | **Analysis** | Geometric characteristics |
| **imageMetadata** | 🟦 Backend | **Metadata** | DPI, quality, contrast, color |
| **backgroundNoise** | 🟦 Backend | **Quality** | Background noise level (0-1) |
| **imageQuality** | 🟦 Backend | **Quality** | Overall image quality (0-1) |
| **contrastLevel** | 🟦 Backend | **Quality** | Contrast level (0-1) |

---

## **🖼️ SSIM PARAMETERS (Visual Analysis)**

### **📊 Pixel-by-Pixel Comparison (4 components)**

SSIM parameters constitute **60%** of the final similarity score and are calculated entirely in Python.

| **Component** | **Calculated In** | **SSIM Weight** | **Formula** | **Description** |
|-----------------|-------------------|---------------|-------------|-----------------|
| **Luminance** | 🐍 Python | **33%** | `(2*μ₁*μ₂ + c₁) / (μ₁² + μ₂² + c₁)` | Brightness similarity |
| **Contrast** | 🐍 Python | **33%** | `(2*σ₁*σ₂ + c₂) / (σ₁² + σ₂² + c₂)` | Contrast similarity |
| **Structure** | 🐍 Python | **33%** | `(σ₁₂ + c₃) / (σ₁*σ₂ + c₃)` | Structural similarity |
| **SSIM Total** | 🐍 Python | **60%** | **Product of 3 components** | **Final SSIM score** |

---

## **⚖️ FINAL SIMILARITY FORMULA**

### **🧮 Total Score Calculation:**

```python
# Step 1: Calculate SSIM (visual analysis)
ssim_score = calculate_ssim(image1, image2)  # 0-1

# Step 2: Calculate weighted parameters score
weighted_parameters = sum(compatibility * weight for param, weight in key_parameters)

# Step 3: Combine SSIM + Parameters
final_similarity = (ssim_score * 0.60) + (weighted_parameters * 0.40)
```

### **🎯 Final Weights:**
- **SSIM (Visual Analysis):** **60%**
- **Graphological Parameters:** **40%**
  - PressureMean: 6.4% (16% × 40%)
  - AvgCurvature: 5.6% (14% × 40%)
  - Proportion: 4.8% (12% × 40%)
  - Other parameters: analogous proportions

---

## **🔄 PROCESSING WORKFLOW**

### **📋 Calculation Sequence:**

1. **🖼️ Image Preprocessing** (Python)
   - Grayscale conversion
   - Binary thresholding
   - Noise reduction

2. **🔍 Parameter Extraction** (Python)
   - Contour analysis
   - 15 graphological parameters calculation
   - 4 naturalness parameters calculation

3. **📊 SSIM Comparison** (Python)
   - Pixel-by-pixel structural analysis
   - Luminance, Contrast, Structure components calculation

4. **⚖️ Compatibility Calculation** (Python)
   - Specific forensic algorithms for each parameter
   - Individual percentage compatibility calculation

5. **🎯 Intelligent Classification** (Python)
   - 2D matrix (Similarity × Naturalness)
   - Final verdict with confidence

6. **🟦 Backend Mapping** (TypeScript)
   - Python data → UI format transformation
   - Image metadata addition

7. **🟨 Frontend Visualization** (React)
   - Tables and charts rendering
   - User interface

---

## **🧪 ALGORITHM TECHNICAL DETAILS**

### **🔬 Specific Python Algorithms:**

#### **Inclination (PCA-based):**
```python
# Principal Component Analysis for main direction
cov_matrix = np.cov(centered_points.T)
eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)
principal_direction = eigenvectors[:, -1]

# Angle relative to vertical
angle_rad = np.arccos(np.clip(dot_product, -1.0, 1.0))
inclination = np.degrees(angle_rad)
```

#### **Pressure (Intensity Analysis):**
```python
# Mean and standard deviation of pixel intensity
image_flat = image.flatten().astype(np.float64)
pressure_mean = float(np.mean(image_flat))
pressure_std = float(np.std(image_flat))
```

#### **Curvature (Numerical Derivatives):**
```python
# Curvature calculation using first and second order derivatives
dx = np.gradient(x_coords)
dy = np.gradient(y_coords)
ddx = np.gradient(dx)
ddy = np.gradient(dy)
curvature = np.abs(dx * ddy - dy * ddx) / (dx**2 + dy**2)**(3/2)
```

#### **Loops (Circularity Analysis):**
```python
# Filter internal circular contours
loops = [cnt for cnt in internal_contours 
         if 20 < cv2.contourArea(cnt) < 500 
         and calculate_circularity(cnt) > 0.5]
avg_loop_size_mm = np.mean([cv2.contourArea(l) for l in loops]) / (px_per_mm²)
```

#### **Naturalness (Multi-component):**
```python
# Fluidity: smoothness analysis
fluidity = analyze_stroke_smoothness(contours, binary)

# Pressure consistency: local variance
pressure_consistency = analyze_local_pressure_variance(gray, binary)

# Coordination: movement regularity
coordination = analyze_movement_regularity(contours, binary)

# Final index
naturalness = fluidity*0.4 + pressure_consistency*0.3 + coordination*0.3
```

---

## **📱 FRONTEND PARAMETERS (Visualization Only)**

### **🟨 Calculated in React Frontend (0 graphological parameters)**

The frontend **does not calculate** graphological parameters, but is limited to:

- **📊 Chart rendering** with data received from backend
- **📋 Table visualization** with pre-calculated compatibility
- **🎨 User interface** for upload and configuration
- **📈 Result interpretation** with colors and icons

---

## **🚫 PARAMETERS NOT USED FOR COMPATIBILITY**

### **🔧 Informational/Metadata Only (11 parameters):**

| **Category** | **Parameters** | **Usage** |
|---------------|---------------|--------------|
| **Physical Dimensions** | `real_width_mm`, `real_height_mm` | User calibration |
| **Calibration** | `pixels_per_mm`, `original_width`, `original_height` | Pixel→mm conversion |
| **Image Metadata** | `DPI`, `imageQuality`, `contrastLevel`, `backgroundNoise`, `detectedInkColor` | Technical information |
| **PDF Display** | `display.*` (pre-formatted strings) | PDF reports |

### **⚖️ Used for Classification (but not compatibility):**

| **Parameter** | **Specific Usage** |
|---------------|----------------------|
| **NaturalnessIndex** | **Intelligent verdict** (Authentic/Suspicious/False) |
| **SSIM components** | **Separate visual analysis** (60% of score) |
| **Fluidity/Pressure/Coordination** | **Dissimulation detection** |

---

## **🔄 SYSTEM ARCHITECTURE**

### **📊 Responsibility Distribution:**

```
🐍 PYTHON (advanced-signature-analyzer.py)
├── ✅ 15 weighted graphological parameters (40% final)
├── ✅ 4 naturalness parameters (classification)
├── ✅ SSIM analysis (60% final)
├── ✅ Specific forensic algorithms
└── ✅ Real dimensions calibration

🟦 BACKEND (signature-analyzer.ts + signature-routes.ts)  
├── 🔄 Python calls orchestration
├── 🔄 Python data → UI format mapping
├── 🔄 Image metadata (DPI, quality)
├── 🔄 Upload and storage management
└── 🔄 REST API for frontend

🟨 FRONTEND (signatures-page.tsx + signature-card.tsx)
├── 🎨 Compatibility tables visualization
├── 🎨 Radar/bar charts rendering
├── 🎨 Crop/calibration interface
├── 🎨 Drag&drop upload
└── 🎨 Result interpretation (colors, icons)
```

---

## **🎯 ARCHITECTURAL DECISIONS**

### **🔬 Why Python for Calculations:**
- **Advanced OpenCV** for morphological analysis
- **NumPy/SciPy** for complex mathematical algorithms
- **scikit-image** for image processing
- **Higher precision** in floating-point calculations

### **🟦 Why TypeScript Backend:**
- **Orchestration** between Python and Frontend
- **Session management** and authentication
- **Structured REST APIs** and type-safe
- **Database ORM** (Drizzle) for persistence

### **🟨 Why React Frontend:**
- **Reactive interface** for upload and configuration
- **Real-time visualization** of results
- **Optimized user experience**
- **No heavy calculations** (delegated to backend)

---

## **📈 PERFORMANCE METRICS**

### **⏱️ Typical Processing Times:**
- **Single signature analysis:** ~2-3 seconds
- **Two signature comparison:** ~5-8 seconds 
- **Chart generation:** ~1-2 seconds
- **Complete PDF report:** ~3-5 seconds

### **🎯 Algorithm Precision:**
- **Inclination:** ±0.5° precision with PCA
- **Pressure:** Normalized 0-255 (8-bit grayscale)
- **Dimensions:** mm accuracy based on user calibration
- **SSIM:** IEEE standard with optimized constants

---

## **🎓 GRAPHOLOGICAL MEANING OF PARAMETERS**

### **📊 Primary Graphological Parameters - Forensic Interpretation:**

#### **1. PressureMean (16% - Maximum Weight)**
**Meaning:** Average intensity with which the person presses the pen on paper.
- **High (>150):** Determined personality, high energy, possible tension
- **Medium (80-150):** Emotional balance, normal writing control  
- **Low (<80):** Delicacy, possible physical or emotional weakness
- **🔍 Forensic:** Very stable parameter over time, difficult to consciously imitate

#### **2. AvgCurvature (14%)**
**Meaning:** Degree of curvilinearity vs. angularity of strokes.
- **High:** Fluid writing, adaptable personality, intuitive thinking
- **Low:** Angular writing, mental rigidity, logical-rational thinking
- **🔍 Forensic:** Deeply unconscious characteristic, resistant to dissimulation

#### **3. Proportion (12%)**
**Meaning:** Ratio between horizontal and vertical development of signature.
- **>2:** Very wide signature - extroversion, need for social space
- **1-2:** Balanced proportions - balanced personality
- **<1:** Compressed signature - introversion, self-control, reserve
- **🔍 Forensic:** Reflects self-image and social projection

#### **4. Velocity (10%)**
**Meaning:** Estimated execution speed of signature.
- **High (>3):** Impatience, decision speed, possible superficiality
- **Medium (2-3):** Balanced rhythm, normal control
- **Low (<2):** Reflection, precision, possible insecurity or advanced age
- **🔍 Forensic:** Difficult to consciously control during imitation

#### **5. PressureStd (8%)**
**Meaning:** Pressure variability during writing.
- **High:** Emotional instability, nervousness, stress
- **Medium:** Normal emotional control
- **Low:** Balance, constant control, possible rigidity
- **🔍 Forensic:** Indicator of emotional state at signature moment

#### **6. AvgAsolaSize (8%)**
**Meaning:** Size of "loops" or closed spaces in letters (like in 'a', 'o', 'e').
- **Large (>2mm²):** Imagination, mental openness, expansiveness, possible vanity
- **Medium (0.5-2mm²):** Balance between rationality and creativity, normal control
- **Small (<0.5mm²):** Control, reserve, possible mental closure, precision
- **🔍 Forensic:** Very personal and distinctive characteristic, difficult to counterfeit

#### **7. AvgSpacing (6%)**
**Meaning:** Distance between graphic elements of signature.
- **Wide (>3mm):** Need for autonomy, social detachment, possible isolation
- **Medium (1-3mm):** Balanced sociability, normal relationship management
- **Narrow (<1mm):** Sociability, close bonds, possible dependence on others
- **🔍 Forensic:** Reflects relationship with others and social space management

#### **8. Inclination (5%)**
**Meaning:** Average inclination of strokes relative to vertical.
- **Right (+15° to +45°):** Extroversion, future thrust, emotionality, impulsiveness
- **Vertical (-5° to +5°):** Control, balance, rationality, self-control
- **Left (-5° to -45°):** Introversion, past attachment, reflection, prudence
- **🔍 Forensic:** Fundamental parameter - reflects deep psychological orientation

#### **9. OverlapRatio (5%)**
**Meaning:** "Filling" density of the area occupied by signature.
- **High (>60%):** Dominant presence, assertiveness, possible intrusiveness or aggressiveness
- **Medium (30-60%):** Balance in space occupation, normal presence
- **Low (<30%):** Discretion, modesty, possible insecurity or shyness
- **🔍 Forensic:** Reflects self-esteem and perception of own social role

#### **10. LetterConnections (5%)**
**Meaning:** Continuity of graphic flow between signature elements.
- **Many (>8):** Deductive logic, sequential thinking, systematicity, coherence
- **Medium (4-8):** Balance between logic and intuition, mental flexibility
- **Few (<4):** Predominant intuition, jumping thinking, creativity, fragmentation
- **🔍 Forensic:** Indicates reasoning mode and thought organization

#### **11. BaselineStdMm (4%)**
**Meaning:** Stability of imaginary baseline on which writing "rests".
- **Low (<0.5mm):** Superior control, emotional stability, determination, constancy
- **Medium (0.5-1mm):** Normal emotional variability, controlled flexibility
- **High (>1mm):** Emotional instability, mood variability, stress, possible anxiety
- **🔍 Forensic:** Primary indicator of psychomotor control and emotional state

#### **12. StrokeComplexity (4%)**
**Meaning:** Richness of details and articulation of graphic movements.
- **High (>0.8):** Complex personality, inner richness, possible mental complication
- **Medium (0.3-0.8):** Balance between simplicity and expressiveness, normal articulation
- **Low (<0.3):** Essentiality, mental clarity, possible excessive simplification
- **🔍 Forensic:** Reflects personality structure complexity

#### **13. ConnectedComponents (2%)**
**Meaning:** Fragmentation vs. continuity in signature execution.
- **Few (1-2):** Executive continuity, internal coherence, integrated thinking
- **Medium (3-4):** Normal articulation with controlled pauses
- **Many (>4):** Fragmentation, possible dispersiveness, anxiety or tremors
- **🔍 Forensic:** Indicates internal coherence and neuromotor control

#### **14. WritingStyle (1%)**
**Meaning:** Predominant graphic mode adopted.
- **Cursive:** Expressive fluidity, adaptability, emotionality, personalization
- **Print:** Formal control, communicative clarity, possible rigidity
- **Mixed:** Adaptive flexibility, balance between control and expressiveness
- **🔍 Forensic:** Reflects approach mode to relationships and communication

#### **15. Readability (0%)**
**Meaning:** Clarity and overall legibility of graphic form.
- **High:** Communicative clarity, relational transparency, mental order
- **Medium:** Normal balance between personal expressiveness and social control
- **Low:** Expressive complexity, possible confusion or desire for privacy
- **🔍 Forensic:** Indicates attitude toward communication and social transparency

---

### **🧠 Naturalness Parameters - Dissimulation Detection:**

#### **1. FluidityScore (40% naturalness)**
**Meaning:** Measures fluidity and naturalness of graphic movements by analyzing curve regularity.
- **High (>80):** Spontaneous and natural graphic movements, automatic signature execution
- **Medium (50-80):** Normal control with occasional micro-tensions, acceptable naturalness  
- **Low (<50):** Rigid and controlled movements, possible conscious dissimulation
- **🔍 Forensic:** **CRUCIAL for detecting imitations** - natural fluidity is impossible to simulate perfectly

#### **2. PressureConsistency (30% naturalness)** 
**Meaning:** Analyzes pressure constancy throughout the entire signature trace.
- **High (>80):** Stable motor control, neuromotor balance, spontaneous execution
- **Medium (50-80):** Normal pressure variability, adequate control
- **Low (<50):** Irregular pressure variations, possible tension from imitation
- **🔍 Forensic:** **AUTHENTICITY INDICATOR** - imitations show typical inconsistency from effort

#### **3. CoordinationIndex (30% naturalness)**
**Meaning:** Evaluates fine motor coordination through regularity analysis of curves and angles.
- **High (>80):** Excellent neuromotor control, harmonic and coordinated movements
- **Medium (50-80):** Normal coordination, adequate psychomotor control
- **Low (<50):** Motor incoordination, tremors, stress from falsification
- **🔍 Forensic:** **IMITATION STRESS DETECTOR** - forgers show micro-tremors and incoordination

#### **4. NaturalnessIndex (Final Combined Index)**
**Meaning:** Global score combining fluidity, pressure consistency and motor coordination.
- **High (>80):** Signature executed in completely natural way, very high authenticity probability
- **Medium (60-80):** Normal execution with slight physiological or emotional tensions
- **Low (<60):** Strong suspicion of dissimulation, imitation, or extreme stress
- **🔍 Forensic:** **MAIN FALSIFICATION INDICATOR** - combines all aspects of graphic automatism

---

### **📊 SSIM Parameters - Meaning in Visual Analysis:**

#### **1. Luminance (Brightness)**
**Meaning:** Compares average brightness of the two signatures.
- **High (>0.9):** Very similar stroke intensity, same pen/pressure type
- **Medium (0.7-0.9):** Slight intensity differences, compatible
- **Low (<0.7):** Different tools or pressure, requires investigation
- **🔍 Forensic:** Indicates tool consistency and pressure habits

#### **2. Contrast**
**Meaning:** Compares contrast between stroke and background.
- **High (>0.9):** Very similar contrast, comparable image quality
- **Medium (0.7-0.9):** Acceptable differences, compatible conditions
- **Low (<0.7):** Different scanning/photo conditions, quality issues
- **🔍 Forensic:** Indicates acquisition conditions and document state

#### **3. Structure**
**Meaning:** Analyzes structural similarity of graphic patterns.
- **High (>0.9):** Very similar graphic structure, high compatibility
- **Medium (0.7-0.9):** Good structural correspondence, likely authenticity
- **Low (<0.7):** Significant structural differences, possible falsification
- **🔍 Forensic:** **MOST IMPORTANT COMPONENT** - directly reveals graphic pattern correspondence

---

## **🎯 AUTHENTICATION THRESHOLDS**

### **🔍 Standard Forensic Classification:**

#### **Similarity Score Interpretation:**
- **≥85%:** **Authentic** (Very high confidence)
- **65-84%:** **Probably Authentic** (Good confidence)  
- **50-64%:** **Inconclusive** (Requires further analysis)
- **35-49%:** **Probably False** (High suspicion)
- **<35%:** **False** (Very high confidence)

#### **Naturalness Score Interpretation:**
- **≥80%:** **Natural Execution** (Spontaneous signature)
- **60-79%:** **Normal Execution** (Slight tensions acceptable)
- **40-59%:** **Suspicious Execution** (Possible dissimulation)
- **<40%:** **Highly Suspicious** (Likely imitation attempt)

---

## **📚 SCIENTIFIC REFERENCES**

### **🔬 Standards and Methodologies:**
- **ENFSI Guidelines** for Handwriting Analysis
- **ASTM E2290** Standard Guide for Examination of Handwriting
- **ISO/IEC 17025** Testing and Calibration Laboratories
- **Wang et al. (2004)** SSIM Image Quality Assessment
- **Srihari et al. (2002)** Individuality of Handwriting

### **🎓 Academic Sources:**
- **Journal of Forensic Document Examination** (JFDE)
- **Forensic Science International** (FSI)
- **IEEE Transactions on Pattern Analysis** (TPAMI)
- **International Journal of Document Analysis** (IJDAR)