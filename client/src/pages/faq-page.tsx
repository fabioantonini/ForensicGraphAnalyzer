import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface FAQCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  items: FAQItem[];
}

export default function FAQPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const faqCategories: FAQCategory[] = [
    {
      id: "generale",
      title: t("faq.categories.generale.title"),
      description: t("faq.categories.generale.description"),
      icon: "🔧",
      items: [
        {
          id: "what-is-grapholex",
          question: t("faq.generale.whatIs.question"),
          answer: t("faq.generale.whatIs.answer"),
          category: "generale"
        },
        {
          id: "how-to-start",
          question: t("faq.generale.howToStart.question"),
          answer: t("faq.generale.howToStart.answer"),
          category: "generale"
        },
        {
          id: "supported-formats",
          question: t("faq.generale.supportedFormats.question"),
          answer: t("faq.generale.supportedFormats.answer"),
          category: "generale"
        },
        {
          id: "language-change",
          question: t("faq.generale.languageChange.question"),
          answer: t("faq.generale.languageChange.answer"),
          category: "generale"
        }
      ]
    },
    {
      id: "documenti",
      title: t("faq.categories.documenti.title"),
      description: t("faq.categories.documenti.description"),
      icon: "📄",
      items: [
        {
          id: "upload-document",
          question: t("faq.documenti.upload.question"),
          answer: t("faq.documenti.upload.answer"),
          category: "documenti"
        },
        {
          id: "file-size-limit",
          question: t("faq.documenti.fileSize.question"),
          answer: t("faq.documenti.fileSize.answer"),
          category: "documenti"
        },
        {
          id: "delete-document",
          question: t("faq.documenti.delete.question"),
          answer: t("faq.documenti.delete.answer"),
          category: "documenti"
        },
        {
          id: "indexing-issues",
          question: t("faq.documenti.indexing.question"),
          answer: t("faq.documenti.indexing.answer"),
          category: "documenti"
        }
      ]
    },
    {
      id: "firme",
      title: t("faq.categories.firme.title"),
      description: t("faq.categories.firme.description"),
      icon: "✍️",
      items: [
        {
          id: "signature-analysis",
          question: t("faq.firme.analysis.question"),
          answer: t("faq.firme.analysis.answer"),
          category: "firme"
        },
        {
          id: "21-parameters",
          question: t("faq.firme.parameters.question"),
          answer: t("faq.firme.parameters.answer"),
          category: "firme"
        },
        {
          id: "authenticity-results",
          question: t("faq.firme.authenticity.question"),
          answer: t("faq.firme.authenticity.answer"),
          category: "firme"
        },
        {
          id: "compare-signatures",
          question: t("faq.firme.compare.question"),
          answer: t("faq.firme.compare.answer"),
          category: "firme"
        }
      ]
    },
    {
      id: "ocr",
      title: t("faq.categories.ocr.title"),
      description: t("faq.categories.ocr.description"),
      icon: "🔍",
      items: [
        {
          id: "ocr-languages",
          question: t("faq.ocr.languages.question"),
          answer: t("faq.ocr.languages.answer"),
          category: "ocr"
        },
        {
          id: "improve-recognition",
          question: t("faq.ocr.improve.question"),
          answer: t("faq.ocr.improve.answer"),
          category: "ocr"
        },
        {
          id: "processing-modes",
          question: t("faq.ocr.modes.question"),
          answer: t("faq.ocr.modes.answer"),
          category: "ocr"
        },
        {
          id: "large-documents",
          question: t("faq.ocr.largeDocuments.question"),
          answer: t("faq.ocr.largeDocuments.answer"),
          category: "ocr"
        }
      ]
    },
    {
      id: "ai-search",
      title: t("faq.categories.aiSearch.title"),
      description: t("faq.categories.aiSearch.description"),
      icon: "🤖",
      items: [
        {
          id: "semantic-search",
          question: t("faq.aiSearch.semantic.question"),
          answer: t("faq.aiSearch.semantic.answer"),
          category: "ai-search"
        },
        {
          id: "what-is-semantic",
          question: t("faq.aiSearch.whatSemantic.question"),
          answer: t("faq.aiSearch.whatSemantic.answer"),
          category: "ai-search"
        },
        {
          id: "better-answers",
          question: t("faq.aiSearch.betterAnswers.question"),
          answer: t("faq.aiSearch.betterAnswers.answer"),
          category: "ai-search"
        },
        {
          id: "document-privacy",
          question: t("faq.aiSearch.privacy.question"),
          answer: t("faq.aiSearch.privacy.answer"),
          category: "ai-search"
        }
      ]
    },
    {
      id: "peer-review",
      title: t("faq.categories.peerReview.title"),
      description: t("faq.categories.peerReview.description"),
      icon: "👥",
      items: [
        {
          id: "what-is-peer-review",
          question: t("faq.peerReview.whatIs.question"),
          answer: t("faq.peerReview.whatIs.answer"),
          category: "peer-review"
        },
        {
          id: "request-review",
          question: t("faq.peerReview.request.question"),
          answer: t("faq.peerReview.request.answer"),
          category: "peer-review"
        },
        {
          id: "access-expertise",
          question: t("faq.peerReview.access.question"),
          answer: t("faq.peerReview.access.answer"),
          category: "peer-review"
        },
        {
          id: "enfsi-standards",
          question: t("faq.peerReview.enfsi.question"),
          answer: t("faq.peerReview.enfsi.answer"),
          category: "peer-review"
        }
      ]
    },
    {
      id: "wake-up-quiz",
      title: t("faq.categories.wakeUpQuiz.title"),
      description: t("faq.categories.wakeUpQuiz.description"),
      icon: "🧠",
      items: [
        {
          id: "quiz-purpose",
          question: t("faq.wakeUpQuiz.purpose.question"),
          answer: t("faq.wakeUpQuiz.purpose.answer"),
          category: "wake-up-quiz"
        },
        {
          id: "question-generation",
          question: t("faq.wakeUpQuiz.generation.question"),
          answer: t("faq.wakeUpQuiz.generation.answer"),
          category: "wake-up-quiz"
        },
        {
          id: "choose-topics",
          question: t("faq.wakeUpQuiz.topics.question"),
          answer: t("faq.wakeUpQuiz.topics.answer"),
          category: "wake-up-quiz"
        },
        {
          id: "save-results",
          question: t("faq.wakeUpQuiz.results.question"),
          answer: t("faq.wakeUpQuiz.results.answer"),
          category: "wake-up-quiz"
        }
      ]
    },
    {
      id: "privacy-security",
      title: t("faq.categories.privacy.title"),
      description: t("faq.categories.privacy.description"),
      icon: "🔒",
      items: [
        {
          id: "data-protection",
          question: t("faq.privacy.dataProtection.question"),
          answer: t("faq.privacy.dataProtection.answer"),
          category: "privacy-security"
        },
        {
          id: "anonymization",
          question: t("faq.privacy.anonymization.question"),
          answer: t("faq.privacy.anonymization.answer"),
          category: "privacy-security"
        },
        {
          id: "document-access",
          question: t("faq.privacy.documentAccess.question"),
          answer: t("faq.privacy.documentAccess.answer"),
          category: "privacy-security"
        },
        {
          id: "authentication",
          question: t("faq.privacy.authentication.question"),
          answer: t("faq.privacy.authentication.answer"),
          category: "privacy-security"
        }
      ]
    },
    {
      id: "reports",
      title: t("faq.categories.reports.title"),
      description: t("faq.categories.reports.description"),
      icon: "📊",
      items: [
        {
          id: "generate-pdf",
          question: t("faq.reports.generatePdf.question"),
          answer: t("faq.reports.generatePdf.answer"),
          category: "reports"
        },
        {
          id: "customize-templates",
          question: t("faq.reports.templates.question"),
          answer: t("faq.reports.templates.answer"),
          category: "reports"
        },
        {
          id: "export-results",
          question: t("faq.reports.export.question"),
          answer: t("faq.reports.export.answer"),
          category: "reports"
        },
        {
          id: "legal-compliance",
          question: t("faq.reports.legal.question"),
          answer: t("faq.reports.legal.answer"),
          category: "reports"
        }
      ]
    }
  ];

  // Filter FAQ items based on search term
  const filteredCategories = faqCategories.map(category => ({
    ...category,
    items: category.items.filter(item =>
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.items.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            {t("faq.title")}
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            {t("faq.subtitle")}
          </p>
          
          {/* Search Bar */}
          <div className="relative max-w-md mx-auto">
            <input
              type="text"
              placeholder={t("faq.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-6">
          {filteredCategories.map((category) => (
            <Card key={category.id} className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleSection(category.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <CardTitle className="text-xl text-gray-800">
                        {category.title}
                      </CardTitle>
                      <CardDescription className="text-gray-600">
                        {category.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      {category.items.length} {t("faq.questions")}
                    </Badge>
                    {openSections.includes(category.id) ? (
                      <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <Collapsible open={openSections.includes(category.id)}>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {category.items.map((item) => (
                        <div
                          key={item.id}
                          className="border-l-4 border-blue-200 pl-4 py-3 bg-blue-50/30 rounded-r-lg"
                        >
                          <h3 className="font-semibold text-gray-800 mb-2">
                            {item.question}
                          </h3>
                          <div 
                            className="text-gray-600 prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: item.answer }}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>

        {searchTerm && filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {t("faq.noResults")}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {t("faq.tryDifferentSearch")}
            </p>
          </div>
        )}

        {/* Contact Section */}
        <Card className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">
              {t("faq.stillNeedHelp")}
            </h2>
            <p className="text-blue-100 mb-6">
              {t("faq.contactDescription")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button 
                className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
                onClick={() => setLocation('/feedback?category=bug&feature=general&title=Richiesta di supporto&description=Ho bisogno di supporto per:')}
              >
                {t("faq.contactSupport")}
              </button>
              <button 
                className="border border-white text-white px-6 py-2 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
                onClick={() => setLocation('/feedback')}
              >
                {t("faq.sendFeedback")}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}