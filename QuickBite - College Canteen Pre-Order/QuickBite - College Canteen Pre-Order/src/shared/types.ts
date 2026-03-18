import z from "zod";

export const FoodItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  image_url: z.string().nullable(),
  is_available: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type FoodItem = z.infer<typeof FoodItemSchema>;

export const CreateFoodItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  image_url: z.string().optional().nullable().or(z.literal("")),
  is_available: z.boolean().optional(),
});

export type CreateFoodItemInput = z.infer<typeof CreateFoodItemSchema>;

export const UpdateFoodItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  image_url: z.string().optional().nullable().or(z.literal("")),
  is_available: z.boolean().optional(),
});

export type UpdateFoodItemInput = z.infer<typeof UpdateFoodItemSchema>;

export const OrderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  food_item_id: z.number(),
  food_item_name: z.string(),
  quantity: z.number(),
  price_at_time: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: z.number(),
  user_id: z.string(),
  user_email: z.string(),
  user_name: z.string().optional(),
  status: z.string(),
  total_price: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Order = z.infer<typeof OrderSchema>;

export const CreateOrderSchema = z.object({
  items: z.array(z.object({
    food_item_id: z.number(),
    quantity: z.number().int().positive(),
  })).min(1),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const UserRoleSchema = z.object({
  id: z.number(),
  user_id: z.string(),
  role: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type UserRole = z.infer<typeof UserRoleSchema>;
