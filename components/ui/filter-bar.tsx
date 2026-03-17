'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ChevronDown, Search } from 'lucide-react';

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
  onSearchToggle?: () => void;
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
  onSearchToggle,
  searchQuery = '',
  onSearchQueryChange,
}: FilterBarProps) {
  return (
    <div className="border-b border-gray-200 pt-3 md:pt-4">
      {/* Pills row + action buttons inline */}
      <div className="flex items-center">
        {/* Scrollable filter pills with right fade */}
        <div className="relative flex-1 min-w-0 overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide scroll-smooth [-webkit-overflow-scrolling:touch] pl-4 pb-2">
            <div className="flex gap-2 items-center w-max">
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
            </div>
          </div>
          {/* Fade overlay */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-r from-transparent to-white pointer-events-none" />
        </div>

        {/* Action buttons — always in-line with pills */}
        <div className="flex items-center gap-1.5 px-3 pb-2 shrink-0">
          <button
            type="button"
            onClick={onSearchToggle}
            className={`hidden md:flex h-8 w-8 shrink-0 rounded-full items-center justify-center transition-colors ${
              showSearch
                ? 'bg-[#3761B0] text-white hover:bg-[#2a4d8a]'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            aria-label="Toggle search"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onAddFilterOpenChange(!addFilterOpen)}
            className="h-8 w-8 shrink-0 rounded-full bg-[#3761B0] text-white flex items-center justify-center hover:bg-[#2a4d8a] transition-colors"
            aria-label="Add filter"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onSortModalOpenChange(true)}
            className="h-8 w-8 shrink-0 rounded-full bg-[#3761B0] text-white flex items-center justify-center hover:bg-[#2a4d8a] transition-colors"
            aria-label="Sort"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Add filter input */}
      {addFilterOpen && (
        <div className="px-4 pb-2 flex gap-2 items-center">
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

      {/* Search bar — toggled */}
      {showSearch && (
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              type="search"
              placeholder="Search items..."
              className="pl-9 rounded-full border-gray-200 bg-gray-50 text-sm focus-visible:ring-[#3761B0]"
              aria-label="Search items"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Sort modal */}
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
