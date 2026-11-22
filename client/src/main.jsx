import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/atma/bengali-500.css';
import '@fontsource/anek-bangla/bengali-400.css';
import '@fontsource/anek-bangla/bengali-500.css';
import '@fontsource/anek-bangla/bengali-600.css';
import '@fontsource/anek-bangla/bengali-700.css';
import '@fontsource/anek-bangla/latin-400.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
