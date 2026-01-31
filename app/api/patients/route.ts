/**
 * API endpoint para gestionar pacientes
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// GET - Listar pacientes y estadísticas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const statsOnly = searchParams.get('stats') === 'true';

    if (statsOnly) {
      const stats = await convex.query(api.patients.getStats, {});
      return NextResponse.json({ stats });
    }

    const patients = await convex.query(api.patients.list, { 
      status: status || undefined,
      limit: 100,
    });
    
    const stats = await convex.query(api.patients.getStats, {});

    return NextResponse.json({ patients, stats });
  } catch (error: any) {
    console.error('Error fetching patients:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch patients' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar un paciente
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    await convex.mutation(api.patients.remove, { id: id as any });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting patient:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete patient' },
      { status: 500 }
    );
  }
}
