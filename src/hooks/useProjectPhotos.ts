import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ProjectPhoto {
  id: string
  project_id: string
  storage_path: string
  file_name: string
  uploaded_by: string | null
  created_at: string
  url?: string
}

const BUCKET = 'project-photos'

function getPublicUrl(storagePath: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export function useProjectPhotos(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projectPhotos', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_photos')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as ProjectPhoto[]).map((p) => ({
        ...p,
        url: getPublicUrl(p.storage_path),
      }))
    },
    enabled: !!projectId,
  })
}

async function compressImage(file: File, maxWidth = 1600, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

export function useUploadProjectPhoto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }) => {
      const compressed = await compressImage(file)
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const storagePath = `${projectId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, compressed, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: userData } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('project_photos')
        .insert({
          project_id: projectId,
          storage_path: storagePath,
          file_name: file.name,
          uploaded_by: userData.user?.id || null,
        })
        .select()
        .single()

      if (error) throw error
      return data as ProjectPhoto
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectPhotos', data.project_id] })
    },
  })
}

export function useDeleteProjectPhoto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (photo: ProjectPhoto) => {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([photo.storage_path])

      if (storageError) throw storageError

      const { error } = await supabase
        .from('project_photos')
        .delete()
        .eq('id', photo.id)

      if (error) throw error
      return photo
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectPhotos', data.project_id] })
    },
  })
}
