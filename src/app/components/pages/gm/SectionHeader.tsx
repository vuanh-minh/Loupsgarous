import React from 'react';
import { type GameThemeTokens } from './gmSharedTypes';

export const SectionHeader = React.memo(function SectionHeader({ icon, title, t }: { icon: React.ReactNode; title: string; t?: GameThemeTokens }) {
  const gold = t?.gold ?? '#d4a843';
  return (
    <div className="flex items-center gap-2 mb-2">
      <span style={{ color: gold }}>{icon}</span>
      <h3 style={{ fontFamily: '"Cinzel", serif', color: gold, fontSize: '0.8rem' }}>
        {title}
      </h3>
    </div>
  );
});
