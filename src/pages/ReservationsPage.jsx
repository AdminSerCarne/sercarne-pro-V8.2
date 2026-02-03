
import React from 'react';
import { Navigate } from 'react-router-dom';

// This component is deprecated and removed from navigation.
// Redirecting to home just in case.
const ReservationsPage = () => {
  return <Navigate to="/" replace />;
};

export default ReservationsPage;
