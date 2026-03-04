import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../api/client";

const ProtectedRoute = ({ children, allowedRoles, redirectTo = "/login" }) => {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("classiq_user") || "null");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let active = true;
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (!active) return;
        const nextUser = data?.user || null;
        if (nextUser) {
          localStorage.setItem("classiq_user", JSON.stringify(nextUser));
        } else {
          localStorage.removeItem("classiq_user");
        }
        setUser(nextUser);
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem("classiq_user");
        setUser(null);
      })
      .finally(() => {
        if (active) setIsChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (isChecking) return null;

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
