import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "../ui/loading-spinner";
import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff } from "lucide-react";

// Schema per le impostazioni API con modelli supportati (GPT-4o default, GPT-5 disponibile)
const apiSettingsSchema = z.object({
  openaiApiKey: z.string().min(1, "API key is required"),
  model: z.enum(["gpt-4o", "gpt-5"]),
  temperature: z.number().min(0).max(1),
});

type ApiSettingsFormValues = z.infer<typeof apiSettingsSchema>;

export function ApiSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  // Format API key for display - always masked for security
  const formatApiKey = (key: string) => {
    if (!key) return "";
    if (key.startsWith("sk-") && key.length > 10) {
      return `sk-${"\u2022".repeat(10)}${key.substring(key.length - 4)}`;
    }
    return "\u2022".repeat(key.length);
  };

  // Initialize form with user data
  const form = useForm<ApiSettingsFormValues>({
    resolver: zodResolver(apiSettingsSchema),
    defaultValues: {
      openaiApiKey: user?.openaiApiKey || "",
      model: (user?.model as "gpt-4o" | "gpt-5") || "gpt-4o",
      temperature: 0.7,
    },
  });



  // Update API key mutation
  const updateApiKeyMutation = useMutation({
    mutationFn: async (data: { openaiApiKey: string }) => {
      const response = await apiRequest("PUT", "/api/user/api-key", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "API key updated",
        description: "Your OpenAI API key has been successfully updated",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update model mutation
  const updateModelMutation = useMutation({
    mutationFn: async (data: { model: string }) => {
      const response = await apiRequest("PUT", "/api/user/model", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Model updated",
        description: "Your OpenAI model preference has been updated",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (values: ApiSettingsFormValues) => {
    updateApiKeyMutation.mutate({ openaiApiKey: values.openaiApiKey });
  };

  // Handle model change
  const handleModelChange = (model: string) => {
    form.setValue('model', model as "gpt-4o" | "gpt-5");
    updateModelMutation.mutate({ model });
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-gray-700 mb-4">API Configuration</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Current API Key Display */}
            {user?.openaiApiKey && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Current API Key</label>
                <div className="relative">
                  <Input
                    type="password"
                    value={formatApiKey(user.openaiApiKey)}
                    readOnly
                    className="pr-20 bg-gray-50"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <span className="text-xs text-gray-400">Secured</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Your API key is encrypted and stored securely
                </p>
              </div>
            )}

            {/* New API Key Input */}
            <FormField
              control={form.control}
              name="openaiApiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {user?.openaiApiKey ? "Update API Key" : "OpenAI API Key"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="sk-..."
                      autoComplete="new-password"
                    />
                  </FormControl>
                  <p className="text-xs text-gray-500 mt-1">
                    {user?.openaiApiKey 
                      ? "Enter a new API key to replace the current one"
                      : "Enter your OpenAI API key to enable AI features"
                    }
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OpenAI Model</FormLabel>
                  <Select
                    onValueChange={handleModelChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-5">GPT-5</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="temperature"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temperature: {field.value}</FormLabel>
                  <FormControl>
                    <Slider
                      min={0}
                      max={1}
                      step={0.1}
                      value={[field.value]}
                      onValueChange={(values) => field.onChange(values[0])}
                    />
                  </FormControl>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>More Precise</span>
                    <span>More Creative</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={updateApiKeyMutation.isPending}
            >
              {updateApiKeyMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : null}
              Save API Settings
            </Button>
          </form>
        </Form>

        {/* API Usage Stats */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">API Usage Stats</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Monthly Queries:</span>
              <span className="text-xs font-medium">
                {user?.queryCount || 0} / 500
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-secondary h-2 rounded-full"
                style={{ width: `${Math.min(100, ((user?.queryCount || 0) / 500) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}