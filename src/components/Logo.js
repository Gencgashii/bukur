import React from 'react';

const Logo = ({ size = 60, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`bukur-logo-svg ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* Outer Circle (thick ring) */}
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="1.5" />
      {/* Inner Circle (thin ring) */}
      <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="0.8" />
      
      {/* Left Monogram 'B' (mirrored) */}
      <path
        d="M 47,28 L 47,72 M 47,28 C 32,28 32,50 47,50 M 47,50 C 32,50 32,72 47,72"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right Monogram 'B' */}
      <path
        d="M 53,28 L 53,72 M 53,28 C 68,28 68,50 53,50 M 53,50 C 68,50 68,72 53,72"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Middle bridge connection */}
      <path
        d="M 47,50 L 53,50"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default Logo;
