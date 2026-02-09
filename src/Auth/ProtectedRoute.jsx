import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRoles, redirectTo = "/login" }) => {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("classiq_user"));
  const isAuthenticated = !!user;
  const userRole = user?.role;

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
