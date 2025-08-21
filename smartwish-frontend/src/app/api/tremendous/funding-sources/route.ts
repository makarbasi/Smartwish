import { NextResponse } from 'next/server'
import axios from 'axios'

const API_KEY = process.env.TREMENDOUS_API_KEY
const BASE_URL = 'https://testflight.tremendous.com/api/v2'

export async function GET() {
  try {
    if (!API_KEY) {
      return NextResponse.json(
        { error: 'TREMENDOUS_API_KEY not configured' },
        { status: 500 }
      )
    }

    const response = await axios.get(`${BASE_URL}/funding_sources`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    
    return NextResponse.json(response.data)
  } catch (error: any) {
    console.error('Error fetching funding sources:', error)
    return NextResponse.json(
      { error: 'Failed to fetch funding sources' },
      { status: 500 }
    )
  }
}