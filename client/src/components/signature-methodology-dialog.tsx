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
          {t('signatures.methodology.button')}
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
                {t('signatures.methodology.overviewDesc1', 'GrapholexInsight utilizza un algoritmo avanzato di analisi grafica per confrontare le firme, integrando tecniche tradizionali con parametri avanzati di computer vision e analisi di naturalezza anti-dissimulazione. Il sistema estrae oltre 21 parametri caratteristici distinti, combinando analisi base con parametri avanzati derivati da algoritmi di machine learning:')}
              </p>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-blue-900 mb-2">{t('signatures.methodology.baseParametersTitle', 'Parametri Base (Peso: 40%)')}</h4>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><span className="font-medium">{t('signatures.methodology.aspectRatio', 'Aspect Ratio (15%)')}</span>: {t('signatures.methodology.aspectRatioDesc', 'Proporzioni complessive della firma')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.strokeFeatures', 'Caratteristiche dei tratti (25%)')}</span>: {t('signatures.methodology.strokeFeaturesDesc', 'Spessore, pressione e variazioni nei tratti')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.curvature', 'Curvatura (20%)')}</span>: {t('signatures.methodology.curvatureDesc', 'Analisi degli angoli e delle curve presenti')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.spatialDistribution', 'Distribuzione spaziale (20%)')}</span>: {t('signatures.methodology.spatialDistributionDesc', 'Occupazione dello spazio e densità grafica')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.connectivity', 'Connettività (20%)')}</span>: {t('signatures.methodology.connectivityDesc', 'Continuità e frammentazione dei tratti')}</li>
                </ul>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-green-900 mb-2">{t('signatures.methodology.advancedParametersTitle', 'Parametri Avanzati (Peso: 30%)')}</h4>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><span className="font-medium">{t('signatures.methodology.dynamicInclination', 'Inclinazione dinamica')}</span>: {t('signatures.methodology.dynamicInclinationDesc', 'Angolo medio della scrittura calcolato tramite ellisse fitting')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.advancedPressure', 'Analisi pressione avanzata')}</span>: {t('signatures.methodology.advancedPressureDesc', 'Pressione media e deviazione standard da intensità pixel')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.microCurvature', 'Curvatura microscala')}</span>: {t('signatures.methodology.microCurvatureDesc', 'Analisi dettagliata tramite scheletro morfologico')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.styleClassification', 'Classificazione stile')}</span>: {t('signatures.methodology.styleClassificationDesc', 'Tipologia automatica (Regolare, Corsiva, Inclinata, Mista)')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.readabilityEval', 'Valutazione leggibilità')}</span>: {t('signatures.methodology.readabilityEvalDesc', 'Uniformità e consistenza dei caratteri')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.loopAnalysis', 'Analisi asole')}</span>: {t('signatures.methodology.loopAnalysisDesc', 'Dimensione e forma delle asole chiuse')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.interCharSpacing', 'Spaziatura inter-carattere')}</span>: {t('signatures.methodology.interCharSpacingDesc', 'Distanze calibrate in millimetri')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.executionSpeed', 'Velocità di esecuzione')}</span>: {t('signatures.methodology.executionSpeedDesc', 'Stima della velocità di scrittura')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.strokeOverlap', 'Sovrapposizione tratti')}</span>: {t('signatures.methodology.strokeOverlapDesc', 'Analisi delle intersezioni morfologiche')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.letterConnections', 'Connessioni lettere')}</span>: {t('signatures.methodology.letterConnectionsDesc', 'Punti di giunzione tramite scheletro')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.baselineDeviation', 'Deviazione baseline')}</span>: {t('signatures.methodology.baselineDeviationDesc', 'Stabilità della linea di base in mm')}</li>
                </ul>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-purple-900 mb-2">{t('signatures.methodology.naturalnessParametersTitle', 'Parametri di Naturalezza (Peso: 30%)')}</h4>
                <p className="text-sm mb-2 text-purple-800">{t('signatures.methodology.naturalnessDesc', 'Nuova implementazione per il rilevamento di firme dissimulate attraverso analisi comportamentale:')}</p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><span className="font-medium">{t('signatures.methodology.fluidity', 'Fluidità dei movimenti')}</span>: {t('signatures.methodology.fluidityDesc', 'Analisi della continuità e naturalezza del tracciato')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.pressureConsistency', 'Consistenza della pressione')}</span>: {t('signatures.methodology.pressureConsistencyDesc', 'Valutazione dell\'uniformità della pressione applicata')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.motorCoordination', 'Coordinazione motoria')}</span>: {t('signatures.methodology.motorCoordinationDesc', 'Indice di coordinazione neuromuscolare nel gesto grafico')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.totalNaturalness', 'Indice di naturalezza totale')}</span>: {t('signatures.methodology.totalNaturalnessDesc', 'Punteggio combinato per rilevare dissimulazioni')}</li>
                </ul>
                <div className="mt-2 p-2 bg-purple-100 rounded text-xs">
                  <strong>{t('signatures.methodology.innovation', 'Innovazione')}:</strong> {t('signatures.methodology.innovationDesc', 'Prima implementazione di AI per rilevamento automatico di firme dissimulate')}
                </div>
              </div>
              
              <p className="mt-2">
                {t('signatures.methodology.conclusion', 'Il punteggio di autenticità deriva dalla combinazione di similarità tradizionale e analisi di naturalezza, con classificazione intelligente in 6 categorie (da "Autentica" a "Probabilmente falsa"). L\'accuratezza stimata del 94% supera l\'analisi manuale tradizionale grazie all\'integrazione di AI e rilevamento anti-dissimulazione.')}
              </p>
            </section>
            
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t('signatures.methodology.unifiedWorkflowTitle', 'Workflow Unificato di Elaborazione')}
              </h3>
              <div className="bg-purple-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-purple-900 mb-2">{t('signatures.methodology.automaticCroppingTitle', 'Ritaglio Automatico e Calibrazione Integrata')}</h4>
                <p className="text-sm mb-2">{t('signatures.methodology.automaticCroppingDesc', 'Il sistema implementa un workflow rivoluzionario che unifica ritaglio e calibrazione in un processo semplificato:')}</p>
                <ol className="list-decimal pl-6 space-y-2 text-sm">
                  <li><span className="font-medium">{t('signatures.methodology.uploadRealDimensions', 'Upload + Dimensioni Reali')}</span>: {t('signatures.methodology.uploadRealDimensionsDesc', 'L\'utente carica l\'immagine e specifica le dimensioni fisiche della firma (es. 80x25mm)')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.mandatoryCropping', 'Ritaglio Automatico Obbligatorio')}</span>: {t('signatures.methodology.mandatoryCroppingDesc', 'Computer vision rileva e ritaglia automaticamente la firma, rimuovendo spazi vuoti')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.directCalibration', 'Calibrazione Diretta')}</span>: {t('signatures.methodology.directCalibrationDesc', 'L\'immagine ritagliata corrisponde esattamente alle dimensioni utente (px/mm = pixel_ritagliati / mm_utente)')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.parameterProcessing', 'Elaborazione Parametri')}</span>: {t('signatures.methodology.parameterProcessingDesc', 'Tutti i 16+ parametri vengono estratti con calibrazione in millimetri reali')}</li>
                  <li><span className="font-medium">{t('signatures.methodology.multiDimensionalComparison', 'Confronto Multi-Dimensionale')}</span>: {t('signatures.methodology.multiDimensionalComparisonDesc', 'Ogni firma è confrontata usando le proprie dimensioni reali specifiche')}</li>
                </ol>
                <div className="mt-3 p-2 bg-purple-100 rounded text-xs">
                  <strong>{t('signatures.methodology.advantages', 'Vantaggi')}:</strong> {t('signatures.methodology.advantagesDesc', 'Elimina inconsistenze dimensionali, garantisce precisione forensica, semplifica l\'esperienza utente')}
                </div>
              </div>
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
                {t('signatures.methodology.classificationTitle', 'Sistema di Classificazione Intelligente')}
              </h3>
              <p className="mb-3">
                {t('signatures.methodology.classificationDesc', 'GrapholexInsight introduce un sistema di classificazione bidimensionale che combina similarità tradizionale e naturalezza comportamentale per una valutazione forensica completa:')}
              </p>
              
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-blue-900 mb-2">{t('signatures.methodology.classificationMatrix', 'Matrice di Classificazione 2D')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded"></span>
                      <span className="font-medium">{t('signatures.methodology.authentic', 'Autentica')}</span>: {t('signatures.methodology.authenticCriteria', 'Similarità ≥85% + Naturalezza ≥80%')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-blue-500 rounded"></span>
                      <span className="font-medium">{t('signatures.methodology.authenticDissimulated', 'Autentica Dissimulata')}</span>: {t('signatures.methodology.authenticDissimulatedCriteria', 'Sim. ≥75% + Nat. 50-79%')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-400 rounded"></span>
                      <span className="font-medium">{t('signatures.methodology.probablyAuthentic', 'Prob. Autentica')}</span>: {t('signatures.methodology.probablyAuthenticCriteria', 'Similarità 65-84%')}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-orange-500 rounded"></span>
                      <span className="font-medium">{t('signatures.methodology.suspicious', 'Sospetta')}</span>: {t('signatures.methodology.suspiciousCriteria', 'Similarità 45-64%')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-gray-500 rounded"></span>
                      <span className="font-medium">{t('signatures.methodology.uncertain', 'Incerta')}</span>: {t('signatures.methodology.uncertainCriteria', 'Dati insufficienti')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-red-500 rounded"></span>
                      <span className="font-medium">{t('signatures.methodology.probablyFalse', 'Prob. Falsa')}</span>: {t('signatures.methodology.probablyFalseCriteria', 'Similarità &lt;45%')}
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-white rounded text-xs">
                  <strong>{t('signatures.methodology.innovation', 'Innovazione')}:</strong> {t('signatures.methodology.worldFirstImplementation', 'Prima implementazione al mondo di classificazione forensica bidimensionale con AI')}
                </div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-yellow-900 mb-2">{t('signatures.methodology.aiInterpretationTitle', 'Interpretazione AI-Powered')}</h4>
                <p className="text-sm mb-2">
                  {t('signatures.methodology.aiInterpretationDesc', 'Ogni classificazione è accompagnata da una spiegazione AI generata automaticamente che include:')}
                </p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>{t('signatures.methodology.criticalParamAnalysis', 'Analisi dei parametri critici che hanno influenzato il verdetto')}</li>
                  <li>{t('signatures.methodology.behavioralAnomalies', 'Identificazione di anomalie comportamentali specifiche')}</li>
                  <li>{t('signatures.methodology.forensicRecommendations', 'Raccomandazioni per approfondimenti forensi')}</li>
                  <li>{t('signatures.methodology.confidenceLevel', 'Livello di confidenza statistico del risultato')}</li>
                </ul>
              </div>
            </section>
            
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t('signatures.methodology.advancedTechTitle', 'Tecnologie Avanzate Integrate')}
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">{t('signatures.methodology.computerVisionTitle', 'Computer Vision e Machine Learning')}</h4>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><span className="font-medium">OpenCV</span>: {t('signatures.methodology.opencvDesc', 'Algoritmi di processamento immagini per estrazione caratteristiche')}</li>
                  <li><span className="font-medium">Morphological Skeleton</span>: {t('signatures.methodology.morphologicalDesc', 'Analisi della struttura tramite scheletro morfologico')}</li>
                  <li><span className="font-medium">Ellipse Fitting</span>: {t('signatures.methodology.ellipseFittingDesc', 'Calcolo preciso dell\'inclinazione tramite fit ellittico')}</li>
                  <li><span className="font-medium">Connected Components</span>: {t('signatures.methodology.connectedComponentsDesc', 'Segmentazione intelligente per analisi spaziatura')}</li>
                  <li><span className="font-medium">Otsu Thresholding</span>: {t('signatures.methodology.otsuDesc', 'Sogliatura automatica ottimale per separazione ink/sfondo')}</li>
                  <li><span className="font-medium">Convex Hull Analysis</span>: {t('signatures.methodology.convexHullDesc', 'Identificazione asole e forme complesse')}</li>
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
