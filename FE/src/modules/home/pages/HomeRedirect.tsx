import { Navigate } from 'react-router-dom';

/** The typing page is the home page: `/` opens it. */
export const HomeRedirect = () => <Navigate to="/typing" replace />;
