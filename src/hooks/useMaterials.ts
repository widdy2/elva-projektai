import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useOrganization } from './useOrganization'

export interface ProjectMaterial {
  id: string
  project_id: string
  warehouse_item_id: string | null
  name: string
  unit: string
  planned_quantity: number
  purchased_quantity: number
  used_quantity: number
  unit_price: number
  sale_price: number | null
  stock_deducted: boolean
  created_at: string
  updated_at: string
}

export interface WarehouseItem {
  id: string
  organization_id: string
  name: string
  unit: string
  quantity: number
  unit_price: number
  note: string | null
  created_at: string
  updated_at: string
}

// --- Project materials ---

export function useProjectMaterials(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projectMaterials', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_materials')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as ProjectMaterial[]
    },
    enabled: !!projectId,
  })
}

export function useCreateProjectMaterial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (material: Omit<ProjectMaterial, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('project_materials')
        .insert(material)
        .select()
        .single()

      if (error) throw error
      return data as ProjectMaterial
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectMaterials', data.project_id] })
    },
  })
}

export function useUpdateProjectMaterial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...material }: Partial<ProjectMaterial> & { id: string }) => {
      const { data, error } = await supabase
        .from('project_materials')
        .update(material)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as ProjectMaterial
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectMaterials', data.project_id] })
    },
  })
}

export function useDeleteProjectMaterial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from('project_materials')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { projectId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectMaterials', data.projectId] })
    },
  })
}

// --- Warehouse items ---

export function useWarehouseItems() {
  const { data: organizationId } = useOrganization()

  return useQuery({
    queryKey: ['warehouseItems', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })

      if (error) throw error
      return data as WarehouseItem[]
    },
    enabled: !!organizationId,
  })
}

export function useCreateWarehouseItem() {
  const queryClient = useQueryClient()
  const { data: organizationId } = useOrganization()

  return useMutation({
    mutationFn: async (item: Omit<WarehouseItem, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('warehouse_items')
        .insert({ ...item, organization_id: organizationId })
        .select()
        .single()

      if (error) throw error
      return data as WarehouseItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouseItems'] })
    },
  })
}

export function useUpdateWarehouseItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...item }: Partial<WarehouseItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('warehouse_items')
        .update(item)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as WarehouseItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouseItems'] })
    },
  })
}

export function useDeleteWarehouseItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('warehouse_items')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouseItems'] })
    },
  })
}
