import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { initPushNotifications } from '../../services/pushService';

export const ProtectedRoute = () => {
    const { isAuthenticated, isLoading, user } = useAuth();

    useEffect(() => {
        if (isAuthenticated && user?.id) {
            initPushNotifications(user.id);
        }
    }, [isAuthenticated, user?.id]);

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-background-dark text-white">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                    progress_activity
                </span>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};
