import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { Database } from './lib/types/supabase';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });
  const url = new URL(req.nextUrl);

  // Get the session from Supabase.
  const { data: { session } } = await supabase.auth.getSession();

  // Redirect unauthenticated users trying to access admin or profile routes.
  if (!session) {
    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/profile')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return res;
  }

  // Only make the DB call if the route is under '/admin'
  if (url.pathname.startsWith('/admin')) {
    const { data: userRoles, error } = await supabase
      .from('roles')
      .select(`
        role,
        event_categories (
          name,
          fests (
            name,
            year
          )
        )
      `)
      .eq('user_id', session.user?.id)
      .eq('event_categories.fests.name', 'Game Of Thrones')
      .eq('event_categories.fests.year', 2025)
      .single();

    // Redirect if there's an error, no role data, or the role doesn't match.
    if (error || !userRoles) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    // Check for general admin access.
    if (userRoles.role !== 'super_admin' && userRoles.role !== 'convenor') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    // Additional check for the add-event route.
    if (
      url.pathname.startsWith('/admin/manage-events/add-event') &&
      userRoles.role !== 'super_admin'
    ) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }

  // If all checks pass, continue to the next middleware or route.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|assets|favicon.ico|logo.png|sw.js).*)',
  ],
};
