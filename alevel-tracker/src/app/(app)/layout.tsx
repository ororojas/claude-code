import { Nav } from "@/components/nav";
import { requireUser } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
