import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { FontSizeProvider } from './contexts/FontSizeContext'

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <FontSizeProvider>
      <App />
    </FontSizeProvider>
  );
}
