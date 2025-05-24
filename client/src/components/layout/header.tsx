import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { LoadingSpinner } from "../ui/loading-spinner";
import { LanguageSwitcher } from "../ui/language-switcher";
import { useTranslation } from "react-i18next";
import { TourHelpButton } from "../tour/tour-help-button";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  
  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleNavigateToSettings = () => {
    setLocation("/settings");
  };

  return (
    <header className={`bg-primary shadow-md ${className}`}>
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-white text-2xl font-bold">{t('layout.appName')}</h1>
          <span className="text-white text-sm ml-3 hidden md:inline-block">
            {t('layout.appDescription')}
          </span>
        </div>
        
        <div className="flex items-center">
          {user && <TourHelpButton />}
          <LanguageSwitcher />
          
          {user && (
            <>
              <span className="text-white mx-4 hidden md:inline-block">
                {user.email}
              </span>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="p-1 rounded-full">
                    <Avatar className="h-8 w-8 bg-secondary text-white">
                      <AvatarFallback>
                        {getInitials(user.fullName || user.username)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleNavigateToSettings}>
                    <User className="mr-2 h-4 w-4" />
                    {t('layout.profileSettings')}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                  >
                    {logoutMutation.isPending ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <LogOut className="mr-2 h-4 w-4" />
                    )}
                    {t('layout.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
