import { AppShell } from "@/components/app-shell"

/**
 * Wraps every /admin/* page in the authenticated product shell.
 * Role guards remain on each page (requireRole call site preserved
 * verbatim from the per-page setup); this layout only adds chrome.
 */
export default function AdminSegmentLayout({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return <AppShell>{children}</AppShell>
}
