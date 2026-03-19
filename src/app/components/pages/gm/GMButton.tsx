import React from 'react';

export const GMButton = React.memo(function GMButton({
  onClick,
  icon,
  label,
  color,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all hover:shadow-lg active:scale-95"
      style={{
        background: primary
          ? `linear-gradient(135deg, ${color}, ${color}cc)`
          : `${color}10`,
        border: `1px solid ${color}${primary ? '60' : '20'}`,
        color: primary ? '#0a0e1a' : color,
        fontFamily: '"Cinzel", serif',
        fontSize: '0.75rem',
        boxShadow: primary ? `0 4px 15px ${color}30` : 'none',
      }}
    >
      {icon}
      {label}
    </button>
  );
});
