'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusLg, ChevronDown, Search, Funnel } from 'react-bootstrap-icons';

export type DateSort = 'date-newest' | 'date-oldest';
export type PriceSort = 'price-highest' | 'price-lowest';

export interface FilterBarProps {
  filterLabels: string[];
  activeFilter: string;
  onFilterChange: (label: string) => void;
  addFilterOpen: boolean;
  onAddFilterOpenChange: (open: boolean) => void;
  newFilterName: string;
  onNewFilterNameChange: (value: string) => void;
  onAddFilter: () => void;
  dateSort: DateSort | null;
  priceSort: PriceSort | null;
  onDateSortChange: (sort: DateSort | null) => void;
  onPriceSortChange: (sort: PriceSort | null) => void;
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
  dateSort,
  priceSort,
  onDateSortChange,
  onPriceSortChange,
  sortModalOpen,
  onSortModalOpenChange,
  showSearch = false,
  onSearchToggle,
  searchQuery = '',
  onSearchQueryChange,
}: FilterBarProps) {
  return (
    <div className="border-b border-gray-200 pt-3 md:pt-2">

      {/* ── Desktop layout ── */}
      <div className="hidden md:flex items-center gap-2 px-4 pb-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Input
            type="search"
            placeholder="Search an item"
            className="rounded-full border-gray-200 bg-gray-100 text-sm focus-visible:ring-[#3761B0] h-8"
            aria-label="Search items"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
          />
        </div>

        {/* Sort pill button */}
        <button
          type="button"
          onClick={() => onSortModalOpenChange(true)}
          className="shrink-0 h-8 px-4 rounded-full bg-[#3761B0] text-white text-sm font-medium flex items-center gap-1.5 hover:bg-[#2a4d8a] transition-colors"
        >
          <Funnel size={14} />
          Sort
          <ChevronDown size={14} />
        </button>

        {/* Filter pills */}
        <div className="flex items-center gap-2 shrink-0">
          {filterLabels.map((label) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              className={`rounded-full h-8 px-4 ${
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

      {/* ── Mobile layout ── */}
      <div className="flex md:hidden items-center">
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

        {/* Mobile action buttons */}
        <div className="flex items-center gap-1.5 px-3 pb-2 shrink-0">
          <button
            type="button"
            onClick={onSearchToggle}
            className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center transition-colors ${
              showSearch
                ? 'bg-[#3761B0] text-white hover:bg-[#2a4d8a]'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            aria-label="Toggle search"
          >
            <Search size={16} />
          </button>
          <button
            type="button"
            onClick={() => onAddFilterOpenChange(!addFilterOpen)}
            className="h-8 w-8 shrink-0 rounded-full bg-[#3761B0] text-white flex items-center justify-center hover:bg-[#2a4d8a] transition-colors"
            aria-label="Add filter"
          >
             <Funnel size={14} />
          </button>
          <button
            type="button"
            onClick={() => onSortModalOpenChange(true)}
            className="h-8 w-8 shrink-0 rounded-full bg-[#3761B0] text-white flex items-center justify-center hover:bg-[#2a4d8a] transition-colors"
            aria-label="Sort"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Mobile: Add filter input */}
      {addFilterOpen && (
        <div className="md:hidden px-4 pb-2 flex gap-2 items-center">
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

      {/* Mobile: Search bar — toggled */}
      {showSearch && (
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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
            <h2 id="sort-modal-title" className="text-lg font-bold text-gray-900 mb-5">
              Sort by
            </h2>

            {/* Date section */}
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Date</p>
            <div className="flex gap-2 mb-5">
              {([null, 'date-newest', 'date-oldest'] as const).map((opt) => (
                <button
                  key={opt ?? 'none-date'}
                  type="button"
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    dateSort === opt
                      ? 'bg-[#3761B0] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => onDateSortChange(dateSort === opt ? null : opt)}
                >
                  {opt === null ? 'None' : opt === 'date-newest' ? 'Newest' : 'Oldest'}
                </button>
              ))}
            </div>

            {/* Price section */}
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Price</p>
            <div className="flex gap-2">
              {([null, 'price-lowest', 'price-highest'] as const).map((opt) => (
                <button
                  key={opt ?? 'none-price'}
                  type="button"
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    priceSort === opt
                      ? 'bg-[#3761B0] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => onPriceSortChange(priceSort === opt ? null : opt)}
                >
                  {opt === null ? 'None' : opt === 'price-lowest' ? 'Lowest' : 'Highest'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
