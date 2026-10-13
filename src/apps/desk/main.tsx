import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './classic.css';
import { DeskApp } from './DeskApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeskApp />
  </StrictMode>,
);
