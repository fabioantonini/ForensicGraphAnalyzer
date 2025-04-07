import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { AuthForms } from "@/components/auth/auth-forms";
import { useLocation } from "wouter";

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (user && !isLoading) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-neutral">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex md:items-center justify-center p-4 bg-neutral">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 md:gap-0">
        {/* Auth Form */}
        <Card className="bg-white rounded-lg shadow-xl w-full overflow-hidden">
          <div className="bg-primary p-6 flex justify-between items-center">
            <h1 className="text-white text-2xl font-bold">GraphoRAG</h1>
            <div className="text-white text-sm">Forensic Graphology</div>
          </div>
          <div className="p-6">
            <AuthForms />
          </div>
        </Card>

        {/* Info Panel */}
        <div className="hidden md:flex flex-col justify-center bg-primary-dark p-8 rounded-r-lg text-white space-y-6">
          <div>
            <h2 className="text-3xl font-bold mb-4">Forensic Graphology Assistant</h2>
            <p className="opacity-90">
              Welcome to GraphoRAG, your intelligent assistant for forensic graphology analysis powered by advanced AI.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-primary-light p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Upload Documents</h3>
                <p className="text-sm opacity-90">Add handwriting samples and documents for analysis</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-primary-light p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">AI-Powered Analysis</h3>
                <p className="text-sm opacity-90">Leverage RAG technology with your OpenAI API key</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-primary-light p-2 rounded-full mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Detailed Insights</h3>
                <p className="text-sm opacity-90">Get professional insights from your handwriting samples</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
