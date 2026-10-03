import { Document } from './document.tsx'
import { Counter } from './public/counter.tsx'

export function HomePage() {
  return () => (
    <Document title="Remix clientEntry HMR reproduction">
      <main>
        <h1>Remix clientEntry HMR reproduction</h1>
        <Counter />
      </main>
    </Document>
  )
}
