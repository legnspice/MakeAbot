'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ChevronDown } from 'lucide-react';

export type SortOption = 'date' | 'price';

export interface FilterBarProps {
  filterLabels: string[];
  activeFilter: string;
  onFilterChange: (label: string) => void;
  addFilterOpen: boolean;
  onAddFilterOpenChange: (open: boolean) => void;
  newFilterName: string;
  onNewFilterNameChange: (value: string) => void;
  onAddFilter: () => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  sortModalOpen: boolean;
  onSortModalOpenChange: (open: boolean) => void;
  showSearch?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
}

export default function FilterBar({
  filterLabels,
  activeFilter,
  onFilterChange,
  addFilterOpen,
  onAddFilterOpenChange,
  newFilterName,
  onNewFilterNameChange,
  onAddFilter,
  sortBy,
  onSortChange,
  sortModalOpen,
  onSortModalOpenChange,
  showSearch = false,
  searchQuery = '',
  onSearchQueryChange,
}: FilterBarProps) {
  return (
    <div className="px-4 pb-2 border-b border-gray-200 overflow-x-auto">
      <div className="flex gap-2 items-center min-w-0">
        {filterLabels.map((label) => (
          <Button
            key={label}
            variant="outline"
            size="sm"
            className={`rounded-full shrink-0 ${
              activeFilter === label
                ? 'bg-[#3761B0] text-white border-[#3761B0] hover:bg-[#3761B0] hover:text-white'
                : 'bg-white text-black font-bold border-[#3761B0] border-2 hover:bg-blue-100 hover:text-[#3761B0]'
            }`}
            onClick={() => onFilterChange(label)}
          >
            {label}
          </Button>
        ))}
        <button
          type="button"
          onClick={() => onAddFilterOpenChange(!addFilterOpen)}
          className="w-9 h-9 shrink-0 rounded-full bg-[#3761B0] text-white flex items-center justify-center hover:bg-[#2a4d8a] transition-colors"
          aria-label="Add filter"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onSortModalOpenChange(true)}
          className="flex items-center gap-1.5 shrink-0 rounded-full bg-[#3761B0] text-white font-bold px-4 py-2 text-sm hover:bg-[#2a4d8a] transition-colors"
          aria-label="Sort"
        >
          <span className="w-2 h-2 rounded-full bg-white/60" aria-hidden />
          Sort
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
      {addFilterOpen && (
        <div className="mt-2 flex gap-2 items-center">
          <Input
            value={newFilterName}
            onChange={(e) => onNewFilterNameChange(e.target.value)}
            placeholder="Filter name (e.g. Books)"
            className="flex-1 rounded-full border-[#3761B0] bg-gray-50 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && onAddFilter()}
          />
          <Button
            type="button"
            size="sm"
            onClick={onAddFilter}
            className="rounded-full bg-[#3761B0] hover:bg-[#2a4d8a] text-white shrink-0"
          >
            Add
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onAddFilterOpenChange(false);
              onNewFilterNameChange('');
            }}
            className="rounded-full shrink-0"
          >
            Cancel
          </Button>
        </div>
      )}
      {showSearch && (
        <div className="mt-3">
          <Input
            type="search"
            placeholder="Search items..."
            className="rounded-full border-gray-200 bg-gray-50 text-sm"
            aria-label="Search items"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
          />
        </div>
      )}
      {sortModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => onSortModalOpenChange(false)}
          aria-hidden
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sort-modal-title"
          >
            <h2 id="sort-modal-title" className="text-lg font-bold text-gray-900 mb-4">
              Sort by
            </h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className={`w-full rounded-xl px-4 py-3 text-left font-medium ${
                  sortBy === 'date'
                    ? 'bg-[#3761B0] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => {
                  onSortChange('date');
                  onSortModalOpenChange(false);
                }}
              >
                Date
              </button>
              <button
                type="button"
                className={`w-full rounded-xl px-4 py-3 text-left font-medium ${
                  sortBy === 'price'
                    ? 'bg-[#3761B0] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => {
                  onSortChange('price');
                  onSortModalOpenChange(false);
                }}
              >
                Price
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
