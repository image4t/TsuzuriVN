import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './style.css';
import './theme.css';
import {desktop} from './desktop';
import {initializeTheme} from './ThemeSwitch';
initializeTheme();if(desktop)void desktop.settings().then(settings=>{document.documentElement.dataset.theme=settings.theme;window.dispatchEvent(new Event('tsuzuri-theme'));});
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
