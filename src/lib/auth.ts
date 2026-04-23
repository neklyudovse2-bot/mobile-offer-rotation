import { cookies } from 'next/headers';

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const password = process.env.ADMIN_PASSWORD;
  
  if (!password) {
    throw new Error('ADMIN_PASSWORD not configured');
  }
  
  const session = cookieStore.get('admin_session')?.value;
  return session === password;
}
