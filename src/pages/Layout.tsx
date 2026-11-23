import { Link, NavLink, Outlet } from "react-router";
import { ROUTES } from "../game";

export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4">
      <header className="flex items-center justify-between gap-4 border-b-2 border-panel-edge py-4">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          <Link to={ROUTES.start}>
            🎒 Backpack <span className="text-gold">Brawl</span>
          </Link>
        </h1>
        <nav>
          <NavLink
            to={ROUTES.hallOfFame}
            className={({ isActive }) => `font-display font-bold hover:text-gold ${isActive ? "text-gold" : ""}`}
          >
            🏆 Hall of fame
          </NavLink>
        </nav>
      </header>

      <main className="flex flex-1 flex-col gap-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-panel-edge py-3 text-xs tracking-wider text-muted">
        Backpack Brawl · practical exam starter
      </footer>
    </div>
  );
}
