export type WhatItem = {
  title: string
  description: string
  image: string
  span: 5 | 7 // 7 ~ 58% (≈55), 5 ~ 42% (≈45)
}

// Base path for public assets under /public/resources/what
const WHAT_BASE = '/resources/what/'

export const whatYouGet: WhatItem[] = [
  {
    title: 'Choose from Various Templates',
    description:
      "Explore a wide array of artistic templates and themes to apply to your cards. Whether you’re creating cards for birthdays or even anniversaries.",
    image: WHAT_BASE + 'what-to-get-1.jpg',
    span: 7,
  },
  {
    title: 'Create from Scratch',
    description:
      'You can also decide to create your card from scratch with a set tools and elements at your disposal.',
    image: WHAT_BASE + 'what-to-get-2.jpg',
    span: 5,
  },
  {
    title: 'Adjust Parameters for Customization',
    description:
      'Fine-tune the brightness, contrast, colors, and so much more with intuitive parameter adjustment tools.',
    image: WHAT_BASE + 'what-to-get-3.jpg',
    span: 5,
  },
  {
    title: 'Save and Share Your Creations',
    description:
      'Save to your device or share it directly with friends and followers on social media. Share off beautiful designs with just a click.',
    image: WHAT_BASE + 'what-to-get-1.jpg',
    span: 7,
  },
]

