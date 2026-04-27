import { AppShell } from "@/components/app-shell"

export default function EmployeeSegmentLayout({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return <AppShell>{children}</AppShell>
}
