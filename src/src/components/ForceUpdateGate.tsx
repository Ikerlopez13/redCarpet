import React from 'react';

export const ForceUpdateGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Force update logic completely removed per user request
    return <>{children}</>;
};
