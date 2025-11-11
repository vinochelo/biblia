"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const settingsFormSchema = z.object({
  plan: z.enum(["non-commercial", "commercial"], {
    required_error: "Debes seleccionar un plan.",
  }),
  overageProtection: z.boolean().default(false),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export function SettingsForm() {
  const { toast } = useToast();
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      plan: "non-commercial",
      overageProtection: true,
    }
  });

  function onSubmit(data: SettingsFormValues) {
    toast({
      title: "Preferencias guardadas",
      description: "Tus preferencias de plan han sido guardadas.",
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="plan"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Plan de Uso</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="non-commercial" />
                    </FormControl>
                    <FormLabel className="font-normal">
                      No Comercial (Starter: 5,000 llamadas/mes)
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="commercial" />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Comercial (Pro: 150,000 llamadas/mes)
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="overageProtection"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Protección contra sobreuso
                </FormLabel>
                <FormDescription>
                  Evita cargos adicionales desactivando el acceso si se excede el límite.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        
        <Button type="submit">
          <Save className="mr-2 h-4 w-4" />
          Guardar Cambios
        </Button>
      </form>
    </Form>
  );
}
