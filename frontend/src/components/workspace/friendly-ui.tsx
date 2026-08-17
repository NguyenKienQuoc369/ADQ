"use client";

import { Lightbulb, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function FriendlySteps({
  title,
  description,
  steps,
}: {
  title: string;
  description: string;
  steps: Array<{ title: string; text: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-sm font-semibold text-cyan-300">
              {index + 1}
            </div>
            <p className="font-medium text-slate-100">{step.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{step.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PlainTips({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
              <Lightbulb className="h-4 w-4 text-amber-300" />
            </div>
            <p>{item}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function SimpleMetric({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
        <Icon className="h-4 w-4 text-cyan-300" />
      </div>
      <p className="font-medium text-slate-100">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}
