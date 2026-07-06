import Svg, { Circle, Path } from 'react-native-svg';

type Props = { width?: number; height?: number; fill?: string };

/** Signal Pin — location pin + eSIM signal (design_handoff_login_1b) */
export function SignalPinIcon({ width = 44, height = 53, fill = '#FF6B4A' }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 120" fill="none">
      <Path
        d="M50,6 C27,6 8,25 8,48 C8,76 50,116 50,116 C50,116 92,76 92,48 C92,25 73,6 50,6 Z"
        fill={fill}
      />
      <Circle cx="50" cy="60" r="6.5" fill="#fff" />
      <Path
        d="M34.6,52.8 A17,17 0 0 1 65.4,52.8"
        stroke="#fff"
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M24.6,48.2 A28,28 0 0 1 75.4,48.2"
        stroke="#fff"
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
