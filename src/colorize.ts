import type { AnsiColor } from './interfaces';

const ansiStyles: Record<AnsiColor, string> = Object.entries({
  reset: 0,
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
}).reduce((styles, [name, value]) => {
  styles[name as AnsiColor] = `\x1b[${value}m`;
  return styles;
}, {} as Record<AnsiColor, string>);

function colorize(color: AnsiColor, message: string): string {
  if (!ansiStyles[color]) {
    return message;
  }
  return `${ansiStyles[color]}${message}${ansiStyles.reset}`;
}

export default colorize;
