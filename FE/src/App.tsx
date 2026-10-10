import { Navigate, Route, Routes } from 'react-router-dom';
import { adminNavItems, adminRoutes, appWidgets, navItems, protectedRoutes } from '@/app/modules';
import { AdminLayout } from '@/shared/components/layout/AdminLayout';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { GuestRoute } from '@/modules/auth/components/GuestRoute';
import { ProtectedRoute } from '@/modules/auth/components/ProtectedRoute';
import { LoginPage } from '@/modules/auth/pages/LoginPage';
import { RegisterPage } from '@/modules/auth/pages/RegisterPage';
import { ForgotPasswordPage } from '@/modules/auth/pages/ForgotPasswordPage';
import { LogoutPage } from '@/modules/auth/pages/LogoutPage';

function App() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
      </Route>
      <Route path="/logout" element={<LogoutPage />} />

      {/* Protected routes — registered by feature modules in src/app/modules.ts */}
      <Route element={<ProtectedRoute><AppLayout navItems={navItems} widgets={appWidgets} /></ProtectedRoute>}>
        {protectedRoutes.map(({ path, Component, roles }) => (
          <Route
            key={path}
            path={path}
            element={roles ? <ProtectedRoute roles={roles}><Component /></ProtectedRoute> : <Component />}
          />
        ))}
        <Route path="/me" element={<Navigate to="/profile" replace />} />
      </Route>

      {/* Admin area — sidebar layout; pages come from `adminRoutes` of each module. Admins only (the API checks the role too). */}
      <Route element={<ProtectedRoute roles={['admin']}><AdminLayout navItems={adminNavItems} /></ProtectedRoute>}>
        {adminRoutes.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
