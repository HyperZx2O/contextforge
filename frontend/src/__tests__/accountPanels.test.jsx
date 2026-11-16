import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import useAuthStore from '../store/authStore.js';
import useGraphStore from '../store/graphStore.js';
import TemplatePanel from '../components/TemplatePanel.jsx';
import PreferencesPanel from '../components/PreferencesPanel.jsx';

vi.mock('../api/client.js', () => ({
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}));

const runPipeline = vi.fn();
vi.mock('../hooks/usePipeline.js', () => ({
  usePipeline: () => ({ runPipeline, loadDemo: vi.fn(), getDemoTopics: vi.fn() }),
}));

const client = await import('../api/client.js');

const loggedOut = { user: null, accessToken: null, isAuthenticated: false };
const loggedIn = {
  user: { id: 'u1', email: 'a@b.c', display_name: 'Ada' },
  accessToken: 'tok',
  isAuthenticated: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState(loggedOut);
  useGraphStore.setState({
    viewMode: 'graph',
    activeFilters: [],
    jobStatus: null,
  });
});

describe('TemplatePanel', () => {
  it('prompts anonymous users to log in', () => {
    render(<TemplatePanel />);
    expect(screen.getByText(/log in to save/i)).toBeInTheDocument();
    expect(screen.queryByTestId('template-save')).not.toBeInTheDocument();
  });

  it('lists saved templates after refresh and runs one', async () => {
    useAuthStore.setState(loggedIn);
    client.listTemplates.mockResolvedValue({
      templates: [{ id: 't1', label: 'Contras', query: 'papers contradicting X', year_from: 2020, year_to: 2024 }],
    });

    render(<TemplatePanel />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    expect(await screen.findByText('Contras')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }));
    expect(runPipeline).toHaveBeenCalledWith('papers contradicting X');
  });

  it('renders the empty state', async () => {
    useAuthStore.setState(loggedIn);
    client.listTemplates.mockResolvedValue({ templates: [] });

    render(<TemplatePanel />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    expect(await screen.findByTestId('templates-empty')).toBeInTheDocument();
  });

  it('saves a template from the form', async () => {
    useAuthStore.setState(loggedIn);
    client.createTemplate.mockResolvedValue({ id: 't2', label: 'My run', query: 'diffusion' });
    client.listTemplates.mockResolvedValue({ templates: [] });

    render(<TemplatePanel />);
    fireEvent.change(screen.getByLabelText(/template label/i), { target: { value: 'My run' } });
    fireEvent.change(screen.getByLabelText(/template query/i), { target: { value: 'diffusion' } });
    fireEvent.click(screen.getByTestId('template-save'));

    await waitFor(() =>
      expect(client.createTemplate).toHaveBeenCalledWith({
        query: 'diffusion',
        label: 'My run',
      }),
    );
  });
});

describe('PreferencesPanel', () => {
  it('prompts anonymous users to log in', () => {
    render(<PreferencesPanel />);
    expect(screen.getByText(/log in to save and restore/i)).toBeInTheDocument();
  });

  it('saves the current view state', async () => {
    useAuthStore.setState(loggedIn);
    useGraphStore.setState({ viewMode: 'timeline', activeFilters: ['CHALLENGES'] });
    client.updatePreferences.mockResolvedValue({
      view_mode: 'timeline',
      active_filters: ['CHALLENGES'],
      theme: 'dark',
    });

    render(<PreferencesPanel />);
    fireEvent.click(screen.getByTestId('preferences-save'));

    await waitFor(() =>
      expect(client.updatePreferences).toHaveBeenCalledWith({
        viewMode: 'timeline',
        activeFilters: ['CHALLENGES'],
      }),
    );
    expect(await screen.findByText('View saved.')).toBeInTheDocument();
  });

  it('applies the saved view back into the store', async () => {
    useAuthStore.setState(loggedIn);
    client.getPreferences.mockResolvedValue({
      view_mode: 'timeline',
      active_filters: ['CITES'],
      theme: 'dark',
    });

    render(<PreferencesPanel />);
    fireEvent.click(screen.getByTestId('preferences-restore'));

    await waitFor(() => {
      expect(useGraphStore.getState().viewMode).toBe('timeline');
      expect(useGraphStore.getState().activeFilters).toEqual(['CITES']);
    });
    expect(await screen.findByText('Saved view applied.')).toBeInTheDocument();
  });
});