import { NextRequest } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

export async function GET(request: NextRequest) {
  if (!CONVEX_URL) {
    return new Response(JSON.stringify({ error: 'Convex URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const convex = new ConvexHttpClient(CONVEX_URL);
    
    // Get recent evaluations (last 20)
    const evaluations = await convex.query(api.evaluations.getRecent, { limit: 20 });
    
    return new Response(JSON.stringify(evaluations), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching evaluations:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
