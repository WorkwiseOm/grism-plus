import { AppShell } from "@/components/app-shell"

export default function ManagerSegmentLayout({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return <AppShell>{children}</AppShell>
}
