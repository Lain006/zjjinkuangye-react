import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import App from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing app root')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domAnimation} strict>
          <App />
        </LazyMotion>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
)
