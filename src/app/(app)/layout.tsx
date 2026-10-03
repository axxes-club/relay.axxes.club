import { PulseTracker } from "@/components/pulse-tracker"
import { AllAppsSwitcher } from "@/components/all-apps-switcher"
import { OrgSwitcher } from "@/components/org-switcher"
import type { Metadata } from "next"
import { BrandScope } from "@/components/brand"
import { getCustomerBrand } from "@/lib/white-label"
import { requireContext } from "@/lib/context"
import { Sidebar } from "@/components/sidebar"
import { MainFrame } from "@/components/main-frame"
import { SignOut } from "@/components/sign-out"
import { Logo, LogoMark } from "@/components/logo"
import { product } from "@/product.config"

async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext()
  const items = [
    { href: "/overview", label: "Overview" },
    ...(product.nav ?? []),
    ...product.resources.map((r) => ({ href: `/${r.key}`, label: r.label })),
  ]

  return (
    <div className="relay-app lg:flex">
      <PulseTracker appKey="relay" tenantId={ctx.tenant.id} userId={ctx.userId}/>
      <Sidebar
        items={items}
        logo={<Logo />}
        mark={<LogoMark />}
        apps={<AllAppsSwitcher tenantId={ctx.tenant.id} />}
        organization={<OrgSwitcher current={{ tenantId: ctx.tenant.id, name: ctx.tenant.name, slug: ctx.tenant.slug, role: ctx.role, isPrimary: false }} memberships={ctx.memberships} />}
        footer={
          <div className="space-y-3 text-xs">
            <div>
              <p className="truncate text-muted">{ctx.user.email}</p>
            </div>
            <div className="flex items-center justify-between">
              <a className="text-muted hover:text-text" href="https://members.axxes.club/dashboard">← AXXES portal</a>
              <SignOut />
            </div>
          </div>
        }
      />
      <MainFrame>{children}</MainFrame>
    </div>
  )
}

/** White-label customers see their own brand; everyone else, standard AXXES. */
export default async function BrandedLayout(props: Parameters<typeof AppLayout>[0]) {
  const ctx = await requireContext()
  const brand = ctx ? await getCustomerBrand(ctx.tenant.id) : null
  return <BrandScope brand={brand}>{await AppLayout(props)}</BrandScope>
}

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireContext()
  const brand = ctx ? await getCustomerBrand(ctx.tenant.id) : null
  return brand?.faviconUrl ? { icons: { icon: brand.faviconUrl } } : {}
}
