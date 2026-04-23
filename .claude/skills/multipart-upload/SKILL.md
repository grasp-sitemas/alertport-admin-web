---
name: multipart-upload
description: Upload FormData sem quebrar o Content-Type boundary
---

# Multipart upload — padrão AlertPort

## Helper

Use `src/lib/multipart-form-data.ts` para montar o FormData de forma tipada:

```ts
import { toFormData } from '@/lib/multipart-form-data';

const fd = toFormData({
  name: 'Relatório',
  file: fileInstance,        // File ou Blob
  tags: ['A', 'B'],          // viram repeated fields
});
```

## Envio via Axios

```ts
import { apiClient } from '@/lib/api-client';

await apiClient.post('/api/company/equipments/upload/v1/', fd);
// NÃO setar headers.Content-Type — Axios calcula o boundary
```

## Zod

```ts
export const uploadSchema = z.object({
  name: z.string().trim().min(1),
  file: z.instanceof(File).refine((f) => f.size < 10 * 1024 * 1024, 'Máx 10 MB'),
});
```

## Regras

- **Nunca** setar `Content-Type: multipart/form-data` à mão — quebra o boundary.
- **Validar tamanho/tipo no client** antes do POST.
- **Progresso**: usar `onUploadProgress` do axios se precisar barra de progresso.

## Pitfalls

- `JSON.stringify(formData)` → `{}`. Sempre passar o FormData direto.
- Arrays: usar helpers do `toFormData` (FormData nativo não expressa arrays de forma consistente).
