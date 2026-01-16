import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
    try {
        // Return the fixed author options: SmartWish Studio and Community
        const authors = ['Any author', 'SmartWish Studio', 'Community']

        return NextResponse.json({ authors })
    } catch (error) {
        console.error('Error fetching authors:', error)
        return NextResponse.json(
            { error: 'Failed to fetch authors' },
            { status: 500 }
        )
    }
}
