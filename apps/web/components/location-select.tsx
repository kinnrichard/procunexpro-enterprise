'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { SearchableSelect } from '@/components/ui/searchable-select'

interface LocationSelectProps {
  warehouseId?: string
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Cascading bin/shelf picker — lists the locations of the selected warehouse
 * (grouped by area). Disabled until a warehouse is chosen.
 */
export function LocationSelect({ warehouseId, value, onChange, placeholder, disabled, className }: Readonly<LocationSelectProps>) {
  const { data } = useQuery({
    queryKey: ['warehouse-locations', warehouseId],
    queryFn: async () => (await api.get(`/warehouses/${warehouseId}/locations`)).data,
    enabled: !!warehouseId,
    staleTime: 60_000,
  })

  const rows: any[] = Array.isArray(data) ? data : (data?.data ?? [])
  const options = rows.map((l) => ({
    value: l.id,
    label: l.area?.name ? `${l.area.name} · ${l.name}` : l.name,
  }))

  const resolvedPlaceholder = (() => {
    if (!warehouseId) return 'Select a warehouse first'
    if (options.length === 0) return 'No locations configured'
    return placeholder || 'Select location'
  })()

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder={resolvedPlaceholder}
      disabled={disabled || !warehouseId}
      className={className}
    />
  )
}
