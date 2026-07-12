import '../src/styles/tokens.css';
import '../src/index.css';
import '../src/App.css';
import '../src/landing/landing.css';

const preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#010102' },
        { name: 'surface-1', value: '#0e0f13' },
        { name: 'surface-2', value: '#18191e' },
        { name: 'white', value: '#ffffff' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'padded',
  },
};

export default preview;
