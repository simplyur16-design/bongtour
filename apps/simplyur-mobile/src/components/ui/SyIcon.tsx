import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { SY } from '@/src/constants/theme';

/**
 * Line icons from the 1.0.2 mockups (24 grid, round caps) — /workspace/simplyur-esim-design-1117/src/common.py `I`.
 * Drawn with react-native-svg so they render the same on iOS, Android and web.
 */
export type SyIconName =
  | 'globe'
  | 'help'
  | 'map'
  | 'wifi'
  | 'refund'
  | 'phone'
  | 'qr'
  | 'mail'
  | 'check'
  | 'chev'
  | 'back'
  | 'lock'
  | 'home'
  | 'sim'
  | 'book'
  | 'signal'
  | 'chat'
  | 'share'
  | 'info'
  | 'tag'
  | 'user'
  | 'doc'
  | 'shield'
  | 'logout'
  | 'trash'
  | 'headset'
  | 'link';

type Props = {
  name: SyIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function Shape({ name }: { name: SyIconName }) {
  switch (name) {
    case 'globe':
      return (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </>
      );
    case 'help':
      return (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01" />
        </>
      );
    case 'map':
      return <Path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" />;
    case 'wifi':
      return (
        <>
          <Path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
          <Circle cx={12} cy={19.5} r={0.8} />
        </>
      );
    case 'refund':
      return <Path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />;
    case 'phone':
      return (
        <>
          <Rect x={6} y={2} width={12} height={20} rx={3} />
          <Path d="M11 18h2" />
        </>
      );
    case 'qr':
      return (
        <>
          <Rect x={3} y={3} width={7} height={7} rx={1} />
          <Rect x={14} y={3} width={7} height={7} rx={1} />
          <Rect x={3} y={14} width={7} height={7} rx={1} />
          <Path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h3v3" />
        </>
      );
    case 'mail':
      return (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={2} />
          <Path d="m3 7 9 6 9-6" />
        </>
      );
    case 'check':
      return <Path d="m5 12 4.5 4.5L19 7" />;
    case 'chev':
      return <Path d="m9 6 6 6-6 6" />;
    case 'back':
      return <Path d="m15 6-6 6 6 6" />;
    case 'lock':
      return (
        <>
          <Rect x={5} y={11} width={14} height={10} rx={2} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      );
    case 'home':
      return <Path d="M3 11 12 4l9 7M5 10v10h14V10" />;
    case 'sim':
      return (
        <>
          <Path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
          <Rect x={8.5} y={11} width={7} height={7} rx={1} />
        </>
      );
    case 'book':
      return <Path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z" />;
    case 'signal':
      return <Path d="M5 17v3M10 13v7M15 9v11M20 5v15" />;
    case 'chat':
      return <Path d="M4 5h16v11H9l-5 4z" />;
    case 'share':
      return <Path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />;
    case 'info':
      return (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 11v6M12 7.5h.01" />
        </>
      );
    case 'tag':
      return (
        <>
          <Path d="M3 12V4h8l10 10-8 8z" />
          <Circle cx={7.5} cy={8} r={1.2} />
        </>
      );
    case 'user':
      return (
        <>
          <Circle cx={12} cy={8} r={4} />
          <Path d="M4 21a8 8 0 0 1 16 0" />
        </>
      );
    case 'doc':
      return <Path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />;
    case 'shield':
      return <Path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6zM9 12l2 2 4-4" />;
    case 'logout':
      return <Path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />;
    case 'trash':
      return <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />;
    case 'headset':
      return <Path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1zM17 19c0 1-2 2-5 2" />;
    case 'link':
      return <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />;
    default:
      return null;
  }
}

export function SyIcon({ name, size = 18, color = SY.ink, strokeWidth = 1.9 }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Shape name={name} />
    </Svg>
  );
}
