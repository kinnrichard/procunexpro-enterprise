'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { SearchableSelect } from '@/components/ui/searchable-select'

interface AreaSelectProps {
  warehouseId?: string
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Cascading zone/area picker — lists the areas of the selected warehouse.
 * Optional: leaving it blank means "no specific area". Disabled until a
 * warehouse is chosen.
 */
export function AreaSelect({ warehouseId, value, onChange, placeholder, disabled, className }: Readonly<AreaSelectProps>) {
  const { data } = useQuery({
    queryKey: ['warehouse-areas', warehouseId],
    queryFn: async () => (await api.get(`/warehouses/${warehouseId}/areas`)).data,
    enabled: !!warehouseId,
    staleTime: 60_000,
  })

  const rows: any[] = Array.isArray(data) ? data : (data?.data ?? [])
  const options = rows.map((a) => ({ value: a.id, label: a.name }))

  const resolvedPlaceholder = (() => {
    if (!warehouseId) return 'Select a warehouse first'
    if (options.length === 0) return 'No areas configured'
    return placeholder || 'Any area'
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
