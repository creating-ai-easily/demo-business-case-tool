import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">
          Business Case Builder <small>MARKT-PILOT Edition</small>
        </Link>
        <nav>
          <Link href="/">Dashboard</Link>
          <Link href="/templates">Templates</Link>
        </nav>
        <div className="controls">
          {user?.email && (
            <span className="save-status" title={user.email}>
              {user.email}
            </span>
          )}
          <form action={signOut}>
            <button className="btn-ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}
