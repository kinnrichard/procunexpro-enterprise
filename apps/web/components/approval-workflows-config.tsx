'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Trash2, ArrowUp, ArrowDown, ShieldCheck, Loader2 } from 'lucide-react'

interface Step { name: string; role: string }
interface Workflow { entityType: string; label: string; enforced: boolean; isActive: boolean; steps: { order: number; name: string; role: string }[] }
interface Draft { isActive: boolean; steps: Step[] }

export function ApprovalWorkflowsConfig() {
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['approval-workflows'], queryFn: () => api.get('/approvals/workflows') })
  const { data: rolesData } = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles') })

  const workflows: Workflow[] = data?.data || []
  const roleOptions = (rolesData?.data || []).map((r: any) => ({ value: r.key, label: r.label || r.key }))

  const [draft, setDraft] = useState<Record<string, Draft>>({})
  useEffect(() => {
    if (!workflows.length) return
    const init: Record<string, Draft> = {}
    for (const w of workflows) init[w.entityType] = { isActive: w.isActive, steps: w.steps.map((s) => ({ name: s.name, role: s.role })) }
    setDraft(init)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveMut = useMutation({
    mutationFn: ({ entityType, body }: { entityType: string; body: any }) => api.put(`/approvals/workflows/${entityType}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approval-workflows'] }); toast({ title: 'Approval workflow saved' }) },
    onError: (e: any) => toast({ title: e?.response?.data?.message || 'Failed to save', variant: 'destructive' }),
  })

  const patch = (et: string, fn: (d: Draft) => Draft) => setDraft((prev) => ({ ...prev, [et]: fn(prev[et] || { isActive: true, steps: [] }) }))
  const updateStep = (et: string, i: number, p: Partial<Step>) => patch(et, (d) => ({ ...d, steps: d.steps.map((s, idx) => (idx === i ? { ...s, ...p } : s)) }))
  const addStep = (et: string) => patch(et, (d) => ({ ...d, steps: [...d.steps, { name: '', role: roleOptions[0]?.value || '' }] }))
  const removeStep = (et: string, i: number) => patch(et, (d) => ({ ...d, steps: d.steps.filter((_, idx) => idx !== i) }))
  const moveStep = (et: string, i: number, dir: -1 | 1) => patch(et, (d) => {
    const j = i + dir
    if (j < 0 || j >= d.steps.length) return d
    const steps = [...d.steps]
    ;[steps[i], steps[j]] = [steps[j], steps[i]]
    return { ...d, steps }
  })

  const save = (et: string) => {
    const d = draft[et]
    if (!d) return
    if (d.steps.some((s) => !s.role)) { toast({ title: 'Every stage needs an approver role', variant: 'destructive' }); return }
    saveMut.mutate({ entityType: et, body: { isActive: d.isActive, steps: d.steps.map((s) => ({ name: s.name || undefined, role: s.role })) } })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Approval Workflows</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Define the approval stages for each module. Documents move through the stages in order — a stage is cleared by anyone
          holding that role (admins can approve any stage). A module with <strong>no stages</strong> requires no approval and posts immediately.
        </p>
      </div>

      {workflows.map((w) => {
        const d = draft[w.entityType] || { isActive: true, steps: [] }
        const busy = saveMut.isPending && saveMut.variables?.entityType === w.entityType
        return (
          <Card key={w.entityType}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{w.label}</p>
                    {w.enforced
                      ? <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
                      : <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Config only</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.steps.length === 0 ? 'No approval required' : `${d.steps.length} approval stage${d.steps.length > 1 ? 's' : ''}`}
                    {!w.enforced && ' · enforcement coming soon'}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={d.isActive} onChange={(e) => patch(w.entityType, (x) => ({ ...x, isActive: e.target.checked }))} className="h-4 w-4" />
                  Enabled
                </label>
              </div>

              <div className="space-y-2">
                {d.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                    <Input
                      value={s.name}
                      onChange={(e) => updateStep(w.entityType, i, { name: e.target.value })}
                      placeholder="Stage name (e.g., Manager Approval)"
                      className="h-9 rounded-lg flex-1"
                    />
                    <div className="w-52 shrink-0">
                      <SearchableSelect options={roleOptions} value={s.role} onChange={(v) => updateStep(w.entityType, i, { role: v })} placeholder="Approver role" />
                    </div>
                    <div className="flex items-center">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => moveStep(w.entityType, i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === d.steps.length - 1} onClick={() => moveStep(w.entityType, i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => removeStep(w.entityType, i)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                {d.steps.length === 0 && <p className="text-xs text-muted-foreground italic pl-8">No stages — this module posts without approval.</p>}
              </div>

              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" onClick={() => addStep(w.entityType)}><Plus className="h-4 w-4 mr-1.5" /> Add stage</Button>
                <Button type="button" size="sm" className="bg-gradient-primary text-white" disabled={busy} onClick={() => save(w.entityType)}>
                  {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving…</> : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
