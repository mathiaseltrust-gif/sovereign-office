import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  BookOpen,
  MessageSquare,
  MessageCircle,
  Menu,
  Sun,
  Moon,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Family Directory", href: "/directory", icon: Users },
  { name: "Legal Resources", href: "/legal", icon: BookOpen },
  { name: "Community Forum", href: "/forum", icon: MessageSquare },
  { name: "Legal Guidance", href: "/guidance", icon: MessageCircle },
  { name: "Admin", href: "/admin", icon: Shield },
];

const mobileNav = navigation.slice(0, 5);

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <div className="space-y-0.5">
      {navigation.map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link key={item.name} href={item.href} onClick={onNavigate}>
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="font-medium text-sm">{item.name}</span>
              {item.name === "Admin" && (
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider opacity-60">Office</span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2.5">
          <img src={`${import.meta.env.BASE_URL}tribal-seal.png`} alt="Mathias El Tribe Seal" className="h-9 w-9 object-contain rounded-full" />
          <span className="font-bold text-base leading-tight">Mathias El Tribe</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed top-0 left-0 h-full w-72 bg-card border-r z-50 flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b flex items-center gap-2.5">
              <img src={`${import.meta.env.BASE_URL}tribal-seal.png`} alt="Mathias El Tribe Seal" className="h-9 w-9 object-contain rounded-full shrink-0" />
              <div>
                <p className="font-bold text-base leading-none">Mathias El Tribe</p>
                <p className="text-xs text-muted-foreground mt-0.5">Community Center</p>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
            </div>
            <div className="p-3 border-t">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-card h-screen sticky top-0">
        <div className="p-5 border-b">
          <div className="flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}tribal-seal.png`} alt="Mathias El Tribe Seal" className="h-9 w-9 object-contain rounded-full shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate">Mathias El Tribe</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Community Center</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <NavLinks />
        </div>
        <div className="p-3 border-t">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-30 shadow-lg">
        <div className="flex">
          {mobileNav.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href} className="flex-1">
                <div
                  className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[9px] font-medium leading-none">{item.name.split(" ")[0]}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
