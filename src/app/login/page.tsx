import Link from "next/link";
import { Sunrise } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const mode = searchParams.mode === "signup" ? "signup" : "signin";

  return (
    <main className="bg-sunrise-soft flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <span className="bg-sunrise flex h-9 w-9 items-center justify-center rounded-full shadow-soft">
          <Sunrise className="h-5 w-5 text-[#7a4a12]" aria-hidden />
        </span>
        Daybreak
      </Link>
      <AuthForm initialMode={mode} />
    </main>
  );
}
