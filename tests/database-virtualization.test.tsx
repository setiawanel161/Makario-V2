import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { PropertyType } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableView } from '@/components/database/table-view';
import type { DatabasePropertyData, DatabaseRowData } from '@/components/database/database-types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TableView virtualization', () => {
  it('renders only the visible window for databases with thousands of rows', async () => {
    const properties: DatabasePropertyData[] = [
      {
        id: 'title',
        name: 'Title',
        type: PropertyType.TEXT,
        config: { kind: 'none' },
        orderIndex: 'a0',
        revision: '1',
      },
    ];
    const rows: DatabaseRowData[] = Array.from({ length: 5000 }, (_, index) => ({
      id: `row-${index}`,
      title: `Row ${index}`,
      icon: null,
      orderIndex: `a${index}`,
      revision: '1',
      properties: {},
      propertyValueIds: {},
    }));

    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1024);
    render(
      <TableView
        onCellChange={vi.fn()}
        onEditProperty={vi.fn()}
        onTitleChange={vi.fn()}
        properties={properties}
        rows={rows}
      />,
    );

    await waitFor(() => expect(screen.getByDisplayValue('Row 0')).toBeTruthy());
    expect(screen.getAllByRole('row').length).toBeLessThan(100);
  });

  it('renders all rows when the database has 100 rows', () => {
    const properties: DatabasePropertyData[] = [];
    const rows: DatabaseRowData[] = Array.from({ length: 100 }, (_, index) => ({
      id: `row-${index}`,
      title: `Row ${index}`,
      icon: null,
      orderIndex: `a${index}`,
      revision: '1',
      properties: {},
      propertyValueIds: {},
    }));

    render(
      <TableView
        onCellChange={vi.fn()}
        onEditProperty={vi.fn()}
        onTitleChange={vi.fn()}
        properties={properties}
        rows={rows}
      />,
    );

    expect(screen.getByDisplayValue('Row 0')).toBeTruthy();
    expect(screen.getByDisplayValue('Row 99')).toBeTruthy();
  });
});
