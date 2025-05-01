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

# Costante DPI
DPI = 300

def pixels_to_mm(pixels):
    """Converte i pixel in millimetri basandosi sul DPI"""
    return (pixels * 25.4) / DPI

def preprocess_image(image):
    """Prepara l'immagine per l'analisi"""
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

def analyze_signature(image_path):
    """
    Analizza un'immagine di firma ed estrae parametri caratteristici
    
    Args:
        image_path: Percorso dell'immagine da analizzare
        
    Returns:
        Dizionario con i parametri estratti dalla firma
    """
    try:
        # Carica l'immagine
        image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if image is None:
            raise ValueError(f"Impossibile leggere l'immagine: {image_path}")
        
        # Preprocessa l'immagine
        processed = preprocess_image(image)
        
        # Trova i contorni
        contours, _ = cv2.findContours(processed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            raise ValueError(f"Nessun contorno trovato nell'immagine: {image_path}")

        # Calcola i limiti della firma
        x_min = min([cv2.boundingRect(cnt)[0] for cnt in contours])
        y_min = min([cv2.boundingRect(cnt)[1] for cnt in contours])
        x_max = max([cv2.boundingRect(cnt)[0] + cv2.boundingRect(cnt)[2] for cnt in contours])
        y_max = max([cv2.boundingRect(cnt)[1] + cv2.boundingRect(cnt)[3] for cnt in contours])
        w = x_max - x_min
        h = y_max - y_min
        dimensions = (pixels_to_mm(w), pixels_to_mm(h))
        
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
        baseline_mm_std = pixels_to_mm(baseline_std)

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
    parametri_numerici = [
        'Proportion', 'Inclination', 'PressureMean', 'PressureStd',
        'Curvature', 'AvgAsolaSize', 'AvgSpacing', 'Velocity',
        'OverlapRatio', 'LetterConnections', 'BaselineStd'
    ]

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

    if abs(verifica_data['Curvature'] - comp_data['Curvature']) < 15:
        descrizione += "La curvilineità/angolosità delle firme è coerente.\n"
    else:
        descrizione += "La curvilineità/angolosità differisce sensibilmente tra le firme.\n"

    if abs(verifica_data['AvgSpacing'] - comp_data['AvgSpacing']) < 5:
        descrizione += "La spaziatura tra le lettere appare omogenea.\n"
    else:
        descrizione += "La spaziatura tra le lettere evidenzia disomogeneità.\n"

    return descrizione

def generate_pdf_report(verifica_path, comp_path, verifica_data, comp_data, similarity, output_path, case_info=None):
    # Debug info
    print(f"DEBUG_REPORT verifica_path={verifica_path}", file=sys.stderr)
    print(f"DEBUG_REPORT comp_path={comp_path}", file=sys.stderr)
    
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
    elements.append(Paragraph("Report Analisi Grafologica Forense", title_style))
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

def compare_signatures(verifica_path, comp_path, generate_report=False, case_info=None):
    """
    Funzione principale per confrontare firme
    
    Args:
        verifica_path: Percorso della firma da verificare
        comp_path: Percorso della firma di riferimento
        generate_report: Se True, genera anche un report PDF
        case_info: Informazioni sul caso per il report
        
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
        verifica_data = analyze_signature(verifica_path)
        comp_data = analyze_signature(comp_path)
        
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
                report_path = generate_pdf_report(verifica_path, comp_path, verifica_data, comp_data, similarity, report_pdf_path, case_info)
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
            # Converte tuple e liste di dimensione 2 in oggetti
            result[key] = {"width": value[0], "height": value[1]}
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
    if len(sys.argv) < 3:
        print("Uso: python advanced-signature-analyzer.py <firma_verifica> <firma_comp> [--report]", file=sys.stderr)
        sys.exit(1)
    
    verifica_path = sys.argv[1]
    comp_path = sys.argv[2]
    generate_report = "--report" in sys.argv
    
    result = compare_signatures(verifica_path, comp_path, generate_report)
    
    # Adatta i parametri per JSON
    if "verifica_parameters" in result:
        result["verifica_parameters"] = adapt_parameters_for_json(result["verifica_parameters"])
    if "reference_parameters" in result:
        result["reference_parameters"] = adapt_parameters_for_json(result["reference_parameters"])
    
    # Stampa il risultato come JSON
    print(json.dumps(result))