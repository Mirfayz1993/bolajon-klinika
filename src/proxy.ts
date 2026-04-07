import { withAuth } from 'next-auth/middleware';

export default withAuth;

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/patients/:path*',
    '/appointments/:path*',
    '/payments/:path*',
    '/lab/:path*',
    '/pharmacy/:path*',
    '/rooms/:path*',
    '/admissions/:path*',
    '/staff/:path*',
    '/schedule/:path*',
    '/schedules/:path*',
    '/salaries/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/audit-logs/:path*',
    '/medical-records/:path*',
  ],
};
