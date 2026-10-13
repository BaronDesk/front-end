import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../components/tokens/tokens.css';
import './desk.css';
import { DeskApp } from './DeskApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeskApp />
  </StrictMode>,
);
