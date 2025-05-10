import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCog, User2, UserMinus, UserCheck, Users, BarChart } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  organization: string | null;
  profession: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface SystemStats {
  userCount: number;
  documentCount: number;
  totalSize: string;
  queryCount: number;
  newUsers: User[];
}

export default function AdminPage() {
  const [location, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [showRoleDialog, setShowRoleDialog] = useState<boolean>(false);
  const [newRole, setNewRole] = useState<string>("");
  
  // Reindirizza all'autenticazione se non loggato
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/auth");
    }
  }, [user, authLoading, setLocation]);
  
  // Reindirizza alla home se l'utente non è admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: "Accesso negato",
        description: "Non hai i permessi per accedere all'area amministrativa",
        variant: "destructive"
      });
      setLocation("/");
    }
  }, [user, setLocation, toast]);
  
  // Query per recuperare la lista degli utenti
  const {
    data: users,
    isLoading: isLoadingUsers,
    isError: isErrorUsers
  } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: getQueryFn(),
    enabled: !!user && user.role === 'admin'
  });
  
  // Query per recuperare le statistiche del sistema
  const {
    data: stats,
    isLoading: isLoadingStats,
    isError: isErrorStats
  } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: getQueryFn(),
    enabled: !!user && user.role === 'admin'
  });
  
  // Mutation per cambiare il ruolo di un utente
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number, role: string }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${userId}/role`, { role });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowRoleDialog(false);
      toast({
        title: "Ruolo aggiornato",
        description: "Il ruolo dell'utente è stato aggiornato con successo",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Impossibile aggiornare il ruolo: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Mutation per eliminare un utente
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setConfirmDelete(false);
      toast({
        title: "Utente eliminato",
        description: "L'utente è stato eliminato con successo",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: `Impossibile eliminare l'utente: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Gestori eventi
  const handleChangeRole = (userId: number, username: string, currentRole: string) => {
    const user = users?.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setNewRole(currentRole);
      setShowRoleDialog(true);
    }
  };
  
  const handleDeleteUser = (userId: number, username: string) => {
    const user = users?.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setConfirmDelete(true);
    }
  };
  
  // Se utente non è admin, non mostrare nulla
  if (!user || user.role !== 'admin') {
    return null;
  }
  
  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-6">Pannello di Amministrazione</h1>
      
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid grid-cols-2 w-[400px] mb-6">
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            Utenti
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart className="w-4 h-4 mr-2" />
            Statistiche
          </TabsTrigger>
        </TabsList>
        
        {/* Scheda Utenti */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Gestione Utenti
              </CardTitle>
              <CardDescription>
                Visualizza, modifica e gestisci gli account utente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex justify-center my-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : isErrorUsers ? (
                <div className="text-center text-destructive my-8">
                  Errore nel caricamento degli utenti
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted">
                        <th className="p-2 text-left">ID</th>
                        <th className="p-2 text-left">Username</th>
                        <th className="p-2 text-left">Email</th>
                        <th className="p-2 text-left">Nome</th>
                        <th className="p-2 text-left">Organizzazione</th>
                        <th className="p-2 text-left">Professione</th>
                        <th className="p-2 text-left">Ruolo</th>
                        <th className="p-2 text-left">Data Creazione</th>
                        <th className="p-2 text-left">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users && users.map((user: User) => (
                        <tr key={user.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">{user.id}</td>
                          <td className="p-2">{user.username}</td>
                          <td className="p-2">{user.email}</td>
                          <td className="p-2">{user.fullName || "-"}</td>
                          <td className="p-2">{user.organization || "-"}</td>
                          <td className="p-2">{user.profession || "-"}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="p-2">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-2 flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleChangeRole(user.id, user.username, user.role)}
                            >
                              <UserCog className="w-4 h-4 mr-1" />
                              Ruolo
                            </Button>
                            {user.id !== (user as User)?.id && (
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleDeleteUser(user.id, user.username)}
                              >
                                <UserMinus className="w-4 h-4 mr-1" />
                                Elimina
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Scheda Statistiche */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart className="mr-2 h-5 w-5" />
                Statistiche Generali
              </CardTitle>
              <CardDescription>
                Panoramica delle metriche di sistema e utilizzo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="flex justify-center my-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : isErrorStats ? (
                <div className="text-center text-destructive my-8">
                  Errore nel caricamento delle statistiche
                </div>
              ) : stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Utenti Totali
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.userCount}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Documenti Totali
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.documentCount}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Spazio Totale
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalSize}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Query Totali
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.queryCount}</div>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {stats && stats.newUsers && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Ultimi Utenti Registrati</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted">
                          <th className="p-2 text-left">Username</th>
                          <th className="p-2 text-left">Email</th>
                          <th className="p-2 text-left">Data Registrazione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.newUsers.map((user: User) => (
                          <tr key={user.id} className="border-b hover:bg-muted/50">
                            <td className="p-2">{user.username}</td>
                            <td className="p-2">{user.email}</td>
                            <td className="p-2">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Dialog per cambio ruolo */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambia Ruolo Utente</DialogTitle>
            <DialogDescription>
              Modifica il ruolo di {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Ruolo
              </Label>
              <Select
                value={newRole}
                onValueChange={setNewRole}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleziona ruolo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Utente</SelectItem>
                  <SelectItem value="admin">Amministratore</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Annulla
            </Button>
            <Button 
              onClick={() => selectedUser && updateRoleMutation.mutate({ 
                userId: selectedUser.id, 
                role: newRole 
              })}
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog di conferma eliminazione */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare l'utente {selectedUser?.username}? Questa azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Annulla
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}