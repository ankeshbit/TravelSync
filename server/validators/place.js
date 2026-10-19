const { z } = require('zod');

const createPlaceSchema = z.object({
  name: z.string().trim().min(1, 'Place name is required').max(150, 'Place name must be 150 characters or fewer'),
  address: z.string().trim().max(300, 'Address must be 300 characters or fewer').optional().default(''),
  lat: z.coerce.number().min(-90, 'lat must be >= -90').max(90, 'lat must be <= 90').default(0),
  lng: z.coerce.number().min(-180, 'lng must be >= -180').max(180, 'lng must be <= 180').default(0),
  dayNumber: z.coerce.number().int().min(1, 'dayNumber must be >= 1').default(1),
  orderIndex: z.coerce.number().int().min(0, 'orderIndex must be >= 0').optional().default(0),
  category: z.string().trim().max(50, 'Category must be 50 characters or fewer').optional().default('attraction'),
  duration: z.coerce.number().min(0, 'duration must be >= 0').optional().default(60),
  note: z.string().trim().max(2000, 'note must be 2000 characters or fewer').optional().default('')
});

const updatePlaceNoteSchema = z.object({
  note: z.string().trim().max(2000, 'note must be 2000 characters or fewer').optional().default('')
});

const reorderPlaceItemSchema = z.object({
  placeId: z.string().trim().min(1).optional(),
  id: z.string().trim().min(1).optional(),
  dayNumber: z.coerce.number().int().min(1, 'dayNumber must be >= 1'),
  orderIndex: z.coerce.number().int().min(0, 'orderIndex must be >= 0')
}).refine(item => Boolean(item.placeId || item.id), {
  message: 'placeId or id is required'
}).transform(item => ({
  placeId: item.placeId || item.id,
  dayNumber: item.dayNumber,
  orderIndex: item.orderIndex
}));

const reorderPlacesSchema = z.union([
  z.array(reorderPlaceItemSchema),
  z.object({
    places: z.array(reorderPlaceItemSchema)
  }).transform(data => data.places)
]);

module.exports = {
  createPlaceSchema,
  updatePlaceNoteSchema,
  reorderPlacesSchema
};
