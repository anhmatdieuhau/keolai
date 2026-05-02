"use client";
import { useEffect, useRef } from "react";

export default function ScrollReveal({ children, className = "", delay = 0, direction = "up" }) {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => el.classList.add("revealed"), delay);
                    observer.unobserve(el);
                }
            },
            { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [delay]);

    const dirClass = direction === "left" ? "reveal-left" : direction === "right" ? "reveal-right" : "reveal-up";

    return (
        <div ref={ref} className={`reveal ${dirClass} ${className}`}>
            {children}
        </div>
    );
}
