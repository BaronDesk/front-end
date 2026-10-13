import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../components/tokens/tokens.css';
import './portal.css';
import { PortalApp } from './PortalApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PortalApp />
  </StrictMode>,
);
