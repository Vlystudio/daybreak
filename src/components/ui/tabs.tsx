"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { createContext, useContext, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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

  return (
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
  );
}

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex items-center gap-1 rounded-full bg-muted p-1", className)}
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
        "relative rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:text-foreground",
        className
      )}
      {...props}
    >
      {active && (
        <motion.span
          aria-hidden
          layoutId="tab-indicator"
          className="absolute inset-0 rounded-full bg-card shadow-soft"
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content className={cn("mt-5 focus-visible:outline-none", className)} {...props} />
  );
}
