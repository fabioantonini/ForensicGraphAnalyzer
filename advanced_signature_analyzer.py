#!/usr/bin/env python3
"""
Advanced Signature Analyzer
Integrazione dei parametri avanzati forniti dal cliente per analisi firma completa
"""

import sys
import json
import numpy as np
import cv2
import os
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime

def analyze_signature(image_path: str, real_width_mm: float, real_height_mm: float) -> Dict[str, Any]:
    """
    Analizza una firma utilizzando parametri avanzati
    
    Args:
        image_path: Percorso dell'immagine della firma
        real_width_mm: Larghezza reale in mm
        real_height_mm: Altezza reale in mm
        
    Returns:
        Dizionario con parametri avanzati estratti
    """
    try:
        # Carica l'immagine
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"File non trovato: {image_path}")
            
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Impossibile caricare l'immagine: {image_path}")
            
        # Converte in scala di grigi
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        
        # Calcola fattore di calibrazione
        pixels_per_mm_x = width / real_width_mm
        pixels_per_mm_y = height / real_height_mm
        pixels_per_mm = (pixels_per_mm_x + pixels_per_mm_y) / 2
        
        print(f"[PYTHON] Analisi: {width}x{height}px -> {real_width_mm}x{real_height_mm}mm ({pixels_per_mm:.2f}px/mm)", file=sys.stderr)
        
        # Applica sogliatura per estrarre la firma
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # === PARAMETRI AVANZATI ===
        
        # 1. Proporzione geometrica
        proportion = real_height_mm / real_width_mm
        
        # 2. Inclinazione media
        inclination = calculate_inclination(binary)
        
        # 3. Analisi pressione (da intensità pixel)
        pressure_mean, pressure_std = analyze_pressure(gray, binary)
        
        # 4. Curvatura media
        avg_curvature = calculate_average_curvature(binary, pixels_per_mm)
        
        # 5. Stile di scrittura
        writing_style = classify_writing_style(binary, inclination, avg_curvature)
        
        # 6. Leggibilità
        readability = assess_readability(binary, pixels_per_mm)
        
        # 7. Analisi delle asole
        avg_asola_size = analyze_loops(binary, pixels_per_mm)
        
        # 8. Spaziatura media
        avg_spacing = calculate_spacing(binary, pixels_per_mm)
        
        # 9. Velocità di esecuzione
        velocity = estimate_writing_velocity(binary, avg_spacing, avg_curvature)
        
        # 10. Sovrapposizione tratti
        overlap_ratio = calculate_overlap_ratio(binary)
        
        # 11. Connessioni tra lettere
        letter_connections = count_letter_connections(binary)
        
        # 12. Deviazione baseline
        baseline_std_mm = calculate_baseline_deviation(binary, pixels_per_mm)
        
        # 13. Componenti connesse
        num_components = calculate_connected_components(binary)
        
        # 14. Complessità del tratto
        stroke_complexity = calculate_stroke_complexity(binary, pixels_per_mm)
        
        result = {
            # Parametri base
            "proportion": float(proportion),
            "inclination": float(inclination),
            "pressureMean": float(pressure_mean),
            "pressureStd": float(pressure_std),
            "avgCurvature": float(avg_curvature),
            "writingStyle": writing_style,
            "readability": readability,
            "avgAsolaSize": float(avg_asola_size),
            "avgSpacing": float(avg_spacing),
            "velocity": float(velocity),
            "overlapRatio": float(overlap_ratio),
            "letterConnections": int(letter_connections),
            "baselineStdMm": float(baseline_std_mm),
            "connectedComponents": int(num_components),
            "strokeComplexity": float(stroke_complexity),
            
            # Metadati
            "timestamp": datetime.now().isoformat(),
            "imageSize": f"{width}x{height}",
            "calibration": f"{pixels_per_mm:.2f}px/mm"
        }
        
        print(f"[PYTHON] Analisi completata con {len(result)} parametri", file=sys.stderr)
        return result
        
    except Exception as e:
        print(f"[PYTHON] Errore nell'analisi: {str(e)}", file=sys.stderr)
        return {"error": str(e), "timestamp": datetime.now().isoformat()}

def calculate_inclination(binary: np.ndarray) -> float:
    """Calcola l'inclinazione media della scrittura"""
    try:
        # Trova contorni
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return 0.0
        
        angles = []
        for contour in contours:
            if cv2.contourArea(contour) > 50:  # Solo contorni significativi
                # Calcola ellisse di fit
                if len(contour) >= 5:
                    ellipse = cv2.fitEllipse(contour)
                    angle = ellipse[2]  # Angolo dell'ellisse
                    angles.append(angle)
        
        return float(np.mean(angles)) if angles else 0.0
        
    except Exception:
        return 0.0

def analyze_pressure(gray: np.ndarray, binary: np.ndarray) -> Tuple[float, float]:
    """Analizza la pressione dalla intensità dei pixel"""
    try:
        # Estrae intensità dei pixel della firma
        ink_pixels = gray[binary > 0]
        if len(ink_pixels) == 0:
            return 0.0, 0.0
            
        # Converte in "pressione" (255 - intensità = pressione)
        pressure_values = 255 - ink_pixels
        
        mean_pressure = float(np.mean(pressure_values))
        std_pressure = float(np.std(pressure_values))
        
        # Normalizza (0-100 scale)
        return mean_pressure / 255.0 * 100, std_pressure / 255.0 * 100
        
    except Exception:
        return 0.0, 0.0

def calculate_average_curvature(binary: np.ndarray, pixels_per_mm: float) -> float:
    """Calcola la curvatura media"""
    try:
        # Trova scheletro
        skeleton = cv2.ximgproc.thinning(binary)
        
        # Trova punti di contorno dello scheletro
        contours, _ = cv2.findContours(skeleton, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not contours:
            return 0.0
        
        total_curvature = 0.0
        total_points = 0
        
        for contour in contours:
            if len(contour) > 10:  # Almeno 10 punti per calcolare curvatura
                # Calcola curvatura per segmenti
                for i in range(5, len(contour) - 5):
                    p1 = contour[i-5][0]
                    p2 = contour[i][0]  
                    p3 = contour[i+5][0]
                    
                    # Calcola angolo
                    v1 = p1 - p2
                    v2 = p3 - p2
                    
                    cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
                    cos_angle = np.clip(cos_angle, -1, 1)
                    angle = np.arccos(cos_angle)
                    
                    total_curvature += angle
                    total_points += 1
        
        if total_points == 0:
            return 0.0
            
        # Converte in curvatura per mm
        avg_curvature_per_pixel = total_curvature / total_points
        return float(avg_curvature_per_pixel * pixels_per_mm)
        
    except Exception:
        return 0.0

def classify_writing_style(binary: np.ndarray, inclination: float, curvature: float) -> str:
    """Classifica lo stile di scrittura"""
    try:
        # Calcola alcuni parametri di stile
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return "Sconosciuto"
        
        # Analizza regolarità
        areas = [cv2.contourArea(c) for c in contours if cv2.contourArea(c) > 20]
        if not areas:
            return "Sconosciuto"
            
        area_std = np.std(areas) / (np.mean(areas) + 1e-6)
        
        # Classifica basandosi su parametri
        if area_std < 0.5 and abs(inclination) < 15 and curvature < 2:
            return "Regolare"
        elif curvature > 5:
            return "Corsiva"
        elif abs(inclination) > 20:
            return "Inclinata"
        else:
            return "Mista"
            
    except Exception:
        return "Sconosciuto"

def assess_readability(binary: np.ndarray, pixels_per_mm: float) -> str:
    """Valuta la leggibilità"""
    try:
        # Conta componenti connessi
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary)
        
        if num_labels < 2:
            return "Bassa"
        
        # Analizza dimensioni e distribuzione
        valid_components = stats[1:, cv2.CC_STAT_AREA] > 20  # Esclude background e componenti troppo piccoli
        valid_areas = stats[1:][valid_components, cv2.CC_STAT_AREA]
        
        if len(valid_areas) == 0:
            return "Bassa"
        
        # Calcola uniformità
        area_uniformity = 1.0 - (np.std(valid_areas) / (np.mean(valid_areas) + 1e-6))
        area_uniformity = np.clip(area_uniformity, 0, 1)
        
        if area_uniformity > 0.7:
            return "Alta"
        elif area_uniformity > 0.4:
            return "Media"
        else:
            return "Bassa"
            
    except Exception:
        return "Media"

def analyze_loops(binary: np.ndarray, pixels_per_mm: float) -> float:
    """Analizza le asole (loop chiusi)"""
    try:
        # Trova contorni
        contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        
        loop_areas = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 50:  # Solo asole significative
                # Controlla se è un loop chiuso
                hull = cv2.convexHull(contour)
                hull_area = cv2.contourArea(hull)
                
                # Se l'area del contorno è significativamente diversa dal hull, probabilmente è un loop
                if area / (hull_area + 1e-6) > 0.6:
                    # Converte in mm²
                    loop_size_mm2 = area / (pixels_per_mm ** 2)
                    loop_areas.append(loop_size_mm2)
        
        return float(np.mean(loop_areas)) if loop_areas else 0.0
        
    except Exception:
        return 0.0

def calculate_spacing(binary: np.ndarray, pixels_per_mm: float) -> float:
    """Calcola la spaziatura media"""
    try:
        # Trova componenti connessi
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary)
        
        if num_labels < 3:  # Almeno 2 componenti + background
            return 0.0
        
        # Calcola distanze tra centroidi
        valid_centroids = centroids[1:]  # Esclude background
        distances = []
        
        for i in range(len(valid_centroids)):
            for j in range(i+1, len(valid_centroids)):
                dist = np.linalg.norm(valid_centroids[i] - valid_centroids[j])
                distances.append(dist)
        
        if not distances:
            return 0.0
        
        # Converte in mm
        avg_spacing_pixels = np.mean(distances)
        return float(avg_spacing_pixels / pixels_per_mm)
        
    except Exception:
        return 0.0

def estimate_writing_velocity(binary: np.ndarray, spacing: float, curvature: float) -> float:
    """Stima la velocità di scrittura"""
    try:
        # Fattori che influenzano la velocità:
        # - Spaziatura maggiore = scrittura più veloce
        # - Curvatura maggiore = scrittura più lenta
        # - Regolarità = controllo della velocità
        
        base_velocity = 1.0  # Velocità base normalizzata
        
        # Aggiustamenti
        if spacing > 0:
            spacing_factor = min(spacing / 3.0, 2.0)  # Max 2x per spaziatura
            base_velocity *= (1.0 + spacing_factor)
        
        if curvature > 0:
            curvature_factor = min(curvature / 10.0, 0.8)  # Max riduzione 80%
            base_velocity *= (1.0 - curvature_factor)
        
        return float(max(base_velocity, 0.1))  # Minimo 0.1
        
    except Exception:
        return 1.0

def calculate_overlap_ratio(binary: np.ndarray) -> float:
    """Calcola il rapporto di sovrapposizione"""
    try:
        # Applica dilatazione per trovare sovrapposizioni
        kernel = np.ones((3,3), np.uint8)
        dilated = cv2.dilate(binary, kernel, iterations=1)
        
        # Calcola rapporto tra area dilatata e originale
        original_area = np.sum(binary > 0)
        dilated_area = np.sum(dilated > 0)
        
        if original_area == 0:
            return 0.0
        
        # Rapporto di sovrapposizione
        overlap = 1.0 - (dilated_area / original_area)
        return float(max(overlap, 0.0))
        
    except Exception:
        return 0.0

def count_letter_connections(binary: np.ndarray) -> int:
    """Conta le connessioni tra lettere"""
    try:
        # Applica thinning per ottenere lo scheletro
        skeleton = cv2.ximgproc.thinning(binary)
        
        # Trova punti di giunzione (punti con più di 2 vicini)
        kernel = np.ones((3,3), np.uint8)
        
        connections = 0
        h, w = skeleton.shape
        
        for y in range(1, h-1):
            for x in range(1, w-1):
                if skeleton[y,x] > 0:
                    # Conta i vicini
                    neighborhood = skeleton[y-1:y+2, x-1:x+2]
                    neighbor_count = np.sum(neighborhood > 0) - 1  # Esclude il punto centrale
                    
                    # Se ha più di 2 vicini, è un punto di giunzione
                    if neighbor_count > 2:
                        connections += 1
        
        return connections
        
    except Exception:
        return 0

def calculate_baseline_deviation(binary: np.ndarray, pixels_per_mm: float) -> float:
    """Calcola la deviazione della baseline"""
    try:
        # Trova componenti connessi
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary)
        
        if num_labels < 3:
            return 0.0
        
        # Estrae le coordinate Y dei centroidi (baseline)
        y_coords = centroids[1:, 1]  # Esclude background
        
        if len(y_coords) < 2:
            return 0.0
        
        # Calcola deviazione standard della baseline
        baseline_std_pixels = np.std(y_coords)
        return float(baseline_std_pixels / pixels_per_mm)
        
    except Exception:
        return 0.0

def calculate_connected_components(binary: np.ndarray) -> int:
    """Calcola il numero di componenti connesse nella firma"""
    try:
        # Trova componenti connesse
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary)
        
        # Sottrae 1 per escludere il background
        valid_components = 0
        for i in range(1, num_labels):  # Skip background (label 0)
            area = stats[i, cv2.CC_STAT_AREA]
            if area > 10:  # Solo componenti significative
                valid_components += 1
        
        return max(1, valid_components)  # Almeno 1 componente
        
    except Exception:
        return 1

def calculate_stroke_complexity(binary: np.ndarray, pixels_per_mm: float) -> float:
    """Calcola la complessità del tratto basata su contorni e curvature"""
    try:
        # Trova contorni
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return 0.0
        
        total_complexity = 0.0
        total_perimeter = 0.0
        
        for contour in contours:
            if cv2.contourArea(contour) > 20:
                # Calcola perimetro
                perimeter = cv2.arcLength(contour, True)
                
                # Calcola complessità basata su numero di punti del contorno
                epsilon = 0.02 * perimeter
                approx = cv2.approxPolyDP(contour, epsilon, True)
                
                # Complessità = rapporto tra punti originali e approssimati
                if len(approx) > 0:
                    complexity = len(contour) / len(approx)
                    total_complexity += complexity * perimeter
                    total_perimeter += perimeter
        
        if total_perimeter > 0:
            # Normalizza la complessità (0-1)
            avg_complexity = total_complexity / total_perimeter
            return min(1.0, avg_complexity / 10.0)  # Scala a 0-1
        
        return 0.0
        
    except Exception:
        return 0.0

def main():
    """Funzione principale CLI"""
    if len(sys.argv) != 5:
        print("Uso: python3 advanced_signature_analyzer.py analyze <image_path> <width_mm> <height_mm>")
        sys.exit(1)
    
    command = sys.argv[1]
    if command != "analyze":
        print(f"Comando sconosciuto: {command}")
        sys.exit(1)
    
    image_path = sys.argv[2]
    try:
        width_mm = float(sys.argv[3])
        height_mm = float(sys.argv[4])
    except ValueError:
        print("Errore: dimensioni devono essere numeri validi")
        sys.exit(1)
    
    # Analizza la firma
    result = analyze_signature(image_path, width_mm, height_mm)
    
    # Output JSON per Node.js
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()