import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { APP_MODE, APP_TITLE } from './appMode';
import './styles/base.css';

document.title = APP_TITLE[APP_MODE];

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
