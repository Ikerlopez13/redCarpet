import React, { useState, useRef, useCallback, useEffect } from 'react';
import clsx from 'clsx';

interface DraggableSheetProps {
    children: React.ReactNode;
    floatingContent?: React.ReactNode; // Content that floats above the sheet with fixed margin
    minHeight?: number; // Minimum height in pixels
    maxHeight?: number; // Maximum height as percentage of parent (0-100)
    defaultHeight?: number; // Default height as percentage (0-100)
    onHeightChange?: (height: number) => void;
    className?: string;
}

export const DraggableSheet: React.FC<DraggableSheetProps> = ({
    children,
    floatingContent,
    minHeight = 80, // Just the handle and tabs
    maxHeight = 70, // 70% of parent
    defaultHeight = 45, // 45% default
    onHeightChange,
    className
}) => {
    const [heightPercent, setHeightPercent] = useState(defaultHeight);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const startHeight = useRef(0);

    // Snap points as percentages
    const snapPoints = [15, 45, maxHeight]; // Collapsed, default, expanded

    const findClosestSnapPoint = useCallback((value: number) => {
        return snapPoints.reduce((prev, curr) =>
            Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
        );
    }, [maxHeight]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        setIsDragging(true);
        startY.current = e.touches[0].clientY;
        startHeight.current = heightPercent;
    }, [heightPercent]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging || !containerRef.current) return;

        const parentHeight = containerRef.current.parentElement?.clientHeight || 600;
        const deltaY = startY.current - e.touches[0].clientY;
        const deltaPercent = (deltaY / parentHeight) * 100;

        let newHeight = startHeight.current + deltaPercent;

        // Calculate minimum as percentage
        const minPercent = (minHeight / parentHeight) * 100;

        // Clamp between min and max
        newHeight = Math.max(minPercent, Math.min(maxHeight, newHeight));

        setHeightPercent(newHeight);
        onHeightChange?.(newHeight);
    }, [isDragging, minHeight, maxHeight, onHeightChange]);

    const handleTouchEnd = useCallback(() => {
        if (!isDragging) return;
        setIsDragging(false);

        // Snap to closest snap point
        const snapped = findClosestSnapPoint(heightPercent);
        setHeightPercent(snapped);
        onHeightChange?.(snapped);
    }, [isDragging, heightPercent, findClosestSnapPoint, onHeightChange]);

    // Mouse events for desktop testing
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsDragging(true);
        startY.current = e.clientY;
        startHeight.current = heightPercent;
        e.preventDefault();
    }, [heightPercent]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;

            const parentHeight = containerRef.current.parentElement?.clientHeight || 600;
            const deltaY = startY.current - e.clientY;
            const deltaPercent = (deltaY / parentHeight) * 100;

            let newHeight = startHeight.current + deltaPercent;
            const minPercent = (minHeight / parentHeight) * 100;

            newHeight = Math.max(minPercent, Math.min(maxHeight, newHeight));

            setHeightPercent(newHeight);
            onHeightChange?.(newHeight);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            const snapped = findClosestSnapPoint(heightPercent);
            setHeightPercent(snapped);
            onHeightChange?.(snapped);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, minHeight, maxHeight, heightPercent, findClosestSnapPoint, onHeightChange]);

    // Double tap to toggle between collapsed and expanded
    const lastTap = useRef(0);
    const handleDoubleTap = useCallback(() => {
        const now = Date.now();
        if (now - lastTap.current < 300) {
            // Double tap detected
            const newHeight = heightPercent < 30 ? maxHeight : 15;
            setHeightPercent(newHeight);
            onHeightChange?.(newHeight);
        }
        lastTap.current = now;
    }, [heightPercent, maxHeight, onHeightChange]);

    return (
        <div
            ref={containerRef}
            className={clsx(
                "absolute bottom-0 left-0 right-0 bg-background-dark rounded-t-3xl z-30",
                "shadow-[0_-4px_20px_rgba(0,0,0,0.4)] border-t border-white/5",
                isDragging ? "transition-none" : "transition-all duration-300 ease-out",
                className
            )}
            style={{ height: `${heightPercent}%` }}
        >
            {/* Floating content above the sheet with fixed margin */}
            {floatingContent && (
                <div className="absolute bottom-full left-0 right-0 pb-4 px-4">
                    {floatingContent}
                </div>
            )}

            {/* Drag Handle */}
            <div
                className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onClick={handleDoubleTap}
            >
                <div className={clsx(
                    "w-12 h-1.5 rounded-full transition-colors",
                    isDragging ? "bg-primary" : "bg-white/20"
                )} />
            </div>

            {/* Content */}
            <div className="flex flex-col h-[calc(100%-24px)] overflow-hidden">
                {children}
            </div>
        </div>
    );
};
