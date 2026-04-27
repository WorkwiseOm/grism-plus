"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { isNavItemActive, type NavSection } from "./nav-config"

type AppSidebarProps = {
  sections: ReadonlyArray<NavSection>
}

/**
 * Role-aware nav. Client component only because it reads the current
 * pathname for active-link styling. The nav structure itself comes
 * from a server-side pure mapping (getNavItemsForRole) and is passed
 * down as a prop, so role logic stays out of the client bundle.
 */
export function AppSidebar({ sections }: AppSidebarProps): JSX.Element {
  const pathname = usePathname()

  if (sections.length === 0) {
    return (
      <aside
        aria-label="Primary navigation"
        className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block"
      >
        <p className="text-sm text-slate-500">No navigation available.</p>
      </aside>
    )
  }

  return (
    <aside
      aria-label="Primary navigation"
      className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block"
    >
      <nav className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.heading} className="flex flex-col gap-1">
            {section.heading ? (
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {section.heading}
              </p>
            ) : null}
            {section.items.map((item) => {
              const active = isNavItemActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}

export function AppMobileNav({ sections }: AppSidebarProps): JSX.Element {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const activeItem = sections
    .flatMap((section) => section.items)
    .find((item) => isNavItemActive(pathname, item.href))

  if (sections.length === 0) {
    return (
      <div className="border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <p className="text-sm text-slate-500">No navigation available.</p>
      </div>
    )
  }

  return (
    <div className="border-b border-slate-200 bg-white md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-primary-navigation"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Navigation
          </span>
          <span className="mt-0.5 block truncate text-sm font-medium text-slate-950">
            {activeItem?.label ?? "Select workspace"}
          </span>
        </span>
        {open ? (
          <X className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
        )}
      </button>

      {open ? (
        <nav
          id="mobile-primary-navigation"
          aria-label="Primary navigation"
          className="space-y-4 border-t border-slate-200 px-4 py-3"
        >
          {sections.map((section) => (
            <div key={section.heading} className="space-y-1">
              {section.heading ? (
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {section.heading}
                </p>
              ) : null}
              {section.items.map((item) => {
                const active = isNavItemActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block rounded-md px-2 py-2 text-sm transition-colors",
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      ) : null}
    </div>
  )
}
