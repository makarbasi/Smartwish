'use client'

import { PinturaEditorModal } from '@pqina/react-pintura'

// Import CSS using the module approach recommended for Next.js
import '@pqina/pintura/pintura.css'

export default function DynamicPinturaEditor(props: Record<string, unknown>) {
  console.log('🖼️ DynamicPinturaEditor received props:', {
    src: props.src,
    hasOnProcess: !!props.onProcess,
    allProps: Object.keys(props)
  })
  
  return <PinturaEditorModal {...props} />
}
