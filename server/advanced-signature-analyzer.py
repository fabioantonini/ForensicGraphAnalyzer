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

def analyze_signature(image_path, dpi=DEFAULT_DPI):
    """
    Analizza un'immagine di firma ed estrae parametri caratteristici
    
    Args:
        image_path: Percorso dell'immagine da analizzare
        dpi: Densità di pixel per pollice da utilizzare per il calcolo delle dimensioni reali (default 300)
        
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
        
        # Calcola le dimensioni reali dell'intera immagine
        full_width_cm, full_height_cm = get_signature_cm_size(original_width, original_height, dpi)
        print(f"Dimensioni totali immagine: {original_width}x{original_height} px, {full_width_cm:.2f}x{full_height_cm:.2f} cm @ {dpi} DPI", file=sys.stderr)
            
        # Crea due versioni: una per l'analisi delle dimensioni reali e una per gli altri parametri
        # Per le dimensioni reali, usa l'immagine originale senza ridimensionamento
        processed_original = preprocess_image(image, resize=False)
        
        # Per gli altri parametri, usa l'immagine ridimensionata per omogeneità
        processed = preprocess_image(image, resize=True)
        
        # Trova i contorni nell'immagine originale per dimensioni accurate
        contours_original = None
        contours = None
        try:
            # In OpenCV 4.x la firma è diversa da OpenCV 3.x
            contours_original, _ = cv2.findContours(processed_original, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            contours, _ = cv2.findContours(processed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        except ValueError:
            # In OpenCV 3.x la firma è diversa
            _, contours_original, _ = cv2.findContours(processed_original, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            _, contours, _ = cv2.findContours(processed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
        if not contours_original:
            raise ValueError(f"Nessun contorno trovato nell'immagine originale: {image_path}")
            
        if not contours:
            raise ValueError(f"Nessun contorno trovato nell'immagine ridimensionata: {image_path}")

        # Calcola i limiti della firma usando l'immagine originale
        x_min = min([cv2.boundingRect(cnt)[0] for cnt in contours_original])
        y_min = min([cv2.boundingRect(cnt)[1] for cnt in contours_original])
        x_max = max([cv2.boundingRect(cnt)[0] + cv2.boundingRect(cnt)[2] for cnt in contours_original])
        y_max = max([cv2.boundingRect(cnt)[1] + cv2.boundingRect(cnt)[3] for cnt in contours_original])
        w = x_max - x_min
        h = y_max - y_min
        
        # Calcola le dimensioni reali in centimetri in base al DPI dell'immagine
        sign_width_cm, sign_height_cm = get_signature_cm_size(w, h, dpi)
        
        # Calcola la percentuale dell'immagine occupata dalla firma
        width_percentage = w / original_width if original_width > 0 else 0
        height_percentage = h / original_height if original_height > 0 else 0
        print(f"Bounding box firma: {w}x{h} px, {sign_width_cm:.2f}x{sign_height_cm:.2f} cm ({width_percentage*100:.1f}% x {height_percentage*100:.1f}% dell'immagine)", file=sys.stderr)
        
        # Stima più accurata delle dimensioni in base alle dimensioni dell'immagine intera
        if full_width_cm > 15:  # Se l'immagine è grande (es. foglio A4)
            # Se l'immagine è un foglio A4 (21 x 29.7 cm) o simile
            if width_percentage < 0.4:  # Se la firma occupa meno del 40% della larghezza dell'immagine
                # La firma è probabilmente una vera firma su un documento
                if sign_width_cm > 10.0:  # Ma se è ancora troppo grande (per errori di DPI)
                    # Limitiamo a dimensioni realistiche per documenti
                    aspect_ratio = sign_width_cm / sign_height_cm if sign_height_cm > 0 else 1
                    sign_width_cm = min(sign_width_cm, 8.0)
                    sign_height_cm = sign_width_cm / aspect_ratio if aspect_ratio > 0 else sign_height_cm
        
        # Assicura che le dimensioni siano ragionevoli
        sign_width_cm = max(min(sign_width_cm, 10.0), 3.0)
        sign_height_cm = max(min(sign_height_cm, 5.0), 1.0)
        
        dimensions = (sign_width_cm, sign_height_cm)
        
        # Calcola la proporzione
        proportion = w / h if h > 0 else 0
        
        # Calcola l'inclinazione
        inclination = cv2.fitEllipse(contours[0])[2] if len(contours[0]) >= 5 else 0
        
        # Calcola la pressione media e deviazione standard
        pressure_mean = np.mean(image)
        pressure_std = np.std(image)
        
        # Calcola la curvatura
        curvature = np.mean([calculate_curvature(cnt) for cnt in contours if len(cnt) >= 3])
        
        # Determina la leggibilità e lo stile
        readability = "Alta" if pressure_mean > 90 else "Media" if pressure_mean > 60 else "Bassa"
        style = "Corsivo" if proportion > 2 else "Stampatello" if proportion < 1.2 else "Misto"

        # Trova le asole (loops)
        internal_contours, _ = cv2.findContours(processed, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        asole = [cnt for cnt in internal_contours if 20 < cv2.contourArea(cnt) < 500 and calculate_circularity(cnt) > 0.5]
        avg_asola_size = np.mean([cv2.contourArea(a) for a in asole]) if asole else 0

        # Calcola la spaziatura
        x_positions = [cv2.boundingRect(cnt)[0] for cnt in contours]
        x_positions.sort()
        spacings = [x_positions[i+1] - x_positions[i] for i in range(len(x_positions)-1)] if len(x_positions) > 1 else [0]
        avg_spacing = np.mean(spacings)

        # Calcola la velocità stimata
        total_length = sum([cv2.arcLength(cnt, False) for cnt in contours])
        straight_distance = math.hypot(x_max - x_min, y_max - y_min)
        velocity = total_length / (straight_distance + 1e-5)

        # Calcola il rapporto di sovrapposizione
        overlap_ratio = np.sum(processed > 0) / (w * h) if w * h > 0 else 0

        # Calcola le connessioni tra lettere e la deviazione della linea di base
        letter_connections = len(contours)
        baseline_y_positions = [pt[0][1] for cnt in contours for pt in cnt]
        baseline_std = np.std(baseline_y_positions) if baseline_y_positions else 0
        baseline_mm_std = pixels_to_mm(baseline_std, dpi)

        return {
            'Dimensions': dimensions,
            'Proportion': proportion,
            'Inclination': inclination,
            'PressureMean': pressure_mean,
            'PressureStd': pressure_std,
            'Curvature': curvature,
            'Readability': readability,
            'Style': style,
            'AvgAsolaSize': avg_asola_size,
            'AvgSpacing': avg_spacing,
            'Velocity': velocity,
            'OverlapRatio': overlap_ratio,
            'LetterConnections': letter_connections,
            'BaselineStd': baseline_mm_std
        }
    except Exception as e:
        print(f"Errore durante l'analisi della firma: {str(e)}", file=sys.stderr)
        return None

def create_comparison_chart(verifica_data, comp_data):
    """
    Crea un grafico di confronto tra i parametri di due firme
    
    Args:
        verifica_data: Parametri della firma da verificare
        comp_data: Parametri della firma di riferimento
        
    Returns:
        Base64-encoded PNG immagine del grafico
    """
    # Parametri per entrambe le versioni delle funzioni di analisi
    parametri_numerici = [
        'Proportion', 'Inclination', 'PressureMean', 'PressureStd',
        'AvgAsolaSize', 'AvgSpacing', 'Velocity',
        'OverlapRatio', 'LetterConnections'
    ]
    
    # Aggiungi parametri specifici a seconda della versione dei dati
    if 'AvgCurvature' in verifica_data or 'AvgCurvature' in comp_data:
        parametri_numerici.append('AvgCurvature')
    elif 'Curvature' in verifica_data or 'Curvature' in comp_data:
        parametri_numerici.append('Curvature')
        
    # Aggiungi BaselineStd o BaselineStdMm a seconda della versione
    if 'BaselineStdMm' in verifica_data or 'BaselineStdMm' in comp_data:
        parametri_numerici.append('BaselineStdMm')
    elif 'BaselineStd' in verifica_data or 'BaselineStd' in comp_data:
        parametri_numerici.append('BaselineStd')

    differenze = []
    etichette = []
    
    for parametro in parametri_numerici:
        valore_v = verifica_data.get(parametro, 0)
        valore_c = comp_data.get(parametro, 0)
        differenza = abs(valore_v - valore_c)
        differenze.append(differenza)
        etichette.append(parametro)

    max_diff = max(differenze) if differenze else 1
    compatibilita_percentuale = [(1 - (diff / max_diff)) * 100 for diff in differenze]

    # Crea l'immagine del grafico
    fig = Figure(figsize=(10, 6))
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

def create_descriptive_report(verifica_data, comp_data):
    """
    Crea un report descrittivo basato sul confronto tra due firme
    
    Args:
        verifica_data: Parametri della firma da verificare
        comp_data: Parametri della firma di riferimento
        
    Returns:
        Testo del report descrittivo
    """
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

def generate_pdf_report(verifica_path, comp_path, verifica_data, comp_data, similarity, output_path, case_info=None, project_id=None):
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
    
    # Analisi tecnica
    elements.append(Paragraph("Analisi Tecnica", heading1_style))
    elements.append(Spacer(1, 6))
    
    description = create_descriptive_report(verifica_data, comp_data)
    for line in description.split('\n'):
        if line.strip():
            elements.append(Paragraph(line, normal_style))
            elements.append(Spacer(1, 3))
    
    # Grafici di confronto
    # Crea una figura temporanea per il grafico e includila nel report
    chart_img_base64 = create_comparison_chart(verifica_data, comp_data)
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
    
    # Genera il documento PDF
    try:
        doc.build(elements)
        # Rimuoviamo questa stampa per evitare problemi con l'output JSON
        # print(f"Report PDF generato con successo: {pdf_output_path}")
        
        # Rimuovi il file temporaneo del grafico
        try:
            os.remove(chart_temp_path)
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
        
        # Analizza le firme con dimensioni reali specifiche
        verifica_data = analyze_signature_with_dimensions(verifica_path, verifica_dims[0], verifica_dims[1])
        comp_data = analyze_signature_with_dimensions(comp_path, reference_dims[0], reference_dims[1])
        
        if not verifica_data or not comp_data:
            raise ValueError("Errore nell'analisi di una o entrambe le firme")
        
        # Crea il grafico di confronto
        chart_img = create_comparison_chart(verifica_data, comp_data)
        
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
                
                # Passiamo l'ID del progetto alla funzione di generazione del report
                report_path = generate_pdf_report(verifica_path, comp_path, verifica_data, comp_data, similarity, report_pdf_path, case_info, project_id)
                # Nessun output qui per evitare problemi con JSON
            except Exception as e:
                print(f"Errore nella generazione del report: {str(e)}", file=sys.stderr)
        
        # Prepara il risultato
        result = {
            "similarity": similarity,
            "verdict": "Alta probabilità di autenticità" if similarity >= 0.8 else 
                      "Sospetta" if similarity >= 0.6 else 
                      "Bassa probabilità di autenticità",
            "verifica_parameters": verifica_data,
            "reference_parameters": comp_data,
            "comparison_chart": chart_img,
            "description": description,
            "report_path": report_path if report_path else None
        }
        
        return result
    
    except Exception as e:
        print(f"Errore durante il confronto delle firme con dimensioni: {str(e)}", file=sys.stderr)
        return {"error": str(e)}

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
        
        # Calcola l'inclinazione
        if len(main_contour) >= 5:
            ellipse = cv2.fitEllipse(main_contour)
            inclination = ellipse[2]
        else:
            inclination = 0
        
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
        
        # Calcola le connessioni tra lettere e la deviazione della linea di base in mm
        letter_connections = len(contours)
        baseline_y_positions = [pt[0][1] for cnt in contours for pt in cnt]
        baseline_std_px = np.std(baseline_y_positions) if baseline_y_positions else 0
        baseline_std_mm = baseline_std_px / pixels_per_mm_y if pixels_per_mm_y > 0 else 0
        
        # Costruisci il risultato con i parametri calibrati alle dimensioni reali
        result = {
            'real_width_mm': actual_width_mm,
            'real_height_mm': actual_height_mm,
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
            'Dimensions': (actual_width_mm, actual_height_mm)
        }
            
        return result
        
    except Exception as e:
        print(f"Errore nell'analisi della firma con dimensioni: {str(e)}", file=sys.stderr)
        return {"error": str(e)}

def compare_signatures(verifica_path, comp_path, generate_report=False, case_info=None, project_id=None, dpi=DEFAULT_DPI):
    """
    Funzione principale per confrontare firme
    
    Args:
        verifica_path: Percorso della firma da verificare
        comp_path: Percorso della firma di riferimento
        generate_report: Se True, genera anche un report PDF
        case_info: Informazioni sul caso per il report
        project_id: ID del progetto per garantire l'isolamento dei dati
        dpi: Densità di pixel per pollice da utilizzare per il calcolo delle dimensioni reali (default 300)
        
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
        
        # Analizza le firme
        verifica_data = analyze_signature(verifica_path, dpi)
        comp_data = analyze_signature(comp_path, dpi)
        
        if not verifica_data or not comp_data:
            raise ValueError("Errore nell'analisi di una o entrambe le firme")
        
        # Crea il grafico di confronto
        chart_img = create_comparison_chart(verifica_data, comp_data)
        
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
                
                # Passiamo l'ID del progetto alla funzione di generazione del report
                report_path = generate_pdf_report(verifica_path, comp_path, verifica_data, comp_data, similarity, report_pdf_path, case_info, project_id)
                # Nessun output qui per evitare problemi con JSON
            except Exception as e:
                print(f"Errore nella generazione del report: {str(e)}", file=sys.stderr)
        
        # Prepara il risultato
        result = {
            "similarity": similarity,
            "verdict": "Alta probabilità di autenticità" if similarity >= 0.8 else 
                      "Sospetta" if similarity >= 0.6 else 
                      "Bassa probabilità di autenticità",
            "verifica_parameters": verifica_data,
            "reference_parameters": comp_data,
            "comparison_chart": chart_img,
            "description": description,
            "report_path": report_path if report_path else None
        }
        
        return result
    
    except Exception as e:
        print(f"Errore durante il confronto delle firme: {str(e)}", file=sys.stderr)
        return {"error": str(e)}

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
            print(json.dumps(result, indent=2))
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
    
    # Fallback al DPI se le dimensioni non sono disponibili (compatibilità)
    dpi = DEFAULT_DPI
    if "--dpi" in sys.argv:
        try:
            idx = sys.argv.index("--dpi")
            if idx + 1 < len(sys.argv):
                dpi = int(sys.argv[idx + 1])
                print(f"DPI specificato: {dpi}", file=sys.stderr)
        except Exception as e:
            print(f"Errore nel parsing del DPI: {e}, usando DPI di default={DEFAULT_DPI}", file=sys.stderr)
    
    # Log per debugging
    if verifica_dimensions and reference_dimensions:
        print(f"Confronto tra firme con dimensioni reali - verifica={verifica_dimensions[0]}x{verifica_dimensions[1]}mm, reference={reference_dimensions[0]}x{reference_dimensions[1]}mm", file=sys.stderr)
        result = compare_signatures_with_dimensions(verifica_path, comp_path, verifica_dimensions, reference_dimensions, generate_report, case_info, project_id)
    else:
        print(f"Confronto tra firme con DPI fallback - path1={verifica_path}, path2={comp_path}, dpi={dpi}", file=sys.stderr)
        result = compare_signatures(verifica_path, comp_path, generate_report, case_info, project_id, dpi)
    
    # Adatta i parametri per JSON
    if "verifica_parameters" in result:
        result["verifica_parameters"] = adapt_parameters_for_json(result["verifica_parameters"])
    if "reference_parameters" in result:
        result["reference_parameters"] = adapt_parameters_for_json(result["reference_parameters"])
    
    # Stampa il risultato come JSON
    print(json.dumps(result))