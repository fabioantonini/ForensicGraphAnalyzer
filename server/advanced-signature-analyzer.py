#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Advanced Signature Analyzer - Modulo di integrazione per GrapholexInsight
Adattato da firma_analyzer.py originale per l'uso in un'applicazione web
"""

import cv2
import numpy as np
import os
import math
import json
import sys
import tempfile
from datetime import datetime
import base64
import io
from io import BytesIO
from skimage.metrics import structural_similarity as ssim
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
from docx import Document
from PIL import Image
import PyPDF2
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as ReportlabImage, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch, cm

# DPI di default se non specificato
DEFAULT_DPI = 300

def pixels_to_mm(pixels, dpi=DEFAULT_DPI):
    """
    Converte i pixel in millimetri basandosi sul DPI
    
    Args:
        pixels: Numero di pixel da convertire
        dpi: Densità di pixel per pollice (default 300)
        
    Returns:
        Valore in millimetri
    """
    inches = pixels / dpi  # Conversione da pixel a pollici
    mm = inches * 25.4     # Conversione da pollici a millimetri
    return mm

def get_signature_cm_size(pixel_width, pixel_height, dpi):
    """
    Calcola le dimensioni reali di una firma in centimetri basate sui pixel e sul DPI.
    
    Args:
        pixel_width: Larghezza in pixel
        pixel_height: Altezza in pixel
        dpi: Punti per pollice
        
    Returns:
        Tupla (larghezza, altezza) in centimetri
    """
    # Calcola dimensioni in pollici
    width_inches = pixel_width / dpi if dpi > 0 else 0
    height_inches = pixel_height / dpi if dpi > 0 else 0
    
    # Converti in centimetri (1 pollice = 2.54 cm)
    width_cm = width_inches * 2.54
    height_cm = height_inches * 2.54
    
    return (width_cm, height_cm)

def get_realistic_size(width_mm, height_mm):
    """
    Restituisce dimensioni realistiche per una firma basate su proporzioni tipiche.
    Una firma tipica è larga 5-10 cm e alta 1-3 cm.
    
    Args:
        width_mm: Larghezza in millimetri dall'analisi
        height_mm: Altezza in millimetri dall'analisi
        
    Returns:
        Tupla (larghezza, altezza) in valori realistici (cm)
    """
    # Converti millimetri in centimetri
    width_cm = width_mm / 10.0 if width_mm > 0 else 0
    height_cm = height_mm / 10.0 if height_mm > 0 else 0
    
    # Verifica se ci sono valori anomali (dimensioni eccessive)
    if width_cm > 25 or height_cm > 15:
        # Calcola il fattore di riduzione
        ratio = width_cm / height_cm if height_cm > 0 else 1
        
        # Limita la larghezza a 8 cm massimo
        width_cm = min(width_cm, 8.0)
        
        # Ricalcola l'altezza in base alla proporzione
        height_cm = width_cm / ratio if ratio > 0 else 0
        
        # Limita l'altezza a 4 cm massimo
        height_cm = min(height_cm, 4.0)
    
    # Assicurati che le dimensioni non siano zero o troppo piccole
    width_cm = max(width_cm, 3.0)
    height_cm = max(height_cm, 1.0)
    
    return (width_cm, height_cm)

def preprocess_image(image, resize=True):
    """
    Prepara l'immagine per l'analisi
    
    Args:
        image: Immagine da processare
        resize: Se True, ridimensiona l'immagine a 300x150 pixel
        
    Returns:
        Immagine processata
    """
    if resize:
        image = cv2.resize(image, (300, 150))
    _, thresh = cv2.threshold(image, 150, 255, cv2.THRESH_BINARY_INV)
    return thresh

def calculate_curvature(contour):
    """Calcola la curvatura del contorno di una firma"""
    angles = []
    for i in range(2, len(contour)):
        pt1 = contour[i - 2][0]
        pt2 = contour[i - 1][0]
        pt3 = contour[i][0]
        v1 = pt1 - pt2
        v2 = pt3 - pt2
        angle = math.degrees(math.acos(
            np.clip(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-5), -1.0, 1.0)
        ))
        angles.append(angle)
    return np.mean(angles) if angles else 0

def calculate_circularity(cnt):
    """Calcola la circolarità di un contorno"""
    area = cv2.contourArea(cnt)
    perimeter = cv2.arcLength(cnt, True)
    if perimeter == 0:
        return 0
    return 4 * math.pi * area / (perimeter ** 2)

def calculate_signature_inclination(contours):
    """
    Calcola l'inclinazione della firma usando multiple tecniche robuste
    
    Args:
        contours: Lista dei contorni della firma
        
    Returns:
        Angolo di inclinazione in gradi (0-90)
    """
    if not contours:
        return 0.0
    
    inclinations = []
    
    # Metodo 1: Analisi linea principale usando regressione lineare
    try:
        # Combina tutti i punti dei contorni
        all_points = []
        for contour in contours:
            if len(contour) >= 3:
                points = contour.reshape(-1, 2)
                all_points.extend(points)
        
        if len(all_points) > 10:
            all_points = np.array(all_points)
            
            # Regressione lineare per trovare la linea principale
            x_coords = all_points[:, 0]
            y_coords = all_points[:, 1]
            
            # Calcola il coefficiente angolare
            if len(x_coords) > 1 and np.std(x_coords) > 0:
                slope = np.polyfit(x_coords, y_coords, 1)[0]
                angle_rad = np.arctan(slope)
                angle_deg = np.degrees(angle_rad)
                inclinations.append(abs(angle_deg))
                
    except Exception:
        pass
    
    # Metodo 2: Analisi ellisse per contorni sufficientemente grandi
    try:
        for contour in contours:
            if len(contour) >= 5:  # Minimo per fitEllipse
                ellipse = cv2.fitEllipse(contour)
                angle = ellipse[2]  # Angolo in gradi
                
                # Normalizza l'angolo tra 0 e 90 gradi
                if angle > 90:
                    angle = 180 - angle
                elif angle < 0:
                    angle = abs(angle)
                
                inclinations.append(angle)
                
    except Exception:
        pass
    
    # Metodo 3: Analisi boundingRect inclinato
    try:
        for contour in contours:
            if len(contour) >= 4:
                rect = cv2.minAreaRect(contour)
                angle = rect[2]  # Angolo della rotazione
                
                # Normalizza l'angolo
                if angle < -45:
                    angle = 90 + angle
                elif angle > 45:
                    angle = angle - 90
                
                inclinations.append(abs(angle))
                
    except Exception:
        pass
    
    # Se abbiamo almeno una misurazione, usa la mediana per robustezza
    if inclinations:
        # Filtra valori outlier (maggiori di 60 gradi sono improbabili per firme)
        valid_inclinations = [inc for inc in inclinations if 0 <= inc <= 60]
        
        if valid_inclinations:
            return np.median(valid_inclinations)
        else:
            return np.median(inclinations)
    
    # Fallback: restituisce un valore ragionevole
    return 15.0  # Inclinazione tipica per firme corsive

def count_letter_connections(binary: np.ndarray) -> int:
    """Conta le connessioni tra lettere usando algoritmi alternativi"""
    try:
        # Usa morphological operations per analizzare la struttura
        kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
        
        # Applica erosione per ridurre i tratti
        eroded = cv2.erode(binary, kernel, iterations=1)
        
        # Trova i contorni per analizzare la struttura
        contours, _ = cv2.findContours(eroded, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        connections = 0
        
        # Analizza ogni contorno per trovare punti di giunzione complessi
        for contour in contours:
            if len(contour) < 10:  # Salta contorni troppo piccoli
                continue
                
            # Calcola il perimetro e l'area per identificare forme complesse
            perimeter = cv2.arcLength(contour, True)
            area = cv2.contourArea(contour)
            
            if area > 0:
                # Se il rapporto perimetro/area è alto, indica una forma complessa con possibili connessioni
                complexity_ratio = perimeter * perimeter / (4 * np.pi * area)
                
                # Soglia per identificare forme complesse che suggeriscono connessioni tra lettere
                if complexity_ratio > 4.0:  # Valore empirico
                    connections += int(complexity_ratio / 4.0)
        
        # Conta anche i punti di curvatura estrema come indicatori di connessioni
        h, w = binary.shape
        junction_points = 0
        
        for y in range(2, h-2, 3):  # Campiona ogni 3 pixel per efficienza
            for x in range(2, w-2, 3):
                if binary[y,x] > 0:
                    # Analizza il vicinato 5x5 per trovare pattern di connessione
                    neighborhood = binary[y-2:y+3, x-2:x+3]
                    
                    # Conta i pixel attivi nel vicinato
                    active_pixels = np.sum(neighborhood > 0)
                    
                    # Se ci sono molti pixel attivi in un'area piccola, potrebbe essere una connessione
                    if active_pixels > 12:  # Soglia per area densa
                        # Verifica che non sia solo una linea dritta
                        horizontal_line = np.sum(binary[y, x-2:x+3] > 0)
                        vertical_line = np.sum(binary[y-2:y+3, x] > 0)
                        
                        # Se non è una linea dritta, potrebbe essere una connessione complessa
                        if horizontal_line < 4 and vertical_line < 4:
                            junction_points += 1
        
        # Combina i due metodi per un risultato più accurato
        total_connections = connections + min(junction_points // 3, 10)  # Normalizza i junction points
        
        # Limita il numero massimo per evitare valori irrealistici
        return min(max(total_connections, 1), 25)  # Almeno 1, massimo 25
        
    except Exception as e:
        print(f"Errore nel conteggio connessioni lettere: {str(e)}", file=sys.stderr)
        return 1  # Valore di fallback ragionevole

# FUNZIONE RIMOSSA - analyze_signature che usa DPI è obsoleta
# Utilizzare sempre analyze_signature_with_dimensions con dimensioni reali
def analyze_signature_deprecated_dpi_removed():
    """
    FUNZIONE RIMOSSA - utilizzare analyze_signature_with_dimensions
    """
    return {"error": "Funzione rimossa - utilizzare analyze_signature_with_dimensions con dimensioni reali"}

def create_naturalness_chart(verifica_data, comp_data):
    """
    Crea un grafico specifico per i parametri di naturalezza (anti-dissimulazione)
    
    Args:
        verifica_data: Parametri della firma da verificare
        comp_data: Parametri della firma comparativa (riferimento)
    
    Returns:
        String base64 dell'immagine del grafico di naturalezza
    """
    try:
        # Parametri specifici per la naturalezza
        naturalness_params = ['FluidityScore', 'PressureConsistency', 'CoordinationIndex']
        
        # Estrai i valori per entrambe le firme
        verifica_values = []
        comp_values = []
        labels = []
        
        for param in naturalness_params:
            if param in verifica_data and param in comp_data:
                verifica_values.append(verifica_data[param])
                comp_values.append(comp_data[param])
                
                # Etichette personalizzate
                if param == 'FluidityScore':
                    labels.append('🧠 Fluidità')
                elif param == 'PressureConsistency':
                    labels.append('🔄 Consistenza')
                elif param == 'CoordinationIndex':
                    labels.append('🎯 Coordinazione')
                else:
                    labels.append(param)
        
        if not verifica_values or not comp_values:
            # Crea un grafico vuoto se non ci sono dati
            fig = Figure(figsize=(10, 6))
            ax = fig.add_subplot(111)
            ax.text(0.5, 0.5, 'Dati di naturalezza non disponibili', 
                   ha='center', va='center', fontsize=16)
            ax.set_xlim(0, 1)
            ax.set_ylim(0, 1)
            ax.axis('off')
        else:
            # Crea il grafico a barre per i parametri di naturalezza
            fig = Figure(figsize=(12, 7))
            ax = fig.add_subplot(111)
            
            x = np.arange(len(labels))
            width = 0.35
            
            # Colori specifici per naturalezza
            bars1 = ax.bar(x - width/2, verifica_values, width, 
                          label='Firma in Verifica', color='#3b82f6', alpha=0.8)
            bars2 = ax.bar(x + width/2, comp_values, width,
                          label='Firma di Riferimento', color='#10b981', alpha=0.8)
            
            # Personalizzazione del grafico
            ax.set_xlabel('Parametri di Naturalezza', fontweight='bold', fontsize=12)
            ax.set_ylabel('Punteggio (%)', fontweight='bold', fontsize=12)
            ax.set_title('🧠 Analisi Naturalezza (Anti-Dissimulazione)', fontweight='bold', fontsize=14)
            ax.set_xticks(x)
            ax.set_xticklabels(labels, fontsize=10)
            ax.legend()
            ax.grid(True, alpha=0.3, axis='y')
            ax.set_ylim(0, 100)
            
            # Aggiungi valori sulle barre
            def add_value_labels(bars):
                for bar in bars:
                    height = bar.get_height()
                    ax.annotate(f'{height:.1f}%',
                               xy=(bar.get_x() + bar.get_width() / 2, height),
                               xytext=(0, 3),  # offset
                               textcoords="offset points",
                               ha='center', va='bottom', fontsize=9)
            
            add_value_labels(bars1)
            add_value_labels(bars2)
        
        # Salva in buffer e converti in base64
        buffer = io.BytesIO()
        fig.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
        buffer.seek(0)
        
        # Converti in base64
        image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        buffer.close()
        
        return image_base64
        
    except Exception as e:
        print(f"[ERROR] Errore nella creazione del grafico naturalezza: {str(e)}", file=sys.stderr)
        # Ritorna un grafico di errore
        fig = Figure(figsize=(10, 6))
        ax = fig.add_subplot(111)
        ax.text(0.5, 0.5, f'Errore grafico naturalezza:\n{str(e)}', 
               ha='center', va='center', fontsize=14, color='red')
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        
        buffer = io.BytesIO()
        fig.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        buffer.close()
        
        return image_base64

def create_comparison_chart(verifica_data, comp_data):
    """
    Crea un grafico di confronto tra i parametri di due firme
    
    Args:
        verifica_data: Parametri della firma da verificare
        comp_data: Parametri della firma di riferimento
        
    Returns:
        Base64-encoded PNG immagine del grafico
    """
    # Normalizza le chiavi per compatibilità
    verifica_data = normalize_parameter_keys(verifica_data)
    comp_data = normalize_parameter_keys(comp_data)
    # LISTA COMPLETA DI TUTTI I PARAMETRI POSSIBILI (21+ parametri)
    parametri_numerici = [
        # Parametri Python avanzati (14 parametri principali)
        'Proportion', 'Inclination', 'PressureMean', 'PressureStd',
        'AvgCurvature', 'Curvature', 'Readability', 
        'AvgAsolaSize', 'AvgSpacing', 'Velocity',
        'OverlapRatio', 'LetterConnections', 'BaselineStd', 'BaselineStdMm',
        
        # Parametri tradizionali aggiuntivi
        'StrokeWidth', 'StrokeComplexity', 'ConnectedComponents',
        'AspectRatio', 'Area', 'Perimeter',
        
        # Parametri dimensionali 
        'Width', 'Height', 'DiagonalLength'
    ]
    
    # Filtra solo i parametri che esistono effettivamente nei dati
    parametri_disponibili = []
    for param in parametri_numerici:
        if (param in verifica_data and isinstance(verifica_data.get(param), (int, float))) or \
           (param in comp_data and isinstance(comp_data.get(param), (int, float))):
            parametri_disponibili.append(param)
    
    # Se abbiamo le dimensioni come array, aggiungiamole
    if 'Dimensions' in verifica_data and isinstance(verifica_data['Dimensions'], list):
        if len(verifica_data['Dimensions']) >= 2:
            # Aggiungi larghezza e altezza come parametri separati
            verifica_data['Width'] = verifica_data['Dimensions'][0]
            verifica_data['Height'] = verifica_data['Dimensions'][1]
            parametri_disponibili.extend(['Width', 'Height'])
    
    if 'Dimensions' in comp_data and isinstance(comp_data['Dimensions'], list):
        if len(comp_data['Dimensions']) >= 2:
            comp_data['Width'] = comp_data['Dimensions'][0]
            comp_data['Height'] = comp_data['Dimensions'][1]
    
    # Usa i parametri disponibili
    parametri_numerici = parametri_disponibili

    differenze = []
    etichette = []
    
    for parametro in parametri_numerici:
        valore_v = verifica_data.get(parametro, 0)
        valore_c = comp_data.get(parametro, 0)
        

        
        differenza = abs(valore_v - valore_c)
        differenze.append(differenza)
        
        # Crea etichetta che mostra il valore per la firma da verificare
        if valore_v != 0:
            etichette.append(f"{parametro} {valore_v:.1f}")
        else:
            etichette.append(f"{parametro} 0.0")

    # Calcola la compatibilità percentuale per ogni parametro
    compatibilita_percentuale = []
    
    for i, diff in enumerate(differenze):
        valore_v = verifica_data.get(parametri_numerici[i], 0)
        valore_c = comp_data.get(parametri_numerici[i], 0)
        
        # Se entrambi i valori sono 0, assegna 0% (nessun dato disponibile)
        if valore_v == 0 and valore_c == 0:
            print(f"[WARNING] Parametro {parametro_nome} non trovato nei dati - valore_v: {valore_v}, valore_c: {valore_c}", file=sys.stderr)
            compatibilita_percentuale.append(0)
            continue
            
        # USA LA STESSA LOGICA INTELLIGENTE DEL FRONTEND per la compatibilità
        parametro_nome = parametri_numerici[i]
        
        # Per parametri con valori molto piccoli (es. asole), usa soglie assolute
        if parametro_nome in ['AvgAsolaSize', 'BaselineStdMm']:
            if diff <= 0.05:
                compatibilita = 95  # Entrambi molto piccoli = alta compatibilità  
            elif diff <= 0.10:
                compatibilita = 85
            elif diff <= 0.20:
                compatibilita = 70
            else:
                compatibilita = 50
        else:
            # Per altri parametri, usa soglie relative
            valore_max = max(abs(valore_v), abs(valore_c))
            if valore_max == 0:
                compatibilita = 100  # Identici
            else:
                diff_percentuale = (diff / valore_max) * 100
                if diff_percentuale <= 5:
                    compatibilita = 98
                elif diff_percentuale <= 10:
                    compatibilita = 90
                elif diff_percentuale <= 15:
                    compatibilita = 80
                elif diff_percentuale <= 25:
                    compatibilita = 70
                elif diff_percentuale <= 40:
                    compatibilita = 50
                else:
                    compatibilita = max(0, 100 - diff_percentuale)
            
        compatibilita_percentuale.append(compatibilita)

    # Crea l'immagine del grafico - dimensioni più grandi per tutti i parametri
    fig = Figure(figsize=(12, max(8, len(parametri_numerici) * 0.5)))
    ax = fig.add_subplot(111)
    
    bars = ax.barh(etichette, compatibilita_percentuale, color='skyblue')
    ax.set_xlabel('Compatibilità (%)')
    ax.set_title('Grafico Compatibilità Parametri Firma')
    ax.set_xlim(0, 100)
    ax.grid(axis='x')
    fig.tight_layout()
    
    # Aggiungi etichette con i valori
    for i, bar in enumerate(bars):
        ax.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2, 
                f'{compatibilita_percentuale[i]:.1f}%', 
                va='center')
    
    # Converti il grafico in base64
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=100)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    
    return img_base64

def normalize_parameter_keys(data):
    """
    Normalizza le chiavi dei parametri per garantire compatibilità tra versioni database/Python
    
    Args:
        data: Dizionario con parametri della firma
        
    Returns:
        Dizionario con chiavi normalizzate
    """
    if not isinstance(data, dict):
        return data
        
    normalized = {}
    
    # Mapping delle chiavi per compatibilità
    key_mapping = {
        'inclination': 'Inclination',
        'Inclination': 'Inclination',
        'pressureMean': 'PressureMean', 
        'pressure_mean': 'PressureMean',
        'PressureMean': 'PressureMean',
        'pressureStd': 'PressureStd',
        'pressure_std': 'PressureStd', 
        'PressureStd': 'PressureStd',
        'proportion': 'Proportion',
        'Proportion': 'Proportion',
        'avgSpacing': 'AvgSpacing',
        'avg_spacing': 'AvgSpacing',
        'AvgSpacing': 'AvgSpacing',
        'velocity': 'Velocity',
        'Velocity': 'Velocity',
        'avgCurvature': 'AvgCurvature',
        'avg_curvature': 'AvgCurvature',
        'AvgCurvature': 'AvgCurvature',
        'curvature': 'Curvature',
        'Curvature': 'Curvature',
        'avgAsolaSize': 'AvgAsolaSize',
        'avg_asola_size': 'AvgAsolaSize',
        'AvgAsolaSize': 'AvgAsolaSize',
        'overlapRatio': 'OverlapRatio',
        'overlap_ratio': 'OverlapRatio',
        'OverlapRatio': 'OverlapRatio',
        'letterConnections': 'LetterConnections',
        'letter_connections': 'LetterConnections',
        'LetterConnections': 'LetterConnections',
        'baselineStd': 'BaselineStd',
        'baseline_std': 'BaselineStd',
        'BaselineStd': 'BaselineStd',
        'baselineStdMm': 'BaselineStdMm',
        'baseline_std_mm': 'BaselineStdMm',
        'BaselineStdMm': 'BaselineStdMm'
    }
    
    # DEBUG: Stampa i dati in ingresso
    print(f"NORMALIZE INPUT: {data}", file=sys.stderr)
    
    # Applica il mapping
    for key, value in data.items():
        normalized_key = key_mapping.get(key, key)
        normalized[normalized_key] = value
        
        # DEBUG: Verifica specifica per avgAsolaSize
        if key == 'avgAsolaSize':
            print(f"DEBUG avgAsolaSize MAPPING: {key} -> {normalized_key} = {value}", file=sys.stderr)
        
        # Assicura che abbiamo anche la versione alternativa per retrocompatibilità
        if normalized_key in key_mapping.values():
            # Cerca tutte le chiavi che mappano a questo valore
            for orig_key, norm_key in key_mapping.items():
                if norm_key == normalized_key and orig_key != key:
                    normalized[orig_key] = value
    
    # DEBUG: Verifica che AvgAsolaSize sia presente
    if 'AvgAsolaSize' in normalized:
        print(f"DEBUG NORMALIZED AvgAsolaSize: {normalized['AvgAsolaSize']}", file=sys.stderr)
    else:
        print(f"DEBUG MISSING AvgAsolaSize in normalized data!", file=sys.stderr)
        print(f"DEBUG NORMALIZED KEYS: {list(normalized.keys())}", file=sys.stderr)
    
    return normalized

def create_descriptive_report(verifica_data, comp_data):
    """
    Crea un report descrittivo basato sul confronto tra due firme
    
    Args:
        verifica_data: Parametri della firma da verificare
        comp_data: Parametri della firma di riferimento
        
    Returns:
        Testo del report descrittivo
    """
    # Normalizza le chiavi per compatibilità
    verifica_data = normalize_parameter_keys(verifica_data)
    comp_data = normalize_parameter_keys(comp_data)
    
    descrizione = ""

    if verifica_data['Velocity'] > comp_data['Velocity'] + 0.2:
        descrizione += "La firma in verifica presenta una maggiore velocità di esecuzione rispetto alla comparativa.\n"
    elif verifica_data['Velocity'] < comp_data['Velocity'] - 0.2:
        descrizione += "La firma in verifica presenta una minore velocità di esecuzione rispetto alla comparativa.\n"
    else:
        descrizione += "La velocità di esecuzione delle firme risulta compatibile.\n"

    if abs(verifica_data['Proportion'] - comp_data['Proportion']) < 0.2:
        descrizione += "Le proporzioni tra altezza e larghezza risultano simili.\n"
    else:
        descrizione += "Le proporzioni tra altezza e larghezza mostrano differenze significative.\n"

    if abs(verifica_data['PressureMean'] - comp_data['PressureMean']) < 10:
        descrizione += "La pressione esercitata durante la firma è compatibile tra i due esemplari.\n"
    else:
        descrizione += "La pressione presenta differenze evidenti tra le firme.\n"

    if abs(verifica_data['Inclination'] - comp_data['Inclination']) < 5:
        descrizione += "L'inclinazione dei tratti risulta simile.\n"
    else:
        descrizione += "L'inclinazione dei tratti evidenzia differenze stilistiche.\n"

    # Usa AvgCurvature se disponibile, altrimenti Curvature per retrocompatibilità
    curvature_key = 'AvgCurvature' if 'AvgCurvature' in verifica_data else 'Curvature'
    if curvature_key in verifica_data and curvature_key in comp_data:
        if abs(verifica_data[curvature_key] - comp_data[curvature_key]) < 15:
            descrizione += "La curvilineità/angolosità delle firme è coerente.\n"
        else:
            descrizione += "La curvilineità/angolosità differisce sensibilmente tra le firme.\n"

    if abs(verifica_data['AvgSpacing'] - comp_data['AvgSpacing']) < 5:
        descrizione += "La spaziatura tra le lettere appare omogenea.\n"
    else:
        descrizione += "La spaziatura tra le lettere evidenzia disomogeneità.\n"

    return descrizione

def generate_pdf_report(verifica_path, comp_path, verifica_data, comp_data, similarity, output_path, case_info=None, project_id=None, verifica_real_dims=None, reference_real_dims=None):
    # Debug info
    print(f"DEBUG_REPORT verifica_path={verifica_path}", file=sys.stderr)
    print(f"DEBUG_REPORT comp_path={comp_path}", file=sys.stderr)
    print(f"DEBUG_REPORT project_id={project_id}", file=sys.stderr)
    
    """
    Genera un report PDF completo del confronto tra firme usando ReportLab
    
    Args:
        verifica_path: Percorso della firma da verificare
        comp_path: Percorso della firma di riferimento
        verifica_data: Parametri della firma da verificare
        comp_data: Parametri della firma di riferimento
        similarity: Valore di similitudine SSIM
        output_path: Percorso dove salvare il report (verrà convertito in .pdf)
        case_info: Informazioni sul caso (opzionale)
        project_id: ID del progetto per garantire l'isolamento dei dati (opzionale)
        
    Returns:
        Path del file PDF generato
    """
    # Assicura che il percorso di output sia corretto
    pdf_output_path = output_path
    if not pdf_output_path.endswith('.pdf'):
        pdf_output_path += '.pdf'
    
    # Stili
    styles = getSampleStyleSheet()
    title_style = styles['Title']
    heading1_style = styles['Heading1']
    heading2_style = styles['Heading2']
    normal_style = styles['Normal']
    bold_style = ParagraphStyle('Bold', parent=normal_style, fontName='Helvetica-Bold')
    
    # Crea il documento
    doc = SimpleDocTemplate(pdf_output_path, pagesize=A4, 
                          rightMargin=72, leftMargin=72,
                          topMargin=72, bottomMargin=72)
    
    # Elementi da aggiungere al documento
    elements = []
    
    # Titolo
    title_text = "Report Analisi Grafologica Forense"
    if project_id is not None:
        title_text += f" - Progetto ID: {project_id}"
    elements.append(Paragraph(title_text, title_style))
    elements.append(Spacer(1, 12))
    
    # Informazioni caso
    elements.append(Paragraph("Informazioni caso", heading1_style))
    elements.append(Spacer(1, 6))
    
    if case_info:
        for key, value in case_info.items():
            elements.append(Paragraph(f"{key}: {value}", normal_style))
            elements.append(Spacer(1, 3))
    else:
        elements.append(Paragraph(f"Data analisi: {datetime.now().strftime('%d/%m/%Y')}", normal_style))
    
    elements.append(Spacer(1, 12))
    
    # Firme analizzate
    elements.append(Paragraph("Firme analizzate", heading1_style))
    elements.append(Spacer(1, 6))
    
    # INVERTITO ORDINE: Prima mostriamo la firma in esame, poi quella di riferimento
    # Firma in esame (prima)
    elements.append(Paragraph("Firma in esame:", bold_style))
    img = Image.open(verifica_path)
    img_width, img_height = img.size
    aspect = img_height / float(img_width)
    max_width = 400  # Massima larghezza in punti
    max_height = 250  # Massima altezza per evitare "Flowable too large"
    img_width = min(max_width, img_width)
    img_height = min(max_height, img_width * aspect)
    
    elements.append(ReportlabImage(verifica_path, width=img_width, height=img_height))
    elements.append(Spacer(1, 12))
    
    # Firma di riferimento (seconda)
    elements.append(Paragraph("Firma di riferimento:", bold_style))
    img = Image.open(comp_path)
    img_width, img_height = img.size
    aspect = img_height / float(img_width)
    img_width = min(max_width, img_width)
    img_height = min(max_height, img_width * aspect)
    
    elements.append(ReportlabImage(comp_path, width=img_width, height=img_height))
    elements.append(Spacer(1, 12))
    
    # PARAMETRI ANALIZZATI - Sezione dettagliata
    elements.append(Paragraph("PARAMETRI ANALIZZATI", heading1_style))
    elements.append(Spacer(1, 6))
    
    # Funzione helper per formatttare i parametri
    def format_parameter_list(data, title):
        params_list = []
        params_list.append(Paragraph(f"<b>{title}:</b>", bold_style))
        params_list.append(Spacer(1, 3))
        
        # Usa le dimensioni reali passate come parametri invece di quelle calcolate
        if title == "FIRMA IN VERIFICA" and verifica_real_dims:
            width_mm = verifica_real_dims[0]
            height_mm = verifica_real_dims[1]
        elif title == "FIRMA DI RIFERIMENTO" and reference_real_dims:
            width_mm = reference_real_dims[0]
            height_mm = reference_real_dims[1]
        else:
            # Fallback alle dimensioni calcolate se non disponibili
            width_mm = data.get('real_width_mm', data.get('Dimensions', (0, 0))[0] if isinstance(data.get('Dimensions'), tuple) else 0)
            height_mm = data.get('real_height_mm', data.get('Dimensions', (0, 0))[1] if isinstance(data.get('Dimensions'), tuple) else 0)
        
        pixels_per_mm = data.get('pixels_per_mm', 1)
        width_px = int(width_mm * pixels_per_mm) if width_mm and pixels_per_mm else 0
        height_px = int(height_mm * pixels_per_mm) if height_mm and pixels_per_mm else 0
        
        # Lista parametri formattata
        param_lines = [
            f"• Dimensioni: {width_px}x{height_px} px",
            f"• Dimensioni reali: {width_mm:.1f}x{height_mm:.1f} mm",
            f"• Spessore tratto medio: {data.get('PressureMean', 0):.3f} mm",
            f"• Varianza spessore: {data.get('PressureStd', 0):.2f}",
            f"• Proporzione: {data.get('Proportion', 0):.3f}",
            f"• Inclinazione: {data.get('Inclination', 0):.1f}°",
            f"• Deviazione pressione: {data.get('PressureStd', 0):.1f}",
            f"• Curvatura media: {data.get('AvgCurvature', 0):.3f}",
            f"• Velocità scrittura: {data.get('Velocity', 0):.1f}/5",
            f"• Stile scrittura: {data.get('WritingStyle', 'N/D')}",
            f"• Leggibilità: {data.get('Readability', 'N/D')}",
            f"• Dimensione asole medie: {data.get('AvgAsolaSize', 0):.2f} mm²",
            f"• Spaziatura media: {data.get('AvgSpacing', 0):.2f} mm",
            f"• Rapporto sovrapposizione: {data.get('OverlapRatio', 0)*100:.1f}%",
            f"• Connessioni lettere: {data.get('LetterConnections', 0):.2f}",
            f"• Deviazione baseline: {data.get('BaselineStdMm', 0):.2f} mm"
        ]
        
        for line in param_lines:
            params_list.append(Paragraph(line, normal_style))
            params_list.append(Spacer(1, 2))
        
        return params_list
    
    # Aggiungi parametri firma da verificare
    verifica_params = format_parameter_list(verifica_data, "FIRMA IN VERIFICA")
    for element in verifica_params:
        elements.append(element)
    
    elements.append(Spacer(1, 6))
    
    # Aggiungi parametri firma di riferimento
    comp_params = format_parameter_list(comp_data, "FIRMA DI RIFERIMENTO")
    for element in comp_params:
        elements.append(element)
        
    elements.append(Spacer(1, 12))
    
    # Risultati del confronto
    elements.append(Paragraph("Risultati del confronto", heading1_style))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(f"Indice di similitudine SSIM: {similarity*100:.2f}%", normal_style))
    
    verdict = "Alta probabilità di autenticità" if similarity >= 0.8 else \
              "Sospetta" if similarity >= 0.6 else \
              "Bassa probabilità di autenticità"
    elements.append(Paragraph(f"Valutazione: <b>{verdict}</b>", normal_style))
    elements.append(Spacer(1, 12))
    
    # Tabella parametri
    elements.append(Paragraph("Parametri comparati", heading1_style))
    elements.append(Spacer(1, 6))
    
    # Crea la tabella
    table_data = [["Parametro", "Firma riferimento", "Firma in esame"]]
    
    for key in verifica_data.keys():
        val_c = comp_data.get(key)
        val_v = verifica_data.get(key)
        
        if isinstance(val_c, (int, float)) and not isinstance(val_c, bool):
            table_data.append([key, f"{val_c:.2f}", f"{val_v:.2f}"])
        else:
            table_data.append([key, str(val_c), str(val_v)])
    
    # Crea tabella
    table = Table(table_data, colWidths=[150, 150, 150])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 12))
    
    # Metodologia di comparazione
    elements.append(Paragraph("Metodologia di Comparazione", heading1_style))
    elements.append(Spacer(1, 6))
    
    methodology_text = """
    <b>Metodo di analisi e comparazione delle firme:</b>
    
    L'analisi delle firme si basa su due approcci complementari:
    
    1. <b>Analisi dell'immagine (SSIM):</b> Viene calcolato l'indice di similarità strutturale (SSIM) tra le due immagini, che misura la somiglianza visiva complessiva considerando luminosità, contrasto e struttura.
    
    2. <b>Analisi dei parametri grafologici:</b> Vengono estratti e confrontati i seguenti parametri chiave:
       • <i>Proporzione</i> - Rapporto tra larghezza e altezza della firma (15%)
       • <i>Inclinazione</i> - Angolazione complessiva dei tratti (10%)
       • <i>Pressione</i> - Intensità e variazione della pressione durante la scrittura (15%)
       • <i>Curvatura</i> - Grado di curvatura dei tratti della firma (20%)
       • <i>Dimensioni asole</i> - Dimensione media degli elementi circolari nella firma (10%)
       • <i>Spaziatura</i> - Distribuzione degli spazi tra gli elementi (10%)
       • <i>Velocità</i> - Stima della velocità di esecuzione basata sulla fluidità dei tratti (10%)
       • <i>Connessioni</i> - Modalità di collegamento tra le lettere (10%)
    
    Ogni parametro contribuisce con un peso specifico (indicato tra parentesi) al calcolo complessivo della compatibilità.
    
    Il verdetto finale tiene conto sia della similarità SSIM che della compatibilità parametrica, con una soglia di accettazione dell'80% per l'autenticità e tra 60-80% per le firme sospette.
    """
    
    elements.append(Paragraph(methodology_text, normal_style))
    elements.append(Spacer(1, 12))
    
    # === NUOVO: ANALISI INTERPRETATIVA AI ===
    try:
        import subprocess
        import tempfile
        
        # Prepara i parametri per l'interpretazione AI
        verdict = case_info.get('verdict', 'Non determinato') if case_info else 'Non determinato'
        similarity = verifica_data.get('similarity', 0)
        naturalness = verifica_data.get('naturalnessScore', 0)
        confidence = verifica_data.get('confidenceLevel', 0)
        
        # Crea uno script Node.js temporaneo per chiamare l'interpretazione AI
        node_script = f'''
const {{ generateSignatureInterpretation }} = require('./server/openai.js');

async function generateInterpretation() {{
    try {{
        const interpretation = await generateSignatureInterpretation(
            "{verdict}",
            {similarity},
            {naturalness},
            null,  // parameters non necessari per interpretazione base
            {confidence}
        );
        console.log("INTERPRETATION_RESULT:" + interpretation);
    }} catch (error) {{
        console.log("INTERPRETATION_ERROR:" + error.message);
    }}
}}

generateInterpretation();
'''
        
        # Salva lo script temporaneo
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as temp_script:
            temp_script.write(node_script)
            temp_script_path = temp_script.name
        
        try:
            # Esegui lo script Node.js
            result = subprocess.run(['node', temp_script_path], 
                                  capture_output=True, text=True, timeout=30)
            
            ai_interpretation = None
            for line in result.stdout.split('\n'):
                if line.startswith('INTERPRETATION_RESULT:'):
                    ai_interpretation = line.replace('INTERPRETATION_RESULT:', '').strip()
                    break
            
            # Aggiungi l'interpretazione AI al report se disponibile
            if ai_interpretation and ai_interpretation != "Analisi non disponibile al momento.":
                elements.append(Paragraph("Interpretazione dell'Analisi", heading1_style))
                elements.append(Spacer(1, 6))
                
                # Stile per l'interpretazione AI
                interpretation_style = ParagraphStyle(
                    'InterpretationStyle',
                    fontName='Helvetica',
                    fontSize=11,
                    leading=14,
                    spaceAfter=8,
                    textColor=colors.HexColor('#2c3e50'),
                    leftIndent=12,
                    rightIndent=12,
                    borderColor=colors.HexColor('#3498db'),
                    borderWidth=0.5,
                    borderPadding=8,
                    backColor=colors.HexColor('#f8f9fa')
                )
                
                # Aggiungi l'interpretazione AI
                for paragraph in ai_interpretation.split('\n\n'):
                    if paragraph.strip():
                        elements.append(Paragraph(paragraph.strip(), interpretation_style))
                        elements.append(Spacer(1, 6))
                
                elements.append(Spacer(1, 12))
                
        except subprocess.TimeoutExpired:
            print("⚠️ Timeout generazione interpretazione AI per PDF", file=sys.stderr)
        except Exception as node_error:
            print(f"⚠️ Errore esecuzione script Node.js: {node_error}", file=sys.stderr)
        finally:
            # Cleanup script temporaneo
            try:
                os.unlink(temp_script_path)
            except:
                pass
                
    except Exception as ai_error:
        print(f"⚠️ Errore setup interpretazione AI per PDF: {ai_error}", file=sys.stderr)
    
    # Analisi tecnica (sezione originale)
    elements.append(Paragraph("Analisi Tecnica", heading1_style))
    elements.append(Spacer(1, 6))
    
    description = create_descriptive_report(verifica_data, comp_data)
    for line in description.split('\n'):
        if line.strip():
            elements.append(Paragraph(line, normal_style))
            elements.append(Spacer(1, 3))
    
    # Grafici di confronto
    # Crea una figura temporanea per il grafico e includila nel report
    # CRITICAL: Usa sempre parametri RICALCOLATI (non dal database) per garantire consistenza
    print(f"[CRITICAL] Generazione grafico PDF con parametri ricalcolati", file=sys.stderr)
    print(f"[DEBUG PDF] Verifica avgAsolaSize: {verifica_data.get('avgAsolaSize', 'MISSING')}", file=sys.stderr)
    print(f"[DEBUG PDF] Comp avgAsolaSize: {comp_data.get('avgAsolaSize', 'MISSING')}", file=sys.stderr)
    
    # Normalizza i parametri per garantire chiavi corrette nel grafico
    verifica_data_normalized = normalize_parameter_keys(verifica_data)
    comp_data_normalized = normalize_parameter_keys(comp_data)
    chart_img_base64 = create_comparison_chart(verifica_data_normalized, comp_data_normalized)
    
    # === NUOVO: GRAFICO DI NATURALEZZA ===
    naturalness_chart_base64 = create_naturalness_chart(verifica_data_normalized, comp_data_normalized)
    chart_data = base64.b64decode(chart_img_base64)
    
    # Salva temporaneamente l'immagine del grafico
    chart_temp_path = os.path.join(tempfile.gettempdir(), f"chart_{os.path.basename(pdf_output_path)}.png")
    with open(chart_temp_path, 'wb') as f:
        f.write(chart_data)
        
    elements.append(Spacer(1, 12))
    elements.append(Paragraph("Grafico di compatibilità", heading2_style))
    elements.append(Spacer(1, 6))
    # Anche per il grafico di comparazione, impostiamo una dimensione massima
    img = Image.open(chart_temp_path)
    img_width, img_height = img.size
    aspect = img_height / float(img_width)
    max_width = 450  # Massima larghezza in punti
    max_height = 250  # Massima altezza per evitare "Flowable too large"
    img_width = min(max_width, img_width)
    img_height = min(max_height, img_width * aspect)
    
    elements.append(ReportlabImage(chart_temp_path, width=img_width, height=img_height))
    elements.append(Spacer(1, 12))
    
    # === NUOVA SEZIONE: ANALISI DI NATURALEZZA ===
    elements.append(Paragraph("Analisi della Naturalezza", heading1_style))
    elements.append(Spacer(1, 6))
    
    # Dati di naturalezza
    naturalness_verifica = verifica_data.get('naturalnessScore', verifica_data.get('NaturalnessIndex', 0))
    naturalness_comp = comp_data.get('naturalnessScore', comp_data.get('NaturalnessIndex', 0))
    fluidity_verifica = verifica_data.get('fluidityScore', verifica_data.get('FluidityScore', 0))
    fluidity_comp = comp_data.get('fluidityScore', comp_data.get('FluidityScore', 0))
    pressure_consistency_verifica = verifica_data.get('pressureConsistency', verifica_data.get('PressureConsistency', 0))
    pressure_consistency_comp = comp_data.get('pressureConsistency', comp_data.get('PressureConsistency', 0))
    coordination_verifica = verifica_data.get('coordinationIndex', verifica_data.get('CoordinationIndex', 0))
    coordination_comp = comp_data.get('coordinationIndex', comp_data.get('CoordinationIndex', 0))
    
    naturalness_text = f"""
    La naturalezza rappresenta quanto la scrittura appare spontanea e fluida, considerando la fluidità del tratto, 
    la consistenza della pressione e l'indice di coordinamento motorio.
    
    <b>Firma da verificare:</b>
    • Naturalezza complessiva: {naturalness_verifica:.1f}%
    • Fluidità del tratto: {fluidity_verifica:.1f}%
    • Consistenza pressione: {pressure_consistency_verifica:.1f}%
    • Coordinamento motorio: {coordination_verifica:.1f}%
    
    <b>Firma di riferimento:</b>
    • Naturalezza complessiva: {naturalness_comp:.1f}%
    • Fluidità del tratto: {fluidity_comp:.1f}%
    • Consistenza pressione: {pressure_consistency_comp:.1f}%
    • Coordinamento motorio: {coordination_comp:.1f}%
    
    <b>Differenza naturalezza:</b> {abs(naturalness_verifica - naturalness_comp):.1f}%
    """
    
    elements.append(Paragraph(naturalness_text, normal_style))
    elements.append(Spacer(1, 12))
    
    # Grafico di naturalezza
    elements.append(Paragraph("Grafico della naturalezza", heading2_style))
    elements.append(Spacer(1, 6))
    
    # Decodifica e salva il grafico di naturalezza
    naturalness_chart_temp_path = None
    if naturalness_chart_base64:
        try:
            naturalness_chart_data = base64.b64decode(naturalness_chart_base64)
            naturalness_chart_temp_path = os.path.join(tempfile.gettempdir(), f"naturalness_chart_{os.path.basename(pdf_output_path)}.png")
            
            with open(naturalness_chart_temp_path, 'wb') as f:
                f.write(naturalness_chart_data)
            
            # Aggiungi il grafico di naturalezza
            img_nat = Image.open(naturalness_chart_temp_path)
            img_nat_width, img_nat_height = img_nat.size
            aspect_nat = img_nat_height / float(img_nat_width)
            max_width_nat = 450  # Massima larghezza in punti
            max_height_nat = 250  # Massima altezza
            img_nat_width = min(max_width_nat, img_nat_width)
            img_nat_height = min(max_height_nat, img_nat_width * aspect_nat)
            
            elements.append(ReportlabImage(naturalness_chart_temp_path, width=img_nat_width, height=img_nat_height))
            elements.append(Spacer(1, 12))
            
        except Exception as e:
            print(f"Errore nell'aggiunta del grafico di naturalezza: {str(e)}", file=sys.stderr)
            naturalness_chart_temp_path = None
    
    # === NUOVA SEZIONE: PROSPETTO FINALE ===
    elements.append(Paragraph("Prospetto Finale dell'Analisi", heading1_style))
    elements.append(Spacer(1, 6))
    
    # Calcola il verdetto finale
    similarity_percentage = verifica_data.get('similarity', 0) * 100 if verifica_data.get('similarity', 0) <= 1 else verifica_data.get('similarity', 0)
    
    verdict = "Non determinato"
    verdict_color = colors.gray
    verdict_icon = "⚪"
    
    if similarity_percentage >= 85 and naturalness_verifica >= 80:
        verdict = "Autentica"
        verdict_color = colors.green
        verdict_icon = "✅"
    elif similarity_percentage >= 65 and naturalness_verifica >= 60:
        verdict = "Probabilmente Autentica"
        verdict_color = colors.HexColor('#28a745')
        verdict_icon = "🟢"
    elif similarity_percentage < 55 and naturalness_verifica >= 80:
        verdict = "Sospetta"
        verdict_color = colors.orange
        verdict_icon = "🟠"
    elif similarity_percentage < 65 and naturalness_verifica < 60:
        verdict = "Probabilmente Falsa"
        verdict_color = colors.red
        verdict_icon = "🔴"
    else:
        verdict = "Incerta"
        verdict_color = colors.gray
        verdict_icon = "⚪"
    
    # Usa il verdetto dal case_info se disponibile
    if case_info and 'verdict' in case_info:
        verdict = case_info['verdict']
    
    # Stile per il prospetto finale
    final_verdict_style = ParagraphStyle(
        'FinalVerdictStyle',
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        alignment=1,  # Centrato
        spaceAfter=12,
        textColor=verdict_color,
        borderColor=verdict_color,
        borderWidth=2,
        borderPadding=12,
        backColor=colors.HexColor('#f8f9fa')
    )
    
    # Stile per i risultati numerici
    results_style = ParagraphStyle(
        'ResultsStyle',
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        spaceAfter=8,
        leftIndent=20,
        bulletIndent=10
    )
    
    # Prospetto finale
    elements.append(Paragraph(f"{verdict_icon} <b>ESITO FINALE: {verdict.upper()}</b>", final_verdict_style))
    elements.append(Spacer(1, 12))
    
    # Dettagli numerici
    elements.append(Paragraph("Risultati numerici dell'analisi:", heading2_style))
    elements.append(Spacer(1, 6))
    
    results_text = f"""
    <b>• Similarità visiva (SSIM):</b> {similarity_percentage:.1f}%
    
    <b>• Naturalezza della scrittura:</b> {naturalness_verifica:.1f}%
    
    <b>• Compatibilità parametrica:</b> {verifica_data.get('compatibilityScore', 0):.1f}%
    
    <b>• Livello di confidenza:</b> {verifica_data.get('confidenceLevel', 0):.1f}%
    
    <b>Soglie di riferimento:</b>
    • Autentica: Similarità ≥ 85% + Naturalezza ≥ 80%
    • Probabilmente Autentica: Similarità ≥ 65% + Naturalezza ≥ 60%
    • Sospetta: Similarità < 55% + Naturalezza ≥ 80%
    • Probabilmente Falsa: Similarità < 65% + Naturalezza < 60%
    """
    
    elements.append(Paragraph(results_text, results_style))
    elements.append(Spacer(1, 12))
    
    # Note conclusive
    elements.append(Paragraph("Note:", heading2_style))
    note_text = """
    Questa analisi è stata condotta utilizzando algoritmi avanzati di computer vision e analisi grafologica. 
    I risultati devono essere sempre interpretati da un esperto grafologo qualificato per una valutazione 
    definitiva in ambito forense o legale.
    """
    elements.append(Paragraph(note_text, normal_style))
    elements.append(Spacer(1, 20))
    
    # Genera il documento PDF
    try:
        doc.build(elements)
        # Rimuoviamo questa stampa per evitare problemi con l'output JSON
        # print(f"Report PDF generato con successo: {pdf_output_path}")
        
        # Rimuovi i file temporanei dei grafici
        try:
            os.remove(chart_temp_path)
            if naturalness_chart_temp_path:
                os.remove(naturalness_chart_temp_path)
        except:
            pass
            
        return pdf_output_path
    except Exception as e:
        print(f"Errore nella generazione del PDF: {str(e)}", file=sys.stderr)
        return None

def compare_signatures_with_dimensions(verifica_path, comp_path, verifica_dims, reference_dims, generate_report=False, case_info=None, project_id=None):
    """
    Funzione principale per confrontare firme con dimensioni reali specifiche
    
    Args:
        verifica_path: Percorso della firma da verificare
        comp_path: Percorso della firma di riferimento
        verifica_dims: Tupla (width_mm, height_mm) per la firma da verificare
        reference_dims: Tupla (width_mm, height_mm) per la firma di riferimento
        generate_report: Se True, genera anche un report PDF
        case_info: Informazioni sul caso per il report
        project_id: ID del progetto per garantire l'isolamento dei dati
        
    Returns:
        Dizionario con i risultati dell'analisi
    """
    try:
        # Carica e analizza le immagini
        verifica_img = cv2.imread(verifica_path, cv2.IMREAD_GRAYSCALE)
        comp_img = cv2.imread(comp_path, cv2.IMREAD_GRAYSCALE)
        
        if verifica_img is None or comp_img is None:
            raise ValueError("Impossibile leggere una o entrambe le immagini")
        
        # Preprocessa le immagini
        processed_verifica = preprocess_image(verifica_img)
        processed_comp = preprocess_image(comp_img)
        
        # Calcola le metriche SSIM
        similarity, _ = ssim(processed_verifica, processed_comp, full=True)
        
        # Analizza le firme con dimensioni reali specifiche - SEMPRE ricalcola per avere parametri freschi
        print(f"DEBUG - Ricalcolo parametri da immagini per garantire consistenza", file=sys.stderr)
        verifica_data = analyze_signature_with_dimensions(verifica_path, verifica_dims[0], verifica_dims[1])
        comp_data = analyze_signature_with_dimensions(comp_path, reference_dims[0], reference_dims[1])
        
        if not verifica_data or not comp_data:
            raise ValueError("Errore nell'analisi di una o entrambe le firme")
        
        print(f"DEBUG - Parametri verifica calcolati: {list(verifica_data.keys())}", file=sys.stderr)
        print(f"DEBUG - Parametri comp calcolati: {list(comp_data.keys())}", file=sys.stderr)
        print(f"DEBUG - Inclination verifica: {verifica_data.get('Inclination', 'MISSING')}", file=sys.stderr)
        print(f"DEBUG - Inclination comp: {comp_data.get('Inclination', 'MISSING')}", file=sys.stderr)
            
        # NORMALIZZA per il grafico - garantisce che le chiavi siano nella forma corretta (maiuscole)
        verifica_data_normalized = normalize_parameter_keys(verifica_data)
        comp_data_normalized = normalize_parameter_keys(comp_data)
        
        print(f"DEBUG CHART - Prima normalizzazione: inclination={verifica_data.get('inclination', 'MISSING')}", file=sys.stderr)
        print(f"DEBUG CHART - Dopo normalizzazione: Inclination={verifica_data_normalized.get('Inclination', 'MISSING')}", file=sys.stderr)
        print(f"DEBUG CHART - Chiavi normalizzate: {list(verifica_data_normalized.keys())}", file=sys.stderr)
        
        # Crea il grafico di confronto con parametri normalizzati
        chart_img = create_comparison_chart(verifica_data_normalized, comp_data_normalized)
        
        # === NUOVO: GRAFICO DI NATURALEZZA ===
        naturalness_chart_img = create_naturalness_chart(verifica_data_normalized, comp_data_normalized)
        
        # Crea il report descrittivo
        description = create_descriptive_report(verifica_data, comp_data)
        
        # Genera il report se richiesto
        report_path = None
        if generate_report:
            output_dir = tempfile.mkdtemp()
            report_path_base = os.path.join(output_dir, f"report_firma_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            report_pdf_path = f"{report_path_base}.pdf"
            try:
                # Genera il report PDF
                # Se l'ID del progetto è presente, lo includiamo nel nome del file
                if project_id is not None:
                    # Aggiorniamo il nome del file per includere l'ID del progetto
                    output_dir = os.path.dirname(report_pdf_path)
                    report_filename = f"report_firma_project_{project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
                    report_pdf_path = os.path.join(output_dir, report_filename)
                    print(f"Report path aggiornato con project_id={project_id}: {report_pdf_path}", file=sys.stderr)
                
                # Passiamo l'ID del progetto e le dimensioni reali alla funzione di generazione del report
                report_path = generate_pdf_report(verifica_path, comp_path, verifica_data, comp_data, similarity, report_pdf_path, case_info, project_id, verifica_dims, reference_dims)
                # Nessun output qui per evitare problemi con JSON
            except Exception as e:
                print(f"Errore nella generazione del report: {str(e)}", file=sys.stderr)
        
        # Calcola il punteggio finale pesato combinando SSIM e parametri graphologici
        def calculate_parameter_compatibility(ref_val, ver_val, param_name):
            """Calcola compatibilità di un singolo parametro con logica migliorata"""
            if ref_val is None or ver_val is None:
                return 0.5  # Compatibilità neutra se mancano dati
                
            # Gestione parametri qualitativi (stringhe)
            if param_name in ['WritingStyle', 'Readability']:
                if isinstance(ref_val, str) and isinstance(ver_val, str):
                    if ref_val.lower() == ver_val.lower():
                        return 1.0  # Identico = 100%
                    elif param_name == 'Readability':
                        # Alta-Media-Bassa: compatibilità graduale
                        levels = {'alta': 3, 'media': 2, 'bassa': 1}
                        ref_level = levels.get(ref_val.lower(), 2)
                        ver_level = levels.get(ver_val.lower(), 2)
                        diff_levels = abs(ref_level - ver_level)
                        return max(0.3, 1 - (diff_levels * 0.35))  # 65% se diff=1, 30% se diff=2
                    else:
                        return 0.5  # WritingStyle diverso = 50%
                return 0.5
                
            # Gestione parametri numerici
            diff = abs(ref_val - ver_val)
            max_val = max(abs(ref_val), abs(ver_val))
            
            # Per parametri con valori molto piccoli (asole, baseline), usa soglie assolute
            if param_name in ['AvgAsolaSize', 'BaselineStdMm']:
                if diff <= 0.05: return 0.95
                elif diff <= 0.1: return 0.80
                elif diff <= 0.2: return 0.60
                else: return max(0, 1 - (diff * 2))  # Scala lineare
            
            # Per altri parametri, usa logica relativa migliorata
            if max_val > 0:
                relative_diff = diff / max_val
                if relative_diff <= 0.05: return 0.98
                elif relative_diff <= 0.1: return 0.90
                elif relative_diff <= 0.15: return 0.80
                elif relative_diff <= 0.25: return 0.60  # === NUOVO: soglia intermedia ===
                elif relative_diff <= 0.50: return 0.30  # === NUOVO: soglia per grandi differenze ===
                else: return max(0.10, 1 - relative_diff)  # === CORRETTO: minimo 10% invece di 0% ===
            else:
                return 1.0  # Entrambi zero = perfetta compatibilità
        
        # Lista parametri chiave per il calcolo pesato - usa TUTTI i parametri disponibili
        key_parameters = [
            ('PressureMean', 0.16),     # 16% - pressione media (molto stabile)
            ('AvgCurvature', 0.14),     # 14% - curvatura (caratteristica distintiva) 
            ('Proportion', 0.12),       # 12% - proporzioni (aspect ratio)
            ('Velocity', 0.10),         # 10% - velocità 
            ('PressureStd', 0.08),      # 8%  - variazione pressione (importante!)
            ('AvgAsolaSize', 0.08),     # 8%  - dimensione asole
            ('AvgSpacing', 0.06),       # 6%  - spaziatura
            ('Inclination', 0.05),      # 5%  - inclinazione
            ('OverlapRatio', 0.05),     # 5%  - sovrapposizioni
            ('LetterConnections', 0.05), # 5%  - connessioni
            ('BaselineStdMm', 0.04),    # 4%  - baseline 
            ('StrokeComplexity', 0.04), # 4%  - complessità del tratto
            ('ConnectedComponents', 0.02), # 2%  - numero componenti
            ('WritingStyle', 0.01),     # 1%  - stile (qualitativo)
            ('Readability', 0.00),      # 0%  - leggibilità (qualitativo, rimosso per spazio)
        ]
        
        # Calcola punteggio parametri pesato
        total_weight = 0
        weighted_score = 0
        
        for param_name, weight in key_parameters:
            ref_val = comp_data.get(param_name)
            ver_val = verifica_data.get(param_name) 
            
            if ref_val is not None and ver_val is not None:
                compatibility = calculate_parameter_compatibility(ref_val, ver_val, param_name)
                weighted_score += compatibility * weight
                total_weight += weight
        
        # Normalizza il punteggio parametri
        if total_weight > 0:
            parameters_score = weighted_score / total_weight
        else:
            parameters_score = 0.5  # Fallback se nessun parametro disponibile
            
        # Combina SSIM (60%) + Parametri (40%) per punteggio finale - più peso all'analisi visuale
        final_similarity = (similarity * 0.6) + (parameters_score * 0.4)
        
        print(f"DEBUG SCORING - SSIM: {similarity:.3f}, Parameters: {parameters_score:.3f}, Final: {final_similarity:.3f}", file=sys.stderr)

        # ==============================================
        # NUOVA CLASSIFICAZIONE INTELLIGENTE CON NATURALEZZA
        # ==============================================
        
        # Estrai l'Indice di Naturalezza dalle firme analizzate
        verifica_naturalness = verifica_data.get('NaturalnessIndex', 50.0)  # Default neutro
        reference_naturalness = comp_data.get('NaturalnessIndex', 50.0)     # Default neutro
        
        # Calcola la naturalezza media (considerando entrambe le firme)
        avg_naturalness = (verifica_naturalness + reference_naturalness) / 2.0
        
        print(f"[CLASSIFICAZIONE] Similarity: {final_similarity*100:.1f}%, Naturalness: {avg_naturalness:.1f}%", file=sys.stderr)
        
        # Implementa classificazione a matrice 2D (Similarità vs Naturalezza)
        def classify_signature_intelligent(similarity_pct, naturalness_pct):
            """
            Classificazione intelligente basata su matrice 2D
            
            Args:
                similarity_pct: Percentuale di similarità (0-100)
                naturalness_pct: Percentuale di naturalezza (0-100)
                
            Returns:
                Tupla (verdict, confidence, explanation)
            """
            # Converti in percentuali per chiarezza
            sim = similarity_pct * 100  # similarity_pct è 0-1, convertire in 0-100
            nat = naturalness_pct        # naturalness_pct è già 0-100
            
            # MATRICE DI CLASSIFICAZIONE 2D
            
            # REGOLA PRIORITARIA: Similarità quasi perfetta = Autentica (indipendentemente dalla naturalezza)
            if sim >= 98:
                return ("Autentica", 98, "Similarità quasi perfetta - firma identica")
            
            # Caso 1: Alta similarità + Alta naturalezza = AUTENTICA
            if sim >= 85 and nat >= 80:
                return ("Autentica", 95, "Alta similarità e movimenti naturali")
            
            # Caso 2: Alta similarità + Bassa naturalezza = POSSIBILE COPIA ABILE
            elif sim >= 85 and nat < 60:
                return ("Possibile copia abile", 70, "Alta similarità ma movimenti innaturali")
            
            # Caso 3: Similarità intermedia + Alta naturalezza = AUTENTICA DISSIMULATA ⭐
            elif 55 <= sim < 65 and nat >= 80:
                return ("Autentica dissimulata", 85, "Modificata intenzionalmente ma autentica")
                
            # Caso 4A: Similarità molto bassa + Alta naturalezza = SOSPETTA (possibile imitazione naturale)
            elif sim < 55 and nat >= 80:
                return ("Sospetta", 75, "Similarità troppo bassa - possibile imitazione naturale")
                
            # Caso 4B: Bassa similarità + Bassa naturalezza = PROBABILMENTE FALSA
            elif sim < 65 and nat < 60:
                return ("Probabilmente falsa", 90, "Bassa similarità e movimenti innaturali")
            
            # Casi intermedi: similarità media
            elif 65 <= sim < 85:
                if nat >= 75:
                    return ("Probabilmente autentica", 75, "Similarità accettabile e movimenti naturali")
                elif nat < 50:
                    return ("Sospetta", 60, "Similarità media ma movimenti innaturali")
                else:
                    return ("Incerta", 50, "Similarità e naturalezza intermedie")
            
            # Casi intermedi: naturalezza media
            elif 60 <= nat < 80:
                if sim >= 75:
                    return ("Probabilmente autentica", 75, "Alta similarità e naturalezza accettabile")
                else:
                    return ("Sospetta", 65, "Parametri nel range intermedio")
            
            # Fallback
            else:
                return ("Incerta", 50, "Parametri nel range intermedio")
        
        # Applica la nuova classificazione
        verdict, confidence, explanation = classify_signature_intelligent(final_similarity, avg_naturalness)
        
        print(f"[CLASSIFICAZIONE] Risultato: {verdict} (confidenza: {confidence}%) - {explanation}", file=sys.stderr)
        
        # ==============================================
        # FINE NUOVA CLASSIFICAZIONE
        # ==============================================
        
        # Prepara il risultato con la nuova classificazione
        result = {
            "similarity": final_similarity,  # Punteggio tradizionale per compatibilità
            "naturalness": avg_naturalness / 100.0,  # Nuovo: Indice di naturalezza (0-1)
            "verdict": verdict,  # Nuova classificazione intelligente
            "confidence": confidence,  # Nuovo: Livello di confidenza
            "explanation": explanation,  # Nuovo: Spiegazione del risultato
            "verifica_parameters": verifica_data,
            "reference_parameters": comp_data,
            "comparison_chart": chart_img,
            "naturalness_chart": naturalness_chart_img,  # === NUOVO GRAFICO DI NATURALEZZA ===
            "description": description,
            "report_path": report_path if report_path else None
        }
        
        return result
    
    except Exception as e:
        print(f"Errore durante il confronto delle firme con dimensioni: {str(e)}", file=sys.stderr)
        return {"error": str(e)}

# ==============================================
# FUNZIONI PER L'INDICE DI NATURALEZZA
# ==============================================

def calculate_fluidity_score(binary: np.ndarray, contours: list) -> float:
    """
    Calcola il punteggio di fluidità basato sulla smoothness dei contorni
    
    Args:
        binary: Immagine binaria della firma
        contours: Lista dei contorni della firma
        
    Returns:
        Score di fluidità da 0-100 (più alto = più naturale)
    """
    try:
        if not contours:
            return 0.0
        
        # Analizza la smoothness di ogni contorno
        smoothness_scores = []
        
        for contour in contours:
            if len(contour) < 10:  # Salta contorni troppo piccoli
                continue
                
            # Calcola la derivata seconda per misurare le irregolarità
            points = contour.reshape(-1, 2)
            if len(points) < 10:
                continue
                
            # Calcola le differenze tra punti consecutivi (velocità)
            dx = np.diff(points[:, 0])
            dy = np.diff(points[:, 1])
            
            # Calcola la derivata seconda (accelerazione)
            ddx = np.diff(dx)
            ddy = np.diff(dy)
            
            # Calcola l'accelerazione totale
            acceleration = np.sqrt(ddx**2 + ddy**2)
            
            # La fluidità è inversamente proporzionale alle variazioni di accelerazione
            if len(acceleration) > 0:
                # Normalizza rispetto alla lunghezza del contorno
                contour_length = cv2.arcLength(contour, False)
                if contour_length > 0:
                    irregularity = np.std(acceleration) / contour_length
                    # Converti in score di fluidità (0-100)
                    smoothness = max(0.0, 100.0 - (irregularity * 1000))
                    smoothness_scores.append(min(100.0, smoothness))
        
        if not smoothness_scores:
            return 50.0  # Valore neutro se non ci sono contorni validi
        
        # Media pesata dei punteggi di fluidità
        return float(np.mean(smoothness_scores))
        
    except Exception as e:
        print(f"Errore nel calcolo fluidity score: {str(e)}", file=sys.stderr)
        return 50.0  # Valore neutro in caso di errore


def calculate_pressure_consistency(gray: np.ndarray, binary: np.ndarray) -> float:
    """
    Calcola la consistenza della pressione lungo il tracciato
    
    Args:
        gray: Immagine in scala di grigi
        binary: Immagine binaria della firma
        
    Returns:
        Score di consistenza pressione da 0-100 (più alto = più consistente = più naturale)
    """
    try:
        # ===== CORREZIONE: Assicura che gray e binary abbiano le stesse dimensioni =====
        if gray.shape != binary.shape:
            # Ridimensiona binary per matchare gray
            binary = cv2.resize(binary, (gray.shape[1], gray.shape[0]), interpolation=cv2.INTER_NEAREST)
            print(f"[PRESSURE CONSISTENCY] Ridimensionato binary da {binary.shape} a {gray.shape}", file=sys.stderr)
        
        # Estrae intensità dei pixel della firma
        ink_pixels = gray[binary > 0]
        if len(ink_pixels) == 0:
            return 0.0
        
        # Converte in valori di "pressione" (255 - intensità)
        pressure_values = 255 - ink_pixels
        
        if len(pressure_values) < 10:
            return 0.0
        
        # Calcola la variabilità della pressione
        pressure_mean = np.mean(pressure_values)
        pressure_std = np.std(pressure_values)
        
        # Una pressione naturale ha variabilità moderata ma non eccessiva
        # Troppo uniforme = artificiale, troppo variabile = nervosismo/controllo
        if pressure_mean == 0:
            return 0.0
            
        coefficient_variation = pressure_std / pressure_mean
        
        # Curve di naturalezza: picco intorno a 0.15-0.25 di CV
        if 0.10 <= coefficient_variation <= 0.30:
            # Range naturale - alta consistenza
            consistency_score = 90 + (10 * (1 - abs(coefficient_variation - 0.20) / 0.10))
        elif 0.05 <= coefficient_variation <= 0.40:
            # Range accettabile
            consistency_score = 70 + (20 * (1 - abs(coefficient_variation - 0.20) / 0.20))
        else:
            # Troppo uniforme o troppo variabile = sospetto
            consistency_score = max(0, 50 - (abs(coefficient_variation - 0.20) * 100))
        
        return float(min(100.0, max(0.0, consistency_score)))
        
    except Exception as e:
        print(f"Errore nel calcolo pressure consistency: {str(e)}", file=sys.stderr)
        return 50.0  # Valore neutro in caso di errore


def calculate_coordination_index(contours: list, binary: np.ndarray) -> float:
    """
    Calcola l'indice di coordinazione basato sulla regolarità delle curve
    
    Args:
        contours: Lista dei contorni della firma
        binary: Immagine binaria per analisi aggiuntive
        
    Returns:
        Score di coordinazione da 0-100 (più alto = più coordinato = più naturale)
    """
    try:
        if not contours:
            return 0.0
        
        coordination_scores = []
        
        for contour in contours:
            if len(contour) < 20:  # Serve un contorno sufficientemente lungo
                continue
                
            # Analizza la regolarità delle curve
            points = contour.reshape(-1, 2)
            
            # Calcola gli angoli di curvatura
            angles = []
            for i in range(2, len(points) - 2):
                p1 = points[i-2]
                p2 = points[i]
                p3 = points[i+2]
                
                # Vettori
                v1 = p1 - p2
                v2 = p3 - p2
                
                # Calcola angolo
                cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
                cos_angle = np.clip(cos_angle, -1, 1)
                angle = np.arccos(cos_angle)
                angles.append(angle)
            
            if len(angles) < 5:
                continue
            
            # Analizza la distribuzione degli angoli
            angles = np.array(angles)
            
            # Una scrittura naturale ha angoli che seguono pattern fluidi
            # Calcola la regolarità (bassa deviazione standard = più regolare)
            angle_std = np.std(angles)
            angle_mean = np.mean(angles)
            
            # Normalizza rispetto alla lunghezza del contorno
            contour_length = cv2.arcLength(contour, False)
            if contour_length > 0:
                normalized_variation = angle_std / (angle_mean + 1e-6)
                
                # Score di coordinazione basato su regolarità ottimale
                if 0.3 <= normalized_variation <= 0.8:
                    # Range naturale di variazione
                    coord_score = 85 + (15 * (1 - abs(normalized_variation - 0.55) / 0.25))
                elif 0.1 <= normalized_variation <= 1.2:
                    # Range accettabile
                    coord_score = 60 + (25 * (1 - abs(normalized_variation - 0.55) / 0.45))
                else:
                    # Troppo rigido o troppo caotico
                    coord_score = max(0, 40 - (abs(normalized_variation - 0.55) * 50))
                
                coordination_scores.append(min(100.0, max(0.0, coord_score)))
        
        if not coordination_scores:
            return 50.0  # Valore neutro
        
        # Media pesata degli score di coordinazione
        return float(np.mean(coordination_scores))
        
    except Exception as e:
        print(f"Errore nel calcolo coordination index: {str(e)}", file=sys.stderr)
        return 50.0  # Valore neutro in caso di errore


def calculate_naturalness_index(fluidity: float, pressure_consistency: float, coordination: float) -> float:
    """
    Calcola l'Indice di Naturalezza combinando i tre componenti
    
    Args:
        fluidity: Punteggio di fluidità (0-100)
        pressure_consistency: Punteggio di consistenza pressione (0-100)  
        coordination: Punteggio di coordinazione (0-100)
        
    Returns:
        Indice di Naturalezza finale (0-100)
    """
    try:
        # Pesi per i diversi componenti (somma = 1.0)
        fluidity_weight = 0.4      # La fluidità è il più importante
        pressure_weight = 0.3      # La pressione è significativa
        coordination_weight = 0.3  # La coordinazione completa il quadro
        
        # Calcola l'indice combinato
        naturalness = (
            fluidity * fluidity_weight + 
            pressure_consistency * pressure_weight + 
            coordination * coordination_weight
        )
        
        return float(min(100.0, max(0.0, naturalness)))
        
    except Exception as e:
        print(f"Errore nel calcolo naturalness index: {str(e)}", file=sys.stderr)
        return 50.0  # Valore neutro in caso di errore

# ==============================================
# FINE FUNZIONI INDICE DI NATURALEZZA  
# ==============================================

def analyze_signature_with_dimensions(image_path, real_width_mm, real_height_mm):
    """
    Analizza una firma utilizzando dimensioni reali specifiche invece del DPI
    
    Args:
        image_path: Percorso dell'immagine della firma
        real_width_mm: Larghezza reale in mm
        real_height_mm: Altezza reale in mm
        
    Returns:
        Dizionario con i parametri estratti dalla firma
    """
    try:
        # Carica l'immagine
        image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if image is None:
            raise ValueError(f"Impossibile leggere l'immagine: {image_path}")
            
        # Ottieni le dimensioni originali dell'immagine
        original_height, original_width = image.shape
        
        # Calcola la densità di pixel per millimetro usando le dimensioni reali
        pixels_per_mm_x = original_width / real_width_mm
        pixels_per_mm_y = original_height / real_height_mm
        pixels_per_mm = (pixels_per_mm_x + pixels_per_mm_y) / 2  # Media per uniformità
        
        print(f"Calibrazione con dimensioni reali: {original_width}x{original_height}px -> {real_width_mm}x{real_height_mm}mm ({pixels_per_mm:.2f}px/mm)", file=sys.stderr)
            
        # Crea due versioni: una per l'analisi delle dimensioni reali e una per gli altri parametri
        # Per le dimensioni reali, usa l'immagine originale senza ridimensionamento
        processed_original = preprocess_image(image, resize=False)
        
        # Per gli altri parametri, usa l'immagine ridimensionata per omogeneità
        processed = preprocess_image(image, resize=True)
        
        # Trova i contorni principali
        contours, _ = cv2.findContours(processed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return {"error": "Nessun contorno trovato nell'immagine"}
        
        # Trova il contorno principale (il più grande)
        main_contour = max(contours, key=cv2.contourArea)
        
        # Calcola il bounding box del contorno principale
        x, y, w, h = cv2.boundingRect(main_contour)
        
        # Usa l'immagine originale per calcolare le dimensioni reali effettive
        contours_orig, _ = cv2.findContours(processed_original, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours_orig:
            main_contour_orig = max(contours_orig, key=cv2.contourArea)
            x_orig, y_orig, w_orig, h_orig = cv2.boundingRect(main_contour_orig)
            
            # Calcola le dimensioni reali del bounding box della firma
            actual_width_mm = w_orig / pixels_per_mm_x
            actual_height_mm = h_orig / pixels_per_mm_y
            
            print(f"Bounding box firma: {w_orig}x{h_orig}px, {actual_width_mm:.2f}x{actual_height_mm:.2f}mm ({(w_orig/original_width)*100:.1f}% x {(h_orig/original_height)*100:.1f}% dell'immagine)", file=sys.stderr)
        else:
            # Fallback se non ci sono contorni nell'immagine originale
            actual_width_mm = real_width_mm
            actual_height_mm = real_height_mm
            print(f"Fallback: usando dimensioni totali immagine: {real_width_mm}x{real_height_mm}mm", file=sys.stderr)
        
        # NUOVO APPROCCIO: Analisi completa con dimensioni reali invece di DPI
        # Non richiamare analyze_signature che usa DPI - implementa l'analisi diretta
        
        # Calcola tutti i parametri usando le dimensioni reali calibrate
        proportion = actual_width_mm / actual_height_mm if actual_height_mm > 0 else 1
        
        # Calcola l'inclinazione usando l'algoritmo robusto
        inclination = calculate_signature_inclination([main_contour])
        
        # Calcola la pressione media e deviazione standard
        pressure_mean = float(np.mean(image.flatten()))
        pressure_std = float(np.std(image.flatten()))
        
        # Calcola la curvatura
        curvature = calculate_curvature(main_contour) if len(main_contour) >= 3 else 0
        
        # Determina la leggibilità e lo stile
        readability = "Alta" if pressure_mean > 90 else "Media" if pressure_mean > 60 else "Bassa"
        style = "Corsivo" if proportion > 2 else "Stampatello" if proportion < 1.2 else "Misto"
        
        # Trova le asole (loops)
        internal_contours, _ = cv2.findContours(processed, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        asole = [cnt for cnt in internal_contours if 20 < cv2.contourArea(cnt) < 500 and calculate_circularity(cnt) > 0.5]
        avg_asola_size_mm = (np.mean([cv2.contourArea(a) for a in asole]) / (pixels_per_mm * pixels_per_mm)) if asole else 0
        
        # Calcola la spaziatura in mm
        x_positions = [cv2.boundingRect(cnt)[0] for cnt in contours]
        x_positions.sort()
        spacings = [x_positions[i+1] - x_positions[i] for i in range(len(x_positions)-1)] if len(x_positions) > 1 else [0]
        avg_spacing_mm = (np.mean(spacings) / pixels_per_mm_x) if spacings else 0
        
        # Calcola la velocità stimata
        total_length = sum([cv2.arcLength(cnt, False) for cnt in contours])
        if contours_orig:
            straight_distance = math.hypot(w_orig, h_orig)
        else:
            straight_distance = math.hypot(w, h)
        velocity = total_length / (straight_distance + 1e-5)
        
        # Calcola il rapporto di sovrapposizione
        overlap_ratio = np.sum(processed > 0) / (w * h) if w * h > 0 else 0
        
        # Calcola le connessioni tra lettere usando l'analisi dello scheletro e la deviazione della linea di base in mm
        letter_connections = count_letter_connections(processed)
        baseline_y_positions = [pt[0][1] for cnt in contours for pt in cnt]
        baseline_std_px = np.std(baseline_y_positions) if baseline_y_positions else 0
        baseline_std_mm = baseline_std_px / pixels_per_mm_y if pixels_per_mm_y > 0 else 0
        
        # Calcola la complessità del tratto (stroke complexity)
        total_contour_points = sum([len(cnt) for cnt in contours])
        stroke_complexity = total_contour_points / (w * h) if w * h > 0 else 0
        
        # Calcola il numero di componenti connesse
        num_components = len(contours) if contours else 0
        
        # ==============================================
        # CALCOLA PARAMETRI DI NATURALEZZA
        # ==============================================
        
        print(f"[NATURALEZZA] Inizio calcolo parametri di naturalezza...", file=sys.stderr)
        
        # 1. Calcola il Fluidity Score (Punteggio di Fluidità)
        fluidity_score = calculate_fluidity_score(processed, contours)
        print(f"[NATURALEZZA] Fluidity Score: {fluidity_score:.2f}", file=sys.stderr)
        
        # 2. Calcola la Pressure Consistency (Consistenza della Pressione) 
        pressure_consistency = calculate_pressure_consistency(image, processed)
        print(f"[NATURALEZZA] Pressure Consistency: {pressure_consistency:.2f}", file=sys.stderr)
        
        # 3. Calcola il Coordination Index (Indice di Coordinazione)
        coordination_index = calculate_coordination_index(contours, processed)
        print(f"[NATURALEZZA] Coordination Index: {coordination_index:.2f}", file=sys.stderr)
        
        # 4. Calcola l'Indice di Naturalezza Combinato
        naturalness_index = calculate_naturalness_index(fluidity_score, pressure_consistency, coordination_index)
        print(f"[NATURALEZZA] Naturalness Index FINALE: {naturalness_index:.2f}", file=sys.stderr)
        
        # ==============================================
        # FINE CALCOLI NATURALEZZA
        # ==============================================
        
        # Costruisci il risultato con i parametri calibrati alle dimensioni reali
        result = {
            'real_width_mm': real_width_mm,
            'real_height_mm': real_height_mm,
            'pixels_per_mm': pixels_per_mm,
            'Proportion': proportion,
            'Inclination': inclination,
            'PressureMean': pressure_mean,
            'PressureStd': pressure_std,
            'AvgCurvature': curvature,
            'Readability': readability,
            'WritingStyle': style,
            'AvgAsolaSize': avg_asola_size_mm,  # In mm²
            'AvgSpacing': avg_spacing_mm,      # In mm
            'Velocity': velocity,
            'OverlapRatio': overlap_ratio,
            'LetterConnections': letter_connections,
            'BaselineStdMm': baseline_std_mm,  # In mm
            'StrokeComplexity': stroke_complexity,  # Densità dei punti del contorno
            'ConnectedComponents': num_components,  # Numero di componenti separate
            'Dimensions': (actual_width_mm, actual_height_mm),
            
            # ==============================================
            # NUOVI PARAMETRI DI NATURALEZZA
            # ==============================================
            'FluidityScore': fluidity_score,          # Punteggio di fluidità (0-100)
            'PressureConsistency': pressure_consistency,  # Consistenza della pressione (0-100)
            'CoordinationIndex': coordination_index,   # Indice di coordinazione (0-100)  
            'NaturalnessIndex': naturalness_index      # Indice di naturalezza finale (0-100)
        }
            
        return result
        
    except Exception as e:
        print(f"Errore nell'analisi della firma con dimensioni: {str(e)}", file=sys.stderr)
        return {"error": str(e)}

def compare_signatures_deprecated(verifica_path, comp_path, generate_report=False, case_info=None, project_id=None, dpi=DEFAULT_DPI):
    """
    FUNZIONE DEPRECATA - utilizzare compare_signatures_with_dimensions
    Questa funzione è mantenuta solo per compatibilità temporanea
    """
    print(f"ATTENZIONE: Uso di funzione deprecata che usa DPI. Utilizzare sempre dimensioni reali.", file=sys.stderr)
    return {"error": "Funzione deprecata - utilizzare sempre dimensioni reali invece di DPI"}

def adapt_parameters_for_json(params):
    """
    Adatta i parametri estratti per la serializzazione JSON
    
    Args:
        params: Dizionario di parametri estratti dall'analisi
        
    Returns:
        Dizionario adattato per JSON
    """
    result = {}
    for key, value in params.items():
        if isinstance(value, (list, tuple)) and len(value) == 2 and isinstance(value[0], (int, float)) and isinstance(value[1], (int, float)):
            # Converte tuple e liste di dimensione 2 in oggetti e arrotonda a 1 decimale per chiarezza
            # Questo è particolarmente importante per le dimensioni
            result[key] = {"width": round(value[0], 1), "height": round(value[1], 1)}
        elif isinstance(value, np.ndarray):
            # Converte array NumPy in liste
            result[key] = value.tolist()
        elif isinstance(value, (np.int32, np.int64, np.float32, np.float64)):
            # Converte tipi NumPy in tipi Python nativi
            result[key] = float(value) if "float" in str(type(value)) else int(value)
        else:
            result[key] = value
    return result

# Funzione principale per l'esecuzione come script
if __name__ == "__main__":
    # Supporto per test di analisi singola con dimensioni
    if len(sys.argv) >= 4 and sys.argv[1] == "--analyze-dimensions":
        try:
            image_path = sys.argv[2]
            width_mm = float(sys.argv[3])
            height_mm = float(sys.argv[4])
            
            print(f"Test analisi singola: {image_path} con dimensioni {width_mm}x{height_mm}mm", file=sys.stderr)
            result = analyze_signature_with_dimensions(image_path, width_mm, height_mm)
            
            # Formatta il risultato nel formato che il bridge TypeScript si aspetta
            if result and "error" not in result:
                formatted_result = {
                    "verifica_parameters": result
                }
                print(json.dumps(formatted_result))
            else:
                print(json.dumps(result))
            sys.exit(0)
        except Exception as e:
            print(f"Errore nell'analisi singola: {str(e)}", file=sys.stderr)
            sys.exit(1)
    
    if len(sys.argv) < 3:
        print("Uso: python advanced-signature-analyzer.py <firma_verifica> <firma_comp> [--report] [--case-info <json>] [--project-id <id>]", file=sys.stderr)
        print("      python advanced-signature-analyzer.py --analyze-dimensions <immagine> <larghezza_mm> <altezza_mm>", file=sys.stderr)
        sys.exit(1)
    
    verifica_path = sys.argv[1]
    comp_path = sys.argv[2]
    generate_report = "--report" in sys.argv
    
    # Recupera le informazioni sul caso se presenti
    case_info = None
    if "--case-info" in sys.argv:
        try:
            idx = sys.argv.index("--case-info")
            if idx + 1 < len(sys.argv):
                case_info = json.loads(sys.argv[idx + 1])
                print(f"Case info recuperate: {case_info}", file=sys.stderr)
        except Exception as e:
            print(f"Errore nel parsing delle informazioni sul caso: {e}", file=sys.stderr)
    
    # Recupera l'ID del progetto se presente
    project_id = None
    if "--project-id" in sys.argv:
        try:
            idx = sys.argv.index("--project-id")
            if idx + 1 < len(sys.argv):
                project_id = int(sys.argv[idx + 1])
                print(f"Project ID recuperato: {project_id}", file=sys.stderr)
        except Exception as e:
            print(f"Errore nel parsing dell'ID del progetto: {e}", file=sys.stderr)
    
    # Recupera le dimensioni reali se presenti
    verifica_dimensions = None
    reference_dimensions = None
    
    if "--verifica-dimensions" in sys.argv:
        try:
            idx = sys.argv.index("--verifica-dimensions")
            if idx + 1 < len(sys.argv):
                dims = sys.argv[idx + 1].split('x')
                if len(dims) == 2:
                    verifica_dimensions = (float(dims[0]), float(dims[1]))
                    print(f"Dimensioni verifica: {verifica_dimensions[0]}x{verifica_dimensions[1]}mm", file=sys.stderr)
        except Exception as e:
            print(f"Errore nel parsing delle dimensioni verifica: {e}", file=sys.stderr)
    
    if "--reference-dimensions" in sys.argv:
        try:
            idx = sys.argv.index("--reference-dimensions")
            if idx + 1 < len(sys.argv):
                dims = sys.argv[idx + 1].split('x')
                if len(dims) == 2:
                    reference_dimensions = (float(dims[0]), float(dims[1]))
                    print(f"Dimensioni reference: {reference_dimensions[0]}x{reference_dimensions[1]}mm", file=sys.stderr)
        except Exception as e:
            print(f"Errore nel parsing delle dimensioni reference: {e}", file=sys.stderr)
    
    # Solo dimensioni reali sono supportate - no fallback ai DPI
    if verifica_dimensions and reference_dimensions:
        print(f"Confronto tra firme con dimensioni reali - verifica={verifica_dimensions[0]}x{verifica_dimensions[1]}mm, reference={reference_dimensions[0]}x{reference_dimensions[1]}mm", file=sys.stderr)
        result = compare_signatures_with_dimensions(verifica_path, comp_path, verifica_dimensions, reference_dimensions, generate_report, case_info, project_id)
    else:
        print(f"ERRORE: Dimensioni reali obbligatorie per entrambe le firme - no DPI fallback", file=sys.stderr)
        result = {"error": "Dimensioni reali obbligatorie per entrambe le firme"}
    
    # Adatta i parametri per JSON
    if "verifica_parameters" in result:
        result["verifica_parameters"] = adapt_parameters_for_json(result["verifica_parameters"])
    if "reference_parameters" in result:
        result["reference_parameters"] = adapt_parameters_for_json(result["reference_parameters"])
    
    # Stampa il risultato come JSON
    print(json.dumps(result))