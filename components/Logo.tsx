// wiki.simonwied.com wordmark logo (from assets/logo_big.svg).
// The lettering uses currentColor so it adapts to the theme; the accent square
// uses --accent (the brand green #009955).
export default function Logo({ height = 28 }: { height?: number }) {
  return (
    <svg
      height={height}
      viewBox="5 14 202 44"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="wiki.simonwied.com"
      style={{ display: 'block', width: 'auto' }}
    >
      <g fill="currentColor">
        <path d="m 172.56665,30.248495 v 25.929169 h 12.7 V 30.248495 Z" />
        <path d="m 150.39436,30.248495 -15.13396,11.165209 17.67385,14.76396 h 16.08688 l -18.04438,-14.64769 16.245,-11.281479 z" />
        <path d="m 103.45717,30.248495 v 25.929169 h 12.7 V 30.248495 Z" />
        <path d="M 20.623986,30.302238 H 6.1153107 L 20.58988,56.177664 H 38.47561 L 50.487796,32.719145 62.499983,56.177664 H 80.38571 L 99.117901,22.310995 H 84.40717 L 70.999723,48.726434 58.478006,22.310995 H 42.49707 L 29.975353,48.726434 Z" />
        <path d="m 122.34852,19.665161 v 36.512503 h 12.7 V 19.665161 Z" />
        <path d="m 172.19613,16.648808 v 7.9375 h 13.44052 v -7.9375 z" />
        <path d="m 103.08665,16.648808 v 7.9375 h 13.44104 v -7.9375 z" />
      </g>
      <path fill="var(--accent)" d="m 191.1929,48.186934 v 7.99073 h 13.44104 v -7.99073 z" />
    </svg>
  )
}
