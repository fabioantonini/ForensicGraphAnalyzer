import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { TourProvider } from "@/components/tour/tour-provider";

// Pages
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import DocumentsPage from "@/pages/documents-page";
import QueryPage from "@/pages/query-page";
import SettingsPage from "@/pages/settings-page";
import SignaturesPage from "@/pages/signatures-page";
import AdminPage from "@/pages/admin-page";
import ForgotPasswordPage from "@/pages/forgot-password-page";
import ResetPasswordPage from "@/pages/reset-password-page";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-neutral p-4">
          {children}
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      
      <ProtectedRoute path="/" component={() => (
        <AppLayout>
          <DashboardPage />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/documents" component={() => (
        <AppLayout>
          <DocumentsPage />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/query" component={() => (
        <AppLayout>
          <QueryPage />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/settings" component={() => (
        <AppLayout>
          <SettingsPage />
        </AppLayout>
      )} />

      <ProtectedRoute path="/signatures" component={() => (
        <AppLayout>
          <SignaturesPage />
        </AppLayout>
      )} />
      
      <ProtectedRoute 
        path="/admin" 
        requireAdmin={true}
        component={() => (
          <AppLayout>
            <AdminPage />
          </AppLayout>
        )} 
      />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TourProvider>
            <Router />
            <Toaster />
          </TourProvider>
        </AuthProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

export default App;
