import Skeleton from '../Skeleton.jsx';

export default {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
};

export const Default = {
  args: { rows: 3 },
};

export const SingleRow = {
  args: { rows: 1 },
};

export const ManyRows = {
  args: { rows: 8 },
};

export const CardPlaceholder = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <Skeleton rows={1} className="skeleton--block" />
      <Skeleton rows={1} className="skeleton--block" />
      <Skeleton rows={3} />
    </div>
  ),
};
