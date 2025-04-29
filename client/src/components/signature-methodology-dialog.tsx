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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {t('signatures.methodology.title', 'Metodologia di analisi delle firme - GrapholexInsight')}
          </DialogTitle>
          <DialogDescription>
            {t('signatures.methodology.subtitle', 'Dettagli sull\'algoritmo e sui parametri utilizzati per la verifica delle firme')}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4 mt-6">
          <div className="space-y-6">
            <section>
              <h3 className="text-lg font-semibold mb-2">
                {t('signatures.methodology.overview', 'Panoramica del sistema')}
              </h3>
              <p className="mb-2">
                {t('signatures.methodology.overviewDesc1', 'GrapholexInsight utilizza un algoritmo avanzato di analisi grafica per confrontare le firme, estraendo caratteristiche biometriche sia visibili che invisibili a occhio nudo. L\'analisi è basata su 5 parametri principali, ciascuno con un peso specifico nella valutazione finale:')}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <span className="font-medium">{t('signatures.methodology.aspectRatio', 'Aspect Ratio (15%)')}</span>: {t('signatures.methodology.aspectRatioDesc', 'Proporzioni complessive della firma, larghezza e altezza')}
                </li>
                <li>
                  <span className="font-medium">{t('signatures.methodology.strokeFeatures', 'Caratteristiche dei tratti (25%)')}</span>: {t('signatures.methodology.strokeFeaturesDesc', 'Analisi dello spessore, pressione e variazioni nei tratti')}
                </li>
                <li>
                  <span className="font-medium">{t('signatures.methodology.curvature', 'Curvatura (20%)')}</span>: {t('signatures.methodology.curvatureDesc', 'Analisi degli angoli e delle curve presenti nella firma')}
                </li>
                <li>
                  <span className="font-medium">{t('signatures.methodology.spatialDistribution', 'Distribuzione spaziale (20%)')}</span>: {t('signatures.methodology.spatialDistributionDesc', 'Come la firma occupa lo spazio e distribuzione del peso grafico')}
                </li>
                <li>
                  <span className="font-medium">{t('signatures.methodology.connectivity', 'Connettività (20%)')}</span>: {t('signatures.methodology.connectivityDesc', 'Continuità e frammentazione dei tratti')}
                </li>
              </ul>
              <p className="mt-2">
                {t('signatures.methodology.conclusion', 'Il punteggio di somiglianza combinato deriva dalla media ponderata di questi parametri, con un\'accuratezza stimata dell\'85% rispetto all\'analisi manuale di un esperto grafologo. Punteggi superiori all\'80% indicano un\'alta probabilità di autenticità.')}
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
