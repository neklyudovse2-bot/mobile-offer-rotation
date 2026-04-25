import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const password = process.env.ADMIN_PASSWORD;
  
  if (!password) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD not configured' }, { status: 500 });
  }

  const session = cookieStore.get('admin_session')?.value;
  if (session !== password) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const protocol = request.url.startsWith('https') ? 'https' : 'http';
    const host = request.headers.get('host');
    
    const url = new URL(request.url);
    const appIdParam = url.searchParams.get('app_id');
    const rotationUrl = appIdParam 
      ? `${protocol}://${host}/api/rotation/run?app_id=${appIdParam}`
      : `${protocol}://${host}/api/rotation/run`;
      
    const res = await fetch(rotationUrl, { method: 'POST', cache: 'no-store' });
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
