import Link from "next/link";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="font-semibold text-lg">
            Dropea Dashboard
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground"
            >
              Diario
            </Link>
            <Link
              href="/dashboard/mensual"
              className="text-muted-foreground hover:text-foreground"
            >
              Mensual
            </Link>
            <Link
              href="/settings"
              className="text-foreground font-medium"
            >
              Config
            </Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
