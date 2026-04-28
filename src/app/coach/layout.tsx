import { AppShell } from "@/components/app-shell"

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return <AppShell>{children}</AppShell>
}
