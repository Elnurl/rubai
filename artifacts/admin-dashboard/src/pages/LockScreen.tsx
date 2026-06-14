import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, ShieldAlert } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const formSchema = z.object({
  adminKey: z.string().min(1, "Admin key is required"),
});

export default function LockScreen() {
  const { setAdminKey } = useAuth();
  const [, setLocation] = useLocation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      adminKey: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setAdminKey(values.adminKey);
    setLocation("/lookup");
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">RubAI Ops</CardTitle>
            <CardDescription className="text-sm font-medium mt-1 text-muted-foreground">
              Restricted Area. Admin access required.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="adminKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Admin Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="password"
                          placeholder="Enter admin key"
                          className="pl-10 h-12 text-center text-lg tracking-widest font-mono"
                          data-testid="input-admin-key"
                          autoComplete="off"
                          autoFocus
                          {...field}
                        />
                        <ShieldAlert className="w-5 h-5 absolute left-3 top-3.5 text-muted-foreground" />
                      </div>
                    </FormControl>
                    <FormMessage className="text-center" />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-12 text-md font-semibold" data-testid="button-submit-key">
                Unlock Dashboard
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
