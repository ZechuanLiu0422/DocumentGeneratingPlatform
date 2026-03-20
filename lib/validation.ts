import { z } from 'zod';

export const docTypeSchema = z.enum(['notice', 'letter', 'request', 'report']);
export const providerSchema = z.enum(['claude', 'openai', 'doubao', 'glm']);
export const phraseTypeSchema = z.enum(['recipient', 'issuer']);

const limitedString = (label: string, max: number) =>
  z.string().trim().min(1, `${label}不能为空`).max(max, `${label}不能超过 ${max} 个字符`);

export const loginSchema = z.object({
  email: z.string().trim().email('请输入有效邮箱'),
  password: z.string().min(8, '密码至少需要 8 位'),
});

export const profileSchema = z.object({
  displayName: z.string().trim().max(80, '显示名称不能超过 80 个字符'),
});

export const changePasswordSchema = z
  .object({
    password: z.string().min(12, '新密码至少需要 12 位'),
    confirmPassword: z.string().min(12, '确认密码至少需要 12 位'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

export const contactSchema = z.object({
  name: limitedString('联系人', 80),
  phone: limitedString('电话', 40),
});

export const phraseSchema = z.object({
  type: phraseTypeSchema,
  phrase: limitedString('常用信息', 120),
});

export const draftSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  docType: docTypeSchema,
  title: z.string().trim().max(200, '标题不能超过 200 个字符').optional().default(''),
  recipient: z.string().trim().max(200, '主送机关不能超过 200 个字符').optional().default(''),
  content: z.string().trim().max(12000, '内容不能超过 12000 个字符').optional().default(''),
  issuer: z.string().trim().max(200, '发文机关不能超过 200 个字符').optional().default(''),
  date: z.string().trim().max(20, '日期格式不正确').optional().default(''),
  provider: providerSchema,
  contactName: z.string().trim().max(80, '联系人不能超过 80 个字符').optional().default(''),
  contactPhone: z.string().trim().max(40, '电话不能超过 40 个字符').optional().default(''),
  attachments: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
});

export const polishSchema = z.object({
  docType: docTypeSchema,
  title: z.string().trim().max(200).optional().default(''),
  recipient: limitedString('主送机关', 200),
  content: limitedString('内容', 12000),
  provider: providerSchema,
  attachments: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  referenceAnalysis: z
    .object({
      tone: z.string().trim().max(400),
      structure: z.string().trim().max(400),
      vocabulary: z.string().trim().max(400),
      sentenceStyle: z.string().trim().max(400),
      logicFlow: z.string().trim().max(400),
    })
    .optional()
    .nullable(),
  imitationStrength: z.enum(['strict', 'moderate', 'loose']).optional().default('moderate'),
});

export const refineSchema = z.object({
  docType: docTypeSchema,
  recipient: limitedString('主送机关', 200),
  originalContent: limitedString('原始内容', 12000),
  userFeedback: limitedString('修改意见', 2000),
  provider: providerSchema,
});

export const analyzeReferenceSchema = z.object({
  docType: docTypeSchema,
  fileContent: limitedString('参考内容', 30000),
  provider: providerSchema,
});

export const generateSchema = z.object({
  docType: docTypeSchema,
  title: limitedString('标题', 200),
  recipient: limitedString('主送机关', 200),
  content: limitedString('原始内容', 12000),
  issuer: limitedString('发文机关', 200),
  date: limitedString('成文日期', 20),
  generatedContent: limitedString('生成内容', 20000),
  provider: providerSchema,
  attachments: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  contactName: z.string().trim().max(80).optional().default(''),
  contactPhone: z.string().trim().max(40).optional().default(''),
});

export const deleteIdSchema = z.object({
  id: z.string().uuid('参数 id 不正确'),
});

export const historyQuerySchema = z.object({
  id: z.string().uuid().optional(),
});

export const uploadDocTypeSchema = z.object({
  docType: docTypeSchema,
});
