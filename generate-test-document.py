#!/usr/bin/env python3
"""
Generatore di documento di test per il sistema OCR
Crea un PDF con testo in italiano per testare l'estrazione e il salvataggio nella base di conoscenza
"""

from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

def create_test_document():
    """Crea un documento PDF di test per il sistema OCR"""
    
    # Nome del file di output
    output_path = "/home/runner/workspace/attached_assets/documento_test_ocr.pdf"
    
    # Crea il documento
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=18
    )
    
    # Ottieni gli stili predefiniti
    styles = getSampleStyleSheet()
    
    # Crea stili personalizzati
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=1  # Centrato
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=20,
        textColor='blue'
    )
    
    normal_style = styles['Normal']
    normal_style.fontSize = 11
    normal_style.spaceAfter = 12
    
    # Contenuto del documento
    story = []
    
    # Titolo principale
    story.append(Paragraph("Documento di Test per Sistema OCR", title_style))
    story.append(Spacer(1, 20))
    
    # Introduzione
    story.append(Paragraph("Introduzione all'Analisi Grafologica", subtitle_style))
    story.append(Paragraph(
        "L'analisi grafologica forense rappresenta una disciplina scientifica "
        "che studia la scrittura manuale per identificare caratteristiche "
        "individuali dello scrivente. Questa tecnica viene utilizzata in "
        "ambito giudiziario per verificare l'autenticità di documenti, "
        "firme e manoscritti di varia natura.",
        normal_style
    ))
    
    # Parametri tecnici
    story.append(Paragraph("Parametri Tecnici di Analisi", subtitle_style))
    story.append(Paragraph(
        "I principali parametri analizzati includono:",
        normal_style
    ))
    story.append(Paragraph(
        "• <b>Pressione del tratto:</b> Misurata attraverso la profondità "
        "dell'incisione sulla carta e l'intensità dell'inchiostro",
        normal_style
    ))
    story.append(Paragraph(
        "• <b>Velocità di scrittura:</b> Determinata dall'analisi dei "
        "collegamenti tra le lettere e dalla fluidità del movimento",
        normal_style
    ))
    story.append(Paragraph(
        "• <b>Inclinazione:</b> Angolo di inclinazione delle aste ascendenti "
        "e discendenti rispetto alla linea di base",
        normal_style
    ))
    story.append(Paragraph(
        "• <b>Dimensioni:</b> Altezza e larghezza delle lettere, "
        "proporzioni tra zone grafiche diverse",
        normal_style
    ))
    
    # Metodologia
    story.append(Paragraph("Metodologia di Confronto", subtitle_style))
    story.append(Paragraph(
        "Il processo di verifica grafologica prevede diverse fasi operative:",
        normal_style
    ))
    story.append(Paragraph(
        "1. <b>Acquisizione del campione:</b> Digitalizzazione ad alta "
        "risoluzione del documento da analizzare (minimo 300 DPI)",
        normal_style
    ))
    story.append(Paragraph(
        "2. <b>Preprocessing dell'immagine:</b> Applicazione di filtri "
        "per migliorare la qualità e ridurre il rumore",
        normal_style
    ))
    story.append(Paragraph(
        "3. <b>Estrazione dei parametri:</b> Calcolo automatico delle "
        "caratteristiche morfometriche della scrittura",
        normal_style
    ))
    story.append(Paragraph(
        "4. <b>Confronto statistico:</b> Analisi comparativa con "
        "campioni di riferimento utilizzando algoritmi di machine learning",
        normal_style
    ))
    
    # Conclusioni
    story.append(Paragraph("Applicazioni Pratiche", subtitle_style))
    story.append(Paragraph(
        "Il sistema GrapholexInsight implementa queste metodologie "
        "attraverso un'interfaccia user-friendly che permette agli esperti "
        "di condurre analisi approfondite con risultati scientificamente "
        "validati. L'integrazione con tecnologie OCR avanzate consente "
        "l'elaborazione automatica di documenti testuali per l'arricchimento "
        "della base di conoscenza del sistema.",
        normal_style
    ))
    
    story.append(Spacer(1, 30))
    story.append(Paragraph(
        "<i>Documento generato automaticamente per test del sistema OCR - "
        "GrapholexInsight v2.0</i>",
        ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=9,
            textColor='gray',
            alignment=1
        )
    ))
    
    # Costruisci il PDF
    doc.build(story)
    
    print(f"Documento PDF creato: {output_path}")
    return output_path

if __name__ == "__main__":
    create_test_document()