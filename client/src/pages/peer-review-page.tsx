/**
 * Pagina Peer Review - Sistema di validazione perizie grafologiche secondo standard ENFSI
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDropzone } from "react-dropzone";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Star,
  BarChart3,
  Trash2,
  Download,
  Shield,
  Award,
  TrendingUp,
  FileCheck,
  Info,
  Calendar,
  Weight
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { it, enUS } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface PeerReviewResult {
  id: number;
  overallScore: number;
  classification: string;
  criteriaResults: {
    structureInfo: { score: number; details: string; weight: number };
    materialDocumentation: { score: number; details: string; weight: number };
    methodology: { score: number; details: string; weight: number };
    technicalAnalysis: { score: number; details: string; weight: number };
    validation: { score: number; details: string; weight: number };
    presentation: { score: number; details: string; weight: number };
  };
  suggestions: string;
  processingTime: number;
  filename: string;
  createdAt?: string;
  originalFilename?: string;
}

interface ReviewHistory {
  id: number;
  originalFilename: string;
  fileSize: number;
  overallScore: number;
  classification: string;
  status: string;
  processingTime: number;
  createdAt: string;
}

interface StatsData {
  totalReviews: number;
  averageScore: number;
  averageProcessingTime: number;
  classificationCounts: {
    eccellente?: number;
    buono?: number;
    sufficiente?: number;
    insufficiente?: number;
  };
  recentReviews: ReviewHistory[];
}

const PeerReviewPage = () => {
  const { t: tCommon, i18n } = useTranslation('common');
  const { t } = useTranslation('peerReview');
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [progressPhase, setProgressPhase] = useState<string>('');
  const [currentResult, setCurrentResult] = useState<PeerReviewResult | null>(null);

  // Caricamento storico analisi
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["/api/peer-review/history"],
    enabled: true
  });

  // Caricamento statistiche
  const { data: statsData } = useQuery<StatsData>({
    queryKey: ["/api/peer-review/stats/summary"],
    enabled: true
  });
  


  // Caricamento framework ENFSI
  const { data: frameworkData } = useQuery({
    queryKey: [`/api/peer-review/framework/criteria?lang=${i18n.language}`],
    enabled: true
  });

  // Mutazione per l'upload
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('perizia', file);

      const response = await fetch('/api/peer-review/submit', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return await response.json();
    },
    onSuccess: (data: PeerReviewResult) => {
      setCurrentResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/peer-review/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/peer-review/stats/summary"] });
      setUploadProgress(100);
      setProgressPhase('Analisi completata con successo!');
    },
    onError: (error) => {
      console.error('Errore upload perizia:', error);
      setUploadProgress(0);
      setProgressPhase('');
    }
  });

  // Mutazione per eliminazione
  const deleteMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      const response = await fetch(`/api/peer-review/${reviewId}`, { 
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/peer-review/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/peer-review/stats/summary"] });
    }
  });

  // Configurazione dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setCurrentResult(null);
      setUploadProgress(0);
      setProgressPhase('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxSize: 25 * 1024 * 1024, // 25MB
    multiple: false
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Simulazione progresso graduale durante l'analisi ENFSI - timing realistico
    const simulateProgress = () => {
      setUploadProgress(10);
      setProgressPhase('Estrazione testo e preparazione documento...');
      
      setTimeout(() => {
        setUploadProgress(20);
        setProgressPhase('Analisi strutturale secondo framework ENFSI...');
      }, 3000); // Più tempo per l'estrazione iniziale
      
      setTimeout(() => {
        setUploadProgress(35);
        setProgressPhase('Prima chiamata AI: valutazione strutturale...');
      }, 8000); // Prima chiamata OpenAI
      
      setTimeout(() => {
        setUploadProgress(55);
        setProgressPhase('Seconda chiamata AI: analisi dettagliata criteri...');
      }, 16000); // Seconda chiamata OpenAI
      
      setTimeout(() => {
        setUploadProgress(75);
        setProgressPhase('Terza chiamata AI: generazione suggerimenti...');
      }, 24000); // Terza chiamata OpenAI
      
      setTimeout(() => {
        setUploadProgress(90);
        setProgressPhase('Elaborazione finale e calcolo score...');
      }, 30000); // Elaborazione finale
    };

    simulateProgress();
    
    try {
      await uploadMutation.mutateAsync(selectedFile);
    } catch (error) {
      setUploadProgress(0);
    }
  };

  // Funzione per scaricare il report PDF
  const handleDownloadReport = async (reviewId: number) => {
    try {
      const response = await fetch(`/api/peer-review/${reviewId}/report`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Errore HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Il file PDF ricevuto è vuoto');
      }
      
      // Estrai il nome del file dall'header Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `report-peer-review-${reviewId}.pdf`; // fallback
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      
      link.click();
      
      // Cleanup dopo un breve delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 1000);
      
      // Notifica successo
      toast({
        title: "Download completato",
        description: `Report PDF scaricato con successo`,
        variant: "default",
      });
      
    } catch (error) {
      console.error('Errore download report:', error);
      toast({
        title: "Errore download",
        description: error instanceof Error ? error.message : "Errore sconosciuto durante il download",
        variant: "destructive",
      });
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'eccellente': return 'bg-green-100 text-green-800 border-green-200';
      case 'buono': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'sufficiente': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'insufficiente': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case 'eccellente': return <Award className="h-4 w-4" />;
      case 'buono': return <CheckCircle className="h-4 w-4" />;
      case 'sufficiente': return <AlertCircle className="h-4 w-4" />;
      case 'insufficiente': return <AlertCircle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Funzione per formattare i suggerimenti
  const formatSuggestions = (suggestions: string) => {
    if (!suggestions) return null;

    // Parse dei suggerimenti per azioni immediate, breve termine, lungo termine
    const sections = [
      { 
        title: 'AZIONI IMMEDIATE (Alta Priorità)', 
        pattern: /AZIONI IMMEDIATE|Piano di Implementazione Immediata/i,
        color: 'border-red-200 bg-red-50',
        icon: '🔴'
      },
      { 
        title: 'AZIONI BREVE TERMINE (Media Priorità)', 
        pattern: /BREVE TERMINE|1-3 settimane/i,
        color: 'border-yellow-200 bg-yellow-50',
        icon: '🟡'
      },
      { 
        title: 'AZIONI LUNGO TERMINE (Bassa Priorità)', 
        pattern: /LUNGO TERMINE|1-3 mesi/i,
        color: 'border-green-200 bg-green-50',
        icon: '🟢'
      }
    ];

    // Cerca sezioni strutturate
    const structuredSections: Array<{
      title: string;
      pattern: RegExp;
      color: string;
      icon: string;
      actions: string[];
    }> = [];
    
    sections.forEach(section => {
      if (section.pattern.test(suggestions)) {
        // Trova le azioni per questa sezione
        const sectionStart = suggestions.search(section.pattern);
        if (sectionStart !== -1) {
          const nextSectionStart = suggestions.slice(sectionStart + 50).search(/AZIONI|Piano/i);
          const sectionText = nextSectionStart !== -1 
            ? suggestions.slice(sectionStart, sectionStart + 50 + nextSectionStart)
            : suggestions.slice(sectionStart);
          
          // Estrai le azioni (bullet points)
          const actions = sectionText
            .split(/[•\-\n]/)
            .filter((action: string) => action.trim() && !section.pattern.test(action))
            .slice(0, 4) // Massimo 4 azioni per sezione
            .map((action: string) => action.trim());
          
          if (actions.length > 0) {
            structuredSections.push({
              ...section,
              actions
            });
          }
        }
      }
    });

    if (structuredSections.length > 0) {
      return (
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-800">Piano di Miglioramento Strutturato:</h4>
          {structuredSections.map((section, index) => (
            <div key={index} className={`p-4 rounded-lg border ${section.color}`}>
              <h5 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                <span>{section.icon}</span>
                {section.title}
              </h5>
              <div className="space-y-2">
                {section.actions.map((action: string, actionIndex: number) => (
                  <div key={actionIndex} className="flex items-start gap-2">
                    <span className="text-gray-600 mt-1">•</span>
                    <p className="text-sm text-gray-700">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Fallback per suggerimenti non strutturati
    const lines = suggestions
      .split(/[•\-\n]/)
      .filter(line => line.trim())
      .slice(0, 8); // Massimo 8 suggerimenti

    return (
      <div className="space-y-2">
        {lines.map((line, index) => (
          <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 rounded border-l-4 border-blue-200">
            <span className="text-blue-600 mt-1">💡</span>
            <p className="text-sm text-gray-700">{line.trim()}</p>
          </div>
        ))}
      </div>
    );
  };

  // Normalizzazione delle chiavi per gestire varianti
  const normalizeKey = (key: string): string => {
    // Pulizia robusta: rimuove bullets, dash, newlines e spazi extra
    const cleanKey = key
      .replace(/^[\s•\-–—\n\r]+/, '') // Rimuove prefissi (bullet, dash, newlines)
      .replace(/\s+/g, ' ') // Normalizza spazi multipli
      .trim();
    
    // Gestisce varianti comuni con mapping esteso
    const variations: Record<string, string> = {
      // Varianti con spazi
      'Chain of Custody': 'ChainOfCustody',
      'Date Complete': 'completeDates',
      'Date Completed': 'completeDates',
      'Receipt Condition': 'ReceiptCondition',
      'Receipt Conditions': 'ReceiptCondition',
      'Alterations/Damages': 'AlterationsDamages',
      'Material Info': 'MaterialInfo',
      'Exam Purpose': 'ExamPurpose',
      'Systematic Approach': 'SystematicApproach',
      'Exam Sequence': 'ExamSequence',
      'Analysis Details': 'AnalysisDetails',
      'Graphological Parameters': 'GraphologicalParameters',
      'Handwriting Variations': 'HandwritingVariations',
      'Writing Styles': 'WritingStyles',
      'Comparison Process': 'ComparisonProcess',
      'Individual Characteristics': 'IndividualCharacteristics',
      'Peer Review': 'PeerReview',
      'Evidence Confirmation': 'EvidenceConfirmation',
      'Signature Authentication': 'SignatureAuthentication',
      // Varianti plurali/singolari
      'Case Identifiers': 'caseIdentifier',
      'Expert Data': 'expertData',
      'Examiner Qualifications': 'examinerQualifications',
      'Complete Dates': 'completeDates',
      'Submitter Info': 'submitterInfo',
      'Page Numbering': 'pageNumbering',
      'Document Metadata': 'documentMetadata',
      'Material List': 'materialList',
      'Reception Conditions': 'receptionConditions',
      'Custody Chain': 'custodyChain',
      'Material Tracking': 'materialTracking',
      'Quality Controls': 'qualityControls',
      'Methodology Description': 'methodologyDescription',
      'Equipment Description': 'equipmentDescription',
      'Analysis Scope': 'analysisScope',
      'Limitations Reporting': 'limitationsReporting',
      'Comparative Analysis': 'comparativeAnalysis',
      'Technical Details': 'technicalDetails',
      'Quality Assurance': 'qualityAssurance',
      'Uncertainty Assessment': 'uncertaintyAssessment',
      'Alternative Hypotheses': 'alternativeHypotheses',
      // Termini aggiuntivi dai log console
      'techniqueValidation': 'validation',
      'technique Validation': 'validation',
      'resultClarity': 'presentation',
      'result Clarity': 'presentation',
      'significance': 'conclusions',
      'justifications': 'interpretation',
      'traceability': 'materialTracking',
      'examinationPurpose': 'ExamPurpose',
      'examination Purpose': 'ExamPurpose',
      'systematicApproach': 'SystematicApproach',
      'systematic Approach': 'SystematicApproach',
      'examinationSequence': 'ExamSequence',
      'examination Sequence': 'ExamSequence',
      'analysisDetails': 'AnalysisDetails',
      'analysis Details': 'AnalysisDetails',
      'graphologicalParameters': 'GraphologicalParameters',
      'graphological Parameters': 'GraphologicalParameters',
      'handwritingVariations': 'HandwritingVariations',
      'handwriting Variations': 'HandwritingVariations',
      'writingStyles': 'WritingStyles',
      'writing Styles': 'WritingStyles',
      'comparisonProcess': 'ComparisonProcess',
      'comparison Process': 'ComparisonProcess',
      'individualCharacteristics': 'IndividualCharacteristics',
      'individual Characteristics': 'IndividualCharacteristics',
      'peerReview': 'PeerReview',
      'peer Review': 'PeerReview',
      'evidenceConfirmation': 'EvidenceConfirmation',
      'evidence Confirmation': 'EvidenceConfirmation',
      'qualityControls': 'qualityControls',
      'quality Controls': 'qualityControls',
      'signatureAuthentication': 'SignatureAuthentication',
      'signature Authentication': 'SignatureAuthentication'
    };
    
    return variations[cleanKey] || cleanKey;
  };

  // Funzione per humanizzare nomi camelCase/PascalCase per il fallback
  const humanizeName = (name: string): string => {
    return name
      .replace(/([A-Z])/g, ' $1') // Separa camelCase
      .replace(/^./, str => str.toUpperCase()) // Capitalizza prima lettera
      .trim();
  };

  // Traduzioni per i sub-criteri ENFSI
  const translateSubcriteria = (term: string) => {
    const translations: Record<string, Record<string, string>> = {
      en: {
        // Struttura Informazioni
        caseIdentifier: 'Case Identifier',
        expertData: 'Expert Data',
        examinerQualifications: 'Examiner Qualifications',
        signatures: 'Signatures',
        completeDates: 'Complete Dates',
        submitterInfo: 'Submitter Info',
        pageNumbering: 'Page Numbering',
        documentMetadata: 'Document Metadata',
        // Gestione Materiale
        materialList: 'Material List',
        receptionConditions: 'Reception Conditions',
        custodyChain: 'Chain of Custody',
        materialTracking: 'Material Tracking',
        qualityControls: 'Quality Controls',
        // Metodologia
        methodologyDescription: 'Methodology Description',
        equipmentDescription: 'Equipment Description',
        analysisScope: 'Analysis Scope',
        limitationsReporting: 'Limitations Reporting',
        // Analisi Tecnica
        comparativeAnalysis: 'Comparative Analysis',
        technicalDetails: 'Technical Details',
        validation: 'Validation',
        qualityAssurance: 'Quality Assurance',
        uncertaintyAssessment: 'Uncertainty Assessment',
        // Interpretazione
        interpretation: 'Interpretation',
        conclusions: 'Conclusions',
        presentation: 'Presentation',
        alternativeHypotheses: 'Alternative Hypotheses',
        // Criteri aggiuntivi visibili nelle immagini
        SignatureAuthentication: 'Signature Authentication',
        'Date Complete': 'Complete Dates',
        Transmitter: 'Transmitter',
        ReceiptCondition: 'Receipt Condition',
        AlterationsDamages: 'Alterations/Damages',
        MaterialInfo: 'Material Info',
        ChainOfCustody: 'Chain of Custody',
        ExamPurpose: 'Exam Purpose',
        SystematicApproach: 'Systematic Approach',
        ExamSequence: 'Exam Sequence',
        AnalysisDetails: 'Analysis Details',
        Equipment: 'Equipment',
        GraphologicalParameters: 'Graphological Parameters',
        HandwritingVariations: 'Handwriting Variations',
        WritingStyles: 'Writing Styles',
        ComparisonProcess: 'Comparison Process',
        IndividualCharacteristics: 'Individual Characteristics',
        PeerReview: 'Peer Review',
        EvidenceConfirmation: 'Evidence Confirmation'
      },
      it: {
        // Struttura Informazioni
        caseIdentifier: 'Identificatore Caso',
        expertData: 'Dati Esperto',
        examinerQualifications: 'Qualifiche Esaminatore',
        signatures: 'Firme',
        completeDates: 'Date Completate',
        submitterInfo: 'Info Trasmettitore',
        pageNumbering: 'Numerazione Pagine',
        documentMetadata: 'Metadati Documento',
        // Gestione Materiale
        materialList: 'Elenco Materiale',
        receptionConditions: 'Condizioni Ricezione',
        custodyChain: 'Catena Custodia',
        materialTracking: 'Tracciabilità Materiale',
        qualityControls: 'Controlli Qualità',
        // Metodologia
        methodologyDescription: 'Descrizione Metodologia',
        equipmentDescription: 'Descrizione Strumentazione',
        analysisScope: 'Ambito Analisi',
        limitationsReporting: 'Segnalazione Limitazioni',
        // Analisi Tecnica
        comparativeAnalysis: 'Analisi Comparativa',
        technicalDetails: 'Dettagli Tecnici',
        validation: 'Validazione',
        qualityAssurance: 'Garanzia Qualità',
        uncertaintyAssessment: 'Valutazione Incertezza',
        // Interpretazione
        interpretation: 'Interpretazione',
        conclusions: 'Conclusioni',
        presentation: 'Presentazione',
        alternativeHypotheses: 'Ipotesi Alternative',
        // Criteri aggiuntivi visibili nelle immagini
        SignatureAuthentication: 'Autenticazione Firma',
        'Date Complete': 'Date Completate',
        Transmitter: 'Trasmittente',
        ReceiptCondition: 'Condizione Ricezione',
        AlterationsDamages: 'Alterazioni/Danni',
        MaterialInfo: 'Info Materiale',
        ChainOfCustody: 'Catena Custodia',
        ExamPurpose: 'Scopo Esame',
        SystematicApproach: 'Approccio Sistematico',
        ExamSequence: 'Sequenza Esame',
        AnalysisDetails: 'Dettagli Analisi',
        Equipment: 'Strumentazione',
        GraphologicalParameters: 'Parametri Grafologici',
        HandwritingVariations: 'Variazioni Calligrafia',
        WritingStyles: 'Stili Scrittura',
        ComparisonProcess: 'Processo Comparazione',
        IndividualCharacteristics: 'Caratteristiche Individuali',
        PeerReview: 'Revisione Pari',
        EvidenceConfirmation: 'Conferma Evidenza',
        // Termini aggiuntivi per completezza
        equipment: 'Strumentazione',
        transmitter: 'Trasmittente'
      }
    };

    const lang = i18n.language === 'it' ? 'it' : 'en';
    
    // Normalizza la chiave per gestire varianti
    const normalizedKey = normalizeKey(term);
    
    // Cerca traduzione con chiave normalizzata
    let translated = translations[lang][normalizedKey] || translations[lang][term];
    
    // Se non trovata, prova con fallback humanizzato
    if (!translated) {
      translated = humanizeName(term);
      // Log per debug delle chiavi non trovate
      console.log(`[TRANSLATION] Chiave non trovata: "${term}" (normalizzata: "${normalizedKey}"), usando fallback: "${translated}"`);
    }
    
    return translated;
  };

  // Funzione per formattare i dettagli dell'analisi
  const formatCriteriaDetails = (details: string) => {
    if (!details || !/(Analisi dettagliata|Detailed analysis)/i.test(details)) {
      return (
        <p className="text-sm text-gray-600">{details}</p>
      );
    }

    // Parse dei sub-criteri usando pattern regex robusto per multi-parola e simboli internazionali
    const subcriteriaPattern = /([^:]+?):\s*(\d+)%\s*-\s*(?:Evidenza|Evidence):\s*"?([^"]*)"?\s*(?:Gap|Lacuna):\s*([^\(]*)\((?:Severità|Severity):\s*([^\)]+)\)/g;
    const subcriteria = [];
    let match;
    
    while ((match = subcriteriaPattern.exec(details)) !== null) {
      const [, name, score, evidence, gap, severity] = match;
      subcriteria.push({
        name: translateSubcriteria(name),
        score: parseInt(score),
        evidence: evidence.trim(),
        gap: gap.trim(),
        severity: severity
      });
    }

    if (subcriteria.length === 0) {
      // Fallback per parsing semplificato - supporta entrambe le lingue
      const lines = details
        .replace(/(Analisi dettagliata|Detailed analysis)[^:]*:/gi, '')
        .split(/[•\-]/)
        .filter(line => line.trim())
        .slice(0, 5);
      
      return (
        <div className="space-y-2">
          {lines.map((line, index) => (
            <p key={index} className="text-sm text-gray-600 pl-2 border-l-2 border-gray-200">
              {line.trim()}
            </p>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">{t('details.detailedAnalysis')}</p>
        <div className="space-y-3">
          {subcriteria.map((sub, index) => {
            const scoreColor = sub.score >= 85 ? 'text-green-700 bg-green-50' : 
                             sub.score >= 70 ? 'text-yellow-700 bg-yellow-50' : 
                             sub.score >= 60 ? 'text-orange-700 bg-orange-50' : 
                             'text-red-700 bg-red-50';
            
            const severityColor = sub.severity === 'alta' ? 'text-red-600' : 
                                 sub.severity === 'media' ? 'text-yellow-600' : 
                                 'text-green-600';

            return (
              <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-800">{sub.name}</h5>
                  <Badge className={scoreColor}>
                    {sub.score}%
                  </Badge>
                </div>
                
                {sub.evidence && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-green-700">💡 {t('details.evidence')}</span>
                    <p className="text-sm text-gray-600 mt-1 italic">"{sub.evidence}"</p>
                  </div>
                )}
                
                {sub.gap && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-orange-700">⚠️ {t('details.improvementArea')}</span>
                    <p className="text-sm text-gray-600 mt-1">{sub.gap}</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${severityColor}`}>
                    {t('details.priority')} {sub.severity.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const locale = i18n.language === 'it' ? it : enUS;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  {t('title')}
                </CardTitle>
                <p className="text-gray-600 mt-1">
                  {t('subtitle')}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t('tabs.upload')}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              {t('tabs.history')}
            </TabsTrigger>
            <TabsTrigger value="statistics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('tabs.statistics')}
            </TabsTrigger>
            <TabsTrigger value="framework" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              {t('tabs.framework')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            {/* Upload Section */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  {t('upload.title')}
                </CardTitle>
                <p className="text-gray-600 text-sm">
                  {t('upload.description')}
                </p>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }
                  `}
                >
                  <input {...getInputProps()} />
                  {selectedFile ? (
                    <div className="space-y-2">
                      <FileText className="h-12 w-12 text-blue-600 mx-auto" />
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatBytes(selectedFile.size)} • {t('upload.analyzing')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                      <p className="text-lg font-medium">
                        {isDragActive 
                          ? t('upload.dragDrop').split(' o ')[0] + '...'
                          : t('upload.dragDrop')
                        }
                      </p>
                      <p className="text-sm text-gray-500">
                        {t('upload.formats')}
                      </p>
                    </div>
                  )}
                </div>

                {selectedFile && (
                  <div className="mt-6 flex justify-center">
                    <Button
                      onClick={handleUpload}
                      disabled={uploadMutation.isPending}
                      className="px-8 py-2 bg-blue-600 hover:bg-blue-700"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          {t('upload.analyzing')}
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          Avvia Analisi ENFSI
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Progress Bar */}
            {uploadMutation.isPending && (
              <Card className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Analisi framework ENFSI in corso...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                    {progressPhase && (
                      <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-md border border-blue-200">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          {progressPhase}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {currentResult && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Risultati Analisi ENFSI
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={getClassificationColor(currentResult.classification)}>
                        {getClassificationIcon(currentResult.classification)}
                        {currentResult.classification.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        Score: {currentResult.overallScore}/100
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Score Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-700">
                            {currentResult.overallScore}
                          </div>
                          <div className="text-sm text-blue-600">Score Complessivo</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-green-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700 capitalize">
                            {currentResult.classification}
                          </div>
                          <div className="text-sm text-green-600">Classificazione ENFSI</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-700">
                            {currentResult.processingTime}s
                          </div>
                          <div className="text-sm text-purple-600">Tempo Analisi</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Criteria Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Weight className="h-5 w-5" />
                      {t('details.criteriaEvaluation')}
                    </h3>
                    
                    <div className="grid gap-4">
                      {Object.entries(currentResult.criteriaResults).map(([key, criteria]) => {
                        const categoryNames: Record<string, Record<string, string>> = {
                          it: {
                            structureInfo: "Struttura Obbligatoria",
                            materialDocumentation: "Documentazione Materiale", 
                            methodology: "Metodologia e Procedure",
                            technicalAnalysis: "Analisi Tecnica Specialistica",
                            validation: "Validazione e Controlli Qualità",
                            presentation: "Presentazione e Valutazione"
                          },
                          en: {
                            structureInfo: "Mandatory Structure",
                            materialDocumentation: "Material Documentation", 
                            methodology: "Methodology and Procedures",
                            technicalAnalysis: "Technical Analysis",
                            validation: "Validation and Quality Controls",
                            presentation: "Presentation and Evaluation"
                          }
                        };
                        
                        const lang = i18n.language === 'it' ? 'it' : 'en';
                        const categoryName = categoryNames[lang][key] || translateSubcriteria(key);

                        return (
                          <Card key={key} className="bg-gray-50">
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="font-medium">
                                  {categoryName} (Peso: {criteria.weight}%)
                                </h4>
                                <Badge variant={criteria.score >= 75 ? "default" : "destructive"}>
                                  {criteria.score}/100
                                </Badge>
                              </div>
                              <Progress value={criteria.score} className="h-2 mb-3" />
                              {formatCriteriaDetails(criteria.details)}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* Suggestions */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-blue-800">{t('analysis.suggestions')}</h3>
                    </div>
                    {formatSuggestions(currentResult.suggestions)}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  {t('history.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                    <p>{t('common.loading')}</p>
                  </div>
                ) : (historyData as any)?.reviews?.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p>{t('history.noAnalyses')}</p>
                    <p className="text-sm">{t('history.uploadFirst')}</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {((historyData as any)?.reviews || []).map((review: ReviewHistory) => (
                        <Card key={review.id} className="bg-gray-50 hover:bg-gray-100 transition-colors">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <FileText className="h-4 w-4 text-gray-500" />
                                  <span className="font-medium">{review.originalFilename}</span>
                                  <Badge className={getClassificationColor(review.classification)}>
                                    {getClassificationIcon(review.classification)}
                                    {review.classification}
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Star className="h-3 w-3" />
                                    {review.overallScore}/100
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {review.processingTime}s
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(review.createdAt), { 
                                      addSuffix: true,
                                      locale 
                                    })}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadReport(review.id)}
                                  className="flex items-center gap-2"
                                >
                                  <Download className="h-4 w-4" />
                                  <span className="text-xs">Report PDF</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(review.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="statistics" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('statistics.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Stats Summary */}
                {statsData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-700">
                            {statsData?.totalReviews || 0}
                          </div>
                          <div className="text-sm text-blue-600">{t('statistics.totalAnalyses')}</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-50 to-green-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700">
                            {statsData?.averageScore || 0}
                          </div>
                          <div className="text-sm text-green-600">{t('statistics.averageScore')}</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-700">
                            {Math.round(statsData?.averageProcessingTime || 0)}s
                          </div>
                          <div className="text-sm text-purple-600">{t('statistics.averageTime')}</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-700">
                            {(statsData?.classificationCounts?.eccellente || 0) + (statsData?.classificationCounts?.buono || 0)}
                          </div>
                          <div className="text-sm text-orange-600">{t('statistics.conformCompliant')}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="framework" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  {t('framework.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    {t('framework.description')}
                  </AlertDescription>
                </Alert>

                {(frameworkData as any)?.framework && (
                  <div className="grid gap-6">
                    {Object.entries((frameworkData as any).framework).map(([key, category]: [string, any]) => (
                      <Card key={key} className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{category.name}</CardTitle>
                            <Badge variant="outline">{t('common.weight')}: {category.weight}%</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {/* Gestione sia della vecchia struttura criteria che della nuova subcriteria */}
                            {category.criteria ? (
                              // Vecchia struttura con array di criteri
                              category.criteria.map((criterion: string, index: number) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                  <span>{criterion}</span>
                                </div>
                              ))
                            ) : category.subcriteria ? (
                              // Nuova struttura con sub-criteri dettagliati
                              Object.entries(category.subcriteria).map(([key, subcriterion]: [string, any]) => (
                                <div key={key} className="bg-white rounded-lg p-3 border">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                    <span className="font-medium text-sm">{subcriterion.name}</span>
                                    <Badge variant="secondary" className="text-xs">Peso: {subcriterion.weight}%</Badge>
                                  </div>
                                  <p className="text-xs text-gray-600 mb-2">{subcriterion.description}</p>
                                  {subcriterion.indicators && (
                                    <div className="flex flex-wrap gap-1">
                                      {subcriterion.indicators.map((indicator: string, idx: number) => (
                                        <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs">
                                          {indicator}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500 italic">
                                Nessun criterio disponibile
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="mt-8 p-6 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Award className="h-5 w-5 text-blue-600" />
                    {t('framework.conformityCriteria')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                      <span><strong>{t('framework.excellent')}</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                      <span><strong>{t('framework.good')}</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                      <span><strong>{t('framework.sufficient')}</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                      <span><strong>{t('framework.insufficient')}</strong></span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
};

export default PeerReviewPage;