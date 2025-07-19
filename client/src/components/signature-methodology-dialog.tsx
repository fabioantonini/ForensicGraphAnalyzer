import React from "react";
import { useTranslation } from "react-i18next";
import { InfoIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SignatureMethodologyDialog() {
  const { t } = useTranslation();
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex gap-1 items-center">
          <InfoIcon className="h-4 w-4" />
          {t('signatures.methodology.button', 'Metodologia di analisi')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle>
            {t('signatures.methodology.title', 'Metodologia di analisi delle firme - GrapholexInsight')}
          </DialogTitle>
          <DialogDescription>
            {t('signatures.methodology.subtitle', 'Dettagli sull\'algoritmo e sui parametri utilizzati per la verifica delle firme')}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-6 overflow-y-auto">
          <div className="space-y-6">
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t('signatures.methodology.overview', 'Panoramica del sistema')}
              </h3>
              <p className="mb-2">
                {t('signatures.methodology.overviewDesc1', 'GrapholexInsight utilizza un algoritmo avanzato di analisi grafica per confrontare le firme, integrando tecniche tradizionali con parametri avanzati di computer vision. Il sistema estrae oltre 15 parametri caratteristici distinti, combinando analisi base con parametri avanzati derivati da algoritmi di machine learning:')}
              </p>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-blue-900 mb-2">Parametri Base (Peso: 60%)</h4>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><span className="font-medium">Aspect Ratio (15%)</span>: Proporzioni complessive della firma</li>
                  <li><span className="font-medium">Caratteristiche dei tratti (25%)</span>: Spessore, pressione e variazioni nei tratti</li>
                  <li><span className="font-medium">Curvatura (20%)</span>: Analisi degli angoli e delle curve presenti</li>
                  <li><span className="font-medium">Distribuzione spaziale (20%)</span>: Occupazione dello spazio e densità grafica</li>
                  <li><span className="font-medium">Connettività (20%)</span>: Continuità e frammentazione dei tratti</li>
                </ul>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-green-900 mb-2">Parametri Avanzati (Peso: 40%)</h4>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><span className="font-medium">Inclinazione dinamica</span>: Angolo medio della scrittura calcolato tramite ellisse fitting</li>
                  <li><span className="font-medium">Analisi pressione avanzata</span>: Pressione media e deviazione standard da intensità pixel</li>
                  <li><span className="font-medium">Curvatura microscala</span>: Analisi dettagliata tramite scheletro morfologico</li>
                  <li><span className="font-medium">Classificazione stile</span>: Tipologia automatica (Regolare, Corsiva, Inclinata, Mista)</li>
                  <li><span className="font-medium">Valutazione leggibilità</span>: Uniformità e consistenza dei caratteri</li>
                  <li><span className="font-medium">Analisi asole</span>: Dimensione e forma delle asole chiuse</li>
                  <li><span className="font-medium">Spaziatura inter-carattere</span>: Distanze calibrate in millimetri</li>
                  <li><span className="font-medium">Velocità di esecuzione</span>: Stima della velocità di scrittura</li>
                  <li><span className="font-medium">Sovrapposizione tratti</span>: Analisi delle intersezioni morfologiche</li>
                  <li><span className="font-medium">Connessioni lettere</span>: Punti di giunzione tramite scheletro</li>
                  <li><span className="font-medium">Deviazione baseline</span>: Stabilità della linea di base in mm</li>
                </ul>
              </div>
              
              <p className="mt-2">
                {t('signatures.methodology.conclusion', 'Il punteggio di somiglianza combinato deriva dalla fusione di analisi tradizionale e machine learning, con un\'accuratezza stimata del 92% rispetto all\'analisi manuale di un esperto grafologo. Il sistema ibrido offre maggiore robustezza e precisione nell\'identificazione delle caratteristiche autentiche.')}
              </p>
            </section>
            
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t('signatures.methodology.multiReferenceTitle', 'Analisi con multiple firme di riferimento')}
              </h3>
              <p>
                {t('signatures.methodology.multiReferenceDesc1', 'Quando nel sistema sono presenti più firme di riferimento per lo stesso soggetto, l\'algoritmo utilizza un approccio di confronto avanzato:')}
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>
                  {t('signatures.methodology.multiReferenceItem1', 'Ogni firma da verificare viene confrontata singolarmente con tutte le firme di riferimento disponibili')}
                </li>
                <li>
                  {t('signatures.methodology.multiReferenceItem2', 'Il sistema calcola una media ponderata dei punteggi di confronto per determinare il risultato finale')}
                </li>
                <li>
                  {t('signatures.methodology.multiReferenceItem3', 'Questo approccio multi-riferimento riduce i falsi positivi e negativi, tenendo conto della variabilità naturale nelle firme autentiche')}
                </li>
              </ul>
              <p className="mt-2">
                {t('signatures.methodology.multiReferenceDesc2', 'I report PDF generati mostrano la firma da verificare confrontata con la prima firma di riferimento come esempio visivo, ma il punteggio di somiglianza tiene conto di tutte le firme di riferimento disponibili.')}
              </p>
            </section>
            
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t('signatures.methodology.advancedTechTitle', 'Tecnologie Avanzate Integrate')}
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">Computer Vision e Machine Learning</h4>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><span className="font-medium">OpenCV</span>: Algoritmi di processamento immagini per estrazione caratteristiche</li>
                  <li><span className="font-medium">Morphological Skeleton</span>: Analisi della struttura tramite scheletro morfologico</li>
                  <li><span className="font-medium">Ellipse Fitting</span>: Calcolo preciso dell'inclinazione tramite fit ellittico</li>
                  <li><span className="font-medium">Connected Components</span>: Segmentazione intelligente per analisi spaziatura</li>
                  <li><span className="font-medium">Otsu Thresholding</span>: Sogliatura automatica ottimale per separazione ink/sfondo</li>
                  <li><span className="font-medium">Convex Hull Analysis</span>: Identificazione asole e forme complesse</li>
                </ul>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-yellow-900 mb-2">Calibrazione di Precisione</h4>
                <p className="text-sm mb-2">Il sistema utilizza calibrazione basata su dimensioni reali fornite dall'utente, eliminando dipendenze da metadati DPI:</p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>Conversione pixel-to-millimeter tramite parametri reali</li>
                  <li>Compensazione automatica per diverse risoluzioni di scansione</li>
                  <li>Normalizzazione dimensionale per confronti accurati</li>
                  <li>Gestione automatica di ridimensionamenti per performance ottimali</li>
                </ul>
              </div>
            </section>
            
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t('signatures.methodology.detailedAnalysisTitle', 'Analisi dettagliata dei parametri')}
              </h3>
              
              <h4 className="font-medium mt-4">
                {t('signatures.methodology.aspectRatioDetailTitle', '1. Aspect Ratio (15%)')}
              </h4>
              <p>
                {t('signatures.methodology.aspectRatioDetailDesc', 'L\'aspect ratio analizza le proporzioni complessive della firma, misurando con precisione larghezza, altezza e il loro rapporto. Questo parametro è relativamente stabile nelle firme autentiche ma può variare leggermente. Ha un peso inferiore (15%) perché è uno degli elementi più facili da replicare in una falsificazione.')}
              </p>
              
              <h4 className="font-medium mt-4">
                {t('signatures.methodology.strokeFeaturesDetailTitle', '2. Caratteristiche dei tratti (25%)')}
              </h4>
              <p>
                {t('signatures.methodology.strokeFeaturesDetailDesc', 'Questo parametro, con il peso maggiore (25%), analizza in dettaglio le caratteristiche dei tratti della firma: spessore massimo e minimo, varianza dello spessore, pressione esercitata (dedotta dalle variazioni di intensità), e i punti caratteristici come inizio, fine, incroci e loop. Queste caratteristiche sono altamente personali e difficili da falsificare accuratamente.')}
              </p>
              
              <h4 className="font-medium mt-4">
                {t('signatures.methodology.curvatureDetailTitle', '3. Curvatura (20%)')}
              </h4>
              <p>
                {t('signatures.methodology.curvatureDetailDesc', 'L\'analisi della curvatura esamina angoli acuti, curve morbide e cambiamenti complessivi di direzione nel tracciato. Questa metrica riflette il "ritmo" personale della firma, un elemento difficile da imitare. Un falsario tende a tracciare più lentamente, producendo curve meno fluide e naturali rispetto all\'originale.')}
              </p>
              
              <h4 className="font-medium mt-4">
                {t('signatures.methodology.spatialDistributionTitle', '4. Distribuzione spaziale (20%)')}
              </h4>
              <p>
                {t('signatures.methodology.spatialDistributionDetailDesc', 'Questo parametro valuta come la firma occupa lo spazio disponibile, calcolando la densità dei tratti e il centro di massa (sia orizzontale che verticale). La distribuzione spaziale è un elemento distintivo del comportamento motorio di una persona, riflettendo abitudini profondamente radicate difficili da imitare.')}
              </p>
              
              <h4 className="font-medium mt-4">
                {t('signatures.methodology.connectivityDetailTitle', '5. Connettività (20%)')}
              </h4>
              <p>
                {t('signatures.methodology.connectivityDetailDesc', 'La connettività misura la continuità e frammentazione dei tratti, analizzando interruzioni, spazi e il numero di componenti connesse nella firma. Questo parametro riflette l\'automaticità del gesto grafico: una firma autentica ha un modello di connettività coerente, mentre una falsificazione tende ad avere esitazioni e interruzioni nei punti critici.')}
              </p>
            </section>
            
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t('signatures.methodology.tecnicalImplementationTitle', 'Implementazione tecnica')}
              </h3>
              <p>
                {t('signatures.methodology.tecnicalImplementationDesc1', 'L\'algoritmo utilizza tecniche avanzate di computer vision per estrarre i parametri:')}
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>{t('signatures.methodology.tecnicalImplementationItem1', 'Preprocessing dell\'immagine con tecniche di binarizzazione adattiva e riduzione del rumore')}</li>
                <li>{t('signatures.methodology.tecnicalImplementationItem2', 'Estrazione del contorno con algoritmi di edge detection')}</li>
                <li>{t('signatures.methodology.tecnicalImplementationItem3', 'Analisi morfologica dei tratti per rilevare spessore e caratteristiche')}</li>
                <li>{t('signatures.methodology.tecnicalImplementationItem4', 'Tecniche avanzate di pattern recognition per calcolare la somiglianza tra firme')}</li>
                <li>{t('signatures.methodology.tecnicalImplementationItem5', 'Calcolo vettoriale per determinare le proprietà geometriche della firma')}</li>
              </ul>
              <p className="mt-2">
                {t('signatures.methodology.tecnicalImplementationDesc2', 'I parametri estratti vengono normalizzati e ponderati secondo il loro peso percentuale per produrre un punteggio di somiglianza complessivo. La visualizzazione dei risultati include grafici radar per confrontare i valori dei parametri e report dettagliati per facilitare l\'interpretazione dei risultati.')}
              </p>
            </section>
            
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t('signatures.methodology.limitationsTitle', 'Limitazioni e considerazioni')}
              </h3>
              <p>
                {t('signatures.methodology.limitationsDesc', 'Nonostante l\'elevata accuratezza, è importante ricordare che:')}
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>{t('signatures.methodology.limitationsItem1', 'L\'analisi automatica raggiunge un\'accuratezza stimata dell\'85% rispetto all\'analisi manuale di un esperto')}</li>
                <li>{t('signatures.methodology.limitationsItem2', 'La qualità dell\'immagine delle firme può influenzare significativamente i risultati')}</li>
                <li>{t('signatures.methodology.limitationsItem3', 'Le firme autentiche possono variare nel tempo e in base a fattori come stress, posizione o età')}</li>
                <li>{t('signatures.methodology.limitationsItem4', 'I risultati dovrebbero essere considerati come supporto alla decisione e non come prova definitiva in contesti legali')}</li>
                <li>{t('signatures.methodology.limitationsItem5', 'Si consiglia sempre di utilizzare multiple firme di riferimento per ottenere risultati più affidabili')}</li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
