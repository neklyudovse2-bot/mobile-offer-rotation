import { cookies } from 'next/headers';

export function isAdminAuthenticated() {
  const cookieStore = cookies();
  const password = process.env.ADMIN_PASSWORD;
  
  if (!password) {
    throw new Error('ADMIN_PASSWORD not configured');
  }
  
  const session = cookieStore.get('admin_session')?.value;
  return session === password;
}
