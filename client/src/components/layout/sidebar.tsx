import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Home, FileText, MessageSquare, Settings, ChevronRight, ChevronLeft, Pen, ShieldCheck, FileImage, Shield, Brain, HelpCircle, Microscope } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import React from "react";
import { useTranslation } from "react-i18next";
import { VersionInfo } from "../version-info";

interface SidebarProps {
  className?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  translationKey: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation('common');
  const { user } = useAuth();
  
  // Controlla se l'utente è admin
  const isAdmin = user?.role === 'admin';

  // Hide mobile sidebar when route changes
  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [location, isMobile]);

  const navItems: NavItem[] = [
    {
      href: "/",
      label: "Dashboard",
      translationKey: "layout.dashboard",
      icon: <Home className="h-5 w-5 mr-3" />,
    },
    {
      href: "/documents",
      label: "Documents",
      translationKey: "layout.documents",
      icon: <FileText className="h-5 w-5 mr-3" />,
    },
    {
      href: "/query",
      label: "RAG Query",
      translationKey: "layout.ragQuery",
      icon: <MessageSquare className="h-5 w-5 mr-3" />,
    },
    {
      href: "/ocr",
      label: "OCR Advanced",
      translationKey: "layout.ocr",
      icon: <FileImage className="h-5 w-5 mr-3" />,
    },
    {
      href: "/signatures",
      label: "Signature Verification",
      translationKey: "layout.signatures",
      icon: <Pen className="h-5 w-5 mr-3" />,
    },
    {
      href: "/methodology",
      label: "Methodology",
      translationKey: "layout.methodology",
      icon: <Microscope className="h-5 w-5 mr-3" />,
    },
    {
      href: "/signature-quality",
      label: "Signature Quality Check",
      translationKey: "layout.signatureQuality",
      icon: <ShieldCheck className="h-5 w-5 mr-3" />,
    },
    {
      href: "/anonymize",
      label: "Document Anonymization",
      translationKey: "layout.anonymize",
      icon: <Shield className="h-5 w-5 mr-3" />,
    },
    {
      href: "/peer-review",
      label: "Peer Review ENFSI",
      translationKey: "layout.peerReview",
      icon: <ShieldCheck className="h-5 w-5 mr-3" />,
    },
    {
      href: "/wake-up",
      label: "Wake Up Quiz",
      translationKey: "layout.wakeUp",
      icon: <Brain className="h-5 w-5 mr-3" />,
    },
    {
      href: "/feedback",
      label: "Feedback",
      translationKey: "layout.feedback",
      icon: <MessageSquare className="h-5 w-5 mr-3" />,
    },
    {
      href: "/faq",
      label: "FAQ",
      translationKey: "layout.faq",
      icon: <HelpCircle className="h-5 w-5 mr-3" />,
    },
    {
      href: "/settings",
      label: "Settings",
      translationKey: "layout.settings",
      icon: <Settings className="h-5 w-5 mr-3" />,
    },
    // Opzione di amministrazione (visibile solo agli admin)
    ...(isAdmin ? [{
      href: "/admin",
      label: "Administration",
      translationKey: "layout.admin",
      icon: <ShieldCheck className="h-5 w-5 mr-3" />,
    }] : []),
  ];

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setCollapsed(!collapsed);
    }
  };

  const sidebarClass = isMobile
    ? `fixed inset-y-0 left-0 z-50 w-64 shadow-lg transform ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } transition-transform duration-200 ease-in-out bg-white md:hidden`
    : `bg-white shadow-md ${
        collapsed ? "w-16" : "w-64"
      } transition-all duration-200 hidden md:block ${className}`;

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={sidebarClass} data-tour="sidebar">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between h-14 px-4 border-b">
            {!collapsed && (
              <h2 className="text-lg font-semibold">{t('layout.appName')}</h2>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="md:flex"
              onClick={toggleSidebar}
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
          </div>

          <ScrollArea className="flex-1 px-2 py-4">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <div key={item.href}>
                  <Link href={item.href}>
                    <div
                      className={`flex items-center py-2 px-4
                        rounded-md hover:bg-muted transition-colors cursor-pointer
                        ${
                          location === item.href
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "text-gray-700 hover:text-primary"
                        }
                        ${collapsed ? "justify-center" : "justify-start"}
                      `}
                      data-tour={item.href === "/" ? "dashboard-link" : 
                               item.href === "/documents" ? "documents-link" : 
                               item.href === "/query" ? "assistant-link" : 
                               item.href === "/signatures" ? "signatures-link" : 
                               item.href === "/settings" ? "settings-link" : ""}
                    >
                      <div className={collapsed ? "" : "mr-3"}>
                        {React.cloneElement(item.icon as React.ReactElement, {
                          className: `h-5 w-5 ${collapsed ? "" : "mr-3"}`,
                        })}
                      </div>
                      {!collapsed && <span>{t(item.translationKey)}</span>}
                    </div>
                  </Link>
                </div>
              ))}
            </nav>
          </ScrollArea>

          {/* Footer con versione */}
          {!collapsed && (
            <div className="px-4 py-2 border-t border-border">
              <VersionInfo />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile toggle button */}
      {isMobile && (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 z-40 rounded-full shadow-lg md:hidden"
          onClick={toggleSidebar}
        >
          {mobileOpen ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </Button>
      )}
    </>
  );
}
