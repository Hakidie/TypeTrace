import { Outlet } from "react-router-dom";
import type { NavItem, NavWidget } from "@/app/module.types";
import { BrandFooter } from "@/shared/components/layout/BrandFooter";
import { BrandHeader } from "@/shared/components/layout/BrandHeader";
import { NavLinks } from "@/shared/components/layout/NavLinks";
import { redGlassTheme } from "@/shared/lib/red-glass-theme";
import { AuthBrandPanel } from "./AuthBrandPanel";
import { GuestMenu } from "./GuestMenu";

// Auth pages only (login, register, forgot password); the rest of the app keeps its theme.
// The theme (maroon fields, blood-red dark mode) lives in shared/lib/red-glass-theme.ts.
// From the `lg` breakpoint the typing demo sits on the left and the form on the right; on phones only the form shows.
interface AuthLayoutProps {
  /** The navigation of the signed-in pages; the guest header shows the tabs that have no role. They need an account: a guest who opens one is sent back to Login. */
  navItems?: (NavItem | NavWidget)[];
}

export const AuthLayout = ({ navItems = [] }: AuthLayoutProps) => (
  <div className={`flex min-h-screen flex-col ${redGlassTheme}`}>
    {/* The header of the signed-in pages (sticky, see-through), with the guest menu in place of the user menu. */}
    <div className="sticky top-0 z-50 bg-background/75 backdrop-blur-xs">
      <BrandHeader
        to="/login"
        themeToggle={false}
        nav={<NavLinks items={navItems.filter((item) => !item.roles)} />}
      >
        <GuestMenu />
      </BrandHeader>
    </div>

    {/* The two columns stay level with each other at the top; together they sit in the middle of the page, between the header and the footer. */}
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-7xl items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <AuthBrandPanel />
        {/* The page's Card is the direct child: no background, border, shadow or blur, the form sits on the page.
          Its text is 2px bigger than the shared components' sizes (title 24 -> 32 px, text 16 -> 18 px, small 14 -> 16 px), except the field labels (18 px, muted). */}
        <div className="auth-enter w-full max-w-md justify-self-center lg:justify-self-end [&>*]:border-transparent [&>*]:bg-transparent [&>*]:shadow-none [&_.text-2xl]:text-[32px] [&_.text-base]:text-[18px] [&_label.text-base]:text-muted-foreground [&_.text-sm]:text-base">
          <Outlet />
        </div>
      </div>
    </main>

    <BrandFooter />
  </div>
);
