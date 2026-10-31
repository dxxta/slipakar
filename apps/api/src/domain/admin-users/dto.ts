import { z } from 'zod';

export const listAdminUsersSortByEnum = z.enum(['name', 'email', 'createdAt', 'role', 'status']);
export type ListAdminUsersSortBy = z.infer<typeof listAdminUsersSortByEnum>;

export const listAdminUsersQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  sortBy: listAdminUsersSortByEnum.default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQueryDto>;

const OWN_AVATAR_PATH_REGEX = /^\/me\/avatar\/[A-Za-z0-9_-]{1,128}\?v=[0-9a-fA-F]{1,64}$/;

function isValidAdminUserImage(value: string): boolean {
  if (OWN_AVATAR_PATH_REGEX.test(value)) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.length > 0 &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

export const adminUserImageSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(isValidAdminUserImage, {
    message: 'Image must be an absolute https URL or /me/avatar/<id>?v=<hex>',
  });

export const updateAdminUserDto = z.strictObject({
  name: z.string().trim().min(1).max(100).optional(),
  image: adminUserImageSchema.nullable().optional(),
}).refine((data) => data.name !== undefined || data.image !== undefined, {
  message: 'At least one of name or image must be provided',
});
export type UpdateAdminUserPayload = z.infer<typeof updateAdminUserDto>;

export const disableUserDto = z.strictObject({
  reason: z.string().trim().max(500).optional(),
});
export type DisableUserPayload = z.infer<typeof disableUserDto>;

export const adminUserViewSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  image: z.string().nullable(),
  role: z.string(),
  emailVerified: z.boolean(),
  createdAt: z.string().datetime(),
  disabledAt: z.string().datetime().nullable(),
  projectCount: z.number().int().nonnegative(),
});
export type AdminUserView = z.infer<typeof adminUserViewSchema>;
