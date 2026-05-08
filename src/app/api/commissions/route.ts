import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const commissions = await prisma.commission.findMany({
      include: {
        invoice: true,
        salesperson: true,
      },
    });
    return NextResponse.json(commissions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
  }
}
