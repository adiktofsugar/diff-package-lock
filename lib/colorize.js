const ansiStyles = Object.entries({
  reset: 0,
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90
}).reduce(
  (styles, [name, value]) => ({
    ...styles,
    [name]: `\x1b[${value}m`
  }),
  {}
);
function colorize(color, message) {
  if (!ansiStyles[color]) {
    return message;
  }
  return `${ansiStyles[color]}${message}${ansiStyles.reset}`;
}
module.exports = colorize;
