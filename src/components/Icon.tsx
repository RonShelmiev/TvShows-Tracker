import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

export type IconName =
  | 'search'
  | 'check'
  | 'plus'
  | 'chevronLeft'
  | 'chevronRight'
  | 'list'
  | 'bell'
  | 'tv'
  | 'compass'
  | 'calendar'
  | 'user'
  | 'trash'
  | 'refresh';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/** Stroke icons on a 24px grid, matching the design canvas. */
export function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.7 }: Props) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'search' && (
        <>
          <Circle cx="11" cy="11" r="6.5" {...stroke} />
          <Path d="M16 16l4 4" {...stroke} />
        </>
      )}
      {name === 'check' && <Path d="M4 12.5l5 5L20 6.5" {...stroke} strokeWidth={strokeWidth + 0.7} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...stroke} strokeWidth={strokeWidth + 0.3} />}
      {name === 'chevronLeft' && <Path d="M14.5 5l-7 7 7 7" {...stroke} strokeWidth={strokeWidth + 0.2} />}
      {name === 'chevronRight' && <Path d="M9.5 5l7 7-7 7" {...stroke} strokeWidth={strokeWidth + 0.1} />}
      {name === 'list' && <Path d="M4 7h16M4 12h16M4 17h10" {...stroke} />}
      {name === 'bell' && (
        <>
          <Path d="M6 10a6 6 0 0112 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10z" {...stroke} />
          <Path d="M10.5 19a1.8 1.8 0 003 0" {...stroke} />
        </>
      )}
      {name === 'tv' && (
        <>
          <Rect x="2.5" y="7.5" width="19" height="13" rx="2.5" {...stroke} />
          <Path d="M8 3.5l4 4 4-4" {...stroke} />
        </>
      )}
      {name === 'compass' && (
        <>
          <Circle cx="12" cy="12" r="9" {...stroke} />
          <Path d="M15.5 8.5l-2 5-5 2 2-5z" {...stroke} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x="3" y="5" width="18" height="16" rx="2.5" {...stroke} />
          <Path d="M3 10h18M8 3v4M16 3v4" {...stroke} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx="12" cy="8.5" r="3.8" {...stroke} />
          <Path d="M4.5 20c1.6-3.6 4.3-5.4 7.5-5.4s5.9 1.8 7.5 5.4" {...stroke} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0111 4h2a1.5 1.5 0 011.5 1.5V7" {...stroke} />
          <Path d="M6.5 7l1 12a1.5 1.5 0 001.5 1.4h6a1.5 1.5 0 001.5-1.4l1-12" {...stroke} />
        </>
      )}
      {name === 'refresh' && (
        <>
          <Path d="M20 12a8 8 0 11-2.5-5.8" {...stroke} />
          <Path d="M20 4v5h-5" {...stroke} />
        </>
      )}
    </Svg>
  );
}
