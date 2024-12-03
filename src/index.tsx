import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router'
import { AuthProvider } from './Auth.ctx.js'
import App from './App.js'
import './styles.css'

const Init = (
  <React.StrictMode>
    <AuthProvider>
      <Router>
        <App />
      </Router>
    </AuthProvider>
  </React.StrictMode>
)

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('root')
  if (!el) throw new Error('no root element')
  ReactDOM.createRoot(el).render(Init)
})
