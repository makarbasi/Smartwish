import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
    try {
        const base = process.env.NEXT_PUBLIC_API_BASE ?? 'https://smartwish.onrender.com'
        const apiUrl = new URL('/templates-enhanced/templates', base)

        // Fetch all templates to extract unique regions
        const response = await fetch(apiUrl.toString(), {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        // Extract unique regions from the templates
        const regions = new Set<string>()

        if (data.data && Array.isArray(data.data)) {
            data.data.forEach((template: any) => {
                if (template.region && template.region.trim()) {
                    regions.add(template.region.trim())
                }
            })
        }

        // Convert to array and sort
        const regionsList = ['Any region', ...Array.from(regions).sort()]

        return NextResponse.json({ regions: regionsList })
    } catch (error) {
        console.error('Error fetching regions:', error)
        return NextResponse.json(
            { error: 'Failed to fetch regions' },
            { status: 500 }
        )
    }
}
