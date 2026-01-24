import React from 'react';

export default function LogoMark({ size = 36 }) {
  return (
    <div
      aria-label="GradeStack logo"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'conic-gradient(from 180deg, #00e5ff, #8a2be2, #00e5ff)',
        boxShadow: '0 0 18px rgba(0,229,255,0.4), 0 0 28px rgba(138,43,226,0.35)',
        display: 'grid',
        placeItems: 'center'
      }}
    >
      <span style={{
        color: '#0b0b0d',
        fontWeight: 800,
        fontSize: size * 0.42,
        letterSpacing: -0.5
      }}>GS</span>
    </div>
  );
}
