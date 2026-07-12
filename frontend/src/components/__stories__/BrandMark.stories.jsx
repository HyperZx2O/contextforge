import BrandMark from '../BrandMark.jsx';

export default {
  title: 'Components/BrandMark',
  component: BrandMark,
  tags: ['autodocs'],
};

export const Default = {
  args: { size: 32 },
};

export const Small = {
  args: { size: 16 },
};

export const Sizes = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'end', gap: 24 }}>
      <BrandMark size={16} />
      <BrandMark size={24} />
      <BrandMark size={32} />
      <BrandMark size={48} />
      <BrandMark size={64} />
    </div>
  ),
};
