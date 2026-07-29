import { useConvexAuth } from "convex/react";
import { ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { APP_NAME } from "@/lib/constants";
import { Button } from "./ui/button";

export function Header() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();

  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/signup";

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-2.5 font-semibold text-lg hover:opacity-80 transition-opacity"
        >
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">
              F
            </span>
          </div>
          <span className="hidden sm:inline">{APP_NAME}</span>
        </Link>

        <nav className="flex items-center gap-2">
          {!isLoading && isAuthenticated ? (
            <Button size="sm" asChild>
              <Link to="/dashboard">
                Buka Dashboard
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            !isAuthPage && (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Masuk</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/signup">Daftar</Link>
                </Button>
              </>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
