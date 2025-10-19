import type { Metadata } from "next";
import "./globals.css";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import { SupabaseProvider } from "@/components/providers/supabase-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "LocalSpotlight Console",
  description: "Manage your Google Business Profile automation",
};

const themeInitializer = `
(() => {
  const storageKey = "localspotlight-theme";
  const cookieKey = "localspotlight-theme";
  try {
    const stored = window.localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.cookie = cookieKey + "=" + theme + "; path=/; max-age=" + (60 * 60 * 24 * 365);
  } catch (error) {
    // no-op
  }
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerComponentClientWithAuth();
  const { data: userData } = await supabase.auth.getUser();
  const sessionResponse = userData.user ? await supabase.auth.getSession() : null;
  const session =
    userData.user && sessionResponse?.data.session
      ? { ...sessionResponse.data.session, user: userData.user }
      : null;
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("localspotlight-theme")?.value;
  const initialTheme = themeCookie === "light" || themeCookie === "dark" ? themeCookie : "dark";

  return (
    <html
      lang="en"
      data-theme={initialTheme}
      className={initialTheme === "dark" ? "dark" : ""}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <SupabaseProvider session={session}>{children}</SupabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
