'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QrCode, Barcode, Check } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'QR', label: 'QR Code', desc: 'Square 2D code — best for phones', icon: QrCode },
  { value: 'BARCODE', label: 'Barcode', desc: '1D Code-128 — best for laser scanners', icon: Barcode },
] as const

export function ItemLabelSettings() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: tenant } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => (await api.get('/auth/tenant')).data,
  })
  const current: string = tenant?.settings?.labelCodeType === 'BARCODE' ? 'BARCODE' : 'QR'

  const mutation = useMutation({
    mutationFn: (value: string) =>
      api.put('/auth/tenant', { settings: { ...(tenant?.settings || {}), labelCodeType: value } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] })
      toast({ title: 'Label code type updated' })
    },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><QrCode className="h-5 w-5 text-primary" /></div>
          <div>
            <CardTitle className="text-lg">Item Labels</CardTitle>
            <CardDescription>Choose how item &amp; lot codes are generated. The code encodes the record&apos;s unique ID.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = current === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => !active && mutation.mutate(opt.value)}
                disabled={mutation.isPending}
                className={cn(
                  'relative flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                  active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                )}
              >
                <Icon className={cn('h-6 w-6 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
                {active && <Check className="h-4 w-4 text-primary absolute top-3 right-3" />}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
