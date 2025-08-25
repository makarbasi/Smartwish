import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
    try {
        const base = process.env.NEXT_PUBLIC_API_BASE ?? 'https://smartwish.onrender.com'
        const apiUrl = new URL('/templates-enhanced/templates', base)

        // Fetch all templates to extract unique languages
        const response = await fetch(apiUrl.toString(), {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        // Extract unique languages from the templates
        const languages = new Set<string>()

        if (data.data && Array.isArray(data.data)) {
            data.data.forEach((template: any) => {
                if (template.language && template.language.trim()) {
                    languages.add(template.language.trim())
                }
            })
        }

        // Convert to array and sort
        const languagesList = ['Any language', ...Array.from(languages).sort()]

        return NextResponse.json({ languages: languagesList })
    } catch (error) {
        console.error('Error fetching languages:', error)
        return NextResponse.json(
            { error: 'Failed to fetch languages' },
            { status: 500 }
        )
    }
}
