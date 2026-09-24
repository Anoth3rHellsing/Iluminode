import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        an: {
          'bg-deep': '#051525',
          'bg-mid': '#0a2540',
          'bg-light': '#1a4a7a',
          'glow-cyan': '#6dd5fa',
          text: '#ffffff',
          'text-sec': 'rgba(255,255,255,.8)',
          'text-muted': 'rgba(255,255,255,.5)',
          glass: 'rgba(255,255,255,.15)',
          'glass-border': 'rgba(255,255,255,.1)',
          'glass-hover': 'rgba(255,255,255,.2)',
          online: '#8fd95f',
          red: '#ffa694',
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(109,213,250,.4)',
        'glow-strong': '0 0 40px rgba(109,213,250,.6), 0 0 80px rgba(109,213,250,.2)',
        'an-glow': '0 0 30px rgba(100,180,255,.5)',
        'an-glow-sm': '0 0 12px rgba(100,180,255,.3)',
        'an-tile': '0 4px 16px rgba(0,0,0,.3)',
        'an-tile-hover': '0 8px 32px rgba(0,100,200,.4), 0 0 20px rgba(100,180,255,.2)',
        'an-btn': '0 4px 20px rgba(0,100,200,.4), inset 0 1px 0 rgba(255,255,255,.4)',
      },
      animation: {
        'an-wave1': 'anWaveMove 12s linear infinite',
        'an-wave2': 'anWaveMove 18s linear infinite reverse',
        'an-twinkle': 'anTwinkle 3s ease-in-out infinite',
        'an-bar': 'anBar .8s ease-in-out infinite alternate',
        'an-pop': 'anChannelPop .4s cubic-bezier(.2,.8,.3,1) both',
      },
      keyframes: {
        anWaveMove: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        anTwinkle: {
          '0%, 100%': { opacity: '.2' },
          '50%': { opacity: '.8' },
        },
        anBar: {
          '0%': { height: '3px' },
          '100%': { height: '14px' },
        },
        anChannelPop: {
          from: { opacity: '0', transform: 'scale(.8)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;