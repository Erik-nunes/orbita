import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return (
    <div className="min-h-screen">
      <Sidebar user={{ name: session.user.name, role: session.user.role }} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
