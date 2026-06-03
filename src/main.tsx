import React from 'react'
import ReactDOM from 'react-dom/client'
import { ensureApi } from './lib/ensure-api'
import App from './App'
import './assets/fonts/fonts.css'
import './styles/carbon.scss'
import './index.css'

ensureApi()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
