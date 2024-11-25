import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import { AuthProvider } from './Auth.ctx'
import App from './App'
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
