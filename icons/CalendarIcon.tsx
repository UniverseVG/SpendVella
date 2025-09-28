/* eslint-disable @typescript-eslint/no-empty-object-type */
// CalendarIcon.tsx
import React from "react";

interface CalendarIconProps extends React.SVGProps<SVGSVGElement> {}

const CalendarIcon: React.FC<CalendarIconProps> = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 14v8M15 14v8M9 2v6M15 2v6" />
    </svg>
  );
};

export default CalendarIcon;
