import { PageTransition } from "@/components/motion";

/** Re-mounts on every navigation, so app pages animate in as you move around. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
