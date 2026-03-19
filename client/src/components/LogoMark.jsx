import React from 'react';

export default function LogoMark({ size = 36 }) {
  return (
    <img
      src={`${process.env.PUBLIC_URL || ''}/logo-mascot.png`}
      alt="GradeStack logo"
      width={size}
      height={size}
      style={{
        display: 'block',
        width: size,
        height: size,
        objectFit: 'contain',
        filter: 'drop-shadow(0 0 10px rgba(56,189,248,0.35))',
      }}
    />
  );
}
