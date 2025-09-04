import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { FontSizeProvider } from './contexts/FontSizeContext'

createRoot(document.getElementById("root")!).render(
  <FontSizeProvider>
    <App />
  </FontSizeProvider>
);
