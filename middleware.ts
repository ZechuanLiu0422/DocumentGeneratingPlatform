import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_PATHS = ['/login'];
const PASSWORD_CHANGE_PATH = '/change-password';

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isApiPath(pathname: string) {
  return pathname.startsWith('/api/');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSession(request);

  if (isApiPath(pathname)) {
    return response;
  }

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const mustChangePassword = Boolean(user?.user_metadata?.must_change_password);

  if (user && mustChangePassword && pathname !== PASSWORD_CHANGE_PATH && !isApiPath(pathname)) {
    const changePasswordUrl = request.nextUrl.clone();
    changePasswordUrl.pathname = PASSWORD_CHANGE_PATH;
    changePasswordUrl.searchParams.set('reason', 'must_change_password');
    return NextResponse.redirect(changePasswordUrl);
  }

  if (user && !mustChangePassword && pathname === PASSWORD_CHANGE_PATH) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  if (user && pathname === '/login') {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
