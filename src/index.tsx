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

ReactDOM.createRoot(document.getElementById('root')).render(Init)
