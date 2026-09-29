// Your business name, shown above the "Sales Dashboard" title in the header and on the sign in
// screen. Set VITE_BRAND_NAME in your .env file, for example:
//
//   VITE_BRAND_NAME=Bright Fitness
//
// Leave it out and it just says "Sales Dashboard" with no name above it.

export const BRAND_NAME: string = (import.meta.env.VITE_BRAND_NAME ?? '').trim()
