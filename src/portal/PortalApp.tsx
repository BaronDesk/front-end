import { HashRouter, Link, Route, Routes } from 'react-router';

import { Placeholder } from '../shared/Placeholder';
import { PORTAL_MENU } from './menu';
import { PortalLayout } from './PortalLayout';

function PortalHome() {
  return (
    <>
      <h1>Welcome</h1>
      <ul className="portal-menu">
        {PORTAL_MENU.map((item) => (
          <li key={item.path}>
            <Link to={item.path}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function PortalApp() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<PortalLayout />}>
          <Route index element={<PortalHome />} />
          {PORTAL_MENU.map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={<Placeholder title={item.label} step={item.step} />}
            />
          ))}
          <Route path="/login" element={<Placeholder title="Login" step={3} />} />
          <Route path="*" element={<Placeholder title="Page not found" step={9} />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
