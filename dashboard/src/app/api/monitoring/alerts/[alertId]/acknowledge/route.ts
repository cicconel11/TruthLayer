import { NextRequest, NextResponse } from 'next/server';

export async function POST(
    request: NextRequest,
    { params }: { params: { alertId: string } }
) {
    try {
        const { alertId } = params;
        const body = await request.json();
        const { acknowledgedBy } = body;

        if (!acknowledgedBy) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'acknowledgedBy is required',
                },
                { status: 400 }
            );
        }

        // In a real implementation, you would store alert acknowledgments in the database
        // For now, we'll just return success since alerts are generated dynamically

        console.log(`Alert ${alertId} acknowledged by ${acknowledgedBy} at ${new Date().toISOString()}`);

        return NextResponse.json({
            success: true,
            data: {
                alertId,
                acknowledgedBy,
                acknowledgedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error acknowledging alert:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to acknowledge alert',
            },
            { status: 500 }
        );
    }
}