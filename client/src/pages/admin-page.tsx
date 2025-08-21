import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { User } from "@/lib/types";
import { UpdateUserRole } from "@shared/schema";
import DemoAccountsManagement from "@/components/admin/demo-accounts-management";
import EmailConfiguration from "@/components/admin/email-configuration";
import { GmailConfiguration } from "@/components/admin/gmail-configuration";
import FeedbackManagement from "@/components/admin/feedback-management";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ShieldAlert, ShieldCheck, Trash2, UserCheck } from "lucide-react";

// Interfaccia per le statistiche di sistema
interface SystemStats {
  userCount: number;
  documentCount: number;
  totalSize: string;
  queryCount: number;
  newUsers: User[];
}

export default function AdminPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToChangeRole, setUserToChangeRole] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);

  // Fetch lista utenti
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"]
  });

  // Fetch statistiche sistema
  const { data: stats, isLoading: isLoadingStats } = useQuery<SystemStats>({
    queryKey: ["/api/stats"]
  });

  // Mutation per modificare il ruolo dell'utente
  const updateRoleMutation = useMutation({
    mutationFn: async (data: UpdateUserRole) => {
      const res = await apiRequest("PUT", `/api/admin/users/${data.userId}/role`, { role: data.role });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("admin.roleSaved"),
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsRoleDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation per eliminare un utente
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/user/${userId}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("admin.deleteSuccess"),
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handler per aprire la dialog di eliminazione utente
  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  // Handler per aprire la dialog di cambio ruolo
  const handleChangeRole = (user: User) => {
    setUserToChangeRole(user);
    setIsRoleDialogOpen(true);
  };

  // Filtra gli utenti in base alla ricerca
  const filteredUsers = users
    ? (users as any).filter(
        (user: any) =>
          user.username.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  // Formatta la data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Renderizza l'icona del ruolo utente
  const renderRoleIcon = (role: string) => {
    return role === "admin" ? (
      <ShieldAlert className="h-4 w-4 text-destructive" />
    ) : (
      <UserCheck className="h-4 w-4 text-primary" />
    );
  };

  // Stato caricamento
  const isLoading = isLoadingUsers || isLoadingStats;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6" data-tour="admin-header">{t("admin.title")}</h1>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-4" data-tour="admin-tabs">
          <TabsTrigger value="users">{t("admin.usersManagement")}</TabsTrigger>
          <TabsTrigger value="stats">{t("admin.systemStats")}</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="demo-accounts">{t("admin.demoAccounts.title", "Account Demo")}</TabsTrigger>
          <TabsTrigger value="email-config">{t("admin.emailConfig.tabTitle", "Email")}</TabsTrigger>
          <TabsTrigger value="gmail-config">{t("admin.gmail.tabTitle", "Gmail SMTP")}</TabsTrigger>
        </TabsList>

        {/* Tab per la gestione utenti */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.usersManagement")}</CardTitle>
              <CardDescription>
                {t("admin.usersManagement")}
              </CardDescription>
              <div className="relative w-full md:w-80 mb-4">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("admin.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t("admin.noUsersFound")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.username")}</TableHead>
                        <TableHead>{t("admin.email")}</TableHead>
                        <TableHead>{t("admin.role")}</TableHead>
                        <TableHead>{t("admin.createdAt")}</TableHead>
                        <TableHead>{t("admin.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.username}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {renderRoleIcon(user.role)}
                              <span
                                className={
                                  user.role === "admin"
                                    ? "text-destructive font-semibold"
                                    : ""
                                }
                              >
                                {user.role}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatDate(user.createdAt.toString())}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleChangeRole(user)}
                              >
                                {user.role === "admin"
                                  ? t("admin.makeUser")
                                  : t("admin.makeAdmin")}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteUser(user)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab per le statistiche di sistema */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.systemStats")}</CardTitle>
                <CardDescription>
                  {t("admin.systemStats")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <span className="text-3xl font-bold">
                          {stats?.userCount}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {t("admin.totalUsers")}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-3xl font-bold">
                          {stats?.documentCount}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {t("admin.totalDocuments")}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-3xl font-bold">
                          {stats?.totalSize}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {t("admin.totalStorage")}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-3xl font-bold">
                          {stats?.queryCount}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {t("admin.totalQueries")}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("admin.newUsers")}</CardTitle>
                <CardDescription>
                  {t("admin.newUsers")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (stats as any)?.newUsers && (stats as any).newUsers.length > 0 ? (
                  <div className="space-y-4">
                    {(stats as any).newUsers.map((user: any) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between border-b pb-2"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{user.username}</span>
                          <span className="text-sm text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(user.createdAt.toString())}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("admin.noUsersFound")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab per la visualizzazione feedback */}
        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle>Gestione Feedback</CardTitle>
              <CardDescription>
                Visualizza e gestisci tutti i feedback ricevuti dagli utenti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeedbackManagement />
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab per la gestione account demo */}
        <TabsContent value="demo-accounts">
          <DemoAccountsManagement />
        </TabsContent>
        
        {/* Tab per la configurazione email */}
        <TabsContent value="email-config">
          <EmailConfiguration />
        </TabsContent>
        
        {/* Tab per la configurazione Gmail SMTP */}
        <TabsContent value="gmail-config">
          <GmailConfiguration />
        </TabsContent>
      </Tabs>

      {/* Dialog per conferma eliminazione utente */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.confirmAction")}</DialogTitle>
            <DialogDescription>
              {t("admin.confirmDelete")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start">
            <div className="flex gap-2 w-full sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.delete")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog per conferma cambio ruolo */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.confirmAction")}</DialogTitle>
            <DialogDescription>
              {t("admin.confirmRoleChange")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex items-center justify-center gap-2">
            {userToChangeRole && (
              <>
                <div className="flex items-center gap-1">
                  {userToChangeRole.role === "admin" ? (
                    <ShieldAlert className="h-5 w-5 text-destructive" />
                  ) : (
                    <UserCheck className="h-5 w-5 text-primary" />
                  )}
                  <span>{userToChangeRole.role}</span>
                </div>
                <div className="px-3">→</div>
                <div className="flex items-center gap-1">
                  {userToChangeRole.role === "admin" ? (
                    <UserCheck className="h-5 w-5 text-primary" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-destructive" />
                  )}
                  <span>
                    {userToChangeRole.role === "admin" ? "user" : "admin"}
                  </span>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="sm:justify-start">
            <div className="flex gap-2 w-full sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => setIsRoleDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant={
                  userToChangeRole?.role === "admin" ? "default" : "destructive"
                }
                onClick={() =>
                  userToChangeRole &&
                  updateRoleMutation.mutate({
                    userId: userToChangeRole.id,
                    role:
                      userToChangeRole.role === "admin" ? "user" : "admin",
                  })
                }
                disabled={updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}