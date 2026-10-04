import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Board } from './components/Board'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing from index.html')

createRoot(root).render(
  <StrictMode>
    <Board />
  </StrictMode>,
)
