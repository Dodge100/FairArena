import React from "react";

/* ----------------------------------------------------
   REUSABLE COMPONENT: LegalSection
----------------------------------------------------- */
export function LegalSection({
    title,
    children,
    isDark,
}: {
    title: string;
    children: React.ReactNode;
    isDark: boolean;
}) {
    return (
        <div className="mb-10">
            <h2
                className={`
          text-2xl font-semibold mb-4
          ${isDark ? "text-[#ddef00]" : "text-[#a5bf00]"}
        `}
            >
                {title}
            </h2>
            {children}
        </div>
    );
}

/* ----------------------------------------------------
   REUSABLE COMPONENT: LegalList
----------------------------------------------------- */
export function LegalList({
    items,
    isDark,
}: {
    items: string[];
    isDark: boolean;
}) {
    return (
        <ul
            className={`
        list-disc ml-6 mb-6
        ${isDark ? "text-neutral-300" : "text-neutral-700"}
      `}
        >
            {items.map((item, i) => (
                <li key={i} className="mb-1">
                    {item}
                </li>
            ))}
        </ul>
    );
}
