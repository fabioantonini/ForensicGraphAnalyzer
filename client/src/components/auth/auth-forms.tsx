import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth, LoginData, RegisterData, loginResolver, registerResolver } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export function LoginForm() {
  const { loginMutation } = useAuth();
  const { t } = useTranslation();
  const form = useForm<LoginData>({
    resolver: loginResolver,
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginData) => {
    loginMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.username', 'Username')}</FormLabel>
              <FormControl>
                <Input placeholder={t('auth.username', 'Enter your username')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.password', 'Password')}</FormLabel>
              <FormControl>
                <Input type="password" placeholder={t('auth.password', 'Enter your password')} {...field} />
              </FormControl>
              <FormMessage />
              <div className="text-right">
                <Link
                  href="/forgot-password" 
                  className="text-sm text-primary hover:text-primary-dark"
                >
                  {t('auth.forgotPassword', 'Forgot password?')}
                </Link>
              </div>
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : null}
          {t('auth.signIn', 'Sign In')}
        </Button>
      </form>
    </Form>
  );
}

export function RegisterForm() {
  const { registerMutation } = useAuth();
  const { t } = useTranslation();
  const form = useForm<RegisterData>({
    resolver: registerResolver,
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      organization: "",
      profession: "",
    },
  });

  const onSubmit = (data: RegisterData) => {
    registerMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter your full name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter your email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Choose a username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Create a password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Confirm your password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <FormField
            control={form.control}
            name="organization"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Your organization" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="profession"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profession (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Your profession" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : null}
          {t('auth.signUp', 'Sign Up')}
        </Button>
      </form>
    </Form>
  );
}

export function AuthForms() {
  const [isLogin, setIsLogin] = useState(true);
  const { t } = useTranslation();

  return (
    <div>
      {isLogin ? (
        <>
          <h2 className="text-xl font-medium text-primary mb-6">{t('auth.signIn', 'Sign In')}</h2>
          <LoginForm />
          <div className="mt-4 text-center">
            <span className="text-sm text-gray-600">{t('auth.noAccount', 'Don\'t have an account?')}</span>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className="text-sm text-primary hover:text-primary-dark ml-1 font-medium"
            >
              {t('auth.signUp', 'Sign Up')}
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-xl font-medium text-primary mb-6">{t('auth.createAccount', 'Create Account')}</h2>
          <RegisterForm />
          <div className="mt-4 text-center">
            <span className="text-sm text-gray-600">{t('auth.alreadyHaveAccount', 'Already have an account?')}</span>
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className="text-sm text-primary hover:text-primary-dark ml-1 font-medium"
            >
              {t('auth.signIn', 'Sign In')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
