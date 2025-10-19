"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import type { Database } from "@/types/database";

type Location = Database["public"]["Tables"]["gbp_locations"]["Row"];

interface SidebarProps {
  organizations: Array<{ id: string; name: string | null }>;
  currentOrgId: string | null;
  onSignOut: () => Promise<void>;
}

export function Sidebar({ organizations, currentOrgId, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isLocationsExpanded, setIsLocationsExpanded] = useState(true);

  // Fetch locations for current org
  useEffect(() => {
    if (!currentOrgId) {
      setLocations([]);
      return;
    }

    async function fetchLocations() {
      setIsLoadingLocations(true);
      try {
        const response = await fetch(
          `/api/integrations/google/locations?orgId=${currentOrgId}&from=0&to=99`
        );
        const data = await response.json();
        setLocations((data.locations || []).filter((loc: Location) => loc.is_managed));
      } catch (error) {
        console.error("Failed to fetch locations:", error);
        setLocations([]);
      } finally {
        setIsLoadingLocations(false);
      }
    }

    void fetchLocations();
  }, [currentOrgId]);

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      name: "Locations",
      href: "/locations",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      name: "Reviews",
      href: "/reviews",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      ),
    },
    {
      name: "Content",
      href: "/content",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
    {
      name: "Integrations",
      href: "/integrations/google",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    {
      name: "Settings",
      href: "/settings/org",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-800 bg-slate-900">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-800 px-6">
        <Link href="/" className="text-lg font-semibold text-white">
          LocalSpotlight
        </Link>
      </div>

      {/* Organization Switcher */}
      <div className="border-b border-slate-800 p-4">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
          Organization
        </div>
        <select
          value={currentOrgId ?? ""}
          onChange={(e) => {
            if (e.target.value) {
              window.location.href = `/?orgId=${e.target.value}`;
            }
          }}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          {organizations.length === 0 ? (
            <option value="">No organizations</option>
          ) : (
            organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name ?? "Unnamed org"}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-emerald-500/10 text-emerald-400"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {item.icon}
            <span>{item.name}</span>
          </Link>
        ))}

        {/* Locations Section */}
        {currentOrgId && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <button
              onClick={() => setIsLocationsExpanded(!isLocationsExpanded)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-400 transition-colors"
            >
              <span>Managed Locations</span>
              <svg
                className={`h-4 w-4 transition-transform ${isLocationsExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isLocationsExpanded && (
              <div className="mt-2 space-y-1">
                {isLoadingLocations ? (
                  <div className="px-3 py-2 text-xs text-slate-500">Loading...</div>
                ) : locations.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">
                    No locations synced
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {locations.map((location) => (
                      <Link
                        key={location.id}
                        href={`/locations/${location.id}`}
                        className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                          pathname === `/locations/${location.id}`
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        }`}
                      >
                        <div className="truncate" title={location.title ?? "Untitled"}>
                          {location.title ?? "Untitled"}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User Section */}
      <div className="border-t border-slate-800 p-4">
        <form action={onSignOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </div>
  );
}
