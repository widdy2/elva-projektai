import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useOrganization } from './useOrganization'

export interface Organization {
  id: string
  name: string
  code: string | null
  vat_code: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  brand_color: string | null
  bank_name: string | null
  bank_account: string | null
}

const LOGO_BUCKET = 'org-logos'

export function useOrganizationDetails() {
  const { data: organizationId } = useOrganization()

  return useQuery({
    queryKey: ['organizationDetails', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single()

      if (error) throw error
      return data as Organization
    },
    enabled: !!organizationId,
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()
  const { data: organizationId } = useOrganization()

  return useMutation({
    mutationFn: async (org: Partial<Omit<Organization, 'id'>>) => {
      const { data, error } = await supabase
        .from('organizations')
        .update(org)
        .eq('id', organizationId)
        .select()
        .single()

      if (error) throw error
      return data as Organization
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizationDetails'] })
    },
  })
}

export function useUploadOrgLogo() {
  const queryClient = useQueryClient()
  const { data: organizationId } = useOrganization()

  return useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop() || 'png'
      const storagePath = `${organizationId}/logo-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from(LOGO_BUCKET)
        .getPublicUrl(storagePath)

      const { data, error } = await supabase
        .from('organizations')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', organizationId)
        .select()
        .single()

      if (error) throw error
      return data as Organization
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizationDetails'] })
    },
  })
}
