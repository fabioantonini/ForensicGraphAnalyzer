import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "../ui/loading-spinner";
import { useAuth } from "@/hooks/use-auth";

const passwordSchema = z.object({
  currentPassword: z
    .string()
    .min(6, "Password must be at least 6 characters"),
  newPassword: z
    .string()
    .min(6, "Password must be at least 6 characters"),
  confirmNewPassword: z
    .string()
    .min(6, "Password must be at least 6 characters"),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "New passwords do not match",
  path: ["confirmNewPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function SecuritySettings() {
  const { logoutMutation } = useAuth();
  const { toast } = useToast();

  // Initialize password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      const response = await apiRequest("PUT", "/api/user/password", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password updated",
        description: "Your password has been successfully updated",
        variant: "default",
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout from all sessions mutation
  const logoutAllSessionsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      logoutMutation.mutate();
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Password form submission handler
  const onPasswordSubmit = (values: PasswordFormValues) => {
    updatePasswordMutation.mutate(values);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-gray-700 mb-4">Security Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Change Password Section */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Change Password</h4>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-3">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={passwordForm.control}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button
                  type="submit"
                  disabled={updatePasswordMutation.isPending}
                >
                  {updatePasswordMutation.isPending && (
                    <LoadingSpinner size="sm" className="mr-2" />
                  )}
                  Update Password
                </Button>
              </form>
            </Form>
          </div>
          
          {/* Two-Factor Authentication Section */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Two-Factor Authentication</h4>
            <p className="text-sm text-gray-500 mb-4">Add an extra layer of security to your account</p>
            <div className="flex items-center mb-4">
              <Switch id="enable-2fa" disabled />
              <label htmlFor="enable-2fa" className="ml-2 block text-sm font-medium text-gray-700">
                Enable Two-Factor Authentication
              </label>
            </div>
            <Button variant="outline" disabled>
              Configure 2FA
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              Two-factor authentication is coming soon
            </p>
          </div>
          
          {/* Login Sessions Section */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Login Sessions</h4>
            <p className="text-sm text-gray-500 mb-4">Manage your active sessions</p>
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-md">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Current Session</div>
                    <div className="text-xs text-gray-500">Current Browser</div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
              </div>
              
              <Button
                variant="outline" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => logoutAllSessionsMutation.mutate()}
                disabled={logoutAllSessionsMutation.isPending}
              >
                {logoutAllSessionsMutation.isPending && (
                  <LoadingSpinner size="sm" className="mr-2" />
                )}
                Sign out of all sessions
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
