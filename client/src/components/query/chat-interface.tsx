import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal, Bot, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Document, Message, QueryResult } from "@/lib/types";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { LoadingSpinner } from "../ui/loading-spinner";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";

interface ChatInterfaceProps {
  selectedDocumentIds: number[];
  documentMap: Record<number, Document>;
  className?: string;
  initialQuery?: string;
}

export function ChatInterface({
  selectedDocumentIds,
  documentMap,
  className,
  initialQuery = "",
}: ChatInterfaceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: t("query.welcomeMessage", "Hello! I'm your forensic graphology assistant. I can analyze handwriting, signatures, and other graphological elements using your document knowledge base. How can I help you today?"),
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [model, setModel] = useState("gpt-4o");
  const [temperature, setTemperature] = useState(0.7);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [messages]);

  // Set initial query if provided
  useEffect(() => {
    if (initialQuery) {
      setInputValue(initialQuery);
    }
  }, [initialQuery]);

  const queryMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/query", {
        query,
        documentIds: selectedDocumentIds,
        model,
        temperature,
      });
      return await response.json() as QueryResult;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: new Date(data.createdAt),
          sources: data.documents.map(doc => ({
            documentId: doc.id,
            filename: doc.filename
          }))
        }
      ]);

      // Invalidate queries to update stats
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("query.queryFailed", "Query failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (inputValue.trim() === "") return;
    
    // Check if user has API key configured
    if (!user?.openaiApiKey) {
      toast({
        title: t("settings.api.apiKeyRequired", "API Key Required"),
        description: t("query.configureApiKey", "Please configure your OpenAI API key in the settings page."),
        variant: "destructive",
      });
      return;
    }
    
    // Check if at least one document is selected
    if (selectedDocumentIds.length === 0) {
      toast({
        title: t("query.noDocumentsSelected", "No Documents Selected"),
        description: t("query.selectAtLeastOne", "Please select at least one document to query."),
        variant: "destructive",
      });
      return;
    }

    // Add user message to chat
    const userMessage: Message = {
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    
    // Send query to server
    queryMutation.mutate(inputValue);
    
    // Clear input
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <Card className={className}>
      <CardContent className="p-6 flex flex-col h-full">
        <h3 className="text-lg font-medium text-gray-700 mb-4">{t('query.chatInterface', 'Chat Interface')}</h3>
        
        {/* Chat Messages */}
        <ScrollArea className="flex-1 mb-4 border border-gray-200 rounded-lg p-4 min-h-[300px] max-h-[500px]" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex items-start ${
                  message.role === "user" ? "justify-end" : ""
                }`}
              >
                {message.role !== "user" && (
                  <div className="flex-shrink-0 bg-primary text-white rounded-full p-2">
                    <Bot className="h-5 w-5" />
                  </div>
                )}
                
                <div
                  className={`mx-3 py-2 px-3 rounded-lg max-w-[85%] ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "bg-muted text-gray-800"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {message.sources && message.sources.length > 0 && (
                    <div className="text-xs mt-2 pt-2 border-t border-gray-200 text-gray-500">
                      <span className="font-medium">{t('query.sources', 'Sources')}:</span>{" "}
                      {message.sources.map((source, idx) => (
                        <span key={idx}>
                          {idx > 0 && ", "}
                          {documentMap[source.documentId]?.originalFilename || source.filename}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {message.role === "user" && (
                  <div className="flex-shrink-0 bg-secondary text-white rounded-full p-2">
                    <User className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
            
            {queryMutation.isPending && (
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-primary text-white rounded-full p-2">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="ml-3 bg-muted rounded-lg py-4 px-4 max-w-[85%] flex items-center">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2 text-sm text-gray-600">{t('query.thinking', 'Thinking...')}</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Advanced Settings */}
        <div className="flex flex-col md:flex-row justify-between text-xs text-gray-500 mb-2">
          <div className="flex items-center mb-2 md:mb-0">
            <span>{t('query.usingDocuments', 'Using')} {selectedDocumentIds.length} {t(selectedDocumentIds.length !== 1 ? 'query.documents' : 'query.document', 'document')} {t('query.inContext', 'in context')}</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span>{t('settings.api.model', 'Model')}:</span>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-7 w-28">
                  <SelectValue placeholder="GPT-4o" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span>{t('settings.api.temperature', 'Temp')}: {temperature}</span>
              <Slider
                className="w-24"
                min={0}
                max={1}
                step={0.1}
                value={[temperature]}
                onValueChange={(values) => setTemperature(values[0])}
              />
            </div>
          </div>
        </div>
        
        {/* Query Input */}
        <div className="mt-auto">
          <div className="relative">
            <Textarea
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              rows={3}
              placeholder={t('query.askAboutDocuments', 'Ask a question about your documents...')}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              ref={textareaRef}
              disabled={queryMutation.isPending}
            />
            <Button
              className="absolute right-2 bottom-2"
              size="icon"
              onClick={handleSendMessage}
              disabled={inputValue.trim() === "" || queryMutation.isPending || selectedDocumentIds.length === 0}
              title={
                selectedDocumentIds.length === 0 
                  ? t('query.selectAtLeastOne', 'Select at least one document')
                  : t('query.sendMessage', 'Send message')
              }
            >
              <SendHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
