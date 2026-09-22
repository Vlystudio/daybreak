"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { createContext, useContext, useId, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Tracks the active tab value so triggers can render a shared sliding pill. */
const ActiveTabContext = createContext<string | undefined>(undefined);

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [internal, setInternal] = useState<string | undefined>(
    typeof defaultValue === "string" ? defaultValue : undefined
  );
  const active = (value as string | undefined) ?? internal;
  const groupId = useId();

  return (
    <LayoutGroup id={groupId}>
      <ActiveTabContext.Provider value={active}>
        <TabsPrimitive.Root
          value={value}
          defaultValue={defaultValue}
          onValueChange={(v) => {
            setInternal(v);
            onValueChange?.(v);
          }}
          {...props}
        />
      </ActiveTabContext.Provider>
    </LayoutGroup>
  );
}

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "border-border/60 bg-muted/65 inline-flex items-center gap-1 rounded-2xl border p-1",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const active = useContext(ActiveTabContext) === value;
  const reduce = useReducedMotion();

  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "text-muted-foreground hover:text-foreground focus-visible:ring-ring data-[state=active]:text-foreground relative min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className
      )}
      {...props}
    >
      {active && (
        <motion.span
          aria-hidden
          layoutId="tab-indicator"
          className="bg-card shadow-soft absolute inset-0 rounded-xl"
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("panel-enter mt-5 focus-visible:outline-none", className)}
      {...props}
    />
  );
}
