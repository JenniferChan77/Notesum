import { createServerClient } from '@supabase/ssr'
import { log } from 'console'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: req,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  )

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  // Public routes - accessible to all users
  const publicRoutes = ['/']
  
  // Auth routes - only for unauthenticated users
  const authRoutes = ['/login', '/signup', '/auth/callback']
  
  // Check if current path is public
  const isPublicRoute = publicRoutes.includes(pathname)
  
  // Check if current path is auth route
  const isAuthRoute = authRoutes.includes(pathname)

  // If user is authenticated and trying to access auth routes, redirect to upload
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/upload', req.url))
  }
  
  // If user is not authenticated and trying to access protected routes (not public, not auth)
  if (!session && !isPublicRoute && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}


