import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, Filter } from 'lucide-react';
import { TicketPriority, TicketStatus, TicketListQuery } from '@/lib/types';
import { STATUS_LABEL, PRIORITY_LABEL } from '@/lib/labels';
import { useState } from 'react';

interface TicketFiltersProps {
  query: TicketListQuery;
  onUpdate: (patch: Partial<TicketListQuery>) => void;
  isLoading?: boolean;
}

export function TicketFilters({ query, onUpdate }: TicketFiltersProps) {
  const [searchTerm, setSearchTerm] = useState(query.search || '');

  const clearFilters = () => {
    setSearchTerm('');
    onUpdate({
      search: undefined,
      status: undefined,
      priority: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const hasActiveFilters = 
    Boolean(query.search) || Boolean(query.status) || Boolean(query.priority) || Boolean(query.dateFrom) || Boolean(query.dateTo);

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari kode atau judul..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onUpdate({ search: searchTerm });
            }}
          />
        </div>

        {/* Status Filter */}
        <Select
          value={query.status || ''}
          onChange={(e) => onUpdate({ status: (e.target.value || undefined) as TicketStatus | undefined })}
          aria-label="Filter status"
          className="w-40"
        >
          <option value="">Semua status</option>
          {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </Select>

        {/* Priority Filter */}
        <Select
          value={query.priority || ''}
          onChange={(e) => onUpdate({ priority: (e.target.value || undefined) as TicketPriority | undefined })}
          aria-label="Filter prioritas"
          className="w-40"
        >
          <option value="">Semua prioritas</option>
          {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((value) => (
            <option key={value} value={value}>
              {PRIORITY_LABEL[value]}
            </option>
          ))}
        </Select>

        {/* Date Filters */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-[150px]"
            value={query.dateFrom || ''}
            onChange={(e) => onUpdate({ dateFrom: e.target.value || undefined })}
          />
          <span className="text-muted-foreground text-xs">-</span>
          <Input
            type="date"
            className="w-[150px]"
            value={query.dateTo || ''}
            onChange={(e) => onUpdate({ dateTo: e.target.value || undefined })}
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
            <X className="mr-2 h-4 w-4" />
            Hapus Filter
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Filter className="h-3 w-3" />
        <span>Tekan Enter pada kotak pencarian untuk mulai mencari. Tanggal mencakup rentang hari yang dipilih.</span>
      </div>
    </div>
  );
}
