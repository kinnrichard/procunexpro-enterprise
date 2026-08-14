'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

const WEBSITE_REGEX = /^https?:\/\/.+/i

const vendorSchema = z.object({
  name: z.string().min(2, 'Vendor name is required'),
  code: z.string().optional().or(z.literal('')),
  contactPerson: z.string().min(1, 'Contact person is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  province: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  website: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || WEBSITE_REGEX.test(v), 'Enter a valid URL starting with http:// or https://'),
  taxId: z.string().optional().or(z.literal('')),
  paymentTerms: z.string().optional().or(z.literal('')),
  bankName: z.string().optional().or(z.literal('')),
  bankAccount: z.string().optional().or(z.literal('')),
  bankRouting: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type VendorFormData = z.infer<typeof vendorSchema>

const EMPTY: VendorFormData = {
  name: '', code: '', contactPerson: '', email: '', phone: '',
  address: '', city: '', province: '', country: '', website: '', taxId: '',
  paymentTerms: '', bankName: '', bankAccount: '', bankRouting: '', notes: '',
}

interface VendorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendor?: Record<string, any> | null
  onSaved?: (vendor: any) => void
}

export function VendorFormDialog({ open, onOpenChange, vendor, onSaved }: Readonly<VendorFormDialogProps>) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const editing = !!vendor

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: EMPTY,
    mode: 'onChange',
  })

  // Load the vendor (or a blank form) whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    if (vendor) {
      reset({
        name: vendor.name ?? '',
        code: vendor.code ?? '',
        contactPerson: vendor.contactPerson ?? '',
        email: vendor.email ?? '',
        phone: vendor.phone ?? '',
        address: vendor.address ?? '',
        city: vendor.city ?? '',
        province: vendor.province ?? '',
        country: vendor.country ?? '',
        website: vendor.website ?? '',
        taxId: vendor.taxId ?? '',
        paymentTerms: vendor.paymentTerms ?? '',
        bankName: vendor.bankName ?? '',
        bankAccount: vendor.bankAccount ?? '',
        bankRouting: vendor.bankRouting ?? '',
        notes: vendor.notes ?? '',
      })
    } else {
      reset(EMPTY)
    }
  }, [open, vendor, reset])

  // --- Location cascade (country → province → city) + payment terms ---

  const watchedCountry = watch('country')
  const watchedProvince = watch('province')
  const watchedCity = watch('city')
  const watchedPaymentTerms = watch('paymentTerms')

  const { data: countriesData } = useQuery({
    queryKey: ['locations-countries'],
    queryFn: async () => (await api.get('/locations/countries')).data.data as { name: string; code: string }[],
    staleTime: Infinity,
  })
  const countries = countriesData ?? []
  const countryCode = countries.find((c) => c.name === watchedCountry)?.code

  const { data: provincesData } = useQuery({
    queryKey: ['locations-provinces', countryCode],
    queryFn: async () => (await api.get(`/locations/provinces?countryCode=${countryCode}`)).data.data as { name: string; code: string }[],
    enabled: !!countryCode,
    staleTime: Infinity,
  })
  const provinces = provincesData ?? []
  const provinceCode = provinces.find((p) => p.name === watchedProvince)?.code

  const { data: citiesData } = useQuery({
    queryKey: ['locations-cities', countryCode, provinceCode],
    queryFn: async () => (await api.get(`/locations/cities?countryCode=${countryCode}&provinceCode=${provinceCode}`)).data.data as { name: string; code: string }[],
    enabled: !!countryCode && !!provinceCode,
    staleTime: Infinity,
  })
  const cities = citiesData ?? []

  const { data: paymentTermsData } = useQuery({
    queryKey: ['purchase-terms-active'],
    queryFn: async () => (await api.get('/purchase-terms/active')).data.data as { name: string }[],
    staleTime: 60_000,
  })

  const countryOptions = countries.map((c) => ({ value: c.name, label: c.name }))
  const provinceOptions = provinces.map((p) => ({ value: p.name, label: p.name }))
  const cityOptions = cities.map((c) => ({ value: c.name, label: c.name }))
  const paymentTermsOptions = (paymentTermsData ?? []).map((t) => ({ value: t.name, label: t.name }))

  function handleCountryChange(v: string) {
    setValue('country', v, { shouldValidate: true, shouldDirty: true })
    setValue('province', '', { shouldDirty: true })
    setValue('city', '', { shouldDirty: true })
  }
  function handleProvinceChange(v: string) {
    setValue('province', v, { shouldDirty: true })
    setValue('city', '', { shouldDirty: true })
  }

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: (data: VendorFormData) => api.post('/vendors', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      onOpenChange(false)
      onSaved?.(res.data)
      toast({ title: 'Vendor created', description: 'The vendor has been added successfully.' })
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create vendor. Please try again.', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: (data: VendorFormData) => api.put(`/vendors/${vendor!.id}`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      queryClient.invalidateQueries({ queryKey: ['vendor', vendor!.id] })
      onOpenChange(false)
      onSaved?.(res.data)
      toast({ title: 'Vendor updated', description: 'Changes have been saved.' })
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update vendor. Please try again.', variant: 'destructive' }),
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function onSubmit(data: VendorFormData) {
    if (editing) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <div className="px-6 pt-5 pb-4 bg-muted/50 border-b rounded-t-2xl">
          <DialogTitle>{editing ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {editing ? 'Update the vendor information below.' : 'Fill in the details to create a new vendor.'}
          </DialogDescription>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="vendor-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Row: Name, Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Name <span className="text-red-500">*</span></Label>
                <Input
                  {...register('name')}
                  placeholder="e.g., ABC Supplies Inc."
                  className={cn('h-9 rounded-lg', errors.name && 'border-red-300 focus-visible:ring-red-200')}
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Code</Label>
                <Input
                  {...register('code')}
                  disabled
                  placeholder="Auto-generated on save"
                  className="h-9 rounded-lg bg-muted/50 text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  {editing ? 'System code (cannot be changed).' : 'Assigned automatically when you save.'}
                </p>
              </div>
            </div>

            {/* Row: Contact Person, Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Contact Person <span className="text-red-500">*</span></Label>
                <Input
                  {...register('contactPerson')}
                  placeholder="Full name"
                  className={cn('h-9 rounded-lg', errors.contactPerson && 'border-red-300 focus-visible:ring-red-200')}
                />
                {errors.contactPerson && <p className="text-xs text-red-500">{errors.contactPerson.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Email</Label>
                <Input
                  {...register('email')}
                  placeholder="vendor@email.com"
                  className={cn('h-9 rounded-lg', errors.email && 'border-red-300 focus-visible:ring-red-200')}
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
            </div>

            {/* Row: Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Phone <span className="text-red-500">*</span></Label>
                <Input
                  {...register('phone')}
                  placeholder="+63 900 000 0000"
                  className={cn('h-9 rounded-lg', errors.phone && 'border-red-300 focus-visible:ring-red-200')}
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Address</p>
            </div>

            {/* Row: Address */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Address</Label>
              <Input {...register('address')} placeholder="Street address" className="h-9 rounded-lg" />
            </div>

            {/* Row: Country, Province */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Country</Label>
                <SearchableSelect
                  options={countryOptions}
                  value={watchedCountry}
                  onChange={handleCountryChange}
                  placeholder="Select country"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Province / State</Label>
                <SearchableSelect
                  options={provinceOptions}
                  value={watchedProvince}
                  onChange={handleProvinceChange}
                  placeholder={watchedCountry ? 'Select province' : 'Select a country first'}
                  disabled={!countryCode}
                />
              </div>
            </div>

            {/* Row: City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">City</Label>
                <SearchableSelect
                  options={cityOptions}
                  value={watchedCity}
                  onChange={(v) => setValue('city', v, { shouldDirty: true })}
                  placeholder={watchedProvince ? 'Select city' : 'Select a province first'}
                  disabled={!provinceCode}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Business Details</p>
            </div>

            {/* Row: Website, Tax ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Website</Label>
                <Input
                  {...register('website')}
                  placeholder="https://example.com"
                  className={cn('h-9 rounded-lg', errors.website && 'border-red-300 focus-visible:ring-red-200')}
                />
                {errors.website && <p className="text-xs text-red-500">{errors.website.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Tax ID</Label>
                <Input {...register('taxId')} placeholder="Tax identification number" className="h-9 rounded-lg" />
              </div>
            </div>

            {/* Row: Payment Terms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Payment Terms</Label>
                <SearchableSelect
                  options={paymentTermsOptions}
                  value={watchedPaymentTerms}
                  onChange={(v) => setValue('paymentTerms', v, { shouldDirty: true })}
                  placeholder={paymentTermsOptions.length ? 'Select payment terms' : 'Configure in Settings › Payment Terms'}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Banking Information</p>
            </div>

            {/* Row: Bank Name, Bank Account */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Bank Name</Label>
                <Input {...register('bankName')} placeholder="Bank name" className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Bank Account</Label>
                <Input {...register('bankAccount')} placeholder="Account number" className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Bank Routing</Label>
                <Input {...register('bankRouting')} placeholder="Routing number" className="h-9 rounded-lg" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-[13px]">Notes</Label>
              <Textarea {...register('notes')} placeholder="Additional notes about this vendor..." className="rounded-lg min-h-[80px]" />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="vendor-form" disabled={!isValid || isSubmitting} className="bg-gradient-primary text-white">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? 'Save Changes' : 'Create Vendor'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
