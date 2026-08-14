import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export type LabelCodeType = 'QR' | 'BARCODE'

/** Tenant-wide preference: render item/lot codes as a QR or a 1D barcode. */
export function useLabelCodeType(): LabelCodeType {
  const { data } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => (await api.get('/auth/tenant')).data,
    staleTime: 5 * 60_000,
  })
  return data?.settings?.labelCodeType === 'BARCODE' ? 'BARCODE' : 'QR'
}
